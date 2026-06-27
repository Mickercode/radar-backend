import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, requireParam, notFound } from '../lib/http';
import { requireAuth, userId } from '../middleware/auth';
import { toNote } from '../lib/serialize';

export const notesRouter = Router();
notesRouter.use(requireAuth);

// GET /notes?limit=&offset= → Note[] (newest updated first)
const listQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
notesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { limit, offset } = listQuery.parse(req.query);
    const rows = await prisma.note.findMany({
      where: { userId: userId(req) },
      orderBy: { updatedAt: 'desc' },
      skip: offset ?? 0,
      take: limit ?? 100,
    });
    res.json(rows.map(toNote));
  }),
);

// POST /notes { title?, body? } → Note
const createBody = z.object({
  title: z.string().max(500).optional(),
  body: z.string().max(100_000).optional(),
});
notesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { title, body } = createBody.parse(req.body);
    const note = await prisma.note.create({
      data: { userId: userId(req), title: title ?? '', body: body ?? '' },
    });
    res.status(201).json(toNote(note));
  }),
);

// PATCH /notes/:id { title?, body? } → Note
const updateBody = z.object({
  title: z.string().max(500).optional(),
  body: z.string().max(100_000).optional(),
});
notesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = requireParam(req, 'id');
    const uid = userId(req);
    const changes = updateBody.parse(req.body);

    const existing = await prisma.note.findFirst({ where: { id, userId: uid }, select: { id: true } });
    if (!existing) throw notFound('Note not found');

    const note = await prisma.note.update({
      where: { id },
      data: {
        ...(changes.title !== undefined && { title: changes.title }),
        ...(changes.body !== undefined && { body: changes.body }),
      },
    });
    res.json(toNote(note));
  }),
);

// DELETE /notes/:id → { ok: true }
notesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = requireParam(req, 'id');
    const uid = userId(req);

    const existing = await prisma.note.findFirst({ where: { id, userId: uid }, select: { id: true } });
    if (!existing) throw notFound('Note not found');

    await prisma.note.delete({ where: { id } });
    res.json({ ok: true });
  }),
);
