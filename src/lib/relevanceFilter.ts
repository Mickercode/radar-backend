// Pre-filter for content relevance — runs before the AI editorial pass to avoid
// burning API credits on items that are clearly off-topic.
//
// The approach is simple keyword overlap: count how many topic keywords appear
// in the item text, divide by the keyword set size. Score >= threshold → keep.
// An embedding-based check is a reasonable upgrade later but keyword overlap
// catches 80% of the obvious misfires (e.g. a cooking podcast landing in Sports)
// without any API call.

const TOPIC_KEYWORDS: Record<string, string[]> = {
  tech:       ['tech', 'ai', 'software', 'startup', 'app', 'digital', 'cyber', 'data', 'cloud', 'code', 'algorithm', 'internet', 'robot', 'automation', 'developer', 'programming'],
  business:   ['business', 'company', 'ceo', 'entrepreneur', 'trade', 'commerce', 'corporate', 'startup', 'management', 'strategy', 'market', 'brand', 'leadership'],
  finance:    ['finance', 'bank', 'naira', 'dollar', 'invest', 'stock', 'crypto', 'money', 'fund', 'treasury', 'bond', 'etf', 'portfolio', 'interest rate', 'forex', 'dividend'],
  economy:    ['economy', 'gdp', 'inflation', 'budget', 'fiscal', 'monetary', 'revenue', 'imf', 'world bank', 'recession', 'growth', 'trade deficit', 'labour', 'unemployment'],
  politics:   ['government', 'president', 'minister', 'election', 'senate', 'policy', 'law', 'political', 'parliament', 'vote', 'party', 'democracy', 'governance', 'legislation'],
  science:    ['science', 'research', 'study', 'space', 'nasa', 'discovery', 'biology', 'physics', 'chemistry', 'experiment', 'climate', 'evolution', 'astronomy', 'laboratory'],
  health:     ['health', 'hospital', 'disease', 'cancer', 'drug', 'medicine', 'diet', 'fitness', 'mental health', 'vaccine', 'nutrition', 'therapy', 'surgery', 'symptoms', 'wellness'],
  climate:    ['climate', 'energy', 'solar', 'carbon', 'oil', 'gas', 'emission', 'environment', 'green', 'renewable', 'fossil', 'flood', 'drought', 'sustainability', 'net zero'],
  sports:     ['sport', 'football', 'soccer', 'basketball', 'athlete', 'league', 'match', 'goal', 'tournament', 'olympic', 'coach', 'team', 'stadium', 'champion'],
  music:      ['music', 'song', 'album', 'artist', 'concert', 'singer', 'afrobeats', 'gospel', 'hip hop', 'rap', 'record', 'streaming', 'tour', 'producer', 'lyrics'],
  film:       ['film', 'movie', 'series', 'netflix', 'cinema', 'actor', 'nollywood', 'tv show', 'director', 'script', 'oscar', 'streaming', 'episode', 'documentary'],
  education:  ['education', 'school', 'university', 'student', 'learning', 'teacher', 'academic', 'degree', 'curriculum', 'edtech', 'scholarship', 'study', 'classroom', 'exam'],
  fashion:    ['fashion', 'style', 'design', 'brand', 'clothing', 'luxury', 'beauty', 'skincare', 'outfit', 'wardrobe', 'trend', 'collection', 'runway', 'lifestyle'],
  travel:     ['travel', 'tourism', 'airline', 'hotel', 'airport', 'visa', 'destination', 'adventure', 'trip', 'vacation', 'passport', 'flight', 'tour', 'explore'],
  faith:      ['church', 'mosque', 'faith', 'religion', 'prayer', 'spiritual', 'god', 'christian', 'islam', 'bible', 'quran', 'worship', 'pastor', 'imam', 'theology'],
};

/**
 * Returns a relevance score [0, 1] for an item against a given topic.
 * Computed as: matched_keywords / total_keywords.
 * A score ≥ threshold means the item is likely on-topic.
 */
export function relevanceScore(text: string, topicSlug: string): number {
  const kws = TOPIC_KEYWORDS[topicSlug];
  if (!kws || kws.length === 0) return 1; // unknown topic — don't filter
  const lower = text.toLowerCase();
  const matched = kws.filter((k) => lower.includes(k)).length;
  return matched / kws.length;
}

/**
 * Quick pass/fail relevance check. Returns true if the item passes.
 * threshold defaults to 0.1 (1–2 keywords out of ~15 must match).
 * This is intentionally lenient — the AI editorial does the precision work.
 */
export function isRelevant(text: string, topicSlug: string, threshold = 0.1): boolean {
  return relevanceScore(text, topicSlug) >= threshold;
}
