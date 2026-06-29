import { prisma } from '../lib/prisma';
import { toContentItem, type SerializedContent } from '../lib/serialize';

// PLAYBOOK §4D — Daily Feed & Ranking.
// Order: Impact (tier) → Nigeria context → Urgency (recency).
// Items without §4A scoring (legacy rows) sort last by recency.
function rankFeed(items: SerializedContent[], country?: string): SerializedContent[] {
  const NOW = Date.now();
  // Half-life weight on recency. Clamped at 7 days so a slightly older Tier 1
  // still beats a fresh Tier 2, but nothing older than a week gets buried.
  const ageHours = (createdAt: string) =>
    Math.min(168, (NOW - new Date(createdAt).getTime()) / 3_600_000);

  return [...items].sort((a, b) => {
    const tA = a.summary?.tier ?? 99;
    const tB = b.summary?.tier ?? 99;
    if (tA !== tB) return tA - tB;

    const nA = a.summary?.nigeriaRelevance ?? 0;
    const nB = b.summary?.nigeriaRelevance ?? 0;

    if (country === 'NG' || country === 'AFRICA') {
      // For Nigerian / African users, boost Nigeria-relevant content within same tier.
      if (nA !== nB) return nB - nA;
    }

    return ageHours(a.createdAt) - ageHours(b.createdAt);
  });
}

export interface FeedResult {
  items: SerializedContent[];
  isFallback: boolean;
  matchedTopics: number;
}

// Threshold under which the feed widens beyond the user's topics. Tuned so a
// brand-new user who picked one narrow topic still sees a full first screen.
const SPARSE_TOPIC_THRESHOLD = 5;

// Maps user interest slugs → topic slugs that exist (or will exist) in the DB.
// A single interest may span multiple topic slugs.
const INTEREST_TO_TOPIC_SLUGS: Record<string, string[]> = {
  politics:   ['politics', 'government', 'policy'],
  economy:    ['economy', 'finance', 'business', 'markets'],
  finance:    ['finance', 'money', 'crypto', 'investment', 'economy'],
  business:   ['business', 'economy', 'markets', 'startups'],
  tech:       ['tech', 'technology', 'ai', 'startups'],
  health:     ['health', 'wellness', 'medicine'],
  science:    ['science', 'research', 'space'],
  climate:    ['climate', 'environment', 'energy'],
  sports:     ['sports', 'football', 'athletics'],
  music:      ['music', 'entertainment', 'culture'],
  film:       ['film', 'tv', 'entertainment', 'cinema', 'culture'],
  education:  ['education', 'learning'],
  fashion:    ['fashion', 'lifestyle', 'style'],
  travel:     ['travel', 'lifestyle'],
  faith:      ['faith', 'religion', 'philosophy'],
};

async function interestTopicIds(interests: string[]): Promise<string[]> {
  if (interests.length === 0) return [];
  const slugs = interests.flatMap((i) => INTEREST_TO_TOPIC_SLUGS[i.toLowerCase()] ?? [i.toLowerCase()]);
  const unique = [...new Set(slugs)];
  const topics = await prisma.topic.findMany({ where: { slug: { in: unique } }, select: { id: true } });
  return topics.map((t) => t.id);
}

// True when the user requested a single specific interest (not the mixed "For You" feed).
// In that mode we apply a soft Nigeria-relevance pre-filter: prefer items that
// actually touch Nigerian/African reality (nigeriaRelevance >= 1) and only fall
// back to relevance-0 items if the filtered set is still sparse.
function isPerInterestRequest(interests: string[]): boolean {
  return interests.length === 1;
}

export async function getFeed(topicIds: string[], country?: string, interests: string[] = []): Promise<FeedResult> {
  // Merge explicit topicIds with any derived from interest slugs.
  const interestIds = await interestTopicIds(interests);
  const allTopicIds = [...new Set([...topicIds, ...interestIds])];

  let primary: SerializedContent[] = [];
  if (allTopicIds.length > 0) {
    // Fetch more candidates so after ranking we can return a full 40.
    const rows = await prisma.content.findMany({
      where: { topicId: { in: allTopicIds } },
      include: { summary: true },
      orderBy: { createdAt: 'desc' },
      take: 80,
    });
    const ranked = rankFeed(rows.map(toContentItem), country);

    if (isPerInterestRequest(interests)) {
      // Per-interest tab: prefer items with any Nigeria relevance (nigeriaRelevance >= 1).
      // This filters out purely international stories that the editorial AI judged
      // as having no Nigerian angle. We top up with relevance-0 if needed.
      const relevant = ranked.filter(i => (i.summary?.nigeriaRelevance ?? 0) >= 1);
      const irrelevant = ranked.filter(i => (i.summary?.nigeriaRelevance ?? 0) === 0);
      // Always show at least 20 items even if Nigeria-relevance is low in this topic.
      primary = relevant.length >= 20
        ? relevant.slice(0, 40)
        : [...relevant, ...irrelevant].slice(0, 40);
    } else {
      primary = ranked.slice(0, 40);
    }
  }

  // Enough signal — return as-is.
  if (primary.length >= SPARSE_TOPIC_THRESHOLD) {
    return { items: primary, isFallback: false, matchedTopics: primary.length };
  }

  // Top up with the unfiltered global feed, keeping the user's matches at the top
  // (§3 graceful empty state — a sparse-topic user never sees a blank screen).
  const rows = await prisma.content.findMany({
    include: { summary: true },
    orderBy: { createdAt: 'desc' },
    take: 80,
  });
  const fallback = rankFeed(rows.map(toContentItem), country);
  const seen = new Set(primary.map((x) => x.id));
  const merged = [...primary, ...fallback.filter((x) => !seen.has(x.id))].slice(0, 40);

  return {
    items: merged,
    isFallback: allTopicIds.length > 0 && primary.length < SPARSE_TOPIC_THRESHOLD,
    matchedTopics: primary.length,
  };
}
