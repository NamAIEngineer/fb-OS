import { useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Input, List, Row, Select, Space, Spin, Tabs, Tag, Typography, Upload } from 'antd';
import { DeleteOutlined, FolderOpenOutlined, PlusOutlined, ReloadOutlined, RocketOutlined, SaveOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import type { AutoCommentPost, AutoCommentReceipt, AutoCommentScript, CommentTabContent, EightTab } from '../../../../../packages/shared/contracts-interactions';

const { Text, Title } = Typography;

type DraftScript = AutoCommentScript & { saving?: boolean };
const emptyTabs = (): CommentTabContent[] => [{ tab: 1, text: '', mediaRefs: [] }];
const newScript = (): DraftScript => ({ id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name: 'Kịch bản mới', keywords: [], tabContents: emptyTabs(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

function readScripts(): DraftScript[] {
  try { const parsed = JSON.parse(localStorage.getItem('grouppilot_auto_comment_scripts') ?? ''); return Array.isArray(parsed) && parsed.length ? parsed : [newScript()]; } catch { return [newScript()]; }
}

function tabContent(script: DraftScript, tab: EightTab): CommentTabContent {
  return script.tabContents.find((item) => item.tab === tab) ?? { tab, text: '', mediaRefs: [] };
}

export function AutoCommentPage(): JSX.Element {
  const [scripts, setScripts] = useState<DraftScript[]>(readScripts);
  const [selectedScript, setSelectedScript] = useState(0);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [groupText, setGroupText] = useState('');
  const [fromSec, setFromSec] = useState(60);
  const [toSec, setToSec] = useState(120);
  const [antiSpam, setAntiSpam] = useState(false);
  const [receipts, setReceipts] = useState<AutoCommentReceipt[]>([]);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');

  const current = scripts[selectedScript] ?? scripts[0];
  const selectedGroups = useMemo(() => groupIds.filter(Boolean), [groupIds]);

  function updateCurrent(update: Partial<DraftScript>) {
    setScripts((items) => items.map((script, index) => index === selectedScript ? { ...script, ...update, updatedAt: new Date().toISOString() } : script));
  }

  function updateTab(tab: EightTab, update: Partial<CommentTabContent>) {
    if (!current) return;
    const next = current.tabContents.filter((item) => item.tab !== tab);
    next.push({ ...tabContent(current, tab), ...update, tab });
    next.sort((a, b) => a.tab - b.tab);
    updateCurrent({ tabContents: next });
  }

  function addScript() { setScripts((items) => [...items, newScript()]); setSelectedScript(scripts.length); }
  function removeScript() { if (scripts.length <= 1) return; setScripts((items) => items.filter((_, index) => index !== selectedScript)); setSelectedScript(Math.max(0, selectedScript - 1)); }
  function saveLocal() { localStorage.setItem('grouppilot_auto_comment_scripts', JSON.stringify(scripts)); setMessage('Đã lưu kịch bản cục bộ'); setError(undefined); }

  async function startScan() {
    if (!current?.keywords.some((keyword) => keyword.trim())) { setError('Kịch bản phải có ít nhất 1 từ khóa'); return; }
    if (!current.tabContents.some((tab) => tab.text.trim() || tab.mediaRefs.length)) { setError('Kịch bản phải có ít nhất 1 nội dung bình luận'); return; }
    const groups = groupText.split(/[,\n]/).map((value) => value.trim()).filter(Boolean);
    if (!groups.length) { setError('Chọn ít nhất một nhóm'); return; }
    if (fromSec < 10 || toSec < fromSec) { setError('Khoảng cách phải từ 10 giây và Từ không được lớn hơn Đến'); return; }
    setLoading(true); setError(undefined); setMessage(undefined); setGroupIds(groups);
    const posts: AutoCommentPost[] = groups.map((groupId, index) => ({ groupId, feedbackId: `mock_feedback_${index + 1}`, text: `${current.keywords[0]} · bài mẫu`, postUrl: `https://facebook.com/mock/${index + 1}` }));
    try {
      const response = await fetch('/api/auto-comment/scan', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ request: { accountId: 'mock-account', groupIds: groups, scriptIds: [current.id], fromSec, toSec, antiSpam }, posts }) });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const data = await response.json() as AutoCommentReceipt[];
      setReceipts(data); setMessage('Đã quét bài mới và tạo receipt');
    } catch {
      const now = new Date().toISOString();
      setReceipts(posts.map((post) => ({ receiptId: `mock_${Date.now()}_${post.groupId}`, accountId: 'mock-account', groupId: post.groupId, feedbackId: post.feedbackId, scriptId: current.id, matchedKeyword: current.keywords[0], status: 'success' as const, executor: 'mock' as const, externalSideEffect: false as const, createdAt: now })));
      setMessage('Đã quét bằng MockExecutor cục bộ · chưa có tác động Facebook');
    } finally { setLoading(false); }
  }

  if (!current) return <Empty description="Chưa có kịch bản" />;
  const visibleScripts = scripts.filter((script) => !librarySearch || script.name.toLocaleLowerCase().includes(librarySearch.toLocaleLowerCase()) || script.keywords.some((keyword) => keyword.toLocaleLowerCase().includes(librarySearch.toLocaleLowerCase())));
  return <div className="page-card">
    <Title level={2} className="page-title">Auto comment</Title>
    <Text type="secondary">Quét bài mới theo nhóm, khớp từ khóa và luân phiên nội dung bình luận 8 tab. Local E2E dùng MockExecutor.</Text>
    {error && <Alert style={{ marginTop: 16 }} type="error" showIcon message={error} />}
    {message && <Alert style={{ marginTop: 16 }} type="info" showIcon message={message} />}
    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
      <Col xs={24} lg={14}><Card size="small" title={<Space><Text strong>Kịch bản</Text><Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addScript}>Thêm kịch bản</Button></Space>} extra={<Space><Button size="small" icon={<SaveOutlined />} onClick={saveLocal}>Lưu mẫu</Button><Button size="small" icon={<FolderOpenOutlined />} onClick={() => setLibraryOpen((value) => !value)}>Thư viện</Button><Button size="small" danger icon={<DeleteOutlined />} disabled={scripts.length <= 1} onClick={removeScript}>Xóa</Button></Space>}>
        <Input value={current.name} onChange={(event) => updateCurrent({ name: event.target.value })} addonBefore="Tên" style={{ marginBottom: 12 }} />
        <Text type="secondary">Từ khóa</Text><Select mode="tags" value={current.keywords} onChange={(keywords) => updateCurrent({ keywords })} placeholder="Nhập từ khóa, Enter để thêm" style={{ width: '100%', margin: '6px 0 14px' }} />
        <Text type="secondary">Nội dung bình luận</Text>
        <Tabs activeKey="1" items={Array.from({ length: 8 }, (_, index) => { const tab = (index + 1) as EightTab; const content = tabContent(current, tab); return { key: String(tab), label: `Tab ${tab}`, children: <Space direction="vertical" style={{ width: '100%' }}><Input.TextArea rows={4} value={content.text} onChange={(event) => updateTab(tab, { text: event.target.value })} placeholder="Nội dung bình luận..." /><Upload beforeUpload={() => false} maxCount={4} fileList={content.mediaRefs.map((name, mediaIndex) => ({ uid: `${tab}-${mediaIndex}`, name, status: 'done' as const }))} onChange={({ fileList }) => updateTab(tab, { mediaRefs: fileList.map((file) => file.name) })}><Button icon={<UploadOutlined />}>Thêm ảnh</Button></Upload></Space> }; })} />
      </Card>{libraryOpen && <Card size="small" title="Thư viện kịch bản" style={{ marginTop: 16 }}><Input.Search placeholder="Tìm theo tên hoặc từ khóa" value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} style={{ marginBottom: 8 }} />{visibleScripts.length ? <List size="small" dataSource={visibleScripts} renderItem={(script) => <List.Item actions={[<Button size="small" onClick={() => { setSelectedScript(scripts.indexOf(script)); setLibraryOpen(false); }}>Áp dụng</Button>]}><Space direction="vertical" size={0}><Text strong>{script.name}</Text><Text type="secondary">{script.keywords.join(', ')}</Text></Space></List.Item>} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có mẫu nào" />}</Card>}</Col>
      <Col xs={24} lg={10}><Card size="small" title="Nhóm quét"><Input.TextArea rows={6} value={groupText} onChange={(event) => setGroupText(event.target.value)} placeholder="Mỗi dòng một UID hoặc link nhóm" /><Space wrap style={{ marginTop: 12 }}><Text>Từ</Text><Input type="number" min={10} value={fromSec} onChange={(event) => setFromSec(Number(event.target.value))} style={{ width: 76 }} /><Text>Đến</Text><Input type="number" min={10} value={toSec} onChange={(event) => setToSec(Number(event.target.value))} style={{ width: 76 }} /><label><input type="checkbox" checked={antiSpam} onChange={(event) => setAntiSpam(event.target.checked)} /> Né spam</label></Space><Button block type="primary" icon={<RocketOutlined />} loading={loading} style={{ marginTop: 14 }} onClick={() => void startScan()}>Quét bài mới</Button><Button block icon={<ReloadOutlined />} style={{ marginTop: 8 }} onClick={() => setReceipts([])}>Làm mới</Button></Card>{loading && <Spin style={{ marginTop: 16 }} />}{receipts.length > 0 && <Card size="small" title="Receipt MockExecutor" style={{ marginTop: 16 }}><List size="small" dataSource={receipts} renderItem={(receipt) => <List.Item><Space><Tag color={receipt.status === 'success' ? 'green' : 'default'}>{receipt.status}</Tag><Text>{receipt.groupId} · {receipt.matchedKeyword ?? 'không khớp'}</Text><Text type="secondary">externalSideEffect=false</Text></Space></List.Item>} /></Card>}</Col>
    </Row>
  </div>;
}

export default AutoCommentPage;
