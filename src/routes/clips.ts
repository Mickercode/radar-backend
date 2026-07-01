import { Router } from 'express';
import Parser from 'rss-parser';
import { asyncHandler } from '../lib/http';
import { YOUTUBE_CHANNELS, PROMO_TITLE_PATTERNS } from '../jobs/feeds';

export const clipsRouter = Router();

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface YtItem {
  title?: string;
  id?: string;
  videoId?: string;
  link?: string;
  isoDate?: string;
  contentSnippet?: string;
  content?: string;
}

const parser: Parser<unknown, YtItem> = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': UA },
  customFields: { item: [['yt:videoId', 'videoId']] },
});

function videoId(item: YtItem): string {
  return item.videoId ?? (item.id ?? '').replace('yt:video:', '');
}

function looksLikePromo(title: string): boolean {
  return PROMO_TITLE_PATTERNS.some(re => re.test(title));
}

// GET /clips/live — fetch fresh YouTube videos directly from RSS, no ingest needed.
// Returns up to 30 items across all configured channels, newest first.
clipsRouter.get(
  '/clips/live',
  asyncHandler(async (_req, res) => {
    const results = await Promise.allSettled(
      YOUTUBE_CHANNELS.map(async ch => {
        const feed = await parser.parseURL(
          `https://www.youtube.com/feeds/videos.xml?channel_id=${ch.channelId}`,
        );
        return (feed.items ?? [])
          .slice(0, 6)
          .filter(it => it.title && !looksLikePromo(it.title))
          .map(it => {
            const vid = videoId(it);
            return {
              id: `yt:${vid}`,
              type: 'clip' as const,
              title: it.title!.trim(),
              source: ch.source,
              topic: ch.topic,
              duration: 0,
              videoUrl: `https://www.youtube.com/watch?v=${vid}`,
              thumbnailUrl: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
              articleUrl: `https://www.youtube.com/watch?v=${vid}`,
              createdAt: it.isoDate ?? new Date().toISOString(),
              summary: undefined,
            };
          });
      }),
    );

    type ClipItem = {
      id: string; type: 'clip'; title: string; source: string; topic: string;
      duration: number; videoUrl: string; thumbnailUrl: string; articleUrl: string;
      createdAt: string; summary: undefined;
    };

    // Merge fulfilled results and round-robin across channels
    const groups: ClipItem[][] = results
      .filter((r): r is PromiseFulfilledResult<ClipItem[]> => r.status === 'fulfilled')
      .map(r => r.value);

    const out: ClipItem[] = [];
    const max = Math.max(0, ...groups.map(g => g.length));
    for (let i = 0; i < max; i++) {
      for (const g of groups) {
        if (i < g.length) out.push(g[i]!);
      }
    }

    res.json(out.slice(0, 30));
  }),
);
