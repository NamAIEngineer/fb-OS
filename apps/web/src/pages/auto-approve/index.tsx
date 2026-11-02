import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Checkbox, Col, Empty, List, Row, Space, Spin, Switch, Tag, Typography } from 'antd';
import { CheckCircleOutlined, StopOutlined } from '@ant-design/icons';
import type { PublicGroup } from '../group-library/api';
import { configureAutoApprove, fetchPublicGroups, runAutoApprove } from '../group-library/api';

const { Text, Title } = Typography;

type RunResult = { groupId: string; approvedRequestIds: string[]; skippedRequestIds: string[]; receipt?: { id: string; reason?: string } };

export interface AutoApprovePageProps { defaultAccountId?: string; }

export function AutoApprovePage({ defaultAccountId = '' }: AutoApprovePageProps) {
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [groups, setGroups] = useState<PublicGroup[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [approveSpam, setApproveSpam] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RunResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const managedGroups = useMemo(() => groups.filter((group) => group.isAdminOrModerator), [groups]);

  async function refreshGroups() {
    setLoading(true); setError(null);
    try { setGroups(await fetchPublicGroups()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được nhóm quản trị'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refreshGroups(); }, []);

  async function start() {
    if (!accountId.trim()) { setError('Vui lòng nhập ID tài khoản'); return; }
    if (!selectedGroupIds.length) { setError('Vui lòng chọn ít nhất một nhóm'); return; }
    setRunning(true); setError(null); setResults([]);
    cancelRef.current = false;
    try {
      for (const groupId of selectedGroupIds) {
        if (cancelRef.current) break;
        await configureAutoApprove({ groupId, enabled, approveSuspectedSpam: approveSpam });
        const result = await runAutoApprove(groupId, accountId.trim());
        setResults((current) => [...current, result]);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Duyệt thành viên thất bại'); }
    finally { setRunning(false); }
  }

  function stop() {
    cancelRef.current = true;
    setRunning(false);
  }

  return <div className="page-card">
    <Title level={2} className="page-title">Auto duyệt bài</Title>
    <Text type="secondary">Duyệt thành viên chờ ở nhóm mình làm admin/mod. Chỉ lưu trạng thái moderation, không lưu hồ sơ cá nhân.</Text>
    {error && <Alert style={{ marginTop: 16 }} type="warning" showIcon message={error} />}
    <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
      <Col xs={24} lg={12}>
        <Card title="Cấu hình" bordered>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <label><Text type="secondary">ID tài khoản Facebook</Text><input value={accountId} onChange={(event) => setAccountId(event.target.value)} placeholder="ID tài khoản" style={{ display: 'block', width: '100%', height: 40, border: '1px solid #d9d9d9', borderRadius: 6, padding: '0 11px', marginTop: 5 }} /></label>
            <Space style={{ justifyContent: 'space-between', width: '100%' }}><Text>Auto duyệt đang bật</Text><Switch checked={enabled} onChange={setEnabled} /></Space>
            <Space style={{ justifyContent: 'space-between', width: '100%' }}><Text>Duyệt cả Nghi ngờ Spam (Nguy hiểm):</Text><Switch checked={approveSpam} disabled={running} onChange={setApproveSpam} /></Space>
            <Text type="secondary" style={{ fontSize: 12 }}>(Duyệt 1 lần/1 bài chờ, tối thiểu 10 giây/lần)</Text>
            {running ? <Button danger icon={<StopOutlined />} onClick={stop}>Dừng</Button> : <Button type="primary" icon={<CheckCircleOutlined />} onClick={start}>Bắt Đầu Duyệt Mọi Người</Button>}
          </Space>
        </Card>
        <Card title="Receipt" bordered style={{ marginTop: 20 }}>
          {results.length ? <List size="small" dataSource={results} renderItem={(result) => <List.Item><Space direction="vertical" size={0}><Space><Tag color="green">{result.approvedRequestIds.length} đã duyệt</Tag><Tag color={result.skippedRequestIds.length ? 'gold' : 'default'}>{result.skippedRequestIds.length} bỏ qua</Tag></Space><Text type="secondary" style={{ fontSize: 12 }}>{result.receipt?.id} · {result.receipt?.reason ?? 'mock'}</Text></Space></List.Item>} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa chạy" />}
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card title="Nhóm quản trị" bordered extra={<Button size="small" onClick={refreshGroups}>Làm mới</Button>}>
          {loading ? <Spin /> : managedGroups.length ? <Checkbox.Group value={selectedGroupIds} onChange={(values) => setSelectedGroupIds(values.map(String))} style={{ width: '100%' }}><Space direction="vertical" style={{ width: '100%' }}>{managedGroups.map((group) => <Checkbox key={group.id} value={group.id}><Space direction="vertical" size={0}><Text strong>{group.name}</Text><Text type="secondary" style={{ fontSize: 12 }}>{group.memberCount.toLocaleString('vi-VN')} thành viên · {group.postsPerDay} bài/ngày</Text></Space></Checkbox>)}</Space></Checkbox.Group> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có nhóm admin/mod public" />}
        </Card>
      </Col>
    </Row>
  </div>;
}

export default AutoApprovePage;

