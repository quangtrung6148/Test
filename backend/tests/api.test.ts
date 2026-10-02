import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { AppError } from '../src/middleware/errors.js';
import type { AuthService, Task, TaskStore } from '../src/types.js';

const task: Task = {
  id: 'c7306bcd-5ce5-4a0a-a5b9-d916ee2b3aa8', title: 'Viết README', description: '',
  status: 'pending', created_at: '2026-10-02T00:00:00Z', updated_at: '2026-10-02T00:00:00Z',
};
const key = 'test-service-key-with-at-least-32-characters';
const user = { id: '0f1554dd-0440-442e-bd58-fb61918fa588', email: 'user@example.com' };
const auth: AuthService = { register: vi.fn(), login: vi.fn(), refresh: vi.fn(), user: vi.fn(), logout: vi.fn() };
const store: TaskStore = { list: vi.fn(), pending: vi.fn(), create: vi.fn(), complete: vi.fn() };
const app = createApp({ FRONTEND_URL: 'http://localhost:3000', SERVICE_API_KEY: key }, store, auth);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth.user).mockResolvedValue(user);
  vi.mocked(store.pending).mockResolvedValue([task]);
  vi.mocked(store.list).mockResolvedValue([task]);
  vi.mocked(store.create).mockResolvedValue(task);
  vi.mocked(store.complete).mockResolvedValue({ ...task, status: 'completed' });
});

const authorized = () => ({
  get: (path: string) => request(app).get(path).set('Authorization', 'Bearer test-user-token'),
  post: (path: string) => request(app).post(path).set('Authorization', 'Bearer test-user-token'),
  patch: (path: string) => request(app).patch(path).set('Authorization', 'Bearer test-user-token'),
});

describe('personal task API', () => {
  it('returns tasks, health, CORS and security headers', async () => {
    const response = await authorized().get('/api/v1/tasks').set('Origin', 'http://localhost:3000');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [task] });
    expect(store.list).toHaveBeenCalledWith(user.id);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['cache-control']).toBe('no-store');
    expect((await request(app).get('/health')).body).toEqual({ status: 'ok' });
  });
  it('does not grant browser access to another origin', async () => {
    const response = await authorized().get('/api/v1/tasks').set('Origin', 'https://other.example');
    expect(response.headers['access-control-allow-origin']).not.toBe('https://other.example');
  });
  it('handles PATCH preflight', async () => {
    const response = await request(app).options(`/api/v1/tasks/${task.id}`)
      .set('Origin', 'http://localhost:3000').set('Access-Control-Request-Method', 'PATCH');
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-methods']).toContain('PATCH');
  });
  it('creates a trimmed title and defaults description', async () => {
    const response = await authorized().post('/api/v1/tasks').send({ title: '  Viết README  ' });
    expect(response.status).toBe(201);
    expect(store.create).toHaveBeenCalledWith({ title: 'Viết README', description: '' }, user.id);
  });
  it.each([
    {}, { title: '   ' }, { title: 'a'.repeat(121) }, { title: 12 },
    { title: 'X', description: 'a'.repeat(2001) }, { title: 'X', status: 'completed' },
  ])('rejects invalid creation: %j', async (payload) => {
    const response = await authorized().post('/api/v1/tasks').send(payload);
    expect(response.status).toBe(400);
    expect(store.create).not.toHaveBeenCalled();
  });
  it('completes an existing task', async () => {
    const response = await authorized().patch(`/api/v1/tasks/${task.id}`).send({ status: 'completed' });
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('completed');
    expect(store.complete).toHaveBeenCalledWith(task.id, user.id);
  });
  it.each([{ status: 'pending' }, { status: 'completed', title: 'Changed' }, {}])('rejects invalid updates: %j', async (payload) => {
    expect((await authorized().patch(`/api/v1/tasks/${task.id}`).send(payload)).status).toBe(400);
    expect(store.complete).not.toHaveBeenCalled();
  });
  it('rejects malformed UUID and missing task', async () => {
    expect((await authorized().patch('/api/v1/tasks/not-a-uuid').send({ status: 'completed' })).status).toBe(400);
    vi.mocked(store.complete).mockRejectedValue(new AppError(404, 'TASK_NOT_FOUND', 'Không tìm thấy công việc.'));
    expect((await authorized().patch(`/api/v1/tasks/${task.id}`).send({ status: 'completed' })).status).toBe(404);
  });
  it('handles invalid JSON and oversized bodies', async () => {
    expect((await authorized().post('/api/v1/tasks').type('json').send('{')).status).toBe(400);
    expect((await authorized().post('/api/v1/tasks').send({ title: 'a'.repeat(20_000) })).status).toBe(413);
  });
  it('returns sanitized database errors', async () => {
    vi.mocked(store.list).mockRejectedValue(new AppError(503, 'DATABASE_UNAVAILABLE', 'Không thể kết nối dữ liệu.'));
    const response = await authorized().get('/api/v1/tasks');
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('DATABASE_UNAVAILABLE');
  });
  it('does not expose unexpected errors or secrets', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(store.list).mockRejectedValue(new Error(`postgres credentials ${key}`));
    const response = await authorized().get('/api/v1/tasks');
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain(key);
    expect(JSON.stringify(spy.mock.calls)).not.toContain(key);
    spy.mockRestore();
  });
  it('returns a consistent error for unknown endpoints', async () => {
    expect((await request(app).get('/missing')).body.error.code).toBe('NOT_FOUND');
  });
});

describe('internal task API', () => {
  it.each([undefined, 'Bearer incorrect', `Basic ${key}`, `Bearer ${key}x`])('denies invalid authentication: %s', async (header) => {
    const req = request(app).get('/api/v1/internal/tasks/pending');
    if (header) req.set('Authorization', header);
    expect((await req).status).toBe(401);
    expect(store.pending).not.toHaveBeenCalled();
  });
  it('accepts the correct service key and requests only pending tasks', async () => {
    const response = await request(app).get('/api/v1/internal/tasks/pending').set('Authorization', `Bearer ${key}`);
    expect(response.status).toBe(200);
    expect(store.pending).toHaveBeenCalledWith();
  });
});
