import { Router } from 'express';
import { taskControllers } from '../controllers/tasks.js';
import { serviceAuth } from '../middleware/service-auth.js';
import type { AuthService, TaskStore } from '../types.js';
import { userAuth } from '../middleware/user-auth.js';

export function taskRoutes(store: TaskStore, key: string, auth: AuthService): Router {
  const router = Router();
  const handlers = taskControllers(store);
  router.get('/tasks', userAuth(auth), handlers.list);
  router.post('/tasks', userAuth(auth), handlers.create);
  router.patch('/tasks/:id', userAuth(auth), handlers.complete);
  router.get('/internal/tasks/pending', serviceAuth(key), handlers.pending);
  return router;
}
