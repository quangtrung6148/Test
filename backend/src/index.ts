import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createSupabase } from './config/supabase.js';
import { SupabaseTaskStore } from './services/tasks.js';
import { SupabaseAuthService } from './services/auth.js';

try {
  const env = loadEnv();
  const app = createApp(env, new SupabaseTaskStore(createSupabase(env)), new SupabaseAuthService(env));
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    console.log(JSON.stringify({ event: 'backend_started', port: env.PORT }));
  });
  server.on('error', () => {
    console.error('Backend failed to listen');
    process.exitCode = 1;
  });
  const shutdown = () => {
    console.log(JSON.stringify({ event: 'backend_stopping' }));
    server.close(() => { process.exitCode = 0; });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Backend failed to start');
  process.exitCode = 1;
}
