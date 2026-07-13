import { PrismaClient } from '@prisma/client';
import Parser from 'rss-parser';
import {
  MAX_CLIP_DURATION_SEC,
  MAX_PODCAST_AGE_DAYS,
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
  TARGET_MEDIASTACK,
  TARGET_NEWS,
  TARGET_PODCASTS,
  YOUTUBE_CHANNELS,
} from './feeds';
import { generateSummary, aiIsHealthy, getAiStatus, type SummaryResult } from './editorial';
import { searchEpisodes as listenNotesSearch, getListenNotesUsage } from '../lib/listennotes';
import { TOPIC_SEARCH_TERMS } from './feeds';
import { sendIngestDigest } from '../lib/email';

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

// Generate podcast chapter markers. Uses OpenRouter (DeepSeek free) to extract
// real topic titles from the episode description; falls back to generic labels
// when the description is too short or the API call fails.
async function generateMoments(
  title: string,
  description: string,
  duration: number,
): Promise<Array<{ timestampSec: number; label: string }>> {
  const count = Math.min(5, Math.max(3, Math.floor(duration / 600)));
  const fallback = Array.from({ length: count }, (_, i) => ({
    timestampSec: Math.round((duration / (count + 1)) * (i + 1)),
    label: MOMENT_LABELS[i] ?? `Segment ${i + 1}`,
  }));

  const orKey = process.env.OPENROUTER_API_KEY;
  const desc = description.replace(/<[^>]*>/g, '').trim();
  if (!orKey || desc.length < 80) return fallback;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orKey}`,
        'HTTP-Referer': 'https://radarproapp.com',
        'X-Title': 'Radar',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat',
        max_tokens: 150,
        temperature: 0.3,
        messages: [
          { role: 'system', content: 'Return ONLY a valid JSON array of strings. No markdown, no explanation.' },
          {
            role: 'user',
            content: `Extract ${count} key discussion topics from this podcast episode. Return a JSON array of ${count} short topic titles (under 8 words each).\n\nTitle: ${title}\nDescription: ${desc.slice(0, 500)}`,
          },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = (data.choices?.[0]?.message?.content ?? '').trim()
      .replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim();
    const labels = JSON.parse(raw) as unknown;
    if (Array.isArray(labels) && labels.length >= 2) {
      return labels.slice(0, count).map((l, i) => ({
        timestampSec: Math.round((duration / (count + 1)) * (i + 1)),
        label: String(l).trim().slice(0, 80) || (fallback[i]?.label ?? `Segment ${i + 1}`),
      }));
    }
  } catch { /* fall through */ }

  return fallback;
}

function summaryData(s: SummaryResult) {
  return {
    what: s.what,
    why: s.why,
    edge: s.how_it_matters_to_you,
    glossary: s.glossary,
    tier: s.tier,
    forwardable: s.forwardable,
    advantage: s.advantage,
    nonObvious: s.non_obvious,
    learnable: s.learnable,
    nigeriaRelevance: s.nigeria_relevance,
    summary: s.what,
    keyTakeaways: s.key_takeaways,
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
  skippedPromo: number; skippedDuration: number; skippedAge: number; skippedIrrelevant: number; skippedTier3: number;
}

// ── Mediastack news ───────────────────────────────────────────────────────────

interface MediastackArticle {
  title: string;
  description: string | null;
  url: string;
  source: string;
  image: string | null;
  category: string;
  country: string;
  published_at: string;
}

// Mediastack category → our topic slug
const MS_CATEGORY_TO_TOPIC: Record<string, string> = {
  general:       'politics',
  business:      'business',
  technology:    'tech',
  entertainment: 'music',
  health:        'health',
  science:       'science',
  sports:        'sports',
};

async function fetchMediastack(params: Record<string, string>): Promise<MediastackArticle[]> {
  const apiKey = process.env.MEDIASTACK_API_KEY;
  if (!apiKey) return [];
  const qs = new URLSearchParams({ access_key: apiKey, languages: 'en', limit: '100', sort: 'published_desc', ...params });
  try {
    // Free-tier Mediastack requires plain HTTP. HTTPS is a paid-only feature.
    const res = await fetch(`http://api.mediastack.com/v1/news?${qs}`);
    if (!res.ok) {
      console.warn(`[ingest] Mediastack ${res.status} for params`, params);
      return [];
    }
    const data = (await res.json()) as { data?: MediastackArticle[] };
    return data.data ?? [];
  } catch (e) {
    console.warn('[ingest] Mediastack fetch error:', (e as Error).message);
    return [];
  }
}

