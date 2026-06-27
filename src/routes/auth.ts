import { Router } from 'express';
import { z } from 'zod';
import type { AppUser } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword } from '../lib/password';
import { signAuthToken } from '../lib/jwt';
import { asyncHandler, conflict, unauthorized, badRequest } from '../lib/http';
import { requireAuth, userId } from '../middleware/auth';
import { sendWelcomeEmail, sendResetPasswordEmail, sendOtpEmail } from '../lib/email';
import crypto from 'crypto';

export const authRouter = Router();

function publicUser(u: AppUser) {
  return { id: u.id, email: u.email, name: u.name };
}

function generateOtp(): string {
  return String(crypto.randomInt(100_000, 999_999));
}

const credentials = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const signupBody = credentials.extend({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().trim().min(1).optional(),
});

const INVALID = 'Invalid email or password.';

// ── POST /auth/signup → { pendingEmail }
// Validates, hashes password, stores as PendingSignup, sends OTP.
authRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { email, password, name } = signupBody.parse(req.body);

    const existing = await prisma.appUser.findUnique({ where: { email } });
    if (existing) throw conflict('An account with this email already exists.');

    const passwordHash = await hashPassword(password);
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Upsert PendingSignup — allows resend without duplicates
    await prisma.pendingSignup.upsert({
      where: { email },
      create: { email, passwordHash, name: name ?? null, otp, expiresAt },
      update: { passwordHash, name: name ?? null, otp, expiresAt },
    });

    sendOtpEmail(email, otp, name);

    res.status(202).json({ pendingEmail: email });
  }),
);

// ── POST /auth/verify-otp { email, otp } → { token, user }
// Verifies OTP, creates account, returns JWT.
authRouter.post(
  '/verify-otp',
  asyncHandler(async (req, res) => {
    const { email, otp } = z
      .object({
        email: z.string().trim().toLowerCase().email(),
        otp: z.string().length(6),
      })
      .parse(req.body);

    const pending = await prisma.pendingSignup.findUnique({ where: { email } });

    if (!pending) throw badRequest('No pending signup found. Please sign up again.');
    if (pending.otp !== otp) throw badRequest('Incorrect code. Please try again.');
    if (pending.expiresAt < new Date()) {
      await prisma.pendingSignup.delete({ where: { email } });
      throw badRequest('Code has expired. Please sign up again.');
    }

    // Double-check the email wasn't claimed while OTP was in flight
    const existing = await prisma.appUser.findUnique({ where: { email } });
    if (existing) {
      await prisma.pendingSignup.delete({ where: { email } });
      throw conflict('An account with this email already exists.');
    }

    const user = await prisma.appUser.create({
      data: { email, passwordHash: pending.passwordHash, name: pending.name },
    });

    await prisma.pendingSignup.delete({ where: { email } });

    const token = signAuthToken(user.id, user.email);
    sendWelcomeEmail(user.email, user.name);

    res.status(201).json({ token, user: publicUser(user) });
  }),
);

// ── POST /auth/resend-otp { email } → { ok: true }
authRouter.post(
  '/resend-otp',
  asyncHandler(async (req, res) => {
    const { email } = z.object({ email: z.string().trim().toLowerCase().email() }).parse(req.body);

    const pending = await prisma.pendingSignup.findUnique({ where: { email } });
    if (!pending) throw badRequest('No pending signup found. Please sign up again.');

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.pendingSignup.update({ where: { email }, data: { otp, expiresAt } });
    sendOtpEmail(email, otp, pending.name ?? undefined);

    res.json({ ok: true });
  }),
);

// ── POST /auth/login → { token, user }
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

// ── PATCH /auth/name → { user }   (authenticated)
authRouter.patch(
  '/name',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name } = z.object({ name: z.string().trim().min(1, 'Name is required') }).parse(req.body);
    const user = await prisma.appUser.update({ where: { id: userId(req) }, data: { name } });
    res.json({ user: publicUser(user) });
  }),
);

// ── PATCH /auth/password → { ok: true }   (authenticated)
authRouter.patch(
  '/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = z
      .object({
        currentPassword: z.string().min(1, 'Current password is required'),
        newPassword: z.string().min(6, 'Password must be at least 6 characters'),
      })
      .parse(req.body);

    const uid = userId(req);
    const user = await prisma.appUser.findUnique({ where: { id: uid } });
    if (!user) throw unauthorized('User not found');

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) throw unauthorized('Current password is incorrect');

    const passwordHash = await hashPassword(newPassword);
    await prisma.appUser.update({ where: { id: uid }, data: { passwordHash } });
    res.json({ ok: true });
  }),
);

// ── DELETE /auth/account → { ok: true }   (authenticated)
authRouter.delete(
  '/account',
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.appUser.delete({ where: { id: userId(req) } });
    res.json({ ok: true });
  }),
);

// ── POST /auth/forgot-password → { ok: true }
authRouter.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { email } = z.object({ email: z.string().trim().toLowerCase().email() }).parse(req.body);
    const user = await prisma.appUser.findUnique({ where: { email } });
    if (!user) { res.json({ ok: true }); return; }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } });
    sendResetPasswordEmail(user.email, token);

    res.json({ ok: true });
  }),
);

// ── POST /auth/reset-password → { ok: true }
authRouter.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { token, newPassword } = z
      .object({
        token: z.string().min(1),
        newPassword: z.string().min(6, 'Password must be at least 6 characters'),
      })
      .parse(req.body);

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) throw badRequest('Invalid or expired reset link');
    if (resetToken.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { token } });
      throw badRequest('Reset link has expired. Please request a new one.');
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.appUser.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.delete({ where: { token } }),
    ]);

    res.json({ ok: true });
  }),
);
