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
  // ── Climate ──────────────────────────────────────────────────────────────
  { url: 'https://feeds.acast.com/public/shows/outrage-optimism', source: 'Outrage + Optimism', topic: 'climate' },
  // The Energy Gang (unavailable — feeds moved to Simplecast but 404 on 3 attempts)
  // Song Exploder (unavailable — PRX and Simplecast feeds both failed)
  // Future U (unavailable — Simplecast feeds returned 404 and XML errors)
  // Women Who Travel (unavailable — 3 different Megaphone/Simplecast IDs all 404)
  { url: 'https://podcasts.files.bbci.co.uk/w13xtvb6.rss', source: 'The Climate Question', topic: 'climate' },

  // ── Health ───────────────────────────────────────────────────────────────
  { url: 'https://podcasts.files.bbci.co.uk/p002vsyw.rss', source: 'Health Check', topic: 'health' },
  { url: 'https://feeds.buzzsprout.com/861868.rss', source: 'The Lancet Voice', topic: 'health' },
  { url: 'https://johnshopkinssph.libsyn.com/rss', source: 'Public Health On Call', topic: 'health' },

  // ── Science ──────────────────────────────────────────────────────────────
  { url: 'https://feeds.megaphone.fm/sciencevs', source: 'Science Vs', topic: 'science' },
  { url: 'https://rss.acast.com/nature', source: 'Nature Podcast', topic: 'science' },
  { url: 'https://feeds.simplecast.com/h18ZIZD_', source: 'Science Friday', topic: 'science' },

  // ── Technology ───────────────────────────────────────────────────────────
  { url: 'https://feeds.simplecast.com/6HKOhNgS', source: 'Hard Fork', topic: 'tech' },
  { url: 'https://feeds.megaphone.fm/vergecast', source: 'The Vergecast', topic: 'tech' },
  { url: 'https://feeds.transistor.fm/acquired', source: 'Acquired', topic: 'tech' },

  // ── Business & Finance ───────────────────────────────────────────────────
  { url: 'https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/8a94442e-5a74-4fa2-8b8d-ae27003a8d6b/982f5071-765c-403d-969d-ae27003a8d83/podcast.rss', source: 'Odd Lots', topic: 'finance' },

  // ── Politics ─────────────────────────────────────────────────────────────
  { url: 'https://rss.acast.com/theintelligencepodcast', source: 'The Intelligence', topic: 'politics' },
  { url: 'https://podcasts.files.bbci.co.uk/p02nq0gn.rss', source: 'Global News Podcast', topic: 'politics' },

  // ── Sports ───────────────────────────────────────────────────────────────
  { url: 'https://podcasts.files.bbci.co.uk/p02nrsln.rss', source: 'Football Daily', topic: 'sports' },
  { url: 'https://feeds.acast.com/public/shows/the-athletic-fc-podcast', source: 'The Athletic FC Podcast', topic: 'sports' },
  { url: 'https://rss.art19.com/men-in-blazers', source: 'Men in Blazers', topic: 'sports' },

  // ── Music ────────────────────────────────────────────────────────────────
  { url: 'https://afrobeatsintelligence.substack.com/feed', source: 'Afrobeats Intelligence', topic: 'music' },

  // ── Film & TV ────────────────────────────────────────────────────────────
  { url: 'https://feeds.megaphone.fm/thebigpicture', source: 'The Big Picture', topic: 'film' },
  { url: 'https://feeds.megaphone.fm/PMC7846561481', source: 'IndieWire Screen Talk', topic: 'film' },
  { url: 'https://scriptnotes.libsyn.com/rss', source: 'Scriptnotes', topic: 'film' },

  // ── Education ────────────────────────────────────────────────────────────
  { url: 'https://feeds.soundcloud.com/users/soundcloud:users:144948831/sounds.rss', source: 'The EdSurge Podcast', topic: 'education' },
  { url: 'https://www.educationnext.org/feed/', source: 'Education Next', topic: 'education' },

  // ── Fashion & Travel ─────────────────────────────────────────────────────
  { url: 'https://feeds.acast.com/public/shows/the-business-of-fashion-podcast', source: 'The Business of Fashion Podcast', topic: 'fashion' },
  { url: 'https://feeds.megaphone.fm/ZTTIA6764283121', source: 'Zero To Travel', topic: 'travel' },

  // ── Faith & Philosophy ───────────────────────────────────────────────────
  { url: 'https://feeds.megaphone.fm/QCD6036500916', source: 'Philosophize This!', topic: 'faith' },
  { url: 'https://feeds.soundcloud.com/users/soundcloud:users:19642636/sounds.rss', source: 'On Being', topic: 'faith' },
  { url: 'https://partiallyexaminedlife.libsyn.com/rss', source: 'The Partially Examined Life', topic: 'faith' },

  // ── Existing feeds kept for continuity ───────────────────────────────────
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
export const TARGET_PODCASTS = 20;
export const TARGET_CLIPS = 12;

// How many recent items to pull from each source as candidates.
export const PER_NEWS_FEED = 12;
export const PER_PODCAST_FEED = 3;
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
