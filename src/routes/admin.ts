import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth } from '../middleware/auth';

export const adminRouter = Router();

function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth?.isAdmin) {
    next(new ApiError(403, 'Admin access required'));
    return;
  }
  next();
}

// GET /admin/me — returns the email + admin status the server sees in the token
adminRouter.get('/admin/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({ email: req.auth?.email ?? '', isAdmin: req.auth?.isAdmin ?? false });
}));

// POST /admin/grant-admin { email } → { ok, email }
// Grants permanent DB-level admin to any existing user. Requires admin JWT.
adminRouter.post(
  '/admin/grant-admin',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { email } = z.object({ email: z.string().trim().toLowerCase().email() }).parse(req.body);
    const user = await prisma.appUser.findUnique({ where: { email } });
    if (!user) throw new ApiError(404, `No account found for ${email}`);
    await prisma.appUser.update({ where: { id: user.id }, data: { isAdmin: true } });
    res.json({ ok: true, email });
  }),
);

// GET /admin/stats → AdminStats
adminRouter.get(
  '/admin/stats',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const now   = new Date();
    const ago7d  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const ago3h  = new Date(now.getTime() - 3  * 60 * 60 * 1000);
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [
      totalUsers, newUsers7d, newUsers30d, premiumUsers,
      totalContent, newContent24h, newContent3h, contentByType,
      totalSaved, savedLast7d, totalUploadsThisMonth,
      pendingSignups, summaryTiers, pushSubCount, premiumSubCount,
    ] = await Promise.all([
      prisma.appUser.count(),
      prisma.appUser.count({ where: { createdAt: { gte: ago7d } } }),
      prisma.appUser.count({ where: { createdAt: { gte: ago30d } } }),
      prisma.appUser.count({ where: { isPremium: true } }),
      prisma.content.count(),
      prisma.content.count({ where: { createdAt: { gte: ago24h } } }),
      prisma.content.count({ where: { createdAt: { gte: ago3h } } }),
      prisma.content.groupBy({ by: ['type'], _count: { _all: true } }),
      prisma.savedItem.count(),
      prisma.savedItem.count({ where: { savedAt: { gte: ago7d } } }),
      prisma.uploadCount.aggregate({
        where: { month: monthKey },
        _sum: { count: true },
      }),
      prisma.pendingSignup.count(),
      prisma.summary.groupBy({ by: ['tier'], _count: { _all: true } }),
      prisma.pushSubscription.count(),
      prisma.subscription.count({ where: { plan: { not: 'free' } } }),
    ]);

    const lastIngestSetting = await prisma.systemSetting.findUnique({ where: { key: 'last_ingest' } });
    const lastIngest = lastIngestSetting ? JSON.parse(lastIngestSetting.value) as {
      status: string; runAt: string;
      inserted: { news: number; podcasts: number; clips: number };
      skipped: { promo: number; duration: number; irrelevant: number; tier3: number };
    } : null;

    // Queries that need raw SQL
    const [topInterestsRaw, topLocationsRaw, lastIngestRaw, topSavedRaw, contentByTopicRaw] = await Promise.all([
      // Unnest interests array and count occurrences
      prisma.$queryRaw<{ interest: string; count: bigint }[]>`
        SELECT interest, COUNT(*) AS count
        FROM user_preferences, unnest(interests) AS interest
        GROUP BY interest
        ORDER BY count DESC
        LIMIT 10
      `,
      // Top locations
      prisma.$queryRaw<{ location: string; count: bigint }[]>`
        SELECT location, COUNT(*) AS count
        FROM user_preferences
        WHERE location IS NOT NULL AND location <> ''
        GROUP BY location
        ORDER BY count DESC
        LIMIT 10
      `,
      // Most recent content item (last ingest time)
      prisma.$queryRaw<{ max: Date | null }[]>`
        SELECT MAX(created_at) AS max FROM content
      `,
      // Top 5 most saved content items
      prisma.$queryRaw<{ content_id: string; title: string; source: string; save_count: bigint }[]>`
        SELECT si.content_id, c.title, c.source, COUNT(*) AS save_count
        FROM saved_items si
        JOIN content c ON c.id = si.content_id
        GROUP BY si.content_id, c.title, c.source
        ORDER BY save_count DESC
        LIMIT 5
      `,
      // Content count per topic (top 12)
      prisma.$queryRaw<{ name: string; slug: string; count: bigint }[]>`
        SELECT t.name, t.slug, COUNT(c.id) AS count
        FROM topics t
        LEFT JOIN content c ON c.topic_id = t.id
        GROUP BY t.id, t.name, t.slug
        ORDER BY count DESC
        LIMIT 12
      `,
    ]);

    // Normalize bigint → number for JSON serialisation
    const n = (v: bigint | null | undefined) => Number(v ?? 0);

    res.json({
      users: {
        total: totalUsers,
        newLast7d: newUsers7d,
        newLast30d: newUsers30d,
        premium: premiumUsers,
        topInterests: topInterestsRaw.map((r) => ({ label: r.interest, count: n(r.count) })),
        topLocations: topLocationsRaw.map((r) => ({ label: r.location, count: n(r.count) })),
      },
      content: {
        total: totalContent,
        newLast24h: newContent24h,
        newLast3h: newContent3h,
        lastIngestAt: lastIngestRaw[0]?.max ?? null,
        byType: Object.fromEntries(contentByType.map((r) => [r.type, r._count._all])),
        byTopic: contentByTopicRaw.map((r) => ({ name: r.name, slug: r.slug, count: n(r.count) })),
      },
      engagement: {
        totalSaved,
        savedLast7d,
        topSaved: topSavedRaw.map((r) => ({
          contentId: r.content_id,
          title: r.title,
          source: r.source,
          saves: n(r.save_count),
        })),
        uploadsThisMonth: Number(totalUploadsThisMonth._sum.count ?? 0),
      },
      system: {
        pendingSignups,
        pushSubscribers: pushSubCount,
        premiumSubscriptions: premiumSubCount,
        tierBreakdown: Object.fromEntries(
          summaryTiers.map((r) => [`tier${r.tier ?? 'null'}`, r._count._all])
        ),
        ingest: lastIngest ?? null,
      },
    });
  }),
);
