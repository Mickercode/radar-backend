import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { spawn } from 'child_process';
import path from 'path';
import { prisma } from '../lib/prisma';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { runCoverageAudit } from '../jobs/coverageAudit';
import { runGapFill } from '../jobs/gapFill';
import { getListenNotesUsage } from '../lib/listennotes';

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

// GET /admin/listennotes — returns monthly budget status
adminRouter.get(
  '/admin/listennotes',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const usage = await getListenNotesUsage();
    res.json(usage);
  }),
);

// GET /admin/coverage — returns full content_coverage table + last audit summary
adminRouter.get(
  '/admin/coverage',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const [rows, auditSetting, fillSetting] = await Promise.all([
      prisma.contentCoverage.findMany({
        orderBy: [{ status: 'asc' }, { topicSlug: 'asc' }, { contentType: 'asc' }],
      }),
      prisma.systemSetting.findUnique({ where: { key: 'last_coverage_audit' } }),
      prisma.systemSetting.findUnique({ where: { key: 'last_gap_fill' } }),
    ]);

    res.json({
      rows,
      lastAudit: auditSetting ? JSON.parse(auditSetting.value) : null,
      lastFill:  fillSetting  ? JSON.parse(fillSetting.value)  : null,
    });
  }),
);

// POST /admin/coverage/audit — runs the coverage audit in-process (fast, < 2s)
adminRouter.post(
  '/admin/coverage/audit',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const result = await runCoverageAudit();
    res.json({ success: true, ...result });
  }),
);

// POST /admin/coverage/fill — spawns gap-fill as a detached child process
// (can take 1–5 minutes depending on AI budget; returns 202 immediately).
adminRouter.post(
  '/admin/coverage/fill',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const fillPath = path.join(__dirname, '..', 'jobs', 'gapFill.js');
    const child = spawn(process.execPath, [fillPath], {
      detached: true,
      stdio: 'inherit',
      env: process.env as NodeJS.ProcessEnv,
    });
    child.unref();
    res.status(202).json({ ok: true, pid: child.pid });
  }),
);

// POST /admin/ingest/run
// Triggered by AWS EventBridge Scheduler on a cron schedule.
// Auth: x-ingest-secret header must match INGEST_SECRET env var.
// Returns 202 immediately; ingest runs as a detached child process.
adminRouter.post(
  '/admin/ingest/run',
  asyncHandler(async (req, res) => {
    const secret = process.env.INGEST_SECRET;
    if (!secret) throw new ApiError(500, 'INGEST_SECRET is not configured on this service');
    if (req.headers['x-ingest-secret'] !== secret) throw new ApiError(403, 'Invalid ingest secret');

    // Resolve the compiled ingest entry point relative to this file's directory.
    // In production: dist/routes/admin.js → dist/jobs/ingest.js
    const ingestPath = path.join(__dirname, '..', 'jobs', 'ingest.js');
    const child = spawn(process.execPath, [ingestPath], {
      detached: true,
      stdio: 'inherit',
      env: process.env as NodeJS.ProcessEnv,
    });
    child.unref();

    res.status(202).json({ ok: true, pid: child.pid });
  }),
);
