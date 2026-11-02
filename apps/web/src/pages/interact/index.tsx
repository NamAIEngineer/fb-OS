import { useMemo, useState } from 'react';
import { Alert, Button, Card, Col, DatePicker, Empty, Input, List, Modal, Radio, Row, Select, Space, Table, Tabs, Tag, Typography, Upload } from 'antd';
import { FolderAddOutlined, ReloadOutlined, RocketOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { INTERACTION_ACTIONS, INTERACTION_FILTERS, type FriendRecord, type InteractionAction, type InteractionFilter, type MockReceipt } from '../../../../../packages/shared/contracts-interactions';

const { Text, Title } = Typography;

const actionLabels: Record<InteractionAction, string> = {
  poke: 'Chọc',
  unfriend: 'Xóa bạn',
  cancelRequest: 'Xóa lời mời kết bạn',
  comment: 'Bình luận',
  like: 'Like',
  addFriend: 'Kết bạn',
};

const filterLabels: Record<InteractionFilter, string> = {
  commented: 'Đã bình luận',
  liked: 'Đã like',
  messaged: 'Đã nhắn tin',
  lastInteraction: 'Lần tương tác cuối',
  none: 'Chưa tương tác',
};

const fallbackFriends: FriendRecord[] = [
  { uid: 'mock_friend_1', name: 'Bạn bè mẫu 1', commentCount: 2, likeCount: 0, messageCount: 0, lastInteractionAt: new Date().toISOString() },
  { uid: 'mock_friend_2', name: 'Bạn bè mẫu 2', commentCount: 0, likeCount: 1, messageCount: 0 },
  { uid: 'mock_friend_3', name: 'Bạn bè mẫu 3', commentCount: 0, likeCount: 0, messageCount: 1, lastMessageAt: new Date().toISOString() },
];

function readLocal<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}

function writeLocal(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private browsing */ }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, headers: { accept: 'application/json', ...(init?.headers ?? {}) } });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return response.json() as Promise<T>;
}

