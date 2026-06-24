import { Router } from 'express';
import { z } from 'zod';
import type { AppUser } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword } from '../lib/password';
import { signAuthToken } from '../lib/jwt';
import { asyncHandler, conflict, unauthorized, badRequest } from '../lib/http';
import { requireAuth, userId } from '../middleware/auth';
import crypto from 'crypto';

export const authRouter = Router();

// Public user shape returned to the app — never leaks password_hash.
// Matches the app's `AuthUser` interface ({ id, email, name }).
function publicUser(u: AppUser) {
  return { id: u.id, email: u.email, name: u.name };
}

const credentials = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const signupBody = credentials.extend({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().trim().min(1).optional(),
});

// Generic message for both "no such user" and "wrong password" so we don't
// leak which emails are registered (carried over from the old auth-login fn).
const INVALID = 'Invalid email or password.';

// POST /auth/signup → { token, user }
authRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { email, password, name } = signupBody.parse(req.body);

    const existing = await prisma.appUser.findUnique({ where: { email } });
    if (existing) throw conflict('An account with this email already exists.');

    const passwordHash = await hashPassword(password);
    const user = await prisma.appUser.create({
      data: { email, passwordHash, name: name ?? null },
    });

    const token = signAuthToken(user.id, user.email);
    res.status(201).json({ token, user: publicUser(user) });
  }),
);

// POST /auth/login → { token, user }
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = credentials.parse(req.body);

    const user = await prisma.appUser.findUnique({ where: { email } });
    if (!user) throw unauthorized(INVALID);

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw unauthorized(INVALID);

    const token = signAuthToken(user.id, user.email);
    res.json({ token, user: publicUser(user) });
  }),
);

// PATCH /auth/name → { user }   (authenticated)
authRouter.patch(
  '/name',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name } = z.object({ name: z.string().trim().min(1, 'Name is required') }).parse(req.body);
    const user = await prisma.appUser.update({
      where: { id: userId(req) },
      data: { name },
    });
    res.json({ user: publicUser(user) });
  }),
);

// PATCH /auth/password → { ok: true }   (authenticated)
authRouter.patch(
  '/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = z
      .object({
        currentPassword: z.string().optional(),
        newPassword: z.string().min(6, 'Password must be at least 6 characters'),
      })
      .parse(req.body);

    const uid = userId(req);
    const user = await prisma.appUser.findUnique({ where: { id: uid } });

    if (!user) {
      throw unauthorized('User not found');
    }

    // If currentPassword is provided, verify it before allowing change
    if (currentPassword) {
      const isValid = await verifyPassword(currentPassword, user.passwordHash);
      if (!isValid) {
        throw unauthorized('Current password is incorrect');
      }
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.appUser.update({ where: { id: uid }, data: { passwordHash } });
    res.json({ ok: true });
  }),
);

// DELETE /auth/account → { ok: true }   (authenticated)
// Cascades remove all the user's saved items, insights, reviews, etc.
authRouter.delete(
  '/account',
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.appUser.delete({ where: { id: userId(req) } });
    res.json({ ok: true });
  }),
);

// POST /auth/forgot-password → { ok: true }
// Always returns {ok} to not leak whether email exists
authRouter.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { email } = z.object({ email: z.string().trim().toLowerCase().email() }).parse(req.body);

    const user = await prisma.appUser.findUnique({ where: { email } });
    if (!user) {
      // Don't leak existence - always return ok
      res.json({ ok: true });
      return;
    }

    // Generate a secure reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Delete any existing tokens for this user
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    // Create new reset token
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    // TODO: Send email with reset link
    // In production, integrate with an email service (SendGrid, AWS SES, etc.)
    // The reset link should be: https://yourapp.com/reset-password?token=${token}
    console.log(`[Password Reset] Token for ${email}: ${token}`);

    res.json({ ok: true });
  }),
);

// POST /auth/reset-password → { ok: true }
authRouter.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { token, newPassword } = z
      .object({
        token: z.string().min(1),
        newPassword: z.string().min(6, 'Password must be at least 6 characters'),
      })
      .parse(req.body);

    // Find valid token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      throw badRequest('Invalid or expired reset token');
    }

    if (resetToken.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { token } });
      throw badRequest('Reset token has expired');
    }

    // Update password
    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.appUser.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.delete({ where: { token } }),
    ]);

    res.json({ ok: true });
  }),
);
