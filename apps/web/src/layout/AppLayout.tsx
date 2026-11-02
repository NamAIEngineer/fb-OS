import { BellOutlined, GiftOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Badge, Button, Layout, Menu, Space, Tag, Typography } from 'antd';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BRAND_NAME } from '@grouppilot/shared';

const { Header, Sider, Content } = Layout;
const menuItems = [
  { key: '/post', label: 'Đăng bài' },
  { key: '/accounts', label: 'Tài khoản' },
  { key: '/join-group', label: 'Tham gia nhóm' },
  { key: '/bump', label: 'Úp bài' },
  { key: '/interact', label: 'Tương tác' },
  { key: '/auto-comment', label: 'Bình luận dạo' },
  { key: '/auto-approve', label: 'Tự duyệt' },
  { key: '/affiliate', label: 'Kiếm tiền' }
];

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem('grouppilot_token');
  const userName = localStorage.getItem('grouppilot_user') || 'Người dùng';
  const logout = () => { localStorage.removeItem('grouppilot_token'); localStorage.removeItem('grouppilot_user'); navigate('/login'); };
  return <Layout className="app-shell">
    <Sider width={230} breakpoint="lg" collapsedWidth="0" className="app-sider">
      <Link to="/post" className="app-brand">{BRAND_NAME}<small>social workspace</small></Link>
      <Menu mode="inline" selectedKeys={[location.pathname]} items={menuItems} onClick={({ key }) => navigate(key)} />
      <div style={{ position: 'absolute', bottom: 20, left: 22, right: 22 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Hướng dẫn sử dụng · Câu hỏi thường gặp</Typography.Text>
      </div>
    </Sider>
    <Layout className="app-main">
      <Header className="app-header">
        <span className="health-dot" id="api-health">API đang kiểm tra</span>
        <Badge count={0}><BellOutlined style={{ fontSize: 18, color: '#64748b' }} /></Badge>
        <Tag color="blue">{token ? 'PRO · Vĩnh viễn' : 'Chưa có gói'}</Tag>
        <Button size="small" icon={<GiftOutlined />} onClick={() => navigate('/plans')}>Mua gói</Button>
        <Button size="small" icon={<UserOutlined />} onClick={() => navigate('/profile')}>{userName}</Button>
        {token && <Button size="small" type="text" icon={<LogoutOutlined />} onClick={logout} aria-label="Đăng xuất" />}
      </Header>
      <Content className="app-content"><Outlet /></Content>
    </Layout>
  </Layout>;
}
