import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { unauthorized } from './http';

// 30-day tokens, matching the old custom-JWT TTL. Signed/verified with our own
// APP_JWT_SECRET — no longer the Supabase JWT secret, since nothing downstream
// (no PostgREST/RLS) needs to validate it but this backend.
const TOKEN_TTL = '7d';

export interface AuthClaims {
  sub: string; // app_users.id
  email: string;
}

export function signAuthToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, env.APP_JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

/** Verifies a token string and returns its claims, or throws a 401 ApiError. */
export function verifyAuthToken(token: string): AuthClaims {
  try {
    const decoded = jwt.verify(token, env.APP_JWT_SECRET);
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      typeof decoded.sub === 'string' &&
      typeof (decoded as { email?: unknown }).email === 'string'
    ) {
      return { sub: decoded.sub, email: (decoded as { email: string }).email };
    }
    throw unauthorized('Malformed token');
  } catch (e) {
    if (e instanceof Error && e.name === 'ApiError') throw e;
    throw unauthorized('Invalid or expired token');
  }
}
