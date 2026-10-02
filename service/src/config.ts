import { config } from 'dotenv';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  BACKEND_URL: z.url().refine((value) => /^https?:\/\//.test(value))
    .transform((value) => value.replace(/\/+$/, '')),
  SERVICE_API_KEY: z.string().min(32).refine((value) => !/^(REPLACE_|YOUR_)/.test(value)),
  POLL_INTERVAL_MS: z.coerce.number().int().min(1000).max(2_147_483_647).default(60_000),
});

export function parseEnv(source: NodeJS.ProcessEnv) {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment: ${[...new Set(result.error.issues.map((issue) => issue.path[0]))].join(', ')}`);
  }
  return result.data;
}
export type Env = ReturnType<typeof parseEnv>;

export function loadEnv(): Env {
  config({ path: `.env.${process.env.NODE_ENV ?? 'development'}`, quiet: true });
  return parseEnv(process.env);
}
