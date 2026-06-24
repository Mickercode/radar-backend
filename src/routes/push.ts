import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest } from '../lib/http';
import { requireAuth, userId } from '../middleware/auth';

// Web Push subscription endpoints
export const pushRouter = Router();
pushRouter.use(requireAuth);

// POST /push/subscribe → { ok: true }
// Stores the Web Push subscription for the authenticated user
const subscribeBody = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

pushRouter.post(
  '/subscribe',
  asyncHandler(async (req, res) => {
    const { endpoint, keys } = subscribeBody.parse(req.body);
    const uid = userId(req);

    // Upsert the subscription (update if exists, create if not)
    await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId: uid,
          endpoint,
        },
      },
      create: {
        userId: uid,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    res.json({ ok: true });
  }),
);

// DELETE /push/unsubscribe → { ok: true }
// Removes the Web Push subscription
const unsubscribeBody = z.object({
  endpoint: z.string().url(),
});

pushRouter.delete(
  '/unsubscribe',
  asyncHandler(async (req, res) => {
    const { endpoint } = unsubscribeBody.parse(req.body);
    const uid = userId(req);

    await prisma.pushSubscription.deleteMany({
      where: {
        userId: uid,
        endpoint,
      },
    });

    res.json({ ok: true });
  }),
);
