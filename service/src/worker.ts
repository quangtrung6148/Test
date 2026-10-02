import { z } from 'zod';
import type { Env } from './config.js';

const responseSchema = z.object({
  data: z.array(z.object({ id: z.uuid(), status: z.enum(['pending', 'completed']) })),
});

type Log = (entry: Record<string, unknown>) => void;
interface WorkerOptions {
  fetch?: typeof fetch;
  log?: Log;
  timeoutMs?: number;
}

export function createWorker(env: Pick<Env, 'BACKEND_URL' | 'SERVICE_API_KEY' | 'POLL_INTERVAL_MS'>, options: WorkerOptions = {}) {
  const request = options.fetch ?? fetch;
  const log = options.log ?? ((entry) => console.log(JSON.stringify(entry)));
  const stopController = new AbortController();
  let running = false;
  let active = false;

  async function pollOnce(): Promise<void> {
    if (active || stopController.signal.aborted) return;
    active = true;
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), options.timeoutMs ?? 10_000);
    let code = 'REQUEST_FAILED';
    try {
      const response = await request(`${env.BACKEND_URL}/api/v1/internal/tasks/pending`, {
        headers: { Authorization: `Bearer ${env.SERVICE_API_KEY}` },
        signal: AbortSignal.any([stopController.signal, timeout.signal]),
      });
      if (!response.ok) {
        code = `HTTP_${response.status}`;
        throw new Error('Backend returned an error');
      }
      const parsed = responseSchema.safeParse(await response.json());
      if (!parsed.success) {
        code = 'INVALID_RESPONSE';
        throw new Error('Invalid backend response');
      }
      log({
        event: 'pending_tasks_checked', timestamp: new Date().toISOString(),
        pending_count: parsed.data.data.filter((task) => task.status === 'pending').length,
      });
    } catch {
      if (!stopController.signal.aborted) {
        log({ event: 'pending_tasks_check_failed', timestamp: new Date().toISOString(), code: timeout.signal.aborted ? 'TIMEOUT' : code });
      }
    } finally {
      clearTimeout(timer);
      active = false;
    }
  }

  async function run(): Promise<void> {
    if (running) throw new Error('Worker is already running');
    running = true;
    log({ event: 'worker_started', interval_ms: env.POLL_INTERVAL_MS });
    try {
      while (!stopController.signal.aborted) {
        await pollOnce();
        if (stopController.signal.aborted) break;
        await new Promise<void>((resolve) => {
          const finish = () => {
            clearTimeout(timer);
            stopController.signal.removeEventListener('abort', finish);
            resolve();
          };
          const timer = setTimeout(finish, env.POLL_INTERVAL_MS);
          stopController.signal.addEventListener('abort', finish, { once: true });
          if (stopController.signal.aborted) finish();
        });
      }
    } finally {
      running = false;
      log({ event: 'worker_stopped' });
    }
  }

  return { pollOnce, run, stop: () => stopController.abort() };
}
