import type { RequestHandler } from 'express';
import type { AccountUser, AuthService } from '../types.js';
import { AppError } from './errors.js';

export function accessToken(header: string | undefined): string {
  const match = header?.match(/^Bearer ([^\s]+)$/);
  if (!match?.[1] || match[1].length > 8192) {
    throw new AppError(401, 'LOGIN_REQUIRED', 'Vui lòng đăng nhập để sử dụng công việc.');
  }
  return match[1];
}

export function userAuth(auth: AuthService): RequestHandler {
  return async (req, res, next) => {
    const token = accessToken(req.get('authorization'));
    res.locals.user = await auth.user(token);
    next();
  };
}

export function currentUser(locals: Record<string, unknown>): AccountUser {
  const user = locals.user as AccountUser | undefined;
  if (!user?.id) throw new AppError(401, 'LOGIN_REQUIRED', 'Vui lòng đăng nhập.');
  return user;
}
