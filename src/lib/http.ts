import type { NextFunction, Request, Response } from 'express';

/**
 * An error with an HTTP status. Thrown anywhere in a route/service and caught
 * by the central error middleware, which renders `{ error: message }`.
 */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export const badRequest = (msg: string) => new ApiError(400, msg);
export const unauthorized = (msg = 'Unauthorized') => new ApiError(401, msg);
export const notFound = (msg = 'Not found') => new ApiError(404, msg);
export const conflict = (msg: string) => new ApiError(409, msg);

/**
 * Read a required route param as a definite string. Express guarantees the
 * param exists when the route matched, but `noUncheckedIndexedAccess` types it
 * as `string | undefined` — this narrows it (and guards the empty case).
 */
export function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiError(400, `Missing route parameter: ${name}`);
  }
  return value;
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wraps an async route so rejected promises reach the error middleware. */
export const asyncHandler =
  (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
