import { config } from 'dotenv';
import { z } from 'zod';

const httpUrl = z.url().refine((value) => /^https?:\/\//.test(value));
const secret = z.string().min(32).refine((value) => !/^(REPLACE_|YOUR_)/.test(value));
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SUPABASE_URL: httpUrl.refine((value) => !value.includes('YOUR_PROJECT')),
  SUPABASE_SERVICE_ROLE_KEY: secret,
  FRONTEND_URL: httpUrl.transform((value) => new URL(value).origin),
  SERVICE_API_KEY: secret,
});

export function parseEnv(source: NodeJS.ProcessEnv) {
  const result = schema.safeParse(source);
  if (!result.success) {
    // Only field names: invalid environment values may contain secrets.
    throw new Error(`Invalid environment: ${[...new Set(result.error.issues.map((issue) => issue.path[0]))].join(', ')}`);
  }
  if (result.data.NODE_ENV === 'production' && result.data.PORT === undefined) {
    throw new Error('Invalid environment: PORT is required in production');
  }
  return { ...result.data, PORT: result.data.PORT ?? 5000 };
}

export type Env = ReturnType<typeof parseEnv>;

export function loadEnv(): Env {
  const mode = process.env.NODE_ENV ?? 'development';
  config({ path: `.env.${mode}`, quiet: true });
  return parseEnv(process.env);
}
