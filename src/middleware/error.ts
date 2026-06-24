import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { ApiError } from '../lib/http';
import { isProd } from '../config/env';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}

// Central error renderer. Every thrown ApiError / ZodError / Prisma error
// becomes a clean `{ error }` JSON body so the app's axios layer can surface
// `e.response.data.error` the same way it read Supabase's `{ error }` bodies.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    const msg = err.issues[0]?.message ?? 'Invalid request';
    res.status(400).json({ error: msg });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique-constraint violation → 409.
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Already exists' });
      return;
    }
    // FK / not-found on a relation.
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Not found' });
      return;
    }
  }

  // eslint-disable-next-line no-console
  console.error('[unhandled]', err);
  res.status(500).json({
    error: isProd ? 'Something went wrong' : String((err as Error)?.message ?? err),
  });
}
