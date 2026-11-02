import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Typography } from 'antd';

type Affiliate = { referralCode: string; clicks: number; commissions: number };
export function AffiliatePage() {
  const [profile, setProfile] = useState<Affiliate | null>(null);
  useEffect(() => { const token = localStorage.getItem('grouppilot_token'); if (token) fetch('/api/affiliate/profile', { headers: { authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : null).then(setProfile); }, []);
  return <div><Typography.Title level={2} className="page-title">Kiếm tiền</Typography.Title><Row gutter={[18, 18]}><Col xs={24} md={8}><Card><Statistic title="Mã giới thiệu" value={profile?.referralCode ?? 'Đang tải'} /></Card></Col><Col xs={24} md={8}><Card><Statistic title="Lượt truy cập" value={profile?.clicks ?? 0} /></Card></Col><Col xs={24} md={8}><Card><Statistic title="Hoa hồng" value={profile?.commissions ?? 0} suffix="đ" /></Card></Col></Row></div>;
}
