import { useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Input, InputNumber, List, Row, Space, Statistic, Tag, Typography } from 'antd';
import { PlayCircleOutlined, StopOutlined } from '@ant-design/icons';
import type { GroupJoinStatus, JoinResult, PublicGroup } from '../group-library/api';
import { fetchPublicGroups, joinGroup } from '../group-library/api';

const { Text, Title } = Typography;

type JoinRow = {
  id: string;
  groupId: string;
  groupName: string;
  status: GroupJoinStatus | 'running' | 'error';
  receiptId?: string;
  reason?: string;
};

const statusLabel: Record<JoinRow['status'], string> = {
  joined: 'Đã vào',
  pending: 'Chờ duyệt',
  rejected: 'Từ chối',
  running: 'Đang chạy',
  error: 'Lỗi',
};

const statusColor: Record<JoinRow['status'], string> = {
  joined: 'green',
  pending: 'gold',
  rejected: 'red',
  running: 'blue',
  error: 'red',
};

function parseIds(value: string): string[] {
  return [...new Set(value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))];
}

function answerRows(value: string): { question: string; answer: string }[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf('=');
      return separator < 0
        ? { question: line, answer: '' }
        : { question: line.slice(0, separator).trim(), answer: line.slice(separator + 1).trim() };
    });
}

export interface JoinGroupPageProps {
  /** Optional host callback for route adapters that already own group joining. */
  onJoined?: (result: JoinResult) => void;
  /** Account IDs remain user supplied; this field is never persisted as a credential. */
  defaultAccountId?: string;
}

