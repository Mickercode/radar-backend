import 'dotenv/config';
import { z } from 'zod';

// Validate the environment once, at startup. A missing DATABASE_URL or
// APP_JWT_SECRET should crash the process immediately — not surface as a
// confusing 500 on the first request.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default('*'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  APP_JWT_SECRET: z.string().min(16, 'APP_JWT_SECRET must be at least 16 chars'),
  // Optional until the AI pipeline chunk lands.
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
