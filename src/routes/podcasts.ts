import { Router } from 'express';
import { z } from 'zod';
import Parser from 'rss-parser';
import { asyncHandler } from '../lib/http';
import { searchPodcasts, getEpisodes, getEpisodesByFeedUrl } from '../lib/podcast-index';
import { PODCAST_FEEDS, PROMO_TITLE_PATTERNS } from '../jobs/feeds';

// Public podcast search + episode discovery — no auth required. The user searches
// for a podcast, picks one, and streams episodes directly from the source audio
// URL via the built-in player. No content is stored on our side.
export const podcastsRouter = Router();

interface PodcastItem {
  title?: string;
  isoDate?: string;
  enclosure?: { url?: string; type?: string };
  itunes?: { image?: string; duration?: string };
  image?: { url?: string };
  contentSnippet?: string;
}

const podcastParser: Parser<unknown, PodcastItem> = new Parser({
  timeout: 10000,
  customFields: {
    item: [
      ['itunes:image', 'itunes.image'],
      ['itunes:duration', 'itunes.duration'],
    ],
  },
});

function looksLikePromo(title: string): boolean {
  return PROMO_TITLE_PATTERNS.some(re => re.test(title));
}

function parseItunesDuration(raw: string | undefined): number {
  if (!raw) return 1800;
  const parts = raw.split(':').map(Number);
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  return Number(raw) || 1800;
}

// GET /podcasts/live — fetch episodes directly from PODCAST_FEEDS RSS, no ingest needed.
// Returns up to 30 items across all configured feeds, newest first. No AI summaries.
podcastsRouter.get(
  '/live',
  asyncHandler(async (_req, res) => {
    type PodcastLiveItem = {
      id: string; type: 'podcast'; title: string; source: string; topic: string;
      duration: number; audioUrl?: string; thumbnailUrl?: string; createdAt: string; summary: undefined;
    };

    const results = await Promise.allSettled(
      PODCAST_FEEDS.map(async (feed): Promise<PodcastLiveItem[]> => {
        const parsed = await podcastParser.parseURL(feed.url);
        return (parsed.items ?? [])
          .slice(0, 5)
          .filter(it => it.title && !looksLikePromo(it.title) && it.enclosure?.url)
          .map(it => ({
            id: `pod:${feed.source}:${encodeURIComponent(it.title ?? '')}`,
            type: 'podcast' as const,
            title: (it.title ?? '').trim(),
            source: feed.source,
            topic: feed.topic,
            duration: parseItunesDuration(it.itunes?.duration),
            audioUrl: it.enclosure?.url ?? undefined,
            thumbnailUrl: it.itunes?.image ?? undefined,
            createdAt: it.isoDate ?? new Date().toISOString(),
            summary: undefined,
          }));
      }),
    );

    const groups: PodcastLiveItem[][] = results
      .filter((r): r is PromiseFulfilledResult<PodcastLiveItem[]> => r.status === 'fulfilled')
      .map(r => r.value);

    // Round-robin so topics are interleaved, not all clustered by feed
    const out: PodcastLiveItem[] = [];
    const maxLen = Math.max(0, ...groups.map(g => g.length));
    for (let i = 0; i < maxLen; i++) {
      for (const g of groups) {
        if (i < g.length) out.push(g[i]!);
      }
    }

    res.json(out.slice(0, 30));
  }),
);

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