async function ingestNewsFromMediastack(stats: Stats, budget: { left: number }) {
  if (!process.env.MEDIASTACK_API_KEY) {
    console.log('[ingest] MEDIASTACK_API_KEY not set — skipping Mediastack news');
    return;
  }

  // Free tier: 500 req/month. 2 calls × 4 runs/day × 31 days = 248/month (safe).
  // Only run at 00:00, 06:00, 12:00, 18:00 UTC; skip all other hourly runs.
  const utcHour = new Date().getUTCHours();
  if (utcHour % 6 !== 0) {
    console.log(`[ingest] Mediastack skipped (hour=${utcHour} UTC, only runs at 0/6/12/18)`);
    return;
  }

  const ngArticles = await fetchMediastack({ countries: 'ng', categories: 'general,business,technology,sports', limit: '25' });
  await new Promise(r => setTimeout(r, 2000));
  const africaArticles = await fetchMediastack({ countries: 'gh,ke,za,eg', categories: 'business,technology,general', limit: '25' });

  const all = [...ngArticles, ...africaArticles];
  console.log(`[ingest] Mediastack: ${ngArticles.length} Nigeria + ${africaArticles.length} Africa articles`);

  // Round-robin by category so topics interleave evenly.
  const byCategory: Record<string, MediastackArticle[]> = {};
  for (const a of all) {
    if (a.title) (byCategory[a.category] ??= []).push(a);
  }
  const candidates = roundRobin(Object.values(byCategory));

  for (const article of candidates) {
    if (budget.left <= 0) break;
    if (!aiIsHealthy()) { console.warn('[ingest] AI circuit open — stopping news ingest early'); break; }
    const title = article.title?.trim();
    if (!title) continue;
    if (looksLikePromo(title)) { stats.skippedPromo++; continue; }

    const source = article.source || 'Unknown';
    if (await alreadyHave(source, title)) continue;

    const topic = MS_CATEGORY_TO_TOPIC[article.category] ?? 'politics';
    const topicId = await getTopicId(topic);
    const description = article.description ?? '';

    const s = await generateSummary(title, description, topic);
    if (!s.relevant) { stats.skippedIrrelevant++; continue; }
    if (s.tier === 3) { stats.skippedTier3++; continue; }

    try {
      await prisma.content.create({
        data: {
          type: 'news', title, source,
          duration: estimateReadTime(description),
          thumbnailUrl: article.image ?? null,
          articleUrl: article.url ?? null,
          topicId,
          summary: { create: summaryData(s) },
        },
      });
      stats.news++;
      budget.left--;
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') continue;
      throw e;
    }
  }
}

// ── RSS news (niche topics not covered by Mediastack) ─────────────────────────

// Shuffle so different feeds get priority on different runs (provides variety
// without needing an in-memory round-robin groups array that blows the heap).
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

async function ingestNews(stats: Stats, budget: { left: number }) {
  // Group by topic so every interest gets at least one feed processed before
  // any topic gets a second. Shuffle within each group for per-run variety.
  const byTopic: Record<string, typeof NEWS_FEEDS> = {};
  for (const feed of NEWS_FEEDS) (byTopic[feed.topic] ??= []).push(feed);
  const ordered = roundRobin(Object.values(byTopic).map(shuffled));

  for (const feed of ordered) {
    if (budget.left <= 0) break;
    if (!aiIsHealthy()) { console.warn('[ingest] AI circuit open — stopping RSS news ingest early'); break; }

    let items: FeedItem[];
    try {
      const parsed = await parser.parseURL(feed.url);
      items = (parsed.items ?? []).slice(0, PER_NEWS_FEED);
    } catch (e) {
      console.warn(`[ingest] news feed failed: ${feed.source}`, (e as Error).message);
      continue;
    }

    const topicId = await getTopicId(feed.topic);

    for (const item of items) {
      if (budget.left <= 0) break;
      if (!aiIsHealthy()) break;
      const title = item.title?.trim();
      if (!title) continue;
      if (looksLikePromo(title)) { stats.skippedPromo++; continue; }
      if (await alreadyHave(feed.source, title)) continue;

      const description = descriptionOf(item);
      const s = await generateSummary(title, description, feed.topic);
      if (!s.relevant) { stats.skippedIrrelevant++; continue; }
      if (s.tier === 3) { stats.skippedTier3++; continue; }

      try {
        await prisma.content.create({
          data: {
            type: 'news', title, source: feed.source,
            duration: estimateReadTime(description),
            thumbnailUrl: imageOf(item), articleUrl: item.link ?? null,
            topicId, summary: { create: summaryData(s) },
          },
        });
        stats.news++; budget.left--;
      } catch (e) {
        if ((e as { code?: string }).code === 'P2002') continue;
        throw e;
      }
    }
  }
}

