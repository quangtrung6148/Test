import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { AppError } from './errors.js';

export function serviceAuth(key: string): RequestHandler {
  const expected = Buffer.from(`Bearer ${key}`);
  return (req, _res, next) => {
    const actual = Buffer.from(req.get('authorization') ?? '');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      next(new AppError(401, 'UNAUTHORIZED', 'Service API key không hợp lệ.'));
      return;
    }
    next();
  };
}
