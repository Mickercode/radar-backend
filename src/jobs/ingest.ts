import { PrismaClient } from '@prisma/client';
import Parser from 'rss-parser';
import {
  MAX_CLIP_DURATION_SEC,
  MAX_PODCAST_DURATION_SEC,
  MIN_CLIP_DURATION_SEC,
  MIN_PODCAST_DURATION_SEC,
  NEWS_FEEDS,
  PER_NEWS_FEED,
  PER_PODCAST_FEED,
  PER_YOUTUBE_CHANNEL,
  PODCAST_FEEDS,
  PROMO_TITLE_PATTERNS,
  TARGET_CLIPS,
  TARGET_NEWS,
  TARGET_PODCASTS,
  YOUTUBE_CHANNELS,
} from './feeds';
import { generateSummary, type SummaryResult } from './editorial';

// Radar ingestion worker. Pulls RSS (news + podcasts) + YouTube clips, scores
// them through the Claude editorial engine, and writes publishable rows (Tier
// 1/2). Round-robins across sources so every outlet (incl. Nigerian ones) and
// content type gets represented. Dedup by (source,title)/external_id keeps
// re-runs cheap. Self-contained env: DATABASE_URL + ANTHROPIC_API_KEY (+ GOOGLE_API_KEY).

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

// Browser-ish UA — several Nigerian outlets (e.g. TheCable) 403 a plain bot UA.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const parser: Parser<unknown, FeedItem> = new Parser({
  timeout: 20000,
  headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
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
    summary: s.what,
    keyTakeaways: [s.why, s.edge].filter((x) => x.length > 0),
    whyItMatters: s.why,
  };
}

// Interleave groups so we round-robin across sources: [A0,B0,C0,A1,B1,...].
function roundRobin<T>(groups: T[][]): T[] {
  const out: T[] = [];
  const max = Math.max(0, ...groups.map((g) => g.length));
  for (let i = 0; i < max; i++) for (const g of groups) if (i < g.length) out.push(g[i]!);
  return out;
}

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
  return !!(await prisma.content.findFirst({ where: { source, title }, select: { id: true } }));
}

interface Stats {
  news: number; podcasts: number; clips: number;
  skippedPromo: number; skippedDuration: number; skippedIrrelevant: number; skippedTier3: number;
}

// ── News ─────────────────────────────────────────────────────────────────────

async function ingestNews(stats: Stats, budget: { left: number }) {
  // Gather candidates per feed, then round-robin so sources interleave.
  const groups: { source: string; topic: string; topicId: string; item: FeedItem }[][] = [];
  for (const feed of NEWS_FEEDS) {
    try {
      const topicId = await getTopicId(feed.topic);
      const parsed = await parser.parseURL(feed.url);
      groups.push(
        (parsed.items ?? []).slice(0, PER_NEWS_FEED).map((item) => ({ source: feed.source, topic: feed.topic, topicId, item })),
      );
    } catch (e) {
      console.warn(`[ingest] news feed failed: ${feed.source}`, (e as Error).message);
    }
  }

  for (const c of roundRobin(groups)) {
    if (budget.left <= 0) break;
    const title = c.item.title?.trim();
    if (!title) continue;
    if (looksLikePromo(title)) { stats.skippedPromo++; continue; }
    if (await alreadyHave(c.source, title)) continue;

    const description = descriptionOf(c.item);
    const s = await generateSummary(title, description, c.topic);
    if (!s.relevant) { stats.skippedIrrelevant++; continue; }
    if (s.tier === 3) { stats.skippedTier3++; continue; }

    await prisma.content.create({
      data: {
        type: 'news', title, source: c.source,
        duration: estimateReadTime(description),
        thumbnailUrl: imageOf(c.item), articleUrl: c.item.link ?? null,
        topicId: c.topicId, summary: { create: summaryData(s) },
      },
    });
    stats.news++; budget.left--;
  }
}

// ── Podcasts ─────────────────────────────────────────────────────────────────

