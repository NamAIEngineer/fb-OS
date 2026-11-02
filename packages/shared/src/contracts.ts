export const BRAND_NAME = 'GroupPilot';

export type PlanCode = 'basic' | 'plus' | 'pro';

export type Plan = {
  code: PlanCode;
  name: 'BASIC' | 'PLUS' | 'PRO';
  priceLifetime: number;
  maxAccounts: number;
  isRecommended?: boolean;
  description: string;
  features: string[];
};

export type PublicUser = {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  isActive: boolean;
  plan: Plan | null;
  hasActivePlan: boolean;
  planExpiresAt: string | null;
  daysRemaining: number | null;
  effectiveMaxAccounts: number;
};

export type ApiEnvelope<T> = { data: T; error?: never } | { data?: never; error: string };

export type AuthResponse = { token: string; user: PublicUser };

export type PaymentQr = {
  paymentId: string;
  planCode: PlanCode;
  amount: number;
  qrPayload: string;
  status: 'pending' | 'paid' | 'expired';
};

export type HealthResponse = {
  ok: true;
  service: 'grouppilot-api';
  persistence: 'sqlite';
  socket: 'socket.io';
  time: string;
};

export const PLAN_FEATURES: Record<PlanCode, string[]> = {
  basic: [
    'Dùng 3 Acc Facebook',
    'Đăng bài (2 chế độ — REA: UNKNOWN)',
    'Xáo trộn thứ tự ảnh, clip',
    'Phát hiện Spam, đăng chậm, dừng',
    'Thời gian đăng ngẫu nhiên (Từ/Đến)',
    'Tắt đăng bài lên Marketplace',
    'Lưu bộ sưu tập nhóm yêu thích',
    'Lưu bài đã đăng',
    'Lưu tạm nội dung (draft)',
    'Cài đặt giới hạn hàng ngày'
  ],
  plus: [
    'Tất cả tính năng BASIC',
    'Đăng bài (5 chế độ — REA: UNKNOWN)',
    'Đăng bài lên tường / trang cá nhân',
    'Đăng bài có phông nền',
    'Đăng clip (MP4 ≤500MB)',
    'Xóa bài chờ duyệt, đã đăng',
    'Bình luận dạo',
    'Chia sẻ link',
    'Úp bài đã đăng',
    'Đăng vào nhóm thông qua bài trên trang cá nhân',
    'Xuất báo cáo'
  ],
  pro: [
    'Tất cả tính năng PLUS',
    'Dùng với 3 tài khoản Facebook cá nhân',
    'Tham gia nhóm và trả lời câu hỏi theo mẫu',
    'Rời nhóm hàng loạt',
    'Thư viện nhóm public',
    'Tag @nêu bật, @mọi người',
    'Kết bạn thành viên mới vào nhóm',
    'Lọc tương tác',
    'Tương tác bạn bè trang cá nhân',
    'Tương tác khách hàng trên Page'
  ]
};

export const PLANS: Plan[] = [
  {
    code: 'basic',
    name: 'BASIC',
    priceLifetime: 1_000_000,
    maxAccounts: 3,
    description: 'UNKNOWN — mô tả gói từ REA chưa xác định.',
    features: PLAN_FEATURES.basic
  },
  {
    code: 'plus',
    name: 'PLUS',
    priceLifetime: 1_500_000,
    maxAccounts: 5,
    description: 'UNKNOWN — mô tả gói từ REA chưa xác định.',
    features: PLAN_FEATURES.plus
  },
  {
    code: 'pro',
    name: 'PRO',
    priceLifetime: 2_000_000,
    maxAccounts: 5,
    isRecommended: true,
    description: 'UNKNOWN — mô tả gói từ REA chưa xác định.',
    features: PLAN_FEATURES.pro
  }
];

export const PLAN_RANK: Record<PlanCode, number> = { basic: 1, plus: 2, pro: 3 };

export function hasPlanAccess(current: PlanCode | null | undefined, required: PlanCode): boolean {
  if (!current) return false;
  return PLAN_RANK[current] >= PLAN_RANK[required];
}
