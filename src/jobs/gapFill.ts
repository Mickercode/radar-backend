// Gap-fill job.
// Reads content_coverage rows with status 'gap' or 'sparse', then tries to
// fetch missing content from targeted sources:
//   - Podcasts: Podcast Index API search by topic keyword terms
//   - News: targeted Mediastack category + keyword queries
//   - Clips: logged but not auto-filled (YouTube search requires OAuth / paid API)
//
// Run after coverageAudit to fill the queue it produces.
// Triggered via POST /admin/coverage/fill or as a standalone script.
//
// Usage:
//   node dist/jobs/gapFill.js

import { PrismaClient } from '@prisma/client';
import Parser from 'rss-parser';
import { generateSummary, aiIsHealthy } from './editorial';
import { searchPodcasts, getEpisodes } from '../lib/podcast-index';
import { isRelevant } from '../lib/relevanceFilter';
import { TOPIC_SEARCH_TERMS, MIN_PODCAST_DURATION_SEC, MAX_PODCAST_DURATION_SEC, MAX_PODCAST_AGE_DAYS, PROMO_TITLE_PATTERNS } from './feeds';

const prisma = new PrismaClient();

interface FeedEpisode {
  title?: string;
  enclosure?: { url?: string; type?: string };
  itunes?: { duration?: string; image?: string };
  isoDate?: string;
  content?: string;
  contentSnippet?: string;
  contentEncoded?: string;
}

const parser: Parser<unknown, FeedEpisode> = new Parser({
  timeout: 20000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Radar/1.0)' },
  customFields: { item: [['content:encoded', 'contentEncoded']] },
});

function looksLikePromo(title: string): boolean {
  return PROMO_TITLE_PATTERNS.some((re) => re.test(title));
}

function parseItunesDuration(raw: string | undefined): number | null {
  if (!raw) return null;
  const parts = raw.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  return parts[0]! > 0 ? parts[0]! : null;
}

function descriptionOf(item: FeedEpisode): string {
  return (item as Record<string, string>)['contentEncoded'] || item.content || item.contentSnippet || '';
}

function summaryDataFrom(s: Awaited<ReturnType<typeof generateSummary>>) {
  return {
    what: s.what, why: s.why, edge: s.how_it_matters_to_you,
    glossary: s.glossary, tier: s.tier, forwardable: s.forwardable,
    advantage: s.advantage, nonObvious: s.non_obvious, learnable: s.learnable,
    nigeriaRelevance: s.nigeria_relevance, summary: s.what,
    keyTakeaways: s.key_takeaways, whyItMatters: s.why,
  };
}

const topicCache: Record<string, string> = {};
async function getTopicId(slug: string): Promise<string> {
  if (topicCache[slug]) return topicCache[slug]!;
  const topic = await prisma.topic.upsert({
    where: { slug },
    create: { slug, name: slug.charAt(0).toUpperCase() + slug.slice(1) },
    update: {},
    select: { id: true },
  });
  topicCache[slug] = topic.id;
  return topic.id;
}

async function alreadyExists(source: string, title: string): Promise<boolean> {
  return !!(await prisma.content.findFirst({ where: { source, title }, select: { id: true } }));
}

// ── Podcast gap-filler ────────────────────────────────────────────────────────

