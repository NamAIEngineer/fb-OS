import { useEffect, useState } from 'react';
import { Card, Col, Divider, Empty, Input, Row, Space, Switch, Typography, Button } from 'antd';
import { InfoCircleOutlined, PlusOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AppLayout } from '../layout';
import { PlansPage } from '../pages/plans';
import { AuthPage } from '../pages/auth';
import { ProfilePage } from '../pages/profile';
import { AffiliatePage } from '../pages/affiliate';

function HomePage({ title, description }: { title: string; description: string }) {
  return <div>
    <Typography.Title level={2} className="page-title">{title}</Typography.Title>
    <Row gutter={[18, 18]}>
      <Col xs={24} lg={16}><Card title={<Space><span>Tài khoản</span><Button type="text" icon={<PlusOutlined />} /><InfoCircleOutlined /><SettingOutlined /><ReloadOutlined /></Space>}>
        <Typography.Text type="secondary">Tài khoản Facebook gắn với phiên làm việc riêng.</Typography.Text><Divider />
        <Card type="inner" title={description}><Input.TextArea rows={5} placeholder="Nội dung sẽ được nối vào module theo checklist và REA evidence." />
          <Space style={{ marginTop: 16 }} wrap><Button>Thư viện mẫu</Button><Button icon={<ReloadOutlined />}>Làm mới</Button><Button type="primary">Bắt đầu</Button></Space>
        </Card>
      </Card></Col>
      <Col xs={24} lg={8}><Card title="Bộ sưu tập"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu" /></Card>
        <Card title="Tùy chọn" style={{ marginTop: 18 }}><Space direction="vertical" style={{ width: '100%' }}>
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>Né spam <Switch /></Space>
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>Tắt Marketplace <Switch defaultChecked /></Space>
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>Rời nhóm sau khi đăng <Switch /></Space>
        </Space></Card>
      </Col>
    </Row>
  </div>;
}

function HealthProbe() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'offline'>('checking');
  useEffect(() => {
    fetch('/api/health').then((response) => response.ok ? setStatus('ok') : setStatus('offline')).catch(() => setStatus('offline'));
  }, []);
  useEffect(() => {
    const element = document.getElementById('api-health');
    if (!element) return;
    element.textContent = status === 'ok' ? 'API sẵn sàng' : status === 'offline' ? 'API chưa kết nối' : 'API đang kiểm tra';
    element.classList.toggle('ok', status === 'ok');
  }, [status]);
  return null;
}

function GuardedApp() {
  const navigate = useNavigate();
  useEffect(() => {
    const publicPaths = ['/plans', '/login', '/register'];
    if (!localStorage.getItem('grouppilot_token') && !publicPaths.includes(window.location.pathname)) navigate('/login', { replace: true });
  }, [navigate]);
  return <><HealthProbe /><Routes>
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/plans" element={<PlansPage />} />
    <Route element={<AppLayout />}>
      <Route path="/post" element={<HomePage title="Đăng bài" description="Màn đăng bài đang được REA phân tích theo từng biến thể." />} />
      <Route path="/accounts" element={<HomePage title="Tài khoản" description="Gắn tài khoản Facebook bất kỳ; giới hạn số nick được kiểm tra phía server theo gói." />} />
      <Route path="/join-group" element={<HomePage title="Tham gia nhóm" description="Nhập UID hoặc link nhóm, trả lời câu hỏi theo mẫu và theo dõi trạng thái." />} />
      <Route path="/bump" element={<HomePage title="Úp bài" description="Quản lý số lần úp cho chiến dịch đã đăng." />} />
      <Route path="/interact" element={<HomePage title="Tương tác" description="Các thao tác bạn bè và bộ lọc tương tác sẽ nối vào executor." />} />
      <Route path="/auto-comment" element={<HomePage title="Bình luận dạo" description="Kịch bản bình luận theo từ khóa; chi tiết hành vi gốc: UNKNOWN." />} />
      <Route path="/auto-approve" element={<HomePage title="Tự duyệt" description="Duyệt thành viên chờ trong nhóm do người dùng quản trị." />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/affiliate" element={<AffiliatePage />} />
      <Route path="*" element={<Navigate to="/post" replace />} />
    </Route>
  </Routes></>;
}

export function AppRouter() { return <BrowserRouter><GuardedApp /></BrowserRouter>; }
