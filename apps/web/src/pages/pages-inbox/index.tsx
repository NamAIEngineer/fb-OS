import { useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Input, List, Radio, Space, Tag, Typography } from 'antd';
import { LikeOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons';
import type { PageComment } from '../../../../../packages/shared/contracts-interactions';

const { Text, Title } = Typography;
const seed: PageComment[] = [
  { pageId: 'mock-page', postId: 'mock-post-1', commentId: 'mock-comment-1', text: 'Xin báo giá', createdAt: new Date().toISOString() },
  { pageId: 'mock-page', postId: 'mock-post-1', commentId: 'mock-comment-2', text: 'Cho mình thông tin', createdAt: new Date().toISOString() },
];
function read(): PageComment[] { try { const raw = localStorage.getItem('grouppilot_page_comments'); return raw ? JSON.parse(raw) as PageComment[] : seed; } catch { return seed; } }

export function PagesInboxPage(): JSX.Element {
  const [pageId, setPageId] = useState('mock-page');
  const [comments, setComments] = useState<PageComment[]>(read);
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState<'reply' | 'like'>('reply');
  const [reply, setReply] = useState('');
  const [keyword, setKeyword] = useState('');
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const visible = useMemo(() => comments.filter((comment) => !keyword || comment.text.toLocaleLowerCase().includes(keyword.toLocaleLowerCase())), [comments, keyword]);
  async function run() {
    if (!selected.length) { setError('Chọn ít nhất một bình luận'); return; }
    if (action === 'reply' && !reply.trim()) { setError('Nhập nội dung trả lời'); return; }
    setError(undefined); setMessage(undefined);
    const receipts = selected.map((commentId) => ({ receiptId: `mock_${Date.now()}_${commentId}`, accountId: 'mock-account', pageId, commentId, action, status: 'success' as const, executor: 'mock' as const, externalSideEffect: false as const, createdAt: new Date().toISOString() }));
    try {
      const response = await fetch('/api/pages/comments/keyword-script', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accountId: 'mock-account', pageId, action, comments: comments.filter((comment) => selected.includes(comment.commentId)), scripts: [{ id: 'local-page-script', name: 'Page script', keywords: [''], tabContents: [{ tab: 1, text: reply, mediaRefs: [] }], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] }) });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      setMessage('Đã tạo receipt cho tương tác Page');
    } catch { setMessage(`Đã chạy MockExecutor · ${receipts.length} receipt · externalSideEffect=false`); }
  }
  return <main className="page-card"><Title level={2} className="page-title">Tương tác KH trên Page</Title><Text type="secondary">Chọn Page quản lý, lọc bình luận theo từ khóa, trả lời hoặc like. Live gate yêu cầu tài khoản clone.</Text>{error && <Alert style={{ marginTop: 16 }} type="error" message={error} showIcon />}{message && <Alert style={{ marginTop: 16 }} type="info" message={message} showIcon />}<Card size="small" style={{ marginTop: 16 }}><Space wrap><Input addonBefore="Page" value={pageId} onChange={(event) => setPageId(event.target.value)} /><Input.Search placeholder="Tìm bình luận" value={keyword} onChange={(event) => setKeyword(event.target.value)} /><Button icon={<ReloadOutlined />} onClick={() => { setComments(read()); setMessage('Đã tải bình luận mock'); }}>Làm mới</Button></Space></Card><Card size="small" title={`${selected.length} bình luận đã chọn`} style={{ marginTop: 16 }}><List dataSource={visible} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có bình luận" /> }} renderItem={(comment) => <List.Item><List.Item.Meta avatar={<input type="checkbox" checked={selected.includes(comment.commentId)} onChange={(event) => setSelected((items) => event.target.checked ? [...items, comment.commentId] : items.filter((id) => id !== comment.commentId))} />} title={comment.text} description={<Space><Tag>{comment.commentId}</Tag><Text type="secondary">{comment.createdAt ? new Date(comment.createdAt).toLocaleString('vi-VN') : '—'}</Text></Space>} /></List.Item>} /></Card><Card size="small" title="Kịch bản từ khóa" style={{ marginTop: 16 }}><Radio.Group value={action} onChange={(event) => setAction(event.target.value)} optionType="button" buttonStyle="solid" options={[{ value: 'reply', label: <><SendOutlined /> Trả lời</> }, { value: 'like', label: <><LikeOutlined /> Like</> }]} />{action === 'reply' && <Input.TextArea rows={4} style={{ marginTop: 12 }} placeholder="Nội dung trả lời..." value={reply} onChange={(event) => setReply(event.target.value)} />}<Button type="primary" style={{ marginTop: 12 }} onClick={() => void run()}>Bắt đầu</Button></Card></main>;
}

export default PagesInboxPage;
