import { PrismaClient } from '@prisma/client';
import Parser from 'rss-parser';
import {
  DAILY_PUBLISH_CAP,
  MAX_CLIP_DURATION_SEC,
  MAX_PODCAST_DURATION_SEC,
  MIN_CLIP_DURATION_SEC,
  MIN_PODCAST_DURATION_SEC,
  NEWS_FEEDS,
  PODCAST_FEEDS,
  PROMO_TITLE_PATTERNS,
  YOUTUBE_CHANNELS,
} from './feeds';
import { generateSummary, type SummaryResult } from './editorial';

// Radar ingestion worker. Ported from the old ingest-content Edge Function:
// pulls RSS (news + podcasts) + YouTube clips, runs them through the Gemini
// editorial engine, and writes publishable rows (Tier 1/2) to content/summaries/
// key_moments — capped at 10/day (PLAYBOOK §7). Runs as a Render Cron Job.
// Self-contained env: needs DATABASE_URL + GEMINI_API_KEY (+ GOOGLE_API_KEY for clips).

const prisma = new PrismaClient();

interface FeedItem {
  title?: string;
  link?: string;
  content?: string;
  contentSnippet?: string;
  contentEncoded?: string;
  isoDate?: string;
  enclosure?: { url?: string; type?: string };
  itunes?: { duration?: string; image?: string };
  mediaThumbnail?: { $?: { url?: string } };
}

const parser: Parser<unknown, FeedItem> = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'Radar/1.0' },
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['media:thumbnail', 'mediaThumbnail'],
    ],
  },
});

// ── Helpers ────────────────────────────────────────────────────────────────

const ACRONYMS = new Set(['ai', 'ml', 'api', 'uk', 'us', 'eu', 'nyc']);
function slugToName(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

function looksLikePromo(title: string): boolean {
  return PROMO_TITLE_PATTERNS.some((re) => re.test(title));
}

function estimateReadTime(description: string): number {
  const text = description.replace(/<[^>]*>/g, '').trim();
  if (!text) return 180;
  return Math.max(60, Math.round((text.split(/\s+/).length / 200) * 60));
}

function parseItunesDuration(raw: string | undefined): number | null {
  if (!raw) return null;
  const parts = raw.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  return parts[0]! > 0 ? parts[0]! : null;
}

function descriptionOf(item: FeedItem): string {
  return item.contentEncoded || item.content || item.contentSnippet || '';
}

function imageOf(item: FeedItem): string | null {
  if (item.itunes?.image) return item.itunes.image;
  if (item.mediaThumbnail?.$?.url) return item.mediaThumbnail.$.url;
  if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) return item.enclosure.url;
  const m = descriptionOf(item).match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1]! : null;
}

const MOMENT_LABELS = [
  'Introduction and overview',
  'Main topic begins',
  'Key insight discussed',
  'Deep dive into details',
  'Conclusions and takeaways',
];
function synthesizeMoments(duration: number) {
  const count = Math.min(5, Math.max(3, Math.floor(duration / 600)));
  return Array.from({ length: count }, (_, i) => ({
    timestampSec: Math.round((duration / (count + 1)) * (i + 1)),
    label: MOMENT_LABELS[i] ?? `Segment ${i + 1}`,
  }));
}

function summaryData(s: SummaryResult) {
  return {
    what: s.what, why: s.why, edge: s.edge, tier: s.tier,
    forwardable: s.forwardable, advantage: s.advantage,
    nonObvious: s.non_obvious, learnable: s.learnable,
    nigeriaRelevance: s.nigeria_relevance,
    // Legacy mirror so any non-§4 consumer still renders.
    summary: s.what,
    keyTakeaways: [s.why, s.edge].filter((x) => x.length > 0),
    whyItMatters: s.why,
  };
}

// Topic upsert-on-demand, cached per run.
const topicCache: Record<string, string> = {};
async function getTopicId(slug: string): Promise<string> {
  if (topicCache[slug]) return topicCache[slug]!;
  const topic = await prisma.topic.upsert({
    where: { slug },
    create: { slug, name: slugToName(slug) },
    update: {},
    select: { id: true },
  });
  topicCache[slug] = topic.id;
  return topic.id;
}