export function JoinGroupPage({ onJoined, defaultAccountId = '' }: JoinGroupPageProps) {
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [groupIds, setGroupIds] = useState('');
  const [answers, setAnswers] = useState('');
  const [fromSec, setFromSec] = useState(30);
  const [toSec, setToSec] = useState(60);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<JoinRow[]>([]);
  const [groups, setGroups] = useState<PublicGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const ids = useMemo(() => parseIds(groupIds), [groupIds]);
  const stats = useMemo(() => ({
    joined: rows.filter((row) => row.status === 'joined').length,
    pending: rows.filter((row) => row.status === 'pending').length,
    rejected: rows.filter((row) => row.status === 'rejected').length,
  }), [rows]);

  async function loadLibrary() {
    setError(null);
    try {
      setGroups(await fetchPublicGroups());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được danh sách nhóm');
    }
  }

  function selectLibraryGroup(group: PublicGroup) {
    if (!ids.includes(group.id)) setGroupIds((value) => `${value.trim()}${value.trim() ? '\n' : ''}${group.id}`);
  }

  async function start() {
    setError(null);
    if (!accountId.trim()) { setError('Vui lòng nhập ID tài khoản'); return; }
    if (!ids.length) { setError('Vui lòng nhập ít nhất một ID nhóm'); return; }
    if (fromSec < 10 || toSec < fromSec) { setError('Khoảng cách tối thiểu là 10 giây và Đến phải lớn hơn hoặc bằng Từ'); return; }
    const templateAnswers = answerRows(answers);
    if (templateAnswers.some((entry) => !entry.question || !entry.answer)) { setError('Mỗi câu hỏi phải có dạng Câu hỏi = Câu trả lời'); return; }
    setRunning(true);
    cancelRef.current = false;
    setRows(ids.map((groupId, index) => ({ id: `${groupId}-${index}`, groupId, groupName: groups.find((group) => group.id === groupId)?.name ?? groupId, status: 'running' })));
    for (const groupId of ids) {
      if (cancelRef.current) break;
      try {
        const result = await joinGroup({ accountId: accountId.trim(), groupIdOrUrl: groupId, questionAnswers: templateAnswers, delayFromSeconds: fromSec, delayToSeconds: toSec });
        setRows((current) => current.map((row) => row.groupId === groupId ? { ...row, status: result.status, receiptId: result.receipt.id, reason: result.receipt.reason } : row));
        onJoined?.(result);
      } catch (cause) {
        setRows((current) => current.map((row) => row.groupId === groupId ? { ...row, status: 'error', reason: cause instanceof Error ? cause.message : 'Tham gia nhóm thất bại' } : row));
      }
    }
    setRunning(false);
  }

  function stop() {
    cancelRef.current = true;
    setRunning(false);
  }

  return <div className="page-card">
    <Title level={2} className="page-title">Tham gia nhóm</Title>
    <Text type="secondary">Nhập danh sách UID hoặc link nhóm public. Trả lời câu hỏi theo mẫu, theo dõi trạng thái và receipt MockExecutor.</Text>
    {error && <Alert style={{ marginTop: 16 }} type="warning" showIcon message={error} />}
    <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
      <Col xs={24} lg={12}>
        <Card title="Danh sách uid" bordered>
          <Input.TextArea value={groupIds} onChange={(event) => setGroupIds(event.target.value)} placeholder="Mỗi dòng một group ID" autoSize={{ minRows: 8, maxRows: 14 }} />
          <Space direction="vertical" size={6} style={{ width: '100%', marginTop: 16 }}>
            <Input value={accountId} onChange={(event) => setAccountId(event.target.value)} placeholder="ID tài khoản Facebook" addonBefore="Tài khoản" />
            <Text strong>Câu hỏi theo mẫu</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>Mỗi dòng: Câu hỏi = Câu trả lời</Text>
            <Input.TextArea value={answers} onChange={(event) => setAnswers(event.target.value)} placeholder="Bạn biết nhóm từ đâu? = Tìm thấy qua thư viện public" rows={4} />
          </Space>
          <Row gutter={12} style={{ marginTop: 16 }}>
            <Col span={12}><Text type="secondary">Từ (giây)</Text><InputNumber min={10} value={fromSec} onChange={(value) => setFromSec(value ?? 10)} style={{ width: '100%' }} /></Col>
            <Col span={12}><Text type="secondary">Đến (giây)</Text><InputNumber min={10} value={toSec} onChange={(value) => setToSec(value ?? fromSec)} style={{ width: '100%' }} /></Col>
          </Row>
          <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>(Chạy 1 lần 1 nhóm, tối thiểu 10 giây/lần)</Text>
          <Space style={{ marginTop: 18 }}>
            {running ? <Button danger icon={<StopOutlined />} onClick={stop}>Dừng</Button> : <Button type="primary" icon={<PlayCircleOutlined />} onClick={start}>Bắt Đầu</Button>}
            <Button onClick={loadLibrary}>Làm mới thư viện</Button>
          </Space>
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card title="Thư viện public" bordered extra={<Button size="small" onClick={loadLibrary}>Làm mới</Button>}>
          {!groups.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu nhóm public" /> : <List size="small" dataSource={groups.slice(0, 8)} renderItem={(group) => <List.Item actions={[<Button key="choose" size="small" onClick={() => selectLibraryGroup(group)}>Chọn</Button>]}><List.Item.Meta title={group.name} description={`${group.memberCount.toLocaleString('vi-VN')} thành viên · ${group.postsPerDay} bài/ngày`} /></List.Item>} />}
        </Card>
        <Card title="Kết quả" bordered style={{ marginTop: 20 }}>
          <Space wrap>
            <Statistic title="Đã vào" value={stats.joined} />
            <Statistic title="Chờ duyệt" value={stats.pending} />
            <Statistic title="Từ chối" value={stats.rejected} />
          </Space>
          {rows.length ? <List style={{ marginTop: 16 }} size="small" dataSource={rows} renderItem={(row) => <List.Item><Space direction="vertical" size={0}><Space><Text strong>{row.groupName}</Text><Tag color={statusColor[row.status]}>{statusLabel[row.status]}</Tag></Space><Text type="secondary" style={{ fontSize: 12 }}>{row.reason ?? row.receiptId ?? ''}</Text></Space></List.Item>} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa chạy chiến dịch" />}
        </Card>
      </Col>
    </Row>
  </div>;
}

export function LeaveAfterPostToggle({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  return <Space><Text>Rời nhóm sau khi đăng</Text><Button type={enabled ? 'primary' : 'default'} size="small" onClick={() => onChange(!enabled)}>{enabled ? 'Bật' : 'Tắt'}</Button></Space>;
}

export default JoinGroupPage;

