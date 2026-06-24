// Content sources for the ingestion job. Ported from the old ingest-content
// Edge Function. PLAYBOOK §10 puts Nigeria first, but global signals matter too
// (a US Fed move hits naira liquidity), so we keep global sources and let the
// §4A nigeria_relevance score do the ranking.

export interface NewsFeed {
  url: string;
  source: string;
  topic: string;
}

export const NEWS_FEEDS: NewsFeed[] = [
  // Global
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', source: 'BBC Technology', topic: 'tech' },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC Business', topic: 'finance' },
  { url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', source: 'BBC Science', topic: 'science' },
  { url: 'https://feeds.bbci.co.uk/news/education/rss.xml', source: 'BBC Education', topic: 'education' },
  { url: 'https://feeds.bbci.co.uk/sport/rss.xml', source: 'BBC Sport', topic: 'sports' },
  { url: 'https://feeds.bbci.co.uk/culture/rss.xml', source: 'BBC Culture', topic: 'culture' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', source: 'NY Times Tech', topic: 'tech' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Climate.xml', source: 'NY Times Climate', topic: 'climate' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml', source: 'NY Times Arts', topic: 'culture' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Movies.xml', source: 'NY Times Movies', topic: 'film' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Travel.xml', source: 'NY Times Travel', topic: 'travel' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Education.xml', source: 'NY Times Education', topic: 'education' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Fashion.xml', source: 'NY Times Fashion', topic: 'fashion' },
  { url: 'https://techcrunch.com/feed/', source: 'TechCrunch', topic: 'business' },
  // Nigerian / African
  { url: 'https://techcabal.com/feed/', source: 'TechCabal', topic: 'tech' },
  { url: 'https://techpoint.africa/feed/', source: 'TechPoint Africa', topic: 'business' },
  { url: 'https://nairametrics.com/feed/', source: 'Nairametrics', topic: 'finance' },
  { url: 'https://businessday.ng/feed/', source: 'BusinessDay NG', topic: 'business' },
  { url: 'https://www.thecable.ng/feed/', source: 'TheCable', topic: 'politics' },
  { url: 'https://www.premiumtimesng.com/feed', source: 'Premium Times', topic: 'politics' },
  { url: 'https://www.premiumtimesng.com/entertainment/feed', source: 'Premium Times Entertainment', topic: 'music' },
  { url: 'https://punchng.com/topics/sports/feed', source: 'Punch Sports', topic: 'sports' },
  { url: 'https://guardian.ng/category/life/feed', source: 'Guardian Life', topic: 'fashion' },
  { url: 'https://guardian.ng/category/travel/feed', source: 'Guardian Travel', topic: 'travel' },
];

export const PODCAST_FEEDS: NewsFeed[] = [
  { url: 'https://lexfridman.com/feed/podcast/', source: 'Lex Fridman Podcast', topic: 'ai' },
  { url: 'https://feeds.megaphone.fm/hubermanlab', source: 'Huberman Lab', topic: 'health' },
  { url: 'https://feeds.npr.org/510289/podcast.xml', source: 'Planet Money', topic: 'finance' },
  { url: 'https://feeds.npr.org/510313/podcast.xml', source: 'How I Built This', topic: 'business' },
  { url: 'https://feeds.simplecast.com/54nAGcIl', source: 'The Daily', topic: 'politics' },
];

export interface YoutubeChannel {
  channelId: string;
  source: string;
  topic: string;
}

// Sampled for short-form clips (≤180s). Scope: Tech + Business + Science.
export const YOUTUBE_CHANNELS: YoutubeChannel[] = [
  { channelId: 'UCsBjURrPoezykLs9EqgamOA', source: 'Fireship', topic: 'tech' },
  { channelId: 'UCIALMKvObZNtJ6AmdCLP7Lg', source: 'Bloomberg', topic: 'business' },
  { channelId: 'UCCjyq_K1Xwfg8Lndy7lKMpA', source: 'TechCrunch (Video)', topic: 'startups' },
  { channelId: 'UCJIfeSCssxSC_Dhc5s7woww', source: 'Lex Clips', topic: 'ai' },
  { channelId: 'UCUHW94eEFW7hkUMVaZz4eDg', source: 'MinutePhysics', topic: 'science' },
];

// Per-run targets — how many of each type to publish per ingest. Round-robin
// across sources means these are spread across all feeds (Nigerian included),
// not front-loaded from one outlet. Dedup makes re-runs cheap (only new items
// hit the AI), so there's no daily cap — the feed grows and stays fresh.
export const TARGET_NEWS = 40;
export const TARGET_PODCASTS = 12;
export const TARGET_CLIPS = 12;

// How many recent items to pull from each source as candidates.
export const PER_NEWS_FEED = 12;
export const PER_PODCAST_FEED = 6;
export const PER_YOUTUBE_CHANNEL = 10;

export const MIN_PODCAST_DURATION_SEC = 300;
export const MAX_PODCAST_DURATION_SEC = 4 * 60 * 60;
export const MIN_CLIP_DURATION_SEC = 15;
export const MAX_CLIP_DURATION_SEC = 180;

export const PROMO_TITLE_PATTERNS: RegExp[] = [
  /^\s*trailer\b/i,
  /\btrailer\s*[-:]/i,
  /^\s*bonus\b/i,
  /^\s*\[?ad\]?\b/i,
  /\bsponsored\b/i,
  /^\s*preview\b/i,
  /^\s*promo\b/i,
  /^\s*introducing\b/i,
  /coming soon/i,
  /^\s*announcement\b/i,
];