async function ingestPodcasts(stats: Stats, budget: { left: number }) {
  const groups: { source: string; topic: string; topicId: string; item: FeedItem }[][] = [];
  for (const feed of PODCAST_FEEDS) {
    try {
      const topicId = await getTopicId(feed.topic);
      const parsed = await parser.parseURL(feed.url);
      groups.push(
        (parsed.items ?? []).slice(0, PER_PODCAST_FEED).map((item) => ({ source: feed.source, topic: feed.topic, topicId, item })),
      );
    } catch (e) {
      console.warn(`[ingest] podcast feed failed: ${feed.source}`, (e as Error).message);
    }
  }

  for (const c of roundRobin(groups)) {
    if (budget.left <= 0) break;
    const title = c.item.title?.trim();
    if (!title) continue;
    if (looksLikePromo(title)) { stats.skippedPromo++; continue; }

    const duration = parseItunesDuration(c.item.itunes?.duration) ?? 1800;
    if (duration < MIN_PODCAST_DURATION_SEC || duration > MAX_PODCAST_DURATION_SEC) { stats.skippedDuration++; continue; }
    if (await alreadyHave(c.source, title)) continue;

    const description = descriptionOf(c.item);
    const s = await generateSummary(title, description, c.topic);
    if (!s.relevant) { stats.skippedIrrelevant++; continue; }
    if (s.tier === 3) { stats.skippedTier3++; continue; }

    const created = await prisma.content.create({
      data: {
        type: 'podcast', title, source: c.source, duration,
        thumbnailUrl: imageOf(c.item), audioUrl: c.item.enclosure?.url ?? null,
        topicId: c.topicId, summary: { create: summaryData(s) },
      },
      select: { id: true },
    });
    const moments = synthesizeMoments(duration).map((m) => ({ contentId: created.id, ...m }));
    if (moments.length) await prisma.keyMoment.createMany({ data: moments });

    stats.podcasts++; budget.left--;
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
  timeout: 20000,
  headers: { 'User-Agent': UA },
  customFields: { item: [['yt:videoId', 'videoId']] },
});

async function ingestClips(stats: Stats, budget: { left: number }) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.log('[ingest] GOOGLE_API_KEY not set — skipping YouTube clips');
    return;
  }
  interface ClipCand {
    source: string; topic: string; topicId: string;
    videoId: string; title: string; description: string; duration: number;
  }

  // Gather fresh candidates across channels, then round-robin.
  const groups: ClipCand[][] = [];
  for (const ch of YOUTUBE_CHANNELS) {
    try {
      const topicId = await getTopicId(ch.topic);
      const parsed = await ytParser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.channelId}`);
      const cands = (parsed.items ?? [])
        .slice(0, PER_YOUTUBE_CHANNEL)
        .map((it) => ({
          source: ch.source, topic: ch.topic, topicId,
          videoId: it.videoId || (it.id ?? '').replace('yt:video:', ''),
          title: it.title?.trim() ?? '', description: descriptionOf(it),
        }))
        .filter((c) => c.videoId && c.title);
      if (cands.length === 0) continue;

      const existing = await prisma.content.findMany({
        where: { externalId: { in: cands.map((c) => c.videoId) } },
        select: { externalId: true },
      });
      const seen = new Set(existing.map((r) => r.externalId));
      const fresh = cands.filter((c) => !seen.has(c.videoId));
      if (fresh.length === 0) continue;

      const durations = await fetchDurations(fresh.map((c) => c.videoId), apiKey);
      const kept: ClipCand[] = [];
      for (const c of fresh) {
        const d = durations.get(c.videoId) ?? 0;
        if (d < MIN_CLIP_DURATION_SEC || d > MAX_CLIP_DURATION_SEC) { stats.skippedDuration++; continue; }
        kept.push({ ...c, duration: d });
      }
      if (kept.length) groups.push(kept);
    } catch (e) {
      console.warn(`[ingest] youtube channel failed: ${ch.source}`, (e as Error).message);
    }
  }

  for (const c of roundRobin(groups)) {
    if (budget.left <= 0) break;
    if (looksLikePromo(c.title)) { stats.skippedPromo++; continue; }
    const s = await generateSummary(c.title, c.description, c.topic);
    if (!s.relevant) { stats.skippedIrrelevant++; continue; }
    if (s.tier === 3) { stats.skippedTier3++; continue; }

    await prisma.content.create({
      data: {
        type: 'clip', title: c.title, source: c.source, duration: c.duration,
        thumbnailUrl: `https://i.ytimg.com/vi/${c.videoId}/hqdefault.jpg`,
        videoUrl: `https://www.youtube.com/watch?v=${c.videoId}`,
        externalId: c.videoId, aspectRatio: 0.5625, topicId: c.topicId,
        summary: { create: summaryData(s) },
      },
    });
    stats.clips++; budget.left--;
  }
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export async function runIngest() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[ingest] ANTHROPIC_API_KEY is MISSING — every item will be dropped. Set it on this service.');
  } else {
    console.log('[ingest] ANTHROPIC_API_KEY present ✓');
  }
  console.log(`[ingest] targets — news=${TARGET_NEWS} podcasts=${TARGET_PODCASTS} clips=${TARGET_CLIPS}`);

  const stats: Stats = {
    news: 0, podcasts: 0, clips: 0,
    skippedPromo: 0, skippedDuration: 0, skippedIrrelevant: 0, skippedTier3: 0,
  };

  await ingestNews(stats, { left: TARGET_NEWS });
  await ingestPodcasts(stats, { left: TARGET_PODCASTS });
  await ingestClips(stats, { left: TARGET_CLIPS });

  const total = stats.news + stats.podcasts + stats.clips;
  console.log(`[ingest] done — inserted ${total}`, stats);
  return { total, ...stats };
}

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
