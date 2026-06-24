import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, requireParam } from '../lib/http';
import { requireAuth, userId } from '../middleware/auth';
import { toContentItem } from '../lib/serialize';

// Per-user state: saved items, playback position, preferences. Every query is
// scoped to the JWT's user id (what RLS used to enforce). requireAuth is applied
// per-route (not router-wide) — this router mounts at root, and a router-level
// guard would 401 every unmatched path instead of letting it 404.
export const libraryRouter = Router();

// ── Saved items ────────────────────────────────────────────────────────────

// GET /saved → ContentItem[] (newest saved first)
libraryRouter.get(
  '/saved',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await prisma.savedItem.findMany({
      where: { userId: userId(req) },
      orderBy: { savedAt: 'desc' },
      include: { content: { include: { summary: true } } },
    });
    res.json(rows.map((r) => toContentItem(r.content)));
  }),
);

// POST /saved { contentId } → { ok: true }  (idempotent)
libraryRouter.post(
  '/saved',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { contentId } = z.object({ contentId: z.string().uuid() }).parse(req.body);
    await prisma.savedItem.upsert({
      where: { userId_contentId: { userId: userId(req), contentId } },
      create: { userId: userId(req), contentId },
      update: {},
    });
    res.status(201).json({ ok: true });
  }),
);

// DELETE /saved/:contentId → { ok: true }  (no-op if not saved)
libraryRouter.delete(
  '/saved/:contentId',
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.savedItem.deleteMany({
      where: { userId: userId(req), contentId: requireParam(req, 'contentId') },
    });
    res.json({ ok: true });
  }),
);

// ── Playback state ───────────────────────────────────────────────────────────

// GET /playback/:contentId → { position, speed } | null
libraryRouter.get(
  '/playback/:contentId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await prisma.playbackState.findUnique({
      where: {
        userId_contentId: { userId: userId(req), contentId: requireParam(req, 'contentId') },
      },
    });
    res.json(row ? { position: row.position, speed: row.speed.toNumber() } : null);
  }),
);

// PUT /playback/:contentId { position, speed } → { ok: true }
const playbackBody = z.object({
  position: z.number().int().min(0),
  speed: z.number().positive(),
});
libraryRouter.put(
  '/playback/:contentId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { position, speed } = playbackBody.parse(req.body);
    const contentId = requireParam(req, 'contentId');
    await prisma.playbackState.upsert({
      where: { userId_contentId: { userId: userId(req), contentId } },
      create: { userId: userId(req), contentId, position, speed },
      update: { position, speed },
    });
    res.json({ ok: true });
  }),
);

// ── Preferences ──────────────────────────────────────────────────────────────
// Kept in snake_case to match the app's existing `UserPreferencesRow` interface
// exactly, so the rewire is a pure transport swap.

// GET /preferences → UserPreferencesRow | null
libraryRouter.get(
  '/preferences',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await prisma.userPreferences.findUnique({ where: { userId: userId(req) } });
    res.json(
      row
        ? {
            topic_ids: row.topicIds,
            content_types: row.contentTypes,
            playback_speed: row.playbackSpeed.toNumber(),
            push_token: row.pushToken,
            preferred_country: row.preferredCountry,
            notifications_enabled: row.notificationsEnabled,
            digest_time: row.digestTime,
            review_reminders: row.reviewReminders,
          }
        : null,
    );
  }),
);

// PUT /preferences { topic_ids?, content_types?, playback_speed?, push_token?, preferred_country?, notifications_enabled?, digest_time?, review_reminders? }
const prefsBody = z.object({
  topic_ids: z.array(z.string().uuid()).optional(),
  content_types: z.array(z.string()).optional(),
  playback_speed: z.number().positive().optional(),
  push_token: z.string().nullable().optional(),
  preferred_country: z.enum(['NG', 'AFRICA', 'INTL']).nullable().optional(),
  notifications_enabled: z.boolean().optional(),
  digest_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  review_reminders: z.boolean().optional(),
});
libraryRouter.put(
  '/preferences',
  requireAuth,
  asyncHandler(async (req, res) => {
    const p = prefsBody.parse(req.body);
    const uid = userId(req);
    await prisma.userPreferences.upsert({
      where: { userId: uid },
      create: {
        userId: uid,
        topicIds: p.topic_ids ?? [],
        contentTypes: p.content_types ?? [],
        playbackSpeed: p.playback_speed ?? 1.0,
        pushToken: p.push_token ?? null,
        preferredCountry: p.preferred_country ?? null,
        notificationsEnabled: p.notifications_enabled ?? false,
        digestTime: p.digest_time ?? null,
        reviewReminders: p.review_reminders ?? true,
      },
      update: {
        ...(p.topic_ids !== undefined && { topicIds: p.topic_ids }),
        ...(p.content_types !== undefined && { contentTypes: p.content_types }),
        ...(p.playback_speed !== undefined && { playbackSpeed: p.playback_speed }),
        ...(p.push_token !== undefined && { pushToken: p.push_token }),
        ...(p.preferred_country !== undefined && { preferredCountry: p.preferred_country }),
        ...(p.notifications_enabled !== undefined && { notificationsEnabled: p.notifications_enabled }),
        ...(p.digest_time !== undefined && { digestTime: p.digest_time }),
        ...(p.review_reminders !== undefined && { reviewReminders: p.review_reminders }),
      },
    });
    res.json({ ok: true });
  }),
);
