import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { captureUrl } from '../services/capture';

// "Save to Radar" — POST /capture { url } → CapturedInsight preview.
// Mounted at root. requireAuth (per-route so unmatched paths still 404).
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
    res.json(await captureUrl(url));
  }),
);
