import { useState } from 'react';
import { Alert, Button, Card, Empty, Input, List, Space, Tag, Typography, Upload } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, SaveOutlined, UploadOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;
type CommentCollection = { id: string; name: string; comments: { text: string; mediaRefs: string[] }[]; createdAt: string };
function read(): CommentCollection[] { try { const raw = localStorage.getItem('grouppilot_comment_collections'); return raw ? JSON.parse(raw) as CommentCollection[] : []; } catch { return []; } }

export function CommentCollectionsPage(): JSX.Element {
  const [items, setItems] = useState<CommentCollection[]>(read);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [media, setMedia] = useState<string[]>([]);
  const [message, setMessage] = useState<string>();
  const persist = (next: CommentCollection[]) => { setItems(next); localStorage.setItem('grouppilot_comment_collections', JSON.stringify(next)); };
  function save() { if (!name.trim() || !text.trim()) { setMessage('Nhập tên bộ sưu tập và nội dung bình luận'); return; } persist([{ id: `local_${Date.now()}`, name: name.trim(), comments: [{ text: text.trim(), mediaRefs: media }], createdAt: new Date().toISOString() }, ...items]); setName(''); setText(''); setMedia([]); setMessage('Đã lưu bộ sưu tập bình luận'); }
  function remove(id: string) { persist(items.filter((item) => item.id !== id)); setMessage('Đã xóa bộ sưu tập'); }
  return <main className="page-card"><Title level={2} className="page-title">Bộ sưu tập bình luận</Title><Text type="secondary">Lưu nội dung bình luận và ảnh dùng trong 8 tab tương tác/auto comment.</Text>{message && <Alert style={{ marginTop: 16 }} type="info" message={message} showIcon />}<Card size="small" title="Tạo bộ sưu tập" style={{ marginTop: 16 }}><Space direction="vertical" style={{ width: '100%' }}><Input placeholder="Tên bộ sưu tập" value={name} onChange={(event) => setName(event.target.value)} /><Input.TextArea rows={4} placeholder="Nội dung bình luận..." value={text} onChange={(event) => setText(event.target.value)} /><Upload beforeUpload={() => false} maxCount={4} onChange={({ fileList }) => setMedia(fileList.map((file) => file.name))}><Button icon={<UploadOutlined />}>Thêm ảnh</Button></Upload><Button type="primary" icon={<SaveOutlined />} onClick={save}>Lưu bộ sưu tập</Button></Space></Card><Card size="small" title={`${items.length} bộ sưu tập`} style={{ marginTop: 16 }}>{items.length ? <List dataSource={items} renderItem={(item) => <List.Item actions={[<Button size="small" icon={<EditOutlined />} onClick={() => { const first = item.comments[0]; setName(item.name); setText(first?.text ?? ''); setMedia(first?.mediaRefs ?? []); }}>Sửa</Button>, <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(item.id)} />]}><List.Item.Meta title={item.name} description={<Space direction="vertical"><Text>{item.comments[0]?.text ?? '—'}</Text><Tag>{item.comments[0]?.mediaRefs.length ?? 0} ảnh</Tag></Space>} /></List.Item>} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có bộ sưu tập" />}</Card><Button type="dashed" icon={<PlusOutlined />} style={{ marginTop: 16 }} onClick={() => { setName(''); setText(''); setMedia([]); }}>Tạo mới</Button></main>;
}

export default CommentCollectionsPage;
