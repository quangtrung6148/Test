import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { TaskStore } from '../types.js';
import { currentUser } from '../middleware/user-auth.js';

const createInput = z.strictObject({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(2000).default(''),
});
const updateInput = z.strictObject({ status: z.literal('completed') });

export function taskControllers(store: TaskStore): {
  list: RequestHandler; create: RequestHandler; complete: RequestHandler; pending: RequestHandler;
} {
  return {
    list: async (_req, res) => { res.json({ data: await store.list(currentUser(res.locals).id) }); },
    create: async (req, res) => {
      const input = createInput.parse(req.body);
      res.status(201).json({ data: await store.create(input, currentUser(res.locals).id) });
    },
    complete: async (req, res) => {
      const id = z.uuid().parse(req.params.id);
      updateInput.parse(req.body);
      res.json({ data: await store.complete(id, currentUser(res.locals).id) });
    },
    pending: async (_req, res) => { res.json({ data: await store.pending() }); },
  };
}