async function alreadyHave(source: string, title: string): Promise<boolean> {
  const row = await prisma.content.findFirst({ where: { source, title }, select: { id: true } });
  return !!row;
}

interface Stats {
  news: number; podcasts: number; clips: number;
  skippedPromo: number; skippedDuration: number; skippedIrrelevant: number; skippedTier3: number;
}

// ── News ─────────────────────────────────────────────────────────────────────

async function ingestNews(stats: Stats, budget: { left: number }) {
  for (const feed of NEWS_FEEDS) {
    if (budget.left <= 0) break;
    try {
      const topicId = await getTopicId(feed.topic);
      const parsed = await parser.parseURL(feed.url);
      for (const item of (parsed.items ?? []).slice(0, 5)) {
        if (budget.left <= 0) break;
        const title = item.title?.trim();
        if (!title) continue;
        if (looksLikePromo(title)) { stats.skippedPromo++; continue; }
        if (await alreadyHave(feed.source, title)) continue;

        const description = descriptionOf(item);
        const s = await generateSummary(title, description, feed.topic);
        if (!s.relevant) { stats.skippedIrrelevant++; continue; }
        if (s.tier === 3) { stats.skippedTier3++; continue; }

        await prisma.content.create({
          data: {
            type: 'news', title, source: feed.source,
            duration: estimateReadTime(description),
            thumbnailUrl: imageOf(item), articleUrl: item.link ?? null,
            topicId,
            summary: { create: summaryData(s) },
          },
        });
        stats.news++; budget.left--;
      }
    } catch (e) {
      console.warn(`[ingest] news feed failed: ${feed.source}`, (e as Error).message);
    }
  }
}

// ── Podcasts ─────────────────────────────────────────────────────────────────

async function ingestPodcasts(stats: Stats, budget: { left: number }) {
  for (const feed of PODCAST_FEEDS) {
    if (budget.left <= 0) break;
    try {
      const topicId = await getTopicId(feed.topic);
      const parsed = await parser.parseURL(feed.url);
      for (const item of (parsed.items ?? []).slice(0, 3)) {
        if (budget.left <= 0) break;
        const title = item.title?.trim();
        if (!title) continue;
        if (looksLikePromo(title)) { stats.skippedPromo++; continue; }

        const duration = parseItunesDuration(item.itunes?.duration) ?? 1800;
        if (duration < MIN_PODCAST_DURATION_SEC || duration > MAX_PODCAST_DURATION_SEC) {
          stats.skippedDuration++; continue;
        }
        if (await alreadyHave(feed.source, title)) continue;

        const description = descriptionOf(item);
        const s = await generateSummary(title, description, feed.topic);
        if (!s.relevant) { stats.skippedIrrelevant++; continue; }
        if (s.tier === 3) { stats.skippedTier3++; continue; }

        const created = await prisma.content.create({
          data: {
            type: 'podcast', title, source: feed.source, duration,
            thumbnailUrl: imageOf(item), audioUrl: item.enclosure?.url ?? null,
            topicId,
            summary: { create: summaryData(s) },
          },
          select: { id: true },
        });
        const moments = synthesizeMoments(duration).map((m) => ({ contentId: created.id, ...m }));
        if (moments.length) await prisma.keyMoment.createMany({ data: moments });

        stats.podcasts++; budget.left--;
      }
    } catch (e) {
      console.warn(`[ingest] podcast feed failed: ${feed.source}`, (e as Error).message);
    }
  }
}

// ── YouTube clips (needs GOOGLE_API_KEY for durations) ───────────────────────

interface YtItem extends FeedItem {
  videoId?: string;
  id?: string;
}