// ── Podcasts ─────────────────────────────────────────────────────────────────

async function savePodcastEpisode(
  title: string, source: string, description: string, topic: string, topicId: string,
  duration: number, thumbnailUrl: string | null, audioUrl: string | null,
  stats: Stats, budget: { left: number },
): Promise<boolean> {
  const s = await generateSummary(title, description, topic);
  if (!s.relevant) { stats.skippedIrrelevant++; return false; }
  if (s.tier === 3) { stats.skippedTier3++; return false; }

  let created: { id: string };
  try {
    created = await prisma.content.create({
      data: { type: 'podcast', title, source, duration, thumbnailUrl, audioUrl, topicId, summary: { create: summaryData(s) } },
      select: { id: true },
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') return false;
    throw e;
  }

  const moments = (await generateMoments(title, description, duration)).map((m) => ({ contentId: created.id, ...m }));
  if (moments.length) await prisma.keyMoment.createMany({ data: moments });

  stats.podcasts++; budget.left--;
  return true;
}

async function ingestPodcasts(stats: Stats, budget: { left: number }) {
  // Same topic-grouped round-robin as news: ensures every interest gets a
  // podcast candidate before any topic gets a second slot.
  const byTopic: Record<string, typeof PODCAST_FEEDS> = {};
  for (const feed of PODCAST_FEEDS) (byTopic[feed.topic] ??= []).push(feed);
  const ordered = roundRobin(Object.values(byTopic).map(shuffled));

  // Track which topics produced 0 episodes from RSS — ListenNotes will top those up
  const topicHits: Record<string, number> = {};

  for (const feed of ordered) {
    if (budget.left <= 0) break;
    if (!aiIsHealthy()) { console.warn('[ingest] AI circuit open — stopping podcast ingest early'); break; }

    let items: FeedItem[];
    try {
      const parsed = await parser.parseURL(feed.url);
      items = (parsed.items ?? []).slice(0, PER_PODCAST_FEED);
    } catch (e) {
      console.warn(`[ingest] podcast feed failed: ${feed.source}`, (e as Error).message);
      continue;
    }

    const topicId = await getTopicId(feed.topic);

    for (const item of items) {
      if (budget.left <= 0) break;
      if (!aiIsHealthy()) break;
      const title = item.title?.trim();
      if (!title) continue;
      if (looksLikePromo(title)) { stats.skippedPromo++; continue; }

      const duration = parseItunesDuration(item.itunes?.duration) ?? 1800;
      if (duration < MIN_PODCAST_DURATION_SEC || duration > MAX_PODCAST_DURATION_SEC) { stats.skippedDuration++; continue; }

      if (item.isoDate) {
        const ageDays = (Date.now() - new Date(item.isoDate).getTime()) / 86_400_000;
        if (ageDays > MAX_PODCAST_AGE_DAYS) { stats.skippedAge++; continue; }
      }

      if (await alreadyHave(feed.source, title)) continue;

      const description = descriptionOf(item);
      const added = await savePodcastEpisode(
        title, feed.source, description, feed.topic, topicId,
        duration, imageOf(item), item.enclosure?.url ?? null, stats, budget,
      );
      if (added) topicHits[feed.topic] = (topicHits[feed.topic] ?? 0) + 1;
    }
  }

  // ── ListenNotes top-up: fill topics where RSS yielded nothing ──────────────
  // Both this ingest run and the gap-fill job share the same monthly counter.
  // We only consume LN budget here when it's clearly worth it (dry topic, budget OK).
  if (!process.env.LISTENNOTES_API_KEY) return;

  let lnUsage;
  try { lnUsage = await getListenNotesUsage(); }
  catch { return; }

  // Reserve at least 10 requests for gap-fill; skip top-up if we're tight
  if (lnUsage.remaining < 10) {
    console.log(`[ingest] ListenNotes budget low (${lnUsage.used}/${lnUsage.cap}) — skipping podcast top-up`);
    return;
  }

  const dryTopics = Object.keys(byTopic).filter(slug => !topicHits[slug]);
  if (dryTopics.length === 0) return;

  console.log(`[ingest] ListenNotes top-up for ${dryTopics.length} dry topics (budget: ${lnUsage.remaining} remaining)`);

  for (const slug of dryTopics) {
    if (budget.left <= 0 || !aiIsHealthy()) break;
    // Re-check budget before each LN call (gap-fill may have run concurrently)
    const usage = await getListenNotesUsage().catch(() => null);
    if (!usage || usage.remaining < 5) break;

    const terms = TOPIC_SEARCH_TERMS[slug];
    if (!terms?.length) continue;

    console.log(`[ingest] ListenNotes top-up: topic=${slug} q="${terms[0]}"`);
    let episodes;
    try {
      episodes = await listenNotesSearch(terms[0]!, {
        pageSize: 5,
        minLenMin: Math.floor(MIN_PODCAST_DURATION_SEC / 60),
        maxLenMin: Math.floor(MAX_PODCAST_DURATION_SEC / 60),
      });
    } catch (e) {
      console.warn(`[ingest] ListenNotes top-up error for ${slug}:`, (e as Error).message);
      continue;
    }

    const topicId = await getTopicId(slug);
    for (const ep of episodes.slice(0, 2)) { // max 2 per dry topic
      if (budget.left <= 0 || !aiIsHealthy()) break;
      const title = ep.title?.trim();
      if (!title || looksLikePromo(title)) continue;

      const ageDays = (Date.now() - ep.pub_date_ms) / 86_400_000;
      if (ageDays > MAX_PODCAST_AGE_DAYS || !ep.audio) continue;
      if (await alreadyHave(ep.podcast.title, title)) continue;

      await savePodcastEpisode(
        title, ep.podcast.title, ep.description ?? '', slug, topicId,
        ep.total_length_sec ?? 1800,
        ep.thumbnail || ep.podcast.thumbnail || null,
        ep.audio,
        stats, budget,
      );
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
  timeout: 20000,
  headers: { 'User-Agent': UA },
  customFields: { item: [['yt:videoId', 'videoId']] },
});

async function ingestClips(stats: Stats, budget: { left: number }) {
  const googleKey = process.env.GOOGLE_API_KEY;
  if (!googleKey) {
    console.log('[ingest] GOOGLE_API_KEY not set — clips will ingest without duration filtering');
  }

  interface ClipCand {
    source: string; topic: string; topicId: string;
    videoId: string; title: string; description: string; duration: number;
  }

  const groups: ClipCand[][] = [];
  for (const ch of YOUTUBE_CHANNELS) {
    try {
      const topicId = await getTopicId(ch.topic);
      const parsed = await ytParser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.channelId}`);
      console.log(`[ingest] youtube ${ch.source}: ${parsed.items?.length ?? 0} videos found`);
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

      let kept: ClipCand[];
      if (googleKey) {
        const durations = await fetchDurations(fresh.map((c) => c.videoId), googleKey);
        kept = [];
        for (const c of fresh) {
          const d = durations.get(c.videoId) ?? 0;
          if (d < MIN_CLIP_DURATION_SEC || d > MAX_CLIP_DURATION_SEC) { stats.skippedDuration++; continue; }
          kept.push({ ...c, duration: d });
        }
      } else {
        // No API key — ingest all fresh videos with a default duration of 5 min.
        kept = fresh.map((c) => ({ ...c, duration: 300 }));
      }
      if (kept.length) groups.push(kept);
    } catch (e) {
      console.warn(`[ingest] youtube channel failed: ${ch.source}`, (e as Error).message);
    }
  }

  for (const c of roundRobin(groups)) {
    if (budget.left <= 0) break;
    if (!aiIsHealthy()) { console.warn('[ingest] AI circuit open — stopping clips ingest early'); break; }
    if (looksLikePromo(c.title)) { stats.skippedPromo++; continue; }
    const s = await generateSummary(c.title, c.description, c.topic);
    if (!s.relevant) { stats.skippedIrrelevant++; continue; }
    if (s.tier === 3) { stats.skippedTier3++; continue; }

    try {
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
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') continue; // already exists
      throw e;
    }
  }
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

// INGEST_MODE controls which content types this run processes.
// Set on the Render cron service environment:
//   all      — news + podcasts + clips (default)
//   news     — Mediastack + RSS news only
//   podcasts — podcast feeds only (dedicated run, higher budget)
//   clips    — YouTube clips only
type IngestMode = 'all' | 'news' | 'podcasts' | 'clips';

export async function runIngest() {
  const mode = (process.env.INGEST_MODE ?? 'all') as IngestMode;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[ingest] ANTHROPIC_API_KEY is MISSING — every item will be dropped. Set it on this service.');
  } else {
    console.log('[ingest] ANTHROPIC_API_KEY present ✓');
  }
  const orKey = process.env.OPENROUTER_API_KEY;
  if (!orKey) {
    console.warn('[ingest] OPENROUTER_API_KEY not set — AI will fall back to Claude only');
  } else {
    console.log(`[ingest] OPENROUTER_API_KEY present ✓ (${orKey.slice(0, 4)}****)`);
  }
  const msKey = process.env.MEDIASTACK_API_KEY;
  if (!msKey) {
    console.warn('[ingest] MEDIASTACK_API_KEY not found in process.env — news will fall back to RSS only');
  } else {
    console.log(`[ingest] MEDIASTACK_API_KEY present ✓ (${msKey.slice(0, 4)}****)`);
  }
  const activeSources = [
    (mode === 'all' || mode === 'news') && `${NEWS_FEEDS.length} news feeds`,
    (mode === 'all' || mode === 'podcasts') && `${PODCAST_FEEDS.length} podcast feeds`,
    (mode === 'all' || mode === 'clips') && `${YOUTUBE_CHANNELS.length} YouTube channels`,
  ].filter(Boolean).join(', ');
  const activeTargets = [
    (mode === 'all' || mode === 'news') && `mediastack=${TARGET_MEDIASTACK} rss-news=${TARGET_NEWS}`,
    (mode === 'all' || mode === 'podcasts') && `podcasts=${TARGET_PODCASTS}`,
    (mode === 'all' || mode === 'clips') && `clips=${TARGET_CLIPS}`,
  ].filter(Boolean).join(' ');
  console.log(`[ingest] mode=${mode} sources — ${activeSources}`);
  console.log(`[ingest] targets — ${activeTargets}`);

  const stats: Stats = {
    news: 0, podcasts: 0, clips: 0,
    skippedPromo: 0, skippedDuration: 0, skippedAge: 0, skippedIrrelevant: 0, skippedTier3: 0,
  };

  const runNews     = mode === 'all' || mode === 'news';
  const runPodcasts = mode === 'all' || mode === 'podcasts';
  const runClips    = mode === 'all' || mode === 'clips';

  // Podcast-only runs get a larger budget since they're not competing with news.
  const podcastBudget = mode === 'podcasts' ? TARGET_PODCASTS * 2 : TARGET_PODCASTS;

  if (runNews) {
    await ingestNewsFromMediastack(stats, { left: TARGET_MEDIASTACK });
    await ingestNews(stats, { left: TARGET_NEWS });
  }

  if (runPodcasts) await ingestPodcasts(stats, { left: podcastBudget });
  if (runClips)    await ingestClips(stats, { left: TARGET_CLIPS });

  const total = stats.news + stats.podcasts + stats.clips;

  // After ingest, send a digest email to users who opted in
  if (total > 0) {
    try {
      await sendIngestDigestsToUsers(prisma);
    } catch (e) {
      console.error('[ingest] failed to send digest emails:', (e as Error).message);
    }
  }

  console.log(`[ingest] done — inserted ${total}`, stats);

  // Record run status so the admin dashboard can surface AI credit warnings.
  const aiStatus = getAiStatus();
  try {
    const settingValue = JSON.stringify({
      status: aiStatus,
      runAt: new Date().toISOString(),
      inserted: { news: stats.news, podcasts: stats.podcasts, clips: stats.clips },
      skipped: { promo: stats.skippedPromo, duration: stats.skippedDuration, age: stats.skippedAge, irrelevant: stats.skippedIrrelevant, tier3: stats.skippedTier3 },
    });
    await prisma.systemSetting.upsert({
      where:  { key: 'last_ingest' },
      create: { key: 'last_ingest', value: settingValue },
      update: { value: settingValue },
    });
  } catch (e) {
    console.warn('[ingest] failed to save ingest status:', (e as Error).message);
  }

  // Purge news/clips older than 7 days. Podcasts are excluded — they're cached in
  // S3 and are evergreen content that shouldn't be treated as time-limited news.
  try {
    const purged = await purgeContentOlderThan(7);
    if (purged > 0) console.log(`[ingest] purged ${purged} items older than 7 days`);
  } catch (e) {
    console.error('[ingest] failed to purge old content:', (e as Error).message);
  }

  // Write podcast snapshot to S3 so episodes survive DB purges and load fast.
  try {
    const { writePodcastCache } = await import('../lib/s3.js');
    const podcastRows = await prisma.content.findMany({
      where: { type: 'podcast' },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    if (podcastRows.length > 0) {
      const episodes = podcastRows.map(r => ({
        id: r.id,
        type: 'podcast' as const,
        title: r.title,
        source: r.source,
        topic: r.topicId ?? '',
        duration: r.duration ?? 0,
        audioUrl: r.audioUrl ?? undefined,
        thumbnailUrl: r.thumbnailUrl ?? undefined,
        createdAt: r.createdAt.toISOString(),
        summary: undefined as undefined,
      }));
      await writePodcastCache(episodes);
      console.log(`[ingest] wrote ${episodes.length} podcast episodes to S3`);
    }
  } catch (e) {
    console.warn('[ingest] S3 podcast cache write failed (non-fatal):', (e as Error).message);
  }

  return { total, ...stats };
}

/**
 * Delete content rows older than the specified number of days. Content is
 * inserted once and never overwritten (dedup by source+title), so this keeps
 * the database from growing unbounded while preserving at least a week of
 * history. Cascade deletes also clean up associated summaries and key moments.
 */
async function purgeContentOlderThan(days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await prisma.content.deleteMany({
    where: { createdAt: { lt: cutoff }, type: { not: 'podcast' } },
  });
  return result.count;
}

/**
 * After an ingest run, send digest emails to users who have email notifications
 * enabled. Collects the most recent content items matching each user's topic
 * preferences and sends a digest via Resend.
 */
async function sendIngestDigestsToUsers(prismaClient: PrismaClient): Promise<void> {
  const users = await prismaClient.appUser.findMany({
    where: { preferences: { notificationsEnabled: true } },
    select: { id: true, email: true, name: true, preferences: { select: { topicIds: true } } },
  });

  if (users.length === 0) {
    console.log('[ingest] no users with email notifications enabled — skipping digest');
    return;
  }

  // Get content created in the last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentContent = await prismaClient.content.findMany({
    where: { createdAt: { gte: since } },
    select: { id: true, title: true, type: true, source: true, articleUrl: true, topicId: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  if (recentContent.length === 0) return;

  for (const user of users) {
    const topicIds = new Set(user.preferences?.topicIds ?? []);
    // If user has topic preferences, only include matching content; otherwise include all
    const matching = topicIds.size > 0
      ? recentContent.filter((c) => c.topicId && topicIds.has(c.topicId))
      : recentContent;

    if (matching.length === 0) continue;

    await sendIngestDigest(
      user.email,
      matching.map((c) => ({ title: c.title, type: c.type, source: c.source, articleUrl: c.articleUrl })),
    );
  }

  console.log(`[ingest] digest emails sent to ${users.filter((u) => u.preferences?.topicIds?.length).length || users.length} users`);
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
