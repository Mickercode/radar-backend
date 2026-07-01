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
  ANTHROPIC_API_KEY: z.string().optional(),
  VOYAGE_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  PODCAST_INDEX_API_KEY: z.string().optional(),
  PODCAST_INDEX_API_SECRET: z.string().optional(),
  // The "from" address for all Radar emails. Defaults to the Resend test domain.
  // Once your domain is verified on Resend, change this to something like
  // 'Radar <radar@yourdomain.com>'.
  EMAIL_FROM: z.string().default('Radar <onboarding@resend.dev>'),
  // Public-facing URL of the app for links in emails (e.g. password reset).
  // Must be set in production — no default so a missing value fails loudly.
  APP_URL: z.string().min(1, 'APP_URL is required — set it to the Vercel deployment URL'),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:hello@radar.ng'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MEDIASTACK_API_KEY: z.string().optional(),
  // Comma-separated admin emails — e.g. "you@gmail.com,ops@radar.ng".
  // Users in this list can access GET /admin/stats.
  ADMIN_EMAILS: z.string().default(''),
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