export function InteractPage(): JSX.Element {
  const [accountId, setAccountId] = useState(() => localStorage.getItem('grouppilot_interact_account') ?? 'mock-account');
  const [friends, setFriends] = useState<FriendRecord[]>(() => readLocal('grouppilot_interact_friends', fallbackFriends));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [action, setAction] = useState<InteractionAction>('like');
  const [filter, setFilter] = useState<InteractionFilter>();
  const [since, setSince] = useState<string>();
  const [activeTab, setActiveTab] = useState(1);
  const [contents, setContents] = useState<Record<number, string>>({});
  const [media, setMedia] = useState<Record<number, UploadFile[]>>({});
  const [fromSec, setFromSec] = useState(60);
  const [toSec, setToSec] = useState(120);
  const [antiSpam, setAntiSpam] = useState(false);
  const [receipts, setReceipts] = useState<MockReceipt[]>([]);
  const [collections, setCollections] = useState<{ id: string; name: string; friendIds: string[] }[]>(() => readLocal('grouppilot_friend_collections', []));
  const [collectionName, setCollectionName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  const visibleFriends = useMemo(() => friends.filter((friend) => {
    if (!filter) return true;
    if (filter === 'commented') return (friend.commentCount ?? 0) > 0;
    if (filter === 'liked') return (friend.likeCount ?? 0) > 0;
    if (filter === 'messaged') return (friend.messageCount ?? 0) > 0;
    if (filter === 'none') return !(friend.commentCount || friend.likeCount || friend.messageCount);
    if (!since) return true;
    return Boolean(friend.lastInteractionAt && Date.parse(friend.lastInteractionAt) >= Date.parse(since));
  }), [filter, friends, since]);

  async function loadFriends() {
    setLoading(true); setError(undefined); setMessage(undefined);
    localStorage.setItem('grouppilot_interact_account', accountId.trim());
    try {
      const loaded = await requestJson<FriendRecord[]>(`/interactions/friends?accountId=${encodeURIComponent(accountId.trim())}`);
      setFriends(loaded); writeLocal('grouppilot_interact_friends', loaded); setMessage('Đã tải bạn bè');
    } catch {
      setFriends(fallbackFriends); writeLocal('grouppilot_interact_friends', fallbackFriends); setMessage('Đã tải dữ liệu MockExecutor cục bộ');
    } finally { setLoading(false); }
  }

  async function runAction() {
    if (!selectedIds.length) { setError('Chọn ít nhất một bạn bè'); return; }
    if (action === 'comment' && !contents[activeTab]?.trim() && !(media[activeTab]?.length)) { setError('Nhập nội dung bình luận hoặc chọn ảnh'); return; }
    if (fromSec < 10 || toSec < fromSec) { setError('Khoảng cách phải từ 10 giây và Từ không được lớn hơn Đến'); return; }
    setLoading(true); setError(undefined); setMessage(undefined);
    const request = { accountId, action, friendIds: selectedIds, filter: filter ? { filter, since } : undefined, composers: { [activeTab]: { text: contents[activeTab] ?? '', mediaRefs: (media[activeTab] ?? []).map((file) => file.name) } }, taskBar: { fromSec, toSec, antiSpam } };
    try {
      const result = await requestJson<{ receipts: MockReceipt[] }>('/interactions/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) });
      setReceipts(result.receipts ?? []); setMessage('Đã tạo receipt MockExecutor');
    } catch {
      const now = new Date().toISOString();
      const localReceipts = selectedIds.map((targetUid) => ({ receiptId: `mock_${Date.now()}_${targetUid}`, action, accountId, targetUid, status: 'success' as const, externalSideEffect: false as const, executor: 'mock' as const, createdAt: now }));
      setReceipts(localReceipts); setMessage('Đã chạy MockExecutor cục bộ · chưa có tác động Facebook');
    } finally { setLoading(false); }
  }

  function saveCollection() {
    const name = collectionName.trim();
    if (!name || !selectedIds.length) { setError('Chọn bạn bè và nhập tên bộ sưu tập'); return; }
    const next = [{ id: `local_${Date.now()}`, name, friendIds: selectedIds }, ...collections];
    setCollections(next); writeLocal('grouppilot_friend_collections', next); setCollectionName(''); setMessage('Đã lưu bộ sưu tập bạn bè');
  }

  const columns = [
    { title: 'Bạn bè', dataIndex: 'name', key: 'name', render: (name: string, friend: FriendRecord) => <Space direction="vertical" size={0}><Text strong>{name}</Text><Text type="secondary">{friend.uid}</Text></Space> },
    { title: 'Bình luận', dataIndex: 'commentCount', key: 'commentCount', render: (value?: number) => value ?? '—' },
    { title: 'Tương tác', dataIndex: 'likeCount', key: 'likeCount', render: (value?: number) => value ?? '—' },
    { title: 'Nhắn tin', dataIndex: 'messageCount', key: 'messageCount', render: (value?: number) => value ?? '—' },
    { title: 'Tin nhắn cuối', dataIndex: 'lastMessageAt', key: 'lastMessageAt', render: (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : '—' },
  ];

  return <div className="page-card">
    <Title level={2} className="page-title">Tương tác</Title>
    <Text type="secondary">Thao tác bạn bè theo gói PRO. Local E2E dùng MockExecutor; live gate yêu cầu nick clone và nhóm test riêng.</Text>
    {error && <Alert style={{ marginTop: 16 }} type="error" showIcon message={error} />}
    {message && <Alert style={{ marginTop: 16 }} type="info" showIcon message={message} />}
    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
      <Col xs={24} lg={11}>
        <Card title="Hành động" size="small">
          <Radio.Group value={action} onChange={(event) => setAction(event.target.value)} optionType="button" buttonStyle="solid" options={INTERACTION_ACTIONS.map((value) => ({ value, label: actionLabels[value] }))} />
          {(action === 'comment' || action === 'like') && <Card type="inner" size="small" style={{ marginTop: 14 }} title="Bình luận 8 tab + ảnh">
            <Tabs activeKey={String(activeTab)} onChange={(key) => setActiveTab(Number(key))} items={Array.from({ length: 8 }, (_, index) => ({ key: String(index + 1), label: `Tab ${index + 1}`, children: <Space direction="vertical" style={{ width: '100%' }}><Input.TextArea rows={3} value={contents[index + 1] ?? ''} placeholder="Nội dung bình luận..." onChange={(event) => setContents((current) => ({ ...current, [index + 1]: event.target.value }))} /><Upload beforeUpload={() => false} maxCount={4} fileList={media[index + 1] ?? []} onChange={({ fileList }) => setMedia((current) => ({ ...current, [index + 1]: fileList }))}><Button icon={<UploadOutlined />}>Thêm ảnh</Button></Upload></Space> }))} />
          </Card>}
          <Space wrap style={{ marginTop: 14 }}><Text>Từ</Text><Input type="number" min={10} value={fromSec} onChange={(event) => setFromSec(Number(event.target.value))} style={{ width: 80 }} /><Text>Đến</Text><Input type="number" min={10} value={toSec} onChange={(event) => setToSec(Number(event.target.value))} style={{ width: 80 }} /><label><input type="checkbox" checked={antiSpam} onChange={(event) => setAntiSpam(event.target.checked)} /> Né spam</label></Space>
          <Space wrap style={{ marginTop: 14 }}><Button type="primary" icon={<RocketOutlined />} loading={loading} onClick={() => void runAction()}>Bắt đầu</Button><Button danger disabled={!receipts.length} onClick={() => setReceipts([])}>Xóa receipt</Button></Space>
        </Card>
        <Card title="Lọc tương tác" size="small" style={{ marginTop: 16 }}><Space wrap><Select allowClear placeholder="Mức tương tác" value={filter} onChange={setFilter} options={INTERACTION_FILTERS.map((value) => ({ value, label: filterLabels[value] }))} style={{ width: 180 }} />{filter === 'lastInteraction' && <DatePicker onChange={(value) => setSince(value?.toISOString())} />}<Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadFriends()}>Tải bạn bè</Button></Space></Card>
        <Card title="Bộ sưu tập bạn bè" size="small" style={{ marginTop: 16 }}><Space wrap><Input placeholder="Tên bộ sưu tập" value={collectionName} onChange={(event) => setCollectionName(event.target.value)} /><Button icon={<FolderAddOutlined />} onClick={saveCollection}>Lưu</Button></Space>{collections.length ? <List size="small" dataSource={collections} renderItem={(item) => <List.Item>{item.name} · {item.friendIds.length} bạn bè</List.Item>} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có bộ sưu tập" />}</Card>
      </Col>
      <Col xs={24} lg={13}><Card title={`${selectedIds.length} bạn bè đã chọn`} size="small"><Table rowKey="uid" size="small" loading={loading} dataSource={visibleFriends} columns={columns} rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys.map(String)) }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có danh sách bạn bè" /> }} pagination={{ pageSize: 8 }} scroll={{ x: 620 }} /></Card>{receipts.length > 0 && <Card title="Receipt MockExecutor" size="small" style={{ marginTop: 16 }}><List size="small" dataSource={receipts} renderItem={(receipt) => <List.Item><Space><Tag color="green">{receipt.status}</Tag><Text>{actionLabels[receipt.action]} · {receipt.targetUid}</Text><Text type="secondary">externalSideEffect=false</Text></Space></List.Item>} /></Card>}</Col>
    </Row>
    <Modal open={false} title="Không sử dụng live trong local E2E" onCancel={() => undefined} footer={null} />
  </div>;
}

export default InteractPage;
