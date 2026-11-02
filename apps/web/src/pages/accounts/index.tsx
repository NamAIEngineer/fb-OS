import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Input, InputNumber, List, Modal, Space, Spin, Statistic, Tag, Typography, message } from 'antd';
import { DeleteOutlined, PlusOutlined, ReloadOutlined, SettingOutlined, SyncOutlined } from '@ant-design/icons';
import type { AccountRecord, DailyLimits } from '../../../../api/src/accounts/types';
import { listAccounts, reconcileStatuses, removeAccount, syncAccount, updateAccountLimits } from './api';

const { Text, Title } = Typography;

const quotaFields: { key: keyof DailyLimits; label: string }[] = [
  { key: 'post', label: 'Đăng bài' },
  { key: 'comment', label: 'Bình luận' },
  { key: 'message', label: 'Nhắn tin' },
  { key: 'addFriend', label: 'Kết bạn' },
  { key: 'interact', label: 'Tương tác' },
  { key: 'joinGroup', label: 'Tham gia nhóm' },
];

export interface AccountsPageProps {
  /** Optional fixture API, useful for MockExecutor E2E without external effects. */
  api?: Pick<typeof defaultApi, 'list' | 'sync' | 'reconcile' | 'remove' | 'limits'>;
}

const defaultApi = {
  list: listAccounts,
  sync: syncAccount,
  reconcile: reconcileStatuses,
  remove: removeAccount,
  limits: updateAccountLimits,
};

function statusLabel(status: AccountRecord['status']): string {
  return status === 'active' ? 'Đang hoạt động' : status === 'disconnected' ? 'Mất kết nối' : status === 'pending' ? 'Đang chờ' : 'Chưa rõ';
}

function statusColor(status: AccountRecord['status']): string {
  return status === 'active' ? 'green' : status === 'disconnected' ? 'red' : status === 'pending' ? 'gold' : 'default';
}

function AccountLimitsModal({
  account,
  open,
  onClose,
  onSave,
}: {
  account: AccountRecord | null;
  open: boolean;
  onClose: () => void;
  onSave: (limits: DailyLimits) => Promise<void>;
}) {
  const [limits, setLimits] = useState<DailyLimits>(account?.dailyLimits ?? {} as DailyLimits);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (account) setLimits({ ...account.dailyLimits }); }, [account]);
  async function save() {
    if (!account) return;
    setSaving(true);
    try { await onSave(limits); onClose(); } finally { setSaving(false); }
  }
  return <Modal open={open} title="Cài đặt giới hạn hàng ngày" onCancel={onClose} onOk={() => void save()} confirmLoading={saving} okText="Lưu" cancelText="Hủy" width={880}>
    {account && <Space direction="vertical" style={{ width: '100%' }} size={14}>
      <Space><Text strong>{account.name}</Text><Text type="secondary">({account.uid})</Text></Space>
      <div className="accounts-limit-grid">
        {quotaFields.map(({ key, label }) => <label key={key}><Text type="secondary">{label}</Text><InputNumber min={0} value={limits[key]} onChange={(value) => setLimits((current) => ({ ...current, [key]: value ?? 0 }))} style={{ width: '100%' }} /></label>)}
      </div>
    </Space>}
  </Modal>;
}

