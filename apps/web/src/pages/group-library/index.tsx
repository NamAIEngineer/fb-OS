import { useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Col, Empty, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, Typography } from 'antd';
import { FolderAddOutlined, ReloadOutlined, UserAddOutlined } from '@ant-design/icons';
import type { PublicGroup } from './api';
import { fetchPublicGroups, joinGroup, saveGroupCollection } from './api';

const { Text, Title } = Typography;

export interface GroupLibraryPageProps {
  onQuickJoin?: (group: PublicGroup) => void;
}

export function GroupLibraryPage({ onQuickJoin }: GroupLibraryPageProps) {
  const [keyword, setKeyword] = useState('');
  const [topic, setTopic] = useState('');
  const [minMembers, setMinMembers] = useState<number>();
  const [maxMembers, setMaxMembers] = useState<number>();
  const [minPostsPerDay, setMinPostsPerDay] = useState<number>();
  const [approvalRequired, setApprovalRequired] = useState<boolean>();
  const [groups, setGroups] = useState<PublicGroup[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [collectionName, setCollectionName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [quickJoinGroup, setQuickJoinGroup] = useState<PublicGroup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(() => ({ keyword, topic, minMembers, maxMembers, minPostsPerDay, approvalRequired }), [keyword, topic, minMembers, maxMembers, minPostsPerDay, approvalRequired]);

  async function refresh() {
    setLoading(true); setError(null);
    try { setGroups(await fetchPublicGroups(filters)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được thư viện nhóm'); }
    finally { setLoading(false); }
  }

  async function saveCollection() {
    if (!collectionName.trim() || !selected.length) { setError('Chọn nhóm và nhập tên bộ sưu tập'); return; }
    try { await Promise.all(selected.map((groupId) => saveGroupCollection({ name: collectionName.trim(), groupId }))); setCollectionName(''); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không lưu được bộ sưu tập'); }
  }

  async function quickJoin() {
    if (!quickJoinGroup) return;
    if (!accountId.trim()) { setError('Vui lòng nhập ID tài khoản trước khi tham gia nhanh'); return; }
    try {
      await joinGroup({ accountId: accountId.trim(), groupIdOrUrl: quickJoinGroup.id, questionAnswers: [], delayFromSeconds: 10, delayToSeconds: 10 });
      setQuickJoinGroup(null); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Tham gia nhóm thất bại'); }
  }

  const columns = [
    { title: 'Tên nhóm', dataIndex: 'name', key: 'name', render: (name: string, group: PublicGroup) => <Space direction="vertical" size={0}><Text strong>{name}</Text><Text type="secondary" style={{ fontSize: 12 }}>{group.uid}</Text></Space> },
    { title: 'TV nhóm', dataIndex: 'memberCount', key: 'memberCount', sorter: (a: PublicGroup, b: PublicGroup) => a.memberCount - b.memberCount, render: (value: number) => value.toLocaleString('vi-VN') },
    { title: 'Bài/ngày', dataIndex: 'postsPerDay', key: 'postsPerDay', sorter: (a: PublicGroup, b: PublicGroup) => a.postsPerDay - b.postsPerDay },
    { title: 'TV mới', dataIndex: 'newMembersLastDay', key: 'newMembersLastDay', render: (value?: number) => value ?? '—' },
    { title: 'Duyệt bài', dataIndex: 'approvalRequired', key: 'approvalRequired', render: (value: boolean) => value ? <Tag color="gold">Có</Tag> : <Tag color="green">Không</Tag> },
    { title: 'Thao tác', key: 'actions', render: (_: unknown, group: PublicGroup) => <Button size="small" type="primary" icon={<UserAddOutlined />} onClick={() => { setQuickJoinGroup(group); onQuickJoin?.(group); }}>Tham gia nhanh</Button> },
  ];

  return <div className="page-card">
    <Title level={2} className="page-title">Thư viện nhóm</Title>
    <Text type="secondary">Tìm kiếm và lưu metadata public: tên, UID, thành viên, hoạt động và trạng thái duyệt bài.</Text>
    {error && <Alert style={{ marginTop: 16 }} type="warning" showIcon message={error} />}
    <Card size="small" style={{ marginTop: 20 }}>
      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}><Input placeholder="Tìm từ khóa" value={keyword} onChange={(event) => setKeyword(event.target.value)} onPressEnter={refresh} /></Col>
        <Col xs={24} md={6}><Input placeholder="Chủ đề" value={topic} onChange={(event) => setTopic(event.target.value)} /></Col>
        <Col xs={12} md={5}><InputNumber min={0} style={{ width: '100%' }} placeholder="TV tối thiểu" value={minMembers} onChange={(value) => setMinMembers(value ?? undefined)} /></Col>
        <Col xs={12} md={5}><InputNumber min={0} style={{ width: '100%' }} placeholder="Bài/ngày tối thiểu" value={minPostsPerDay} onChange={(value) => setMinPostsPerDay(value ?? undefined)} /></Col>
        <Col xs={24} md={6}><Select allowClear style={{ width: '100%' }} placeholder="Duyệt bài" value={approvalRequired} onChange={setApprovalRequired} options={[{ value: true, label: 'Có duyệt bài' }, { value: false, label: 'Không duyệt bài' }]} /></Col>
        <Col xs={24} md={18}><Space wrap><Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={refresh}>Tìm kiếm</Button><Button icon={<FolderAddOutlined />} disabled={!selected.length} onClick={saveCollection}>Lưu bộ sưu tập</Button><Input value={collectionName} onChange={(event) => setCollectionName(event.target.value)} placeholder="Tên bộ sưu tập" style={{ width: 190 }} /></Space></Col>
      </Row>
    </Card>
    <Card size="small" title={`${selected.length} nhóm đã chọn`} style={{ marginTop: 20 }}>
      {groups.length ? <Table rowKey="id" loading={loading} columns={columns} dataSource={groups} rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys.map(String)) }} pagination={{ pageSize: 10 }} scroll={{ x: 860 }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không tìm thấy nhóm" />}
    </Card>
    <Modal title={`Tham gia nhanh · ${quickJoinGroup?.name ?? ''}`} open={!!quickJoinGroup} onCancel={() => setQuickJoinGroup(null)} onOk={quickJoin} okText="Tham gia" cancelText="Hủy">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text type="secondary">Thao tác dùng MockExecutor trong local E2E; live gate yêu cầu nick clone Nam và nhóm test riêng.</Text>
        <Input value={accountId} onChange={(event) => setAccountId(event.target.value)} placeholder="ID tài khoản Facebook" addonBefore="Tài khoản" />
      </Space>
    </Modal>
  </div>;
}

export default GroupLibraryPage;