async function fillPodcastGap(topicSlug: string, budget: { left: number }): Promise<number> {
  const terms = TOPIC_SEARCH_TERMS[topicSlug];
  if (!terms || terms.length === 0) {
    console.log(`[gap-fill] no search terms configured for topic=${topicSlug} — skipping`);
    return 0;
  }

  let filled = 0;
  const topicId = await getTopicId(topicSlug);

  for (const term of terms) {
    if (budget.left <= 0 || !aiIsHealthy()) break;

    console.log(`[gap-fill] podcast search: topic=${topicSlug} q="${term}"`);
    const result = await searchPodcasts(term, 10).catch(() => ({ status: false, feeds: [], count: 0 }));
    if (!result.feeds.length) continue;

    // Try up to 3 feeds per search term before moving on.
    for (const feed of result.feeds.slice(0, 3)) {
      if (budget.left <= 0 || !aiIsHealthy()) break;
      if (!feed.url) continue;

      let episodes;
      try {
        const parsed = await parser.parseURL(feed.url);
        episodes = (parsed.items ?? []).slice(0, 3) as FeedEpisode[];
      } catch (e) {
        console.warn(`[gap-fill] rss parse failed for feed ${feed.title}:`, (e as Error).message);
        continue;
      }

      for (const ep of episodes) {
        if (budget.left <= 0 || !aiIsHealthy()) break;

        const title = ep.title?.trim();
        if (!title || looksLikePromo(title)) continue;

        const duration = parseItunesDuration(ep.itunes?.duration) ?? 1800;
        if (duration < MIN_PODCAST_DURATION_SEC || duration > MAX_PODCAST_DURATION_SEC) continue;

        if (ep.isoDate) {
          const ageDays = (Date.now() - new Date(ep.isoDate).getTime()) / 86_400_000;
          if (ageDays > MAX_PODCAST_AGE_DAYS) continue;
        }

        const audioUrl = ep.enclosure?.url;
        if (!audioUrl) continue;

        if (await alreadyExists(feed.title, title)) continue;

        const description = descriptionOf(ep);

        // Quick relevance pre-filter — saves AI credits on obvious mismatches.
        if (!isRelevant(`${title} ${description}`, topicSlug)) {
          console.log(`[gap-fill] relevance pre-filter dropped: "${title.slice(0, 60)}"`);
          continue;
        }

        const s = await generateSummary(title, description, topicSlug);
        if (!s.relevant || s.tier === 3) continue;

        try {
          await prisma.content.create({
            data: {
              type: 'podcast',
              title,
              source: feed.title,
              duration,
              thumbnailUrl: ep.itunes?.image ?? feed.image ?? null,
              audioUrl,
              topicId,
              summary: { create: summaryDataFrom(s) },
            },
          });
          filled++;
          budget.left--;
          console.log(`[gap-fill] +1 podcast topic=${topicSlug} "${title.slice(0, 60)}"`);
        } catch (e) {
          if ((e as { code?: string }).code === 'P2002') continue;
          throw e;
        }
      }

      if (filled > 0) break; // got at least one from this feed — move on
    }

    if (filled >= 3) break; // enough from this search term
  }

  return filled;
}

// ── News gap-filler (Mediastack targeted query) ───────────────────────────────

interface MediastackArticle {
  title: string;
  description: string | null;
  url: string;
  source: string;
  image: string | null;
  published_at: string;
}

// Mediastack free-tier category mapping for topics we can query directly.
const MS_TOPIC_CATEGORY: Record<string, string> = {
  business:  'business',
  finance:   'business',
  economy:   'business',
  tech:      'technology',
  health:    'health',
  science:   'science',
  sports:    'sports',
  music:     'entertainment',
  film:      'entertainment',
};

// Keyword terms sent in the `keywords` param when Mediastack doesn't have a
// dedicated category for the topic (education, climate, fashion, faith, travel).
const MS_TOPIC_KEYWORDS: Record<string, string> = {
  education: 'education university school Nigeria',
  climate:   'climate environment renewable energy',
  faith:     'religion church mosque faith Nigeria',
  fashion:   'fashion style lifestyle Africa',
  travel:    'travel tourism Africa',
  politics:  'government politics Nigeria',
};

