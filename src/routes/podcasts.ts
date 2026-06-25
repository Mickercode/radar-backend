import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/http';
import { searchPodcasts, getEpisodes, getEpisodesByFeedUrl } from '../lib/podcast-index';

// Public podcast search + episode discovery — no auth required. The user searches
// for a podcast, picks one, and streams episodes directly from the source audio
// URL via the built-in player. No content is stored on our side.
export const podcastsRouter = Router();

// GET /podcasts/search?q=term&max=20 → { status, feeds, count }
// Searches the Podcast Index catalog for matching shows.
podcastsRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const { q, max } = z
      .object({
        q: z.string().trim().min(1, 'Search term is required'),
        max: z.coerce.number().int().min(1).max(100).optional(),
      })
      .parse(req.query);

    const result = await searchPodcasts(q, max ?? 20);
    res.json(result);
  }),
);

// GET /podcasts/:id/episodes?max=20 → { status, items, count }
// Returns episodes for a podcast by Podcast Index feed ID.
podcastsRouter.get(
  '/:id/episodes',
  asyncHandler(async (req, res) => {
    const { id, max } = z
      .object({
        id: z.coerce.number().int().positive(),
        max: z.coerce.number().int().min(1).max(100).optional(),
      })
      .parse({ id: req.params.id, ...req.query });

    const result = await getEpisodes(id, max ?? 20);
    res.json(result);
  }),
);

// GET /podcasts/by-feed-url?url=<encoded>&max=20 → { status, items, count }
// Returns episodes for a podcast by RSS feed URL (alternative to feed ID lookup).
podcastsRouter.get(
  '/by-feed-url/episodes',
  asyncHandler(async (req, res) => {
    const { url, max } = z
      .object({
        url: z.string().url('Valid feed URL is required'),
        max: z.coerce.number().int().min(1).max(100).optional(),
      })
      .parse(req.query);

    const result = await getEpisodesByFeedUrl(url, max ?? 20);
    res.json(result);
  }),
);
