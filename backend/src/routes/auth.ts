import { Router } from 'express';
import { z } from 'zod';
import type { AuthService } from '../types.js';
import { accessToken, currentUser, userAuth } from '../middleware/user-auth.js';

const email = z.string().trim().pipe(z.email().max(254));
const registerInput = z.strictObject({ email, password: z.string().min(8).max(128) });
const loginInput = z.strictObject({ email, password: z.string().min(1).max(128) });

export function authRoutes(auth: AuthService): Router {
  const router = Router();
  router.post('/register', async (req, res) => {
    const input = registerInput.parse(req.body);
    res.status(201).json({ data: await auth.register(input.email, input.password) });
  });
  router.post('/login', async (req, res) => {
    const input = loginInput.parse(req.body);
    res.json({ data: await auth.login(input.email, input.password) });
  });
  router.post('/refresh', async (req, res) => {
    const input = z.strictObject({ refresh_token: z.string().min(1).max(8192) }).parse(req.body);
    res.json({ data: await auth.refresh(input.refresh_token) });
  });
  router.get('/me', userAuth(auth), (_req, res) => { res.json({ data: currentUser(res.locals) }); });
  router.post('/logout', userAuth(auth), async (req, res) => {
    await auth.logout(accessToken(req.get('authorization')));
    res.json({ data: { signed_out: true } });
  });
  return router;
}
