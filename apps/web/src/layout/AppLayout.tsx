import {
  AppstoreOutlined,
  BellOutlined,
  BookOutlined,
  DollarOutlined,
  GiftOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
  TeamOutlined,
  UserOutlined,
  UsergroupAddOutlined,
  ThunderboltOutlined,
  CommentOutlined,
  SearchOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { Avatar, Badge, Button, Layout, Menu, Tag, Typography } from 'antd';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BRAND_NAME } from '@grouppilot/shared';

const { Header, Sider, Content } = Layout;
const menuItems = [
  { key: '/post', label: 'Đăng bài & Bình luận', icon: <CommentOutlined /> },
  { key: '/join-group', label: 'Tham gia nhóm', icon: <UsergroupAddOutlined /> },
  { key: '/bump', label: 'Úp bài', icon: <ThunderboltOutlined /> },
  { key: '/interact', label: 'Tương tác', icon: <AppstoreOutlined /> },
  { key: '/auto-comment', label: 'Auto comment', icon: <CommentOutlined /> },
  { key: '/auto-approve', label: 'Auto duyệt bài', icon: <CheckCircleOutlined /> },
  { key: '/search-customers', label: 'Tìm kiếm khách hàng', icon: <SearchOutlined /> },
  { key: '/accounts', label: 'Tài khoản Facebook', icon: <UserOutlined /> },
];

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem('grouppilot_token');
  const userName = localStorage.getItem('grouppilot_user') || 'Người dùng';
  const logout = () => { localStorage.removeItem('grouppilot_token'); localStorage.removeItem('grouppilot_user'); navigate('/login'); };
  return <Layout className="app-shell">
    <Sider width={220} className="app-sider">
      <Link to="/post" className="app-brand">
        <span className="app-brand__mark" aria-hidden="true"><span /><span /><span /></span>
        <span className="app-brand__title">{BRAND_NAME}</span>
      </Link>
      <Menu mode="inline" selectedKeys={[location.pathname]} items={menuItems} onClick={({ key }) => navigate(key)} />
      <div className="app-sidebar__footer">
        <Link to="/affiliate"><DollarOutlined /> Kiếm tiền</Link>
        <a href="#guide"><BookOutlined /> Hướng dẫn sử dụng</a>
        <a href="#faq"><QuestionCircleOutlined /> Câu hỏi thường gặp</a>
      </div>
    </Sider>
    <Layout className="app-main">
      <Header className="app-header">
        <span className="health-dot" id="api-health">API đang kiểm tra</span>
        <div className="app-header__actions">
          <Badge count={0}><BellOutlined className="app-header__bell" /></Badge>
          <Button className="app-header__avatar" type="text" onClick={() => navigate('/profile')} aria-label={userName}>
            <Avatar icon={<UserOutlined />} />
          </Button>
          <Tag className="app-header__optional" color="blue">{token ? 'PRO · Vĩnh viễn' : 'Chưa có gói'}</Tag>
          <Button className="app-header__optional" size="small" icon={<GiftOutlined />} onClick={() => navigate('/plans')}>Mua gói</Button>
          {token && <Button className="app-header__optional" size="small" type="text" icon={<LogoutOutlined />} onClick={logout} aria-label="Đăng xuất" />}
        </div>
      </Header>
      <Content className="app-content"><Outlet /></Content>
    </Layout>
  </Layout>;
}
