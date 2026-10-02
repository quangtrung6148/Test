import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Dữ liệu không hợp lệ.' } });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof Error && 'type' in error) {
    if (error.type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'INVALID_JSON', message: 'JSON không hợp lệ.' } });
      return;
    }
    if (error.type === 'entity.too.large') {
      res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Dữ liệu gửi lên quá lớn.' } });
      return;
    }
  }
  // Never log error objects or response bodies which could contain credentials.
  console.error(JSON.stringify({ event: 'request_failed', code: 'INTERNAL_ERROR' }));
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Có lỗi xảy ra. Vui lòng thử lại.' } });
};
