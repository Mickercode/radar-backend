import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/http';
import { env } from '../config/env';
import { signAuthToken } from '../lib/jwt';

export const googleAuthRouter = Router();

interface GoogleTokenPayload {
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
  sub: string;
}

async function verifyGoogleToken(idToken: string): Promise<GoogleTokenPayload> {
  if (!env.GOOGLE_CLIENT_ID) throw new Error('Google auth not configured');

  // Use Google's tokeninfo endpoint — simple, no extra deps
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) throw new Error('Google token verification failed');

  const payload = await res.json() as GoogleTokenPayload & { aud?: string; error_description?: string };

  if (payload.error_description) throw new Error(payload.error_description);

  // Verify the token was issued for our app
  if (payload.aud !== env.GOOGLE_CLIENT_ID) throw new Error('Token audience mismatch');

  if (!payload.email_verified) throw new Error('Email not verified by Google');

  return payload;
}

// POST /auth/google { idToken } → { token, user, isNew }
googleAuthRouter.post(
  '/google',
  asyncHandler(async (req, res) => {
    const { idToken } = z.object({ idToken: z.string().min(1) }).parse(req.body);

    const gUser = await verifyGoogleToken(idToken);

    const email = gUser.email.toLowerCase();

    // Upsert the user — create if new, otherwise just update avatar/name if missing
    let user = await prisma.appUser.findUnique({ where: { email } });
    let isNew = false;

    if (!user) {
      isNew = true;
      user = await prisma.appUser.create({
        data: {
          email,
          passwordHash: '', // no password for OAuth users
          name: gUser.name ?? null,
          avatarUrl: gUser.picture ?? null,
        },
      });
    } else {
      // Backfill missing name/avatar from Google
      if (!user.name || !user.avatarUrl) {
        user = await prisma.appUser.update({
          where: { id: user.id },
          data: {
            name: user.name ?? gUser.name ?? null,
            avatarUrl: user.avatarUrl ?? gUser.picture ?? null,
          },
        });
      }
    }

    const token = signAuthToken(user.id, user.email);

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      isNew,
    });
  }),
);
