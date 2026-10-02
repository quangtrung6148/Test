import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { AppError } from '../src/middleware/errors.js';
import { SupabaseAuthService } from '../src/services/auth.js';
import type { Env } from '../src/config/env.js';
import type { AuthService, TaskStore } from '../src/types.js';

const user = { id: '0f1554dd-0440-442e-bd58-fb61918fa588', email: 'user@example.com' };
const session = { access_token: 'test-access', refresh_token: 'test-refresh', expires_at: 2_000_000_000 };
const result = { user, session, confirmation_required: false };
const auth: AuthService = { register: vi.fn(), login: vi.fn(), refresh: vi.fn(), user: vi.fn(), logout: vi.fn() };
const store: TaskStore = { list: vi.fn(), pending: vi.fn(), create: vi.fn(), complete: vi.fn() };
const env: Env = {
  NODE_ENV: 'test', PORT: 5000, FRONTEND_URL: 'http://localhost:3000',
  SERVICE_API_KEY: 'test-service-key-with-at-least-32-characters',
  SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-server-key-with-at-least-32-characters',
};
const app = createApp(env, store, auth);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth.register).mockResolvedValue(result);
  vi.mocked(auth.login).mockResolvedValue(result);
  vi.mocked(auth.refresh).mockResolvedValue(result);
  vi.mocked(auth.user).mockImplementation(async token => {
    if (token !== session.access_token) throw new AppError(401, 'AUTH_FAILED', 'Phiên không hợp lệ.');
    return user;
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('account routes and task authorization', () => {
  it('registers with trimmed email and reports confirmation requirement', async () => {
    vi.mocked(auth.register).mockResolvedValue({ user, session: null, confirmation_required: true });
    const response = await request(app).post('/api/v1/auth/register').send({ email: ` ${user.email} `, password: 'password123' });
    expect(response.status).toBe(201);
    expect(response.body.data.confirmation_required).toBe(true);
    expect(auth.register).toHaveBeenCalledWith(user.email, 'password123');
  });
  it.each([
    { email: 'invalid', password: 'password123' },
    { email: user.email, password: 'short' },
    { email: user.email, password: 'password123', user_id: user.id },
  ])('rejects invalid registration %j', async body => {
    expect((await request(app).post('/api/v1/auth/register').send(body)).status).toBe(400);
    expect(auth.register).not.toHaveBeenCalled();
  });
  it('logs in and refreshes a session', async () => {
    expect((await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'password123' })).body).toEqual({ data: result });
    expect((await request(app).post('/api/v1/auth/refresh').send({ refresh_token: session.refresh_token })).body).toEqual({ data: result });
    expect(auth.refresh).toHaveBeenCalledWith(session.refresh_token);
  });
  it('rejects invalid login and refresh payloads before calling Auth', async () => {
    expect((await request(app).post('/api/v1/auth/login').send({ email: user.email, password: '' })).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/refresh').send({ refresh_token: '', extra: true })).status).toBe(400);
    expect(auth.login).not.toHaveBeenCalled();
    expect(auth.refresh).not.toHaveBeenCalled();
  });
  it('returns verified account and logs out the supplied session', async () => {
    expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${session.access_token}`)).body).toEqual({ data: user });
    expect((await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${session.access_token}`)).body).toEqual({ data: { signed_out: true } });
    expect(auth.logout).toHaveBeenCalledWith(session.access_token);
  });
  it.each([undefined, 'Basic test-access', 'Bearer invalid', `Bearer ${env.SERVICE_API_KEY}`])('blocks private endpoints with missing/invalid token: %s', async header => {
    for (const [method, path, body] of [
      ['get', '/api/v1/tasks', undefined],
      ['post', '/api/v1/tasks', { title: 'Private' }],
      ['patch', `/api/v1/tasks/${user.id}`, { status: 'completed' }],
      ['get', '/api/v1/auth/me', undefined],
      ['post', '/api/v1/auth/logout', undefined],
    ] as const) {
      const req = request(app)[method](path);
      if (header) req.set('Authorization', header);
      if (body) req.send(body);
      expect((await req).status).toBe(401);
    }
    expect(store.list).not.toHaveBeenCalled();
    expect(store.create).not.toHaveBeenCalled();
    expect(store.complete).not.toHaveBeenCalled();
    expect(auth.logout).not.toHaveBeenCalled();
  });
  it('cannot override the owner in a task payload', async () => {
    const response = await request(app).post('/api/v1/tasks').set('Authorization', `Bearer ${session.access_token}`)
      .send({ title: 'Private', user_id: 'other-user' });
    expect(response.status).toBe(400);
    expect(store.create).not.toHaveBeenCalled();
  });
  it('propagates safe Auth failures without exposing credentials', async () => {
    vi.mocked(auth.login).mockRejectedValue(new AppError(401, 'AUTH_FAILED', 'Email hoặc mật khẩu không hợp lệ.'));
    const response = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'password123' });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_FAILED');
    expect(JSON.stringify(response.body)).not.toContain('password123');
  });
});

