import type { SupabaseClient } from '@supabase/supabase-js';
import type { NewTask, Task, TaskStore } from '../types.js';
import { AppError } from '../middleware/errors.js';

const fields = 'id,title,description,status,created_at,updated_at';
function databaseError(): never {
  throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Không thể kết nối dữ liệu. Vui lòng thử lại.');
}

export class SupabaseTaskStore implements TaskStore {
  constructor(private readonly client: SupabaseClient) {}

  list(userId: string): Promise<Task[]> { return this.query(false, userId); }
  pending(): Promise<Task[]> { return this.query(true); }

  private async query(pendingOnly: boolean, userId?: string): Promise<Task[]> {
    // Supabase limits a single response to 1,000 rows by default.
    // Fetch chunks internally so the demo API does not silently omit tasks.
    const tasks: Task[] = [];
    for (let offset = 0; ; offset += 1000) {
      let query = this.client.from('tasks').select(fields)
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(offset, offset + 999);
      if (pendingOnly) query = query.eq('status', 'pending');
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (error || !data) databaseError();
      tasks.push(...data as Task[]);
      if (data.length < 1000) return tasks;
    }
  }

  async create(input: NewTask, userId: string): Promise<Task> {
    const { data, error } = await this.client.from('tasks')
      .insert({ ...input, user_id: userId, status: 'pending' }).select(fields).single();
    if (error || !data) databaseError();
    return data as Task;
  }

  private async find(id: string, userId: string): Promise<Task> {
    const { data, error } = await this.client.from('tasks').select(fields).eq('id', id).eq('user_id', userId).maybeSingle();
    if (error) databaseError();
    if (!data) throw new AppError(404, 'TASK_NOT_FOUND', 'Không tìm thấy công việc.');
    return data as Task;
  }

  async complete(id: string, userId: string): Promise<Task> {
    const existing = await this.find(id, userId);
    if (existing.status === 'completed') return existing;
    const { data, error } = await this.client.from('tasks').update({ status: 'completed' })
      .eq('id', id).eq('user_id', userId).eq('status', 'pending').select(fields).maybeSingle();
    if (error) databaseError();
    // Another request may have completed the task in the meantime.
    return data ? data as Task : this.find(id, userId);
  }
}
