// Augment Express's Request with the authenticated user, populated by the
// requireAuth / optionalAuth middleware.
import 'express';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        email: string;
        isAdmin: boolean;
      };
    }
  }
}

export {};
