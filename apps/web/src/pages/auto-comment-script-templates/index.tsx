import { useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Input, List, Modal, Space, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import type { AutoCommentScript } from '../../../../../packages/shared/contracts-interactions';

const { Text, Title } = Typography;
function read(): AutoCommentScript[] { try { const raw = localStorage.getItem('grouppilot_auto_comment_scripts'); const value = raw ? JSON.parse(raw) as AutoCommentScript[] : []; return value; } catch { return []; } }

export function AutoCommentScriptTemplatesPage(): JSX.Element {
  const [items, setItems] = useState<AutoCommentScript[]>(read);
  const [search, setSearch] = useState('');
  const [renameId, setRenameId] = useState<string>();
  const [rename, setRename] = useState('');
  const [message, setMessage] = useState<string>();
  const filtered = useMemo(() => items.filter((item) => !search || item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) || item.keywords.some((keyword) => keyword.toLocaleLowerCase().includes(search.toLocaleLowerCase()))), [items, search]);
  function persist(next: AutoCommentScript[]) { setItems(next); localStorage.setItem('grouppilot_auto_comment_scripts', JSON.stringify(next)); }
  function remove(id: string) { persist(items.filter((item) => item.id !== id)); setMessage('Đã xóa mẫu'); }
  function confirmRename() { if (!renameId || !rename.trim()) return; persist(items.map((item) => item.id === renameId ? { ...item, name: rename.trim(), updatedAt: new Date().toISOString() } : item)); setRenameId(undefined); setRename(''); setMessage('Đã đổi tên mẫu'); }
  function create() { const script: AutoCommentScript = { id: `local_${Date.now()}`, name: 'Mẫu mới', keywords: ['xin chào'], tabContents: [{ tab: 1, text: 'Xin chào!', mediaRefs: [] }], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; persist([script, ...items]); setMessage('Đã tạo mẫu mới'); }
  return <main className="page-card"><Title level={2} className="page-title">Thư viện kịch bản</Title><Text type="secondary">Quản lý mẫu cho auto comment và tương tác Page theo từ khóa.</Text>{message && <Alert style={{ marginTop: 16 }} type="info" message={message} showIcon />}<Card size="small" style={{ marginTop: 16 }}><Space wrap><Input.Search placeholder="Tìm theo tên hoặc từ khóa" value={search} onChange={(event) => setSearch(event.target.value)} /><Button type="primary" icon={<PlusOutlined />} onClick={create}>Tạo mẫu</Button></Space></Card><Card size="small" title={`${filtered.length} mẫu`} style={{ marginTop: 16 }}>{filtered.length ? <List dataSource={filtered} renderItem={(item) => <List.Item actions={[<Button size="small" icon={<EditOutlined />} onClick={() => { setRenameId(item.id); setRename(item.name); }}>Sửa tên</Button>, <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(item.id)} />]}><List.Item.Meta title={item.name} description={<Space wrap>{item.keywords.map((keyword) => <Tag key={keyword}>{keyword}</Tag>)}<Text type="secondary">{item.tabContents.length} tab</Text></Space>} /></List.Item>} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có mẫu nào" />}</Card><Modal open={!!renameId} title="Đổi tên mẫu" okText="Lưu" cancelText="Hủy" onOk={confirmRename} onCancel={() => setRenameId(undefined)}><Input value={rename} onChange={(event) => setRename(event.target.value)} /></Modal></main>;
}

export default AutoCommentScriptTemplatesPage;
