import { loadEnv } from './config.js';
import { createWorker } from './worker.js';

try {
  const worker = createWorker(loadEnv());
  process.once('SIGTERM', worker.stop);
  process.once('SIGINT', worker.stop);
  await worker.run();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Worker failed to start');
  process.exitCode = 1;
}
