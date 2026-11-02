import { useEffect, useState } from 'react';
import { Card, Descriptions, Spin, Tag, Typography } from 'antd';
import type { PublicUser } from '@grouppilot/shared';

export function ProfilePage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  useEffect(() => { const token = localStorage.getItem('grouppilot_token'); if (token) fetch('/api/users/me', { headers: { authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : null).then(setUser); }, []);
  if (!user) return <Spin />;
  return <div><Typography.Title level={2} className="page-title">Trang cá nhân</Typography.Title><Card><Descriptions column={1} bordered><Descriptions.Item label="Username">{user.username}</Descriptions.Item><Descriptions.Item label="Email">{user.email}</Descriptions.Item><Descriptions.Item label="Vai trò"><Tag color={user.role === 'admin' ? 'gold' : 'blue'}>{user.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}</Tag></Descriptions.Item><Descriptions.Item label="Trạng thái"><Tag color={user.isActive ? 'green' : 'red'}>{user.isActive ? 'Đang hoạt động' : 'Đã khóa'}</Tag></Descriptions.Item><Descriptions.Item label="Gói hiện tại">{user.plan?.name ?? 'Chưa có gói'}</Descriptions.Item><Descriptions.Item label="Hết hạn">{user.hasActivePlan ? (user.planExpiresAt ? `Còn ${user.daysRemaining} ngày` : 'Vĩnh viễn') : '—'}</Descriptions.Item><Descriptions.Item label="Số nick tối đa">{user.effectiveMaxAccounts || '—'}</Descriptions.Item></Descriptions></Card></div>;
}
