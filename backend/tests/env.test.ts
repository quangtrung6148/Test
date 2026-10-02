import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.js';

const valid = {
  SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 's'.repeat(40),
  FRONTEND_URL: 'http://localhost:3000', SERVICE_API_KEY: 'k'.repeat(40),
};
describe('backend environment', () => {
  it('defaults the development port', () => { expect(parseEnv(valid).PORT).toBe(5000); });
  it('uses platform values in production', () => {
    expect(parseEnv({ ...valid, NODE_ENV: 'production', PORT: '10000' }).PORT).toBe(10000);
  });
  it('requires a production port', () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: 'production' })).toThrow('PORT');
  });
  it('rejects example placeholders', () => {
    expect(() => parseEnv({ ...valid, SERVICE_API_KEY: 'REPLACE_WITH_RANDOM_KEY_AT_LEAST_32_CHARACTERS' })).toThrow('SERVICE_API_KEY');
  });
  it('does not expose invalid secret values', () => {
    expect(() => parseEnv({ ...valid, SERVICE_API_KEY: 'secret' })).toThrow('Invalid environment: SERVICE_API_KEY');
  });
});
