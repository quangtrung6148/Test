import type { AuthError, Session, User } from '@supabase/supabase-js';
import type { Env } from '../config/env.js';
import { createSupabase } from '../config/supabase.js';
import { AppError } from '../middleware/errors.js';
import type { AuthResult, AuthService } from '../types.js';

function fail(error: AuthError | null, fallbackStatus = 401): never {
  const status = error?.status ?? 503;
  if (status === 429) throw new AppError(429, 'AUTH_RATE_LIMIT', 'Bạn đã thử quá nhiều lần. Vui lòng đợi rồi thử lại.');
  if (!status || status >= 500) throw new AppError(503, 'AUTH_UNAVAILABLE', 'Dịch vụ tài khoản tạm thời không khả dụng.');
  if (error?.code === 'email_not_confirmed') throw new AppError(403, 'EMAIL_NOT_CONFIRMED', 'Vui lòng xác nhận email trước khi đăng nhập.');
  if (error?.code === 'weak_password') throw new AppError(400, 'WEAK_PASSWORD', 'Mật khẩu chưa đáp ứng yêu cầu. Hãy chọn mật khẩu mạnh hơn.');
  if (error?.code === 'signup_disabled') throw new AppError(403, 'SIGNUP_DISABLED', 'Đăng ký tài khoản đang tạm đóng.');
  throw new AppError(fallbackStatus, 'AUTH_FAILED', fallbackStatus === 400
    ? 'Không thể đăng ký. Vui lòng kiểm tra email và mật khẩu.'
    : 'Email, mật khẩu hoặc phiên đăng nhập không hợp lệ.');
}

function result(user: User | null, session: Session | null): AuthResult {
  return {
    user: user ? { id: user.id, email: user.email ?? '' } : null,
    session: session ? {
      access_token: session.access_token, refresh_token: session.refresh_token,
      expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
    } : null,
    confirmation_required: !session,
  };
}

export class SupabaseAuthService implements AuthService {
  constructor(private readonly env: Env) {}

  // Each operation has its own client: signing in must never replace the
  // service-role session of the shared database client or another request.
  async register(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await createSupabase(this.env).auth.signUp({
      email, password, options: { emailRedirectTo: this.env.FRONTEND_URL },
    });
    if (error) fail(error, 400);
    return result(data.user, data.session);
  }
  async login(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await createSupabase(this.env).auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) fail(error);
    return result(data.user, data.session);
  }
  async refresh(refreshToken: string): Promise<AuthResult> {
    const { data, error } = await createSupabase(this.env).auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.user || !data.session) fail(error);
    return result(data.user, data.session);
  }
  async user(accessToken: string) {
    // getUser validates the token with Supabase Auth; no unverified JWT decode.
    const { data, error } = await createSupabase(this.env).auth.getUser(accessToken);
    if (error || !data.user) fail(error);
    return { id: data.user.id, email: data.user.email ?? '' };
  }
  async logout(accessToken: string): Promise<void> {
    const { error } = await createSupabase(this.env).auth.admin.signOut(accessToken, 'local');
    if (error) fail(error);
  }
}
