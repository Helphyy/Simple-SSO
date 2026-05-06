import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATA_DIR: z.string().default('/app/data'),
  PUBLIC_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  // Number of trusted reverse proxies in front of the auth service.
  // Used to pick the right IP from X-Forwarded-For without trusting
  // arbitrary client-supplied entries.
  TRUST_PROXY_COUNT: z.coerce.number().int().nonnegative().default(1),
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  console.error('[config] invalid env:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  cookieSecure: parsed.data.PUBLIC_URL.startsWith('https://'),
} as const;

export type Config = typeof config;
