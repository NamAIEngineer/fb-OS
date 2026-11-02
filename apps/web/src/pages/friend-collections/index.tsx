import { useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Input, List, Space, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import type { FriendRecord } from '../../../../../packages/shared/contracts-interactions';

const { Text, Title } = Typography;
type FriendCollection = { id: string; name: string; friendIds: string[]; createdAt: string };
const fallbackFriends: FriendRecord[] = [
  { uid: 'mock_friend_1', name: 'Bạn bè mẫu 1', commentCount: 2 },
  { uid: 'mock_friend_2', name: 'Bạn bè mẫu 2', likeCount: 1 },
  { uid: 'mock_friend_3', name: 'Bạn bè mẫu 3', messageCount: 1 },
];
function read<T>(key: string, fallback: T): T { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } }

export function FriendCollectionsPage(): JSX.Element {
  const [friends, setFriends] = useState<FriendRecord[]>(() => read('grouppilot_interact_friends', fallbackFriends));
  const [collections, setCollections] = useState<FriendCollection[]>(() => read('grouppilot_friend_collections', []));
  const [selected, setSelected] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string>();
  const visible = useMemo(() => friends.filter((friend) => !query || friend.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()) || friend.uid.includes(query)), [friends, query]);
  function load() { setFriends(read('grouppilot_interact_friends', fallbackFriends)); setMessage('Đã làm mới danh sách bạn bè từ bộ nhớ cục bộ'); }
  function save() {
    const value = name.trim();
    if (!value || !selected.length) { setMessage('Chọn ít nhất một bạn bè và nhập tên bộ sưu tập'); return; }
    const next = [{ id: activeId ?? `local_${Date.now()}`, name: value, friendIds: selected, createdAt: new Date().toISOString() }, ...collections.filter((item) => item.id !== activeId)];
    setCollections(next); localStorage.setItem('grouppilot_friend_collections', JSON.stringify(next)); setName(''); setActiveId(undefined); setMessage('Đã lưu bộ sưu tập');
  }
  function selectCollection(collection: FriendCollection) { setActiveId(collection.id); setName(collection.name); setSelected(collection.friendIds); }
  function remove(id: string) { const next = collections.filter((item) => item.id !== id); setCollections(next); localStorage.setItem('grouppilot_friend_collections', JSON.stringify(next)); if (activeId === id) { setActiveId(undefined); setName(''); setSelected([]); } }
  return <main className="page-card"><Title level={2} className="page-title">Bộ sưu tập bạn bè</Title><Text type="secondary">Lưu nhóm bạn bè đã chọn để dùng lại trong /interact. Không có CSV hoặc xuất dữ liệu cá nhân.</Text>{message && <Alert style={{ marginTop: 16 }} type="info" message={message} showIcon />}<Card size="small" style={{ marginTop: 16 }}><Space wrap><Input placeholder="Tên bộ sưu tập" value={name} onChange={(event) => setName(event.target.value)} /><Button type="primary" icon={<SaveOutlined />} onClick={save}>Lưu</Button><Button icon={<ReloadOutlined />} onClick={load}>Tải bạn bè</Button></Space>{collections.length ? <List size="small" style={{ marginTop: 12 }} dataSource={collections} renderItem={(item) => <List.Item actions={[<Button size="small" onClick={() => selectCollection(item)}>Chọn</Button>, <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(item.id)} />]}><Space><Tag color={item.id === activeId ? 'blue' : 'default'}>{item.friendIds.length}</Tag><Text>{item.name}</Text></Space></List.Item>} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có bộ sưu tập" />}</Card><Card size="small" title={`${selected.length} bạn bè đã chọn`} style={{ marginTop: 16 }}><Input.Search placeholder="Tìm kiếm" value={query} onChange={(event) => setQuery(event.target.value)} style={{ maxWidth: 320, marginBottom: 12 }} /><Table rowKey="uid" size="small" dataSource={visible} columns={[{ title: 'Bạn bè', dataIndex: 'name', render: (value: string, row: FriendRecord) => <Space direction="vertical" size={0}><Text strong>{value}</Text><Text type="secondary">{row.uid}</Text></Space> }, { title: 'Bình luận', dataIndex: 'commentCount', render: (value?: number) => value ?? '—' }, { title: 'Tương tác', dataIndex: 'likeCount', render: (value?: number) => value ?? '—' }, { title: 'Nhắn tin', dataIndex: 'messageCount', render: (value?: number) => value ?? '—' }]} rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys.map(String)) }} pagination={{ pageSize: 10 }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có danh sách bạn bè" /> }} /></Card></main>;
}

export default FriendCollectionsPage;