export function AccountsPage({ api = defaultApi }: AccountsPageProps) {
  const [items, setItems] = useState<AccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AccountRecord | null>(null);
  const [limitsAccount, setLimitsAccount] = useState<AccountRecord | null>(null);
  const [uid, setUid] = useState('');
  const [name, setName] = useState('');

  async function refresh() {
    setLoading(true); setError(null);
    try { setItems((await api.list()).items); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được tài khoản'); } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  async function addAccount() {
    if (!uid.trim() || !name.trim()) { message.warning('Vui lòng nhập UID và tên tài khoản'); return; }
    setSyncing(true);
    try {
      const result = await api.sync({ uid: uid.trim(), name: name.trim(), status: 'active' });
      if (result.account) setItems((current) => [...current.filter((row) => row.id !== result.account?.id), result.account!]);
      setUid(''); setName(''); message.success('Đồng bộ tài khoản thành công');
    } catch (cause) { message.error(cause instanceof Error ? cause.message : 'Đồng bộ tài khoản thất bại'); } finally { setSyncing(false); }
  }

  async function reconcile() {
    if (!items.length) return;
    setSyncing(true);
    try {
      const receipt = await api.reconcile(items.map((item) => ({ uid: item.uid, valid: item.status !== 'disconnected', status: item.status, name: item.name, avatar: item.avatar })));
      setItems(receipt.results); message.success('Đã cập nhật trạng thái tài khoản');
    } catch (cause) { message.error(cause instanceof Error ? cause.message : 'Không cập nhật được trạng thái'); } finally { setSyncing(false); }
  }

  async function deleteAccount(account: AccountRecord) {
    Modal.confirm({ title: 'Xóa tài khoản này?', content: account.name, okText: 'Xóa', cancelText: 'Hủy', okType: 'danger', onOk: async () => { await api.remove(account.id); setItems((current) => current.filter((row) => row.id !== account.id)); } });
  }

  async function saveLimits(account: AccountRecord, limits: DailyLimits) {
    const updated = await api.limits(account.id, limits);
    setItems((current) => current.map((row) => row.id === updated.id ? updated : row));
    message.success('Đã lưu giới hạn');
  }

  const activeCount = useMemo(() => items.filter((item) => item.status === 'active').length, [items]);
  return <div className="accounts-page">
    <Space align="baseline" style={{ width: '100%', justifyContent: 'space-between' }}>
      <div><Title level={2} className="page-title">Tài khoản</Title><Text type="secondary">Gắn tài khoản Facebook bất kỳ; trạng thái được đồng bộ qua profile app-owned.</Text></div>
      <Space><Statistic title="Nick active" value={activeCount} /><Button icon={<ReloadOutlined />} onClick={() => void refresh()} loading={loading}>Làm mới</Button><Button icon={<SyncOutlined />} onClick={() => void reconcile()} loading={syncing}>Đồng bộ</Button></Space>
    </Space>
    {error && <Alert style={{ marginTop: 16 }} type="warning" showIcon message={error} />}
    <Card title={<Space><PlusOutlined />Thêm tài khoản</Space>} style={{ marginTop: 20 }}>
      <Space wrap>
        <Input placeholder="UID Facebook" value={uid} onChange={(event) => setUid(event.target.value)} aria-label="UID Facebook" />
        <Input placeholder="Tên tài khoản" value={name} onChange={(event) => setName(event.target.value)} aria-label="Tên tài khoản" />
        <Button type="primary" onClick={() => void addAccount()} loading={syncing}>Đồng bộ tài khoản</Button>
      </Space>
      <Text type="secondary" style={{ display: 'block', marginTop: 10 }}>Đăng nhập facebook.com trên profile riêng rồi đồng bộ. Không lưu cookie hoặc token.</Text>
    </Card>
    <Card title={`Tài khoản đã gắn (${items.length})`} style={{ marginTop: 20 }}>
      {loading ? <Spin /> : items.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có tài khoản" /> : <List dataSource={items} rowKey="id" renderItem={(account) => <List.Item actions={[<Button key="limits" type="text" icon={<SettingOutlined />} onClick={() => setLimitsAccount(account)}>Cài đặt giới hạn</Button>, <Button key="delete" danger type="text" icon={<DeleteOutlined />} onClick={() => void deleteAccount(account)}>Xóa</Button>]}>
        <List.Item.Meta avatar={<div className="accounts-avatar">{account.name.slice(0, 1).toUpperCase()}</div>} title={<Space>{account.name}<Tag color={statusColor(account.status)}>{statusLabel(account.status)}</Tag></Space>} description={<Space direction="vertical" size={0}><Text type="secondary">UID: {account.uid}</Text><Text type="secondary">Đồng bộ: {account.lastSyncedAt ? new Date(account.lastSyncedAt).toLocaleString('vi-VN') : 'Chưa có'}</Text></Space>} />
      </List.Item>} />}
    </Card>
    <AccountLimitsModal account={limitsAccount} open={Boolean(limitsAccount)} onClose={() => setLimitsAccount(null)} onSave={(limits) => limitsAccount ? saveLimits(limitsAccount, limits) : Promise.resolve()} />
    {selected && <Text>{selected.name}</Text>}
  </div>;
}

export default AccountsPage;
