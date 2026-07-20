import type { NextFunction, Request, Response } from 'express';
import { verifyAuthToken } from '../lib/jwt';
import { unauthorized } from '../lib/http';

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/** Hard auth gate — 401s if there's no valid Bearer token. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearer(req);
  if (!token) return next(unauthorized('Missing bearer token'));
  const claims = verifyAuthToken(token); // throws ApiError(401) on bad token
  req.auth = { userId: claims.sub, email: claims.email, isAdmin: claims.isAdmin, isSuperAdmin: claims.isSuperAdmin };
  next();
}

/**
 * Soft auth — attaches req.auth if a valid token is present, but never blocks.
 * Used by the public catalog routes (feed/content/topics) so a logged-out
 * client still gets the catalog, the same way the old anon-readable RLS worked.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearer(req);
  if (!token) return next();
  try {
    const claims = verifyAuthToken(token);
    req.auth = { userId: claims.sub, email: claims.email, isAdmin: claims.isAdmin, isSuperAdmin: claims.isSuperAdmin };
  } catch {
    // Ignore a bad/expired token on a public route — treat as anonymous.
  }
  next();
}

/** Convenience: the user id on a route guarded by requireAuth. */
export function userId(req: Request): string {
  if (!req.auth) throw unauthorized();
  return req.auth.userId;
}
