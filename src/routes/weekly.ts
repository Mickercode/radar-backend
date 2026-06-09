import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/http';
import { requireAuth, userId } from '../middleware/auth';
import { toInsight } from '../lib/serialize';
import { dueDateAfter } from '../services/srs';

// "You Got Smarter" weekly review (PLAYBOOK §7). Mounted at root (GET /weekly-review).
export const weeklyRouter = Router();

weeklyRouter.get(
  '/weekly-review',
  requireAuth,
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const now = new Date();
    const weekStart = dueDateAfter(-7, now);
    const weekStartIso = weekStart.toISOString();
    const weekEndIso = now.toISOString();

    const [saved, reviews] = await Promise.all([
      prisma.insight.findMany({
        where: { userId: uid, createdAt: { gte: weekStart } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.insightReview.findMany({
        where: { userId: uid, lastReviewedAt: { gte: weekStart } },
        select: { id: true, lastReviewedAt: true },
      }),
    ]);

    // Streak proxy — distinct calendar days in the window with any activity.
    const dates = new Set<string>();
    for (const i of saved) dates.add(i.createdAt.toISOString().slice(0, 10));
    for (const r of reviews) {
      if (r.lastReviewedAt) dates.add(r.lastReviewedAt.toISOString().slice(0, 10));
    }

    // Top insight: lowest tier number (1 = must-see) wins, ties broken by recency.
    const topInsight =
      saved.length === 0
        ? null
        : [...saved].sort((a, b) => {
            const tA = a.tier ?? 99;
            const tB = b.tier ?? 99;
            if (tA !== tB) return tA - tB;
            return b.createdAt.getTime() - a.createdAt.getTime();
          })[0]!;

    res.json({
      weekStartIso,
      weekEndIso,
      insightsSaved: saved.length,
      reviewsCompleted: reviews.length,
      daysActive: dates.size,
      topInsight: topInsight ? toInsight(topInsight) : null,
      insights: saved.slice(0, 10).map(toInsight),
    });
  }),
);
