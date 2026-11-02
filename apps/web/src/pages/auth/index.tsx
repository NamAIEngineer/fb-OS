import { useState } from 'react';
import { Button, Form, Input, Typography, message } from 'antd';
import { Link, useNavigate } from 'react-router-dom';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const register = mode === 'register';
  const submit = async (values: Record<string, string>) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/auth/${register ? 'register' : 'login'}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Không thể xác thực');
      localStorage.setItem('grouppilot_token', body.token); localStorage.setItem('grouppilot_user', body.user.username);
      message.success(register ? 'Đăng ký thành công' : 'Đăng nhập thành công'); navigate('/post');
    } catch (error) { message.error(error instanceof Error ? error.message : 'Không thể xác thực'); } finally { setLoading(false); }
  };
  return <div className="auth-wrap"><div className="page-card"><Typography.Title level={2}>{register ? 'Tạo tài khoản' : 'Đăng nhập'}</Typography.Title><Typography.Paragraph type="secondary">{register ? 'Bắt đầu với GroupPilot.' : 'Chào mừng trở lại GroupPilot.'}</Typography.Paragraph>
    <Form layout="vertical" onFinish={submit} requiredMark={false}>
      {register && <Form.Item name="username" label="Tên người dùng" rules={[{ required: true, message: 'Vui lòng nhập tên người dùng' }]}><Input autoComplete="username" /></Form.Item>}
      <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Email không hợp lệ' }]}><Input autoComplete="email" /></Form.Item>
      <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: register ? 8 : 1, message: register ? 'Mật khẩu tối thiểu 8 ký tự' : 'Vui lòng nhập mật khẩu' }]}><Input.Password autoComplete={register ? 'new-password' : 'current-password'} /></Form.Item>
      <Button type="primary" htmlType="submit" block loading={loading}>{register ? 'Đăng ký' : 'Đăng nhập'}</Button>
    </Form><Typography.Paragraph style={{ marginTop: 20, textAlign: 'center' }}>{register ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}<Link to={register ? '/login' : '/register'}>{register ? 'Đăng nhập' : 'Đăng ký'}</Link></Typography.Paragraph>
  </div></div>;
}
