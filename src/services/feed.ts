import { prisma } from '../lib/prisma';
import { toContentItem, type SerializedContent } from '../lib/serialize';

// PLAYBOOK §4D — Daily Feed & Ranking. Ported verbatim from the app's old
// services/api.ts so behaviour is identical, just running server-side now.
// Order: Impact (tier) → Nigeria context → Urgency (recency). Items without
// §4A scoring (legacy rows) sort last by recency.
function rankFeed(items: SerializedContent[], country?: string): SerializedContent[] {
  const NOW = Date.now();
  // Half-life weight on recency, clamped at 7 days so a slightly older Tier 1
  // still beats a fresh Tier 2 but nothing older than a week gets buried.
  const ageHours = (createdAt: string) =>
    Math.min(168, (NOW - new Date(createdAt).getTime()) / 3_600_000);

  return [...items].sort((a, b) => {
    const tA = a.summary?.tier ?? 99;
    const tB = b.summary?.tier ?? 99;
    if (tA !== tB) return tA - tB;

    const nA = a.summary?.nigeriaRelevance ?? 0;
    const nB = b.summary?.nigeriaRelevance ?? 0;

    // Boost Nigeria relevance based on country preference
    if (country === 'NG') {
      // For Nigeria tab, heavily boost Nigeria-relevant content
      if (nA !== nB) return nB - nA;
    } else if (country === 'AFRICA') {
      // For Africa tab, moderately boost Nigeria-relevant content (as proxy for Africa)
      if (nA !== nB && (nA >= 2 || nB >= 2)) return nB - nA;
    }
    // For INTL, don't boost by nigeriaRelevance

    return ageHours(a.createdAt) - ageHours(b.createdAt);
  });
}

export interface FeedResult {
  items: SerializedContent[];
  isFallback: boolean; // true when filtered results were too sparse and we widened
  matchedTopics: number; // how many items actually matched the user's topics
}

// Threshold under which the feed widens beyond the user's topics. Tuned so a
// brand-new user who picked one narrow topic still sees a full first screen.
const SPARSE_TOPIC_THRESHOLD = 5;

export async function getFeed(topicIds: string[], country?: string): Promise<FeedResult> {
  // Step 1: filtered query (the user's actual topic preferences).
  let primary: SerializedContent[] = [];
  if (topicIds.length > 0) {
    const rows = await prisma.content.findMany({
      where: { topicId: { in: topicIds } },
      include: { summary: true },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    primary = rankFeed(rows.map(toContentItem), country);
  }

  // Enough signal already — return the filtered set as-is.
  if (primary.length >= SPARSE_TOPIC_THRESHOLD) {
    return { items: primary.slice(0, 20), isFallback: false, matchedTopics: primary.length };
  }

  // Step 2: top up with the unfiltered top of the feed, keeping the user's
  // matches at the top (§3 graceful empty state — a sparse-topic user never
  // sees a blank screen, but their picks still come first).
  const rows = await prisma.content.findMany({
    include: { summary: true },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });
  const fallback = rankFeed(rows.map(toContentItem), country);
  const seen = new Set(primary.map((x) => x.id));
  const merged = [...primary, ...fallback.filter((x) => !seen.has(x.id))].slice(0, 20);

  return {
    items: merged,
    // Only a "fallback" if the user HAD topics and we had to widen. Empty topics
    // = the default unfiltered feed, not a fallback.
    isFallback: topicIds.length > 0 && primary.length < SPARSE_TOPIC_THRESHOLD,
    matchedTopics: primary.length,
  };
}
