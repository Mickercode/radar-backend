import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, notFound, requireParam } from '../lib/http';
import { requireAuth, userId } from '../middleware/auth';
import {
  toInsight,
  toInsightEdge,
  toQuizAttempt,
  toQuizQuestion,
} from '../lib/serialize';
import { dueDateAfter, intervalDaysForStep } from '../services/srs';
import { generateQuizQuestions } from '../services/quiz';

// Knowledge graph (PLAYBOOK §4B) + quiz (§3). All routes require auth and are
// scoped to the JWT user id. Ported from the app's old services/api.ts.
export const insightsRouter = Router();
insightsRouter.use(requireAuth);

// ── Create / list / search ──────────────────────────────────────────────────

const saveInsightBody = z.object({
  sourceContentId: z.string().uuid().optional(),
  title: z.string().trim().min(1),
  what: z.string().trim().min(1),
  why: z.string().trim().min(1),
  edge: z.string().trim().min(1),
  sourceText: z.string().optional(),
  sourcePositionSec: z.number().int().min(0).optional(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  tags: z.array(z.string()).optional(),
});

// POST /insights → Insight
// Creates the node AND its spaced-repetition schedule row in one transaction,
// replacing the old `schedule_insight_review` DB trigger.
insightsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = saveInsightBody.parse(req.body);
    const uid = userId(req);

    const insight = await prisma.$transaction(async (tx) => {
      const created = await tx.insight.create({
        data: {
          userId: uid,
          sourceContentId: input.sourceContentId ?? null,
          title: input.title,
          what: input.what,
          why: input.why,
          edge: input.edge,
          sourceText: input.sourceText ?? null,
          sourcePositionSec: input.sourcePositionSec ?? null,
          tier: input.tier ?? 2,
          tags: input.tags ?? [],
        },
      });
      await tx.insightReview.create({
        data: { userId: uid, insightId: created.id, dueAt: dueDateAfter(1) },
      });
      return created;
    });

    res.status(201).json(toInsight(insight));
  }),
);

const listQuery = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// GET /insights?q=&limit=&offset= → Insight[]
// With `q`: keyword search across title/what/why/edge. Without: newest-first list.
insightsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q, limit, offset } = listQuery.parse(req.query);
    const uid = userId(req);

    if (q && q.length > 0) {
      const rows = await prisma.insight.findMany({
        where: {
          userId: uid,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { what: { contains: q, mode: 'insensitive' } },
            { why: { contains: q, mode: 'insensitive' } },
            { edge: { contains: q, mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: limit ?? 30,
      });
      res.json(rows.map(toInsight));
      return;
    }

    const rows = await prisma.insight.findMany({
      where: { userId: uid },
      orderBy: { createdAt: 'desc' },
      skip: offset ?? 0,
      take: limit ?? 50,
    });
    res.json(rows.map(toInsight));
  }),
);

// ── Manual linking ────────────────────────────────────────────────────────────

const linkBody = z.object({
  fromInsightId: z.string().uuid(),
  toInsightId: z.string().uuid(),
  reason: z.string().optional(),
});

// POST /insights/links → InsightEdge (manual, strength 1.0)
insightsRouter.post(
  '/links',
  asyncHandler(async (req, res) => {
    const { fromInsightId, toInsightId, reason } = linkBody.parse(req.body);
    if (fromInsightId === toInsightId) throw badRequest('Cannot link an insight to itself');
    const uid = userId(req);

    // Both endpoints must belong to the caller (RLS used to guarantee this).
    const owned = await prisma.insight.count({
      where: { userId: uid, id: { in: [fromInsightId, toInsightId] } },
    });
    if (owned !== 2) throw notFound('One or both insights not found');

    const edge = await prisma.insightEdge.create({
      data: { userId: uid, fromInsightId, toInsightId, strength: 1.0, reason: reason ?? null, source: 'manual' },
    });
    res.status(201).json(toInsightEdge(edge));
  }),
);