async function fillNewsGap(topicSlug: string, budget: { left: number }): Promise<number> {
  const msKey = process.env.MEDIASTACK_API_KEY;
  if (!msKey) {
    console.log('[gap-fill] MEDIASTACK_API_KEY not set — skipping news gap-fill');
    return 0;
  }

  const category = MS_TOPIC_CATEGORY[topicSlug];
  const keywords = MS_TOPIC_KEYWORDS[topicSlug];
  if (!category && !keywords) {
    console.log(`[gap-fill] no Mediastack mapping for topic=${topicSlug}`);
    return 0;
  }

  const qs = new URLSearchParams({
    access_key: msKey,
    languages: 'en',
    countries: 'ng',
    limit: '20',
    sort: 'published_desc',
    ...(category ? { categories: category } : {}),
    ...(keywords ? { keywords } : {}),
  });

  let articles: MediastackArticle[] = [];
  try {
    const res = await fetch(`http://api.mediastack.com/v1/news?${qs}`);
    if (!res.ok) {
      console.warn(`[gap-fill] Mediastack ${res.status} for topic=${topicSlug}`);
      return 0;
    }
    const data = (await res.json()) as { data?: MediastackArticle[] };
    articles = data.data ?? [];
  } catch (e) {
    console.warn('[gap-fill] Mediastack error:', (e as Error).message);
    return 0;
  }

  const topicId = await getTopicId(topicSlug);
  let filled = 0;

  for (const article of articles) {
    if (budget.left <= 0 || !aiIsHealthy()) break;
    const title = article.title?.trim();
    if (!title || looksLikePromo(title)) continue;
    if (await alreadyExists(article.source ?? 'Mediastack', title)) continue;

    const description = article.description ?? '';
    if (!isRelevant(`${title} ${description}`, topicSlug)) continue;

    const s = await generateSummary(title, description, topicSlug);
    if (!s.relevant || s.tier === 3) continue;

    try {
      await prisma.content.create({
        data: {
          type: 'news',
          title,
          source: article.source ?? 'Mediastack',
          duration: Math.max(60, Math.round((description.split(/\s+/).length / 200) * 60)),
          thumbnailUrl: article.image ?? null,
          articleUrl: article.url ?? null,
          topicId,
          summary: { create: summaryDataFrom(s) },
        },
      });
      filled++;
      budget.left--;
      console.log(`[gap-fill] +1 news topic=${topicSlug} "${title.slice(0, 60)}"`);
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') continue;
      throw e;
    }
  }

  return filled;
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export async function runGapFill(): Promise<{ filled: number; byTopic: Record<string, number> }> {
  console.log('[gap-fill] starting');

  // Only process gaps/sparse — skip 'ok' and 'scarce'.
  const gaps = await prisma.contentCoverage.findMany({
    where: { status: { in: ['gap', 'sparse'] } },
    orderBy: [{ itemCount: 'asc' }, { topicSlug: 'asc' }],
  });

  if (gaps.length === 0) {
    console.log('[gap-fill] no gaps to fill');
    return { filled: 0, byTopic: {} };
  }

  console.log(`[gap-fill] ${gaps.length} gap/sparse rows to process`);

  const byTopic: Record<string, number> = {};
  let totalFilled = 0;
  const budget = { left: 30 }; // total AI calls across the whole run

  for (const row of gaps) {
    if (budget.left <= 0 || !aiIsHealthy()) break;

    let added = 0;
    if (row.contentType === 'podcast') {
      added = await fillPodcastGap(row.topicSlug, budget);
    } else if (row.contentType === 'news') {
      added = await fillNewsGap(row.topicSlug, budget);
    } else {
      // Clips: log but don't auto-fill — YouTube search requires a dedicated API.
      console.log(`[gap-fill] clip gap for topic=${row.topicSlug} — manual action needed`);
    }

    byTopic[`${row.topicSlug}:${row.contentType}`] = added;
    totalFilled += added;

    // Update fail cycle: reset if we filled something, increment otherwise.
    await prisma.contentCoverage.update({
      where: { topicSlug_contentType: { topicSlug: row.topicSlug, contentType: row.contentType } },
      data: { failCycles: added > 0 ? 0 : { increment: 1 } },
    });
  }

  console.log(`[gap-fill] done — filled ${totalFilled} items`, byTopic);

  // Persist result for admin dashboard.
  await prisma.systemSetting.upsert({
    where: { key: 'last_gap_fill' },
    create: { key: 'last_gap_fill', value: JSON.stringify({ filled: totalFilled, byTopic, runAt: new Date().toISOString() }) },
    update: { value: JSON.stringify({ filled: totalFilled, byTopic, runAt: new Date().toISOString() }) },
  });

  return { filled: totalFilled, byTopic };
}

if (require.main === module) {
  runGapFill()
    .then(() => prisma.$disconnect())
    .then(() => process.exit(0))
    .catch(async (e) => {
      console.error('[gap-fill] fatal', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
