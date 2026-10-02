import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorker } from '../src/worker.js';
import { parseEnv } from '../src/config.js';

const env = { BACKEND_URL: 'http://backend:5000', SERVICE_API_KEY: 'k'.repeat(40), POLL_INTERVAL_MS: 60_000 };
const pending = { id: 'c7306bcd-5ce5-4a0a-a5b9-d916ee2b3aa8', status: 'pending' };
const success = () => Response.json({ data: [pending] });

afterEach(() => { vi.useRealTimers(); });
describe('background worker', () => {
  it('only calls the backend and includes the Bearer key', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(success());
    const log = vi.fn();
    await createWorker(env, { fetch: mockFetch, log }).pollOnce();
    expect(mockFetch).toHaveBeenCalledWith('http://backend:5000/api/v1/internal/tasks/pending', expect.objectContaining({
      headers: { Authorization: `Bearer ${env.SERVICE_API_KEY}` }, signal: expect.any(AbortSignal),
    }));
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: 'pending_tasks_checked', pending_count: 1 }));
    expect(JSON.stringify(log.mock.calls)).not.toContain(env.SERVICE_API_KEY);
  });
  it('counts only pending tasks and handles an empty list', async () => {
    const mockFetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ data: [pending, { ...pending, status: 'completed' }] }))
      .mockResolvedValueOnce(Response.json({ data: [] }));
    const log = vi.fn();
    const worker = createWorker(env, { fetch: mockFetch, log });
    await worker.pollOnce(); await worker.pollOnce();
    expect(log.mock.calls[0]?.[0].pending_count).toBe(1);
    expect(log.mock.calls[1]?.[0].pending_count).toBe(0);
  });
  it('recovers after network and HTTP errors', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error(`secret=${env.SERVICE_API_KEY}`))
      .mockResolvedValueOnce(new Response('', { status: 401 })).mockResolvedValueOnce(success());
    const log = vi.fn();
    const worker = createWorker(env, { fetch: mockFetch, log });
    await worker.pollOnce(); await worker.pollOnce(); await worker.pollOnce();
    expect(log.mock.calls.map(([entry]) => entry.event)).toEqual(['pending_tasks_check_failed', 'pending_tasks_check_failed', 'pending_tasks_checked']);
    expect(log.mock.calls[1]?.[0].code).toBe('HTTP_401');
    expect(JSON.stringify(log.mock.calls)).not.toContain(env.SERVICE_API_KEY);
  });
  it('rejects malformed backend responses', async () => {
    const log = vi.fn();
    await createWorker(env, { fetch: vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: 'wrong' })), log }).pollOnce();
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_RESPONSE' }));
  });
  it('times out an in-flight request', async () => {
    vi.useFakeTimers();
    const mockFetch = vi.fn<typeof fetch>().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
    }));
    const log = vi.fn();
    const check = createWorker(env, { fetch: mockFetch, log }).pollOnce();
    await vi.advanceTimersByTimeAsync(10_000);
    await check;
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ code: 'TIMEOUT' }));
  });
  it('prevents overlapping polls', async () => {
    let finish!: (response: Response) => void;
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const worker = createWorker(env, { fetch: mockFetch, log: vi.fn() });
    const first = worker.pollOnce();
    await worker.pollOnce();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    finish(success()); await first;
    worker.stop();
  });
  it('polls immediately, waits the interval and shuts down cleanly', async () => {
    vi.useFakeTimers();
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(async () => success());
    const log = vi.fn();
    const worker = createWorker(env, { fetch: mockFetch, log });
    const run = worker.run();
    await vi.advanceTimersByTimeAsync(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    worker.stop(); await run;
    expect(log).toHaveBeenLastCalledWith({ event: 'worker_stopped' });
  });
  it('stops an in-flight request without reporting a failure', async () => {
    const log = vi.fn();
    const mockFetch = vi.fn<typeof fetch>().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
    }));
    const worker = createWorker(env, { fetch: mockFetch, log });
    const run = worker.run();
    worker.stop(); await run;
    expect(log.mock.calls.map(([entry]) => entry.event)).toEqual(['worker_started', 'worker_stopped']);
  });
  it('validates environment and does not require any database key', () => {
    expect(parseEnv({ BACKEND_URL: env.BACKEND_URL, SERVICE_API_KEY: env.SERVICE_API_KEY }).POLL_INTERVAL_MS).toBe(60_000);
    expect(() => parseEnv({ BACKEND_URL: 'not-url', SERVICE_API_KEY: 'short' })).toThrow('Invalid environment');
    expect(() => parseEnv({ ...env, POLL_INTERVAL_MS: '0' } as unknown as NodeJS.ProcessEnv)).toThrow('POLL_INTERVAL_MS');
  });
});
