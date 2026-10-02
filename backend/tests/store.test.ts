import { describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { SupabaseTaskStore } from '../src/services/tasks.js';
import type { Task } from '../src/types.js';

const task: Task = {
  id: 'c7306bcd-5ce5-4a0a-a5b9-d916ee2b3aa8', title: 'X', description: '', status: 'pending',
  created_at: '2026-10-02T00:00:00Z', updated_at: '2026-10-02T00:00:00Z',
};
function setup(responses: Response[]) {
  const mockFetch = vi.fn<typeof fetch>().mockImplementation(async () => {
    const response = responses.shift();
    if (!response) throw new Error('Unexpected database request');
    return response;
  });
  const client = createClient('https://test.supabase.co', 'test-server-key', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: mockFetch },
  });
  return { store: new SupabaseTaskStore(client), mockFetch };
}
const userId = '0f1554dd-0440-442e-bd58-fb61918fa588';
const json = (body: unknown, status = 200) => Response.json(body, { status });

describe('Supabase task store using mocked database HTTP', () => {
  it('queries pending tasks and newest-first order', async () => {
    const { store, mockFetch } = setup([json([task])]);
    expect(await store.pending()).toEqual([task]);
    const url = new URL(String(mockFetch.mock.calls[0]?.[0]));
    expect(url.searchParams.get('status')).toBe('eq.pending');
    expect(url.searchParams.get('order')).toBe('created_at.desc,id.desc');
  });
  it('fetches beyond the default 1,000-row response limit', async () => {
    const { store, mockFetch } = setup([json(Array.from({ length: 1000 }, () => task)), json([task])]);
    expect(await store.list(userId)).toHaveLength(1001);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    for (const call of mockFetch.mock.calls) expect(new URL(String(call[0])).searchParams.get('user_id')).toBe(`eq.${userId}`);
  });
  it('inserts pending tasks', async () => {
    const { store, mockFetch } = setup([json(task, 201)]);
    expect(await store.create({ title: 'X', description: '' }, userId)).toEqual(task);
    expect(JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body))).toEqual({ title: 'X', description: '', status: 'pending', user_id: userId });
  });
  it('completes pending tasks with a conditional update', async () => {
    const completed = { ...task, status: 'completed', updated_at: '2026-10-02T01:00:00Z' };
    const { store, mockFetch } = setup([json(task), json(completed)]);
    expect(await store.complete(task.id, userId)).toEqual(completed);
    expect(new URL(String(mockFetch.mock.calls[1]?.[0])).searchParams.get('status')).toBe('eq.pending');
    for (const call of mockFetch.mock.calls) expect(new URL(String(call[0])).searchParams.get('user_id')).toBe(`eq.${userId}`);
  });
  it('repeated completion performs no update and preserves the timestamp', async () => {
    const completed = { ...task, status: 'completed' };
    const { store, mockFetch } = setup([json(completed)]);
    expect(await store.complete(task.id, userId)).toEqual(completed);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
  it('handles concurrent completion without another timestamp change', async () => {
    const completed = { ...task, status: 'completed' };
    const { store } = setup([json(task), json(null), json(completed)]);
    expect(await store.complete(task.id, userId)).toEqual(completed);
  });
  it('returns 404 for a missing task', async () => {
    const { store, mockFetch } = setup([json(null)]);
    await expect(store.complete(task.id, userId)).rejects.toMatchObject({ status: 404, code: 'TASK_NOT_FOUND' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(new URL(String(mockFetch.mock.calls[0]?.[0])).searchParams.get('user_id')).toBe(`eq.${userId}`);
  });
  it('sanitizes database failures', async () => {
    const { store } = setup([json({ message: 'sensitive database error' }, 500)]);
    await expect(store.list(userId)).rejects.toMatchObject({ status: 503, code: 'DATABASE_UNAVAILABLE' });
  });
});
