import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, notFound } from '../lib/http';
import { optionalAuth } from '../middleware/auth';
import { getFeed } from '../services/feed';
import { toContentItem, toKeyMoment, toTopic } from '../lib/serialize';

// Public catalog (feed / content / topics). optionalAuth mirrors the old
// "anon-readable public catalog" RLS — a logged-out client still gets content.
export const catalogRouter = Router();
catalogRouter.use(optionalAuth);

/** Parse ?foo=a,b or ?foo=a&foo=b into a clean string[]. */
function parseList(v: unknown): string[] {
  const raw = Array.isArray(v) ? v : v == null ? [] : [v];
  return raw
    .flatMap((x) => String(x).split(','))
    .map((s) => s.trim())
    .filter(Boolean);
}

// GET /topics → Topic[]
catalogRouter.get(
  '/topics',
  asyncHandler(async (_req, res) => {
    const topics = await prisma.topic.findMany({ orderBy: { name: 'asc' } });
    res.json(topics.map(toTopic));
  }),
);

// GET /feed?topicIds=a,b → { items, isFallback, matchedTopics }
catalogRouter.get(
  '/feed',
  asyncHandler(async (req, res) => {
    const topicIds = parseList(req.query.topicIds);
    res.json(await getFeed(topicIds));
  }),
);

// GET /content?ids=a,b   (fetchContentByIds)
// GET /content?type=news (fetchContentByType / fetchNews / fetchClips)
const contentType = z.enum(['news', 'podcast', 'clip']);
catalogRouter.get(
  '/content',
  asyncHandler(async (req, res) => {
    const ids = parseList(req.query.ids);
    if (ids.length > 0) {
      const rows = await prisma.content.findMany({
        where: { id: { in: ids } },
        include: { summary: true },
      });
      res.json(rows.map(toContentItem));
      return;
    }

    if (req.query.type != null) {
      const type = contentType.parse(req.query.type);
      const rows = await prisma.content.findMany({
        where: { type },
        include: { summary: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      res.json(rows.map(toContentItem));
      return;
    }

    throw badRequest('Provide either ?ids= or ?type=');
  }),
);

// GET /content/:id → ContentItem (404 if missing; app maps 404 → null)
catalogRouter.get(
  '/content/:id',
  asyncHandler(async (req, res) => {
    const row = await prisma.content.findUnique({
      where: { id: req.params.id },
      include: { summary: true },
    });
    if (!row) throw notFound('Content not found');
    res.json(toContentItem(row));
  }),
);

// GET /content/:id/key-moments → KeyMoment[]
catalogRouter.get(
  '/content/:id/key-moments',
  asyncHandler(async (req, res) => {
    const moments = await prisma.keyMoment.findMany({
      where: { contentId: req.params.id },
      orderBy: { timestampSec: 'asc' },
    });
    res.json(moments.map(toKeyMoment));
  }),
);