describe('Supabase Auth adapter with mocked HTTP', () => {
  function setup(bodies: Array<{ body: unknown; status?: number }>) {
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(async () => {
      const next = bodies.shift();
      if (!next) throw new Error('Unexpected Auth request');
      return Response.json(next.body, { status: next.status ?? 200, headers: { 'X-Supabase-Api-Version': '2024-01-01' } });
    });
    vi.stubGlobal('fetch', mockFetch);
    return { service: new SupabaseAuthService(env), mockFetch };
  }
  const granted = { ...session, token_type: 'bearer', expires_in: 3600, user };
  it('registers through Auth with the configured email redirect', async () => {
    const { service, mockFetch } = setup([{ body: user }]);
    expect(await service.register(user.email, 'password123')).toEqual({ user, session: null, confirmation_required: true });
    expect(String(mockFetch.mock.calls[0]?.[0])).toContain('/auth/v1/signup');
    expect(String(mockFetch.mock.calls[0]?.[0])).toContain('redirect_to=http%3A%2F%2Flocalhost%3A3000');
    expect(JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body))).toMatchObject({ email: user.email, password: 'password123' });
  });
  it('logs in, refreshes, verifies user and revokes only the current session', async () => {
    const { service, mockFetch } = setup([{ body: granted }, { body: granted }, { body: user }, { body: {}, status: 200 }]);
    expect(await service.login(user.email, 'password123')).toEqual(result);
    expect(await service.refresh(session.refresh_token)).toEqual(result);
    expect(await service.user(session.access_token)).toEqual(user);
    await service.logout(session.access_token);
    const urls = mockFetch.mock.calls.map(call => String(call[0]));
    expect(urls[0]).toContain('grant_type=password');
    expect(urls[1]).toContain('grant_type=refresh_token');
    expect(urls[2]).toContain('/auth/v1/user');
    expect(urls[3]).toContain('/auth/v1/logout?scope=local');
    const headers = new Headers(mockFetch.mock.calls[2]?.[1]?.headers);
    expect(headers.get('Authorization')).toBe(`Bearer ${session.access_token}`);
    expect(headers.get('apikey')).toBe(env.SUPABASE_SERVICE_ROLE_KEY);
    expect(urls.every(url => !url.includes('/rest/v1'))).toBe(true);
  });
  it.each([
    ['invalid_credentials', 400, 401], ['email_not_confirmed', 400, 403],
    ['over_request_rate_limit', 429, 429], ['server_error', 503, 503],
  ])('sanitizes Auth error %s', async (code, status, expectedStatus) => {
    const { service } = setup([{ body: { code, msg: 'sensitive upstream error' }, status }]);
    await expect(service.login(user.email, 'password123')).rejects.toMatchObject({ status: expectedStatus });
  });
});
