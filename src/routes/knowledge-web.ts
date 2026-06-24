import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/http';
import { requireAuth, userId } from '../middleware/auth';
import { toInsight } from '../lib/serialize';

// Knowledge Web dashboard (PLAYBOOK §4B — Brain upgrade). Three endpoints
// that power the enhanced Brain page: stats, gap analysis, and growth metrics.
export const knowledgeWebRouter = Router();
knowledgeWebRouter.use(requireAuth);

// ── GET /knowledge-web/stats ──────────────────────────────────────────────────
// Returns aggregate stats for the Knowledge Web dashboard.
// { totalInsights, totalEdges, tierDistribution, newThisWeek, newThisMonth,
//   activeStreakDays, topTags }
knowledgeWebRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalInsights, totalEdges, recentInsights, monthInsights, tags] =
      await Promise.all([
        prisma.insight.count({ where: { userId: uid } }),
        prisma.insightEdge.count({ where: { userId: uid } }),
        prisma.insight.findMany({
          where: { userId: uid, createdAt: { gte: weekAgo } },
          select: { id: true, tier: true },
        }),
        prisma.insight.findMany({
          where: { userId: uid, createdAt: { gte: monthAgo } },
          select: { id: true, tier: true },
        }),
        prisma.insight.findMany({
          where: { userId: uid },
          select: { tags: true },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
      ]);

    // Tier distribution
    const tierDist = { '1': 0, '2': 0, '3': 0 };
    for (const i of monthInsights) {
      const key = String(i.tier) as keyof typeof tierDist;
      if (key in tierDist) tierDist[key]++;
    }

    // Top tags (most frequently used across all insights)
    const tagCount = new Map<string, number>();
    for (const i of tags) {
      for (const t of i.tags) {
        tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
      }
    }
    const topTags = [...tagCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    // Active streak: consecutive days with an insight saved
    const allDates = await prisma.insight.findMany({
      where: { userId: uid },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const uniqueDays = new Set<string>();
    for (const d of allDates) {
      uniqueDays.add(d.createdAt.toISOString().slice(0, 10));
    }
    const sortedDays = [...uniqueDays].sort().reverse();
    let streak = 0;
    const todayStr = now.toISOString().slice(0, 10);
    for (let i = 0; i < sortedDays.length; i++) {
      const expected = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      if (sortedDays[i] === expected) streak++;
      else break;
    }

    res.json({
      totalInsights,
      totalEdges,
      tierDistribution: tierDist,
      newThisWeek: recentInsights.length,
      newThisMonth: monthInsights.length,
      activeStreakDays: streak,
      topTags,
    });
  }),
);

// ── GET /knowledge-web/gaps ───────────────────────────────────────────────────
// Identifies knowledge gaps — topics where the user has few or no insights.
// Uses existing tags to find under-explored areas, plus suggests tags that
// have only been covered by low-tier insights.
// { gaps: [{ topic, insightCount, avgTier, suggestion }] }
knowledgeWebRouter.get(
  '/gaps',
  asyncHandler(async (req, res) => {
    const uid = userId(req);

    const insights = await prisma.insight.findMany({
      where: { userId: uid },
      select: { id: true, title: true, tier: true, tags: true, what: true },
      orderBy: { createdAt: 'desc' },
    });

    // Group by tag
    const tagGroups = new Map<
      string,
      { count: number; tiers: number[]; ids: string[] }
    >();
    for (const i of insights) {
      for (const t of i.tags) {
        const key = t.toLowerCase();
        if (!tagGroups.has(key)) tagGroups.set(key, { count: 0, tiers: [], ids: [] });
        const g = tagGroups.get(key)!;
        g.count++;
        g.tiers.push(i.tier);
        g.ids.push(i.id);
      }
    }

    // Tags with low coverage: 1-2 insights, or average tier > 2 (weak coverage)
    const gaps = [...tagGroups.entries()]
      .filter(([, g]) => {
        if (g.count <= 2) return true;
        const avgTier = g.tiers.reduce((a, b) => a + b, 0) / g.tiers.length;
        return avgTier > 2.2;
      })
      .map(([topic, g]) => {
        const avgTier = g.tiers.reduce((a, b) => a + b, 0) / g.tiers.length;
        return {
          topic,
          insightCount: g.count,
          avgTier: Math.round(avgTier * 10) / 10,
          suggestion: g.count <= 1
            ? `You've only covered "${topic}" once. Explore more to build depth.`
            : `Your "${topic}" knowledge is shallow (avg tier ${avgTier.toFixed(1)}). Focus on higher-quality sources.`,
        };
      })
      .sort((a, b) => a.avgTier - b.avgTier) // weakest first
      .slice(0, 6);

    res.json({ gaps, totalTags: tagGroups.size });
  }),
);

// ── GET /knowledge-web/growth ────────────────────────────────────────────────
// Weekly growth data for the last 12 weeks: insights added, connections made.
// Returns an array of { weekStart, insightCount, edgeCount } for charting.
knowledgeWebRouter.get(
  '/growth',
  asyncHandler(async (req, res) => {
    const uid = userId(req);
    const now = new Date();
    const weeks: { weekStart: string; insightCount: number; edgeCount: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [insightCount, edgeCount] = await Promise.all([
        prisma.insight.count({
          where: {
            userId: uid,
            createdAt: { gte: weekStart, lt: weekEnd },
          },
        }),
        prisma.insightEdge.count({
          where: {
            userId: uid,
            createdAt: { gte: weekStart, lt: weekEnd },
          },
        }),
      ]);

      weeks.push({
        weekStart: weekStart.toISOString().slice(0, 10),
        insightCount,
        edgeCount,
      });
    }

    res.json({ weeks });
  }),
);
