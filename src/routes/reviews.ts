import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, notFound, requireParam } from '../lib/http';
import { requireAuth, userId } from '../middleware/auth';
import { toInsight, toInsightReview } from '../lib/serialize';
import { dueDateAfter, intervalDaysForStep } from '../services/srs';

// Spaced repetition (PLAYBOOK §4C). Ported from services/api.ts.
export const reviewsRouter = Router();
reviewsRouter.use(requireAuth);

// GET /reviews/due/count → number of reviews due now (Brain tab badge)
reviewsRouter.get(
  '/due/count',
  asyncHandler(async (req, res) => {
    const count = await prisma.insightReview.count({
      where: { userId: userId(req), dueAt: { lte: new Date() } },
    });
    res.json(count);
  }),
);

// GET /reviews/due?limit= → DueReview[]  ({ review, insight }, oldest-due first)
reviewsRouter.get(
  '/due',
  asyncHandler(async (req, res) => {
    const { limit } = z.object({ limit: z.coerce.number().int().positive().max(100).optional() }).parse(req.query);
    const rows = await prisma.insightReview.findMany({
      where: { userId: userId(req), dueAt: { lte: new Date() } },
      orderBy: { dueAt: 'asc' },
      take: limit ?? 20,
      include: { insight: true },
    });
    res.json(
      rows
        .filter((r) => r.insight) // skip orphaned rows just in case
        .map((r) => ({ review: toInsightReview(r), insight: toInsight(r.insight) })),
    );
  }),
);

const submitBody = z.object({ grade: z.union([z.literal(0), z.literal(1)]) });

// POST /reviews/:id/submit { grade } → InsightReview
//   grade 1 (remembered) → step + 1, next interval = SCHEDULE[newStep]
//   grade 0 (forgot)     → step = 0, next interval = 1 day
reviewsRouter.post(
  '/:id/submit',
  asyncHandler(async (req, res) => {
    const reviewId = requireParam(req, 'id');
    const { grade } = submitBody.parse(req.body);
    const uid = userId(req);

    const current = await prisma.insightReview.findFirst({
      where: { id: reviewId, userId: uid },
      select: { step: true, reviewCount: true },
    });
    if (!current) throw notFound('Review not found');

    const nextStep = grade === 1 ? current.step + 1 : 0;
    const updated = await prisma.insightReview.update({
      where: { id: reviewId },
      data: {
        step: nextStep,
        dueAt: dueDateAfter(intervalDaysForStep(nextStep)),
        lastReviewedAt: new Date(),
        lastGrade: grade,
        reviewCount: current.reviewCount + 1,
      },
    });

    res.json(toInsightReview(updated));
  }),
);
