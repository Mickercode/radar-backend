import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/http';
import { requireAuth, userId } from '../middleware/auth';
import { getVapidPublicKey } from '../lib/push';

export const pushRouter = Router();

// GET /push/vapid-public-key → { publicKey } (public — FE needs this to subscribe)
pushRouter.get('/vapid-public-key', (_req, res) => {
  const key = getVapidPublicKey();
  if (!key) return res.status(503).json({ error: 'Push not configured' });
  res.json({ publicKey: key });
});

pushRouter.use(requireAuth);

// POST /push/subscribe → { ok: true }
const subscribeBody = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

pushRouter.post(
  '/subscribe',
  asyncHandler(async (req, res) => {
    const { endpoint, keys } = subscribeBody.parse(req.body);
    const uid = userId(req);
    await prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId: uid, endpoint } },
      create: { userId: uid, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      update: { p256dh: keys.p256dh, auth: keys.auth },
    });
    res.json({ ok: true });
  }),
);

// DELETE /push/unsubscribe → { ok: true }
const unsubscribeBody = z.object({ endpoint: z.string().url() });

pushRouter.delete(
  '/unsubscribe',
  asyncHandler(async (req, res) => {
    const { endpoint } = unsubscribeBody.parse(req.body);
    await prisma.pushSubscription.deleteMany({ where: { userId: userId(req), endpoint } });
    res.json({ ok: true });
  }),
);
