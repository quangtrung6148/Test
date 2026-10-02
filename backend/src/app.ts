import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import type { Env } from './config/env.js';
import type { AuthService, TaskStore } from './types.js';
import { taskRoutes } from './routes/tasks.js';
import { AppError, errorHandler } from './middleware/errors.js';
import { authRoutes } from './routes/auth.js';

export function createApp(env: Pick<Env, 'FRONTEND_URL' | 'SERVICE_API_KEY'>, store: TaskStore, auth: AuthService) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin: env.FRONTEND_URL,
    methods: ['GET', 'POST', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  app.use(express.json({ limit: '16kb' }));
  app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });
  app.use('/api/v1', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api/v1/auth', authRoutes(auth));
  app.use('/api/v1', taskRoutes(store, env.SERVICE_API_KEY, auth));
  app.use((_req, _res, next) => { next(new AppError(404, 'NOT_FOUND', 'Endpoint không tồn tại.')); });
  app.use(errorHandler);
  return app;
}