function isoDurationToSec(iso: string): number {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  return (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
}

async function fetchDurations(ids: string[], apiKey: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${batch.join(',')}&key=${apiKey}`,
      );
      if (!res.ok) continue;
      const data = (await res.json()) as { items?: { id: string; contentDetails?: { duration?: string } }[] };
      for (const it of data.items ?? []) {
        if (it.contentDetails?.duration) out.set(it.id, isoDurationToSec(it.contentDetails.duration));
      }
    } catch {
      /* skip batch */
    }
  }
  return out;
}

const ytParser: Parser<unknown, YtItem> = new Parser({
  timeout: 15000,
  customFields: { item: [['yt:videoId', 'videoId']] },
});

async function ingestClips(stats: Stats, budget: { left: number }) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.log('[ingest] GOOGLE_API_KEY not set — skipping YouTube clips');
    return;
  }
  for (const ch of YOUTUBE_CHANNELS) {
    if (budget.left <= 0) break;
    try {
      const topicId = await getTopicId(ch.topic);
      const parsed = await ytParser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.channelId}`);
      const candidates = (parsed.items ?? [])
        .slice(0, 10)
        .map((it) => ({ videoId: it.videoId || (it.id ?? '').replace('yt:video:', ''), title: it.title?.trim() ?? '', description: descriptionOf(it) }))
        .filter((c) => c.videoId && c.title);
      if (candidates.length === 0) continue;

      const existing = await prisma.content.findMany({
        where: { externalId: { in: candidates.map((c) => c.videoId) } },
        select: { externalId: true },
      });
      const seen = new Set(existing.map((r) => r.externalId));
      const fresh = candidates.filter((c) => !seen.has(c.videoId));
      if (fresh.length === 0) continue;

      const durations = await fetchDurations(fresh.map((c) => c.videoId), apiKey);

      for (const c of fresh) {
        if (budget.left <= 0) break;
        if (looksLikePromo(c.title)) { stats.skippedPromo++; continue; }
        const duration = durations.get(c.videoId) ?? 0;
        if (duration < MIN_CLIP_DURATION_SEC || duration > MAX_CLIP_DURATION_SEC) {
          stats.skippedDuration++; continue;
        }
        const s = await generateSummary(c.title, c.description, ch.topic);
        if (!s.relevant) { stats.skippedIrrelevant++; continue; }
        if (s.tier === 3) { stats.skippedTier3++; continue; }

        await prisma.content.create({
          data: {
            type: 'clip', title: c.title, source: ch.source, duration,
            thumbnailUrl: `https://i.ytimg.com/vi/${c.videoId}/hqdefault.jpg`,
            videoUrl: `https://www.youtube.com/watch?v=${c.videoId}`,
            externalId: c.videoId, aspectRatio: 0.5625, topicId,
            summary: { create: summaryData(s) },
          },
        });
        stats.clips++; budget.left--;
      }
    } catch (e) {
      console.warn(`[ingest] youtube channel failed: ${ch.source}`, (e as Error).message);
    }
  }
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export async function runIngest() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const publishedToday = await prisma.content.count({ where: { createdAt: { gte: startOfDay } } });
  const budget = { left: Math.max(0, DAILY_PUBLISH_CAP - publishedToday) };
  console.log(`[ingest] publishedToday=${publishedToday} budget=${budget.left}`);

  const stats: Stats = {
    news: 0, podcasts: 0, clips: 0,
    skippedPromo: 0, skippedDuration: 0, skippedIrrelevant: 0, skippedTier3: 0,
  };

  if (budget.left > 0) await ingestNews(stats, budget);
  if (budget.left > 0) await ingestPodcasts(stats, budget);
  if (budget.left > 0) await ingestClips(stats, budget);

  const total = stats.news + stats.podcasts + stats.clips;
  console.log(`[ingest] done — inserted ${total}`, stats);
  return { total, ...stats, budgetRemaining: budget.left };
}

// CLI entry (Render Cron Job runs `node dist/jobs/ingest.js`).
if (require.main === module) {
  runIngest()
    .then(() => prisma.$disconnect())
    .then(() => process.exit(0))
    .catch(async (e) => {
      console.error('[ingest] fatal', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
