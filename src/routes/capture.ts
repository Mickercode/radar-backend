import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { captureUrl } from '../services/capture';
import { checkAndIncrementDailyLimit } from '../lib/dailyLimit';
import { prisma } from '../lib/prisma';

// "Save to Radar" — POST /capture { url } → CapturedInsight preview.
export const captureRouter = Router();

const captureBody = z.object({
  url: z
    .string()
    .trim()
    .regex(/^https?:\/\//, 'url must start with http(s)://'),
});

captureRouter.post(
  '/capture',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { url } = captureBody.parse(req.body);

    const uid = req.auth!.userId;
    const user = await prisma.appUser.findUnique({ where: { id: uid }, select: { isPremium: true } });
    await checkAndIncrementDailyLimit(uid, user?.isPremium ?? false);

    res.json(await captureUrl(url));
  }),
);