// ── Graph slice ────────────────────────────────────────────────────────────

// GET /insights/:id/graph → { root, edges, neighbours }
insightsRouter.get(
  '/:id/graph',
  asyncHandler(async (req, res) => {
    const id = requireParam(req, 'id');
    const uid = userId(req);

    const root = await prisma.insight.findFirst({ where: { id, userId: uid } });
    if (!root) throw notFound('Insight not found');

    const edges = await prisma.insightEdge.findMany({
      where: { userId: uid, OR: [{ fromInsightId: id }, { toInsightId: id }] },
    });

    const neighbourIds = Array.from(
      new Set(
        edges.flatMap((e) => [e.fromInsightId, e.toInsightId]).filter((nid) => nid !== id),
      ),
    );
    const neighbours =
      neighbourIds.length > 0
        ? await prisma.insight.findMany({ where: { userId: uid, id: { in: neighbourIds } } })
        : [];

    res.json({
      root: toInsight(root),
      edges: edges.map(toInsightEdge),
      neighbours: neighbours.map(toInsight),
    });
  }),
);

// ── Share tracking (§4E) ──────────────────────────────────────────────────────

// POST /insights/:id/share { platform? } → { ok: true }   (best-effort, non-fatal)
insightsRouter.post(
  '/:id/share',
  asyncHandler(async (req, res) => {
    const id = requireParam(req, 'id');
    const { platform } = z.object({ platform: z.string().optional() }).parse(req.body ?? {});
    try {
      await prisma.insightShare.create({
        data: { userId: userId(req), insightId: id, platform: platform ?? null },
      });
    } catch {
      // Analytics only — never block the user's share flow.
    }
    res.json({ ok: true });
  }),
);

// ── Quiz (§3) ────────────────────────────────────────────────────────────────

// GET /insights/:id/quiz → QuizQuestion[]  (cached, else generate — AI chunk)
insightsRouter.get(
  '/:id/quiz',
  asyncHandler(async (req, res) => {
    const id = requireParam(req, 'id');
    const cached = await prisma.insightQuizQuestion.findMany({
      where: { insightId: id, userId: userId(req) },
      orderBy: { displayOrder: 'asc' },
    });
    if (cached.length === 3) {
      res.json(cached.map(toQuizQuestion));
      return;
    }
    await generateQuizQuestions(id); // throws 503 until the AI chunk lands
  }),
);

const attemptBody = z.object({
  correctCount: z.number().int().min(0),
  totalCount: z.number().int().positive(),
});

// POST /insights/:id/quiz/attempt → QuizAttempt
// Logs the attempt AND nudges the SR schedule: pass (≥2/3) advances a step,
// fail (≤1/3) rolls one back, middle = no change.
insightsRouter.post(
  '/:id/quiz/attempt',
  asyncHandler(async (req, res) => {
    const insightId = requireParam(req, 'id');
    const { correctCount, totalCount } = attemptBody.parse(req.body);
    const uid = userId(req);

    const attempt = await prisma.insightQuizAttempt.create({
      data: { userId: uid, insightId, correctCount, totalCount },
    });

    // SR nudge — non-fatal so the user always gets their score back.
    try {
      const passed = totalCount >= 3 && correctCount >= 2;
      const failed = totalCount >= 3 && correctCount <= 1;
      if (passed || failed) {
        const review = await prisma.insightReview.findFirst({
          where: { insightId, userId: uid },
          select: { id: true, step: true },
        });
        if (review) {
          const nextStep = Math.max(0, review.step + (passed ? 1 : -1));
          await prisma.insightReview.update({
            where: { id: review.id },
            data: { step: nextStep, dueAt: dueDateAfter(intervalDaysForStep(nextStep)) },
          });
        }
      }
    } catch {
      // Ignore — the attempt itself is recorded; SR adjustment is best-effort.
    }

    res.status(201).json(toQuizAttempt(attempt));
  }),
);
