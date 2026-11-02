import { useEffect, useState } from 'react';
import { Button, Card, Spin, Typography, message } from 'antd';
import { PLANS, BRAND_NAME, type Plan } from '@grouppilot/shared';

const apiBase = '';
const money = (value: number) => `${value.toLocaleString('vi-VN')}đ`;

export function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>(PLANS);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true);
    fetch(`${apiBase}/api/plans`).then((r) => r.ok ? r.json() : Promise.reject(new Error('plans unavailable')))
      .then((data: Plan[]) => setPlans(data)).catch(() => message.info('Đang hiển thị bảng giá mặc định; API chưa sẵn sàng.')).finally(() => setLoading(false));
  }, []);
  const checkout = async (plan: Plan) => {
    const token = localStorage.getItem('grouppilot_token');
    if (!token) { message.info('Đăng nhập để thanh toán qua QR'); window.location.assign('/login'); return; }
    const response = await fetch(`${apiBase}/api/payments/create-qr`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ planCode: plan.code }) });
    if (!response.ok) { message.error('Không tạo được QR'); return; }
    const payment = await response.json();
    message.success(`QR mock đã tạo: ${payment.paymentId}`);
  };
  return <div className="pricing-page">
    <div className="pricing-heading"><Typography.Title level={1}>Bảng giá</Typography.Title><Typography.Paragraph>Chọn gói {BRAND_NAME} phù hợp với quy mô vận hành.</Typography.Paragraph></div>
    {loading ? <Spin /> : <div className="pricing-grid">{plans.map((plan) => <article className={`plan-card${plan.isRecommended ? ' recommended' : ''}`} key={plan.code}>
      {plan.isRecommended && <div className="plan-ribbon">ĐỀ XUẤT</div>}
      <div className="plan-header"><span className="plan-name">{plan.name}</span><span className="plan-lifetime">Vĩnh viễn</span></div>
      <div className="plan-price">{money(plan.priceLifetime)}</div>
      <div className="plan-description">{plan.description}</div>
      <ul className="plan-features">{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
      <div className="plan-footer"><Button type="primary" block onClick={() => void checkout(plan)}>Thanh toán qua QR</Button></div>
    </article>)}</div>}
  </div>;
}
