export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'completed';
  created_at: string;
  updated_at: string;
}

export const api = {
  list: (signal?: AbortSignal) => authenticatedRequest<Task[]>('/tasks', { signal }),
  create: (title: string, description: string) => authenticatedRequest<Task>('/tasks', {
    method: 'POST', body: JSON.stringify({ title, description }),
  }),
  complete: (id: string) => authenticatedRequest<Task>(`/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify({ status: 'completed' }),
  }),
};
import { authenticatedRequest } from './session';

