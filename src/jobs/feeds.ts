// Content sources for the ingestion job.
// Nigeria first (PLAYBOOK §10) but global signals matter too — a US Fed move
// hits naira liquidity. The editorial AI's nigeria_relevance score (0-3) does
// the ranking, so we include global sources and let weak items drop at Tier 3.

export interface NewsFeed {
  url: string;
  source: string;
  topic: string;
}

export const NEWS_FEEDS: NewsFeed[] = [

  // ── Nigerian Politics ─────────────────────────────────────────────────────
  { url: 'https://www.premiumtimesng.com/feed',             source: 'Premium Times',          topic: 'politics'     },
  { url: 'https://www.thecable.ng/feed/',                   source: 'TheCable',               topic: 'politics'     },
  { url: 'https://www.vanguardngr.com/feed/',               source: 'Vanguard',               topic: 'politics'     },
  { url: 'https://dailypost.ng/feed/',                      source: 'Daily Post',             topic: 'politics'     },
  { url: 'https://punchng.com/feed/',                       source: 'Punch NG',               topic: 'politics'     },
  { url: 'https://dailytrust.com/feed/',                    source: 'Daily Trust',            topic: 'politics'     },
  { url: 'https://www.channelstv.com/home/feed/',           source: 'Channels TV',            topic: 'politics'     },

  // ── Nigerian Economy (dedicated topic) ───────────────────────────────────
  { url: 'https://nairametrics.com/feed/',                  source: 'Nairametrics',           topic: 'economy'      },
  { url: 'https://businessday.ng/economy/feed/',            source: 'BusinessDay Economy',    topic: 'economy'      },
  { url: 'https://www.thecable.ng/category/economy/feed',   source: 'TheCable Economy',       topic: 'economy'      },
  { url: 'https://punchng.com/topics/business/feed',        source: 'Punch Business',         topic: 'economy'      },
  { url: 'https://www.premiumtimesng.com/business/feed',    source: 'Premium Times Business', topic: 'economy'      },

  // ── Nigerian Finance ──────────────────────────────────────────────────────
  { url: 'https://businessday.ng/feed/',                    source: 'BusinessDay NG',         topic: 'finance'      },
  { url: 'https://techpoint.africa/feed/',                  source: 'TechPoint Africa',       topic: 'business'     },

  // ── Nigerian Sports ───────────────────────────────────────────────────────
  { url: 'https://punchng.com/topics/sports/feed',          source: 'Punch Sports',           topic: 'sports'       },
  { url: 'https://www.completesports.com/feed/',            source: 'Complete Sports NG',     topic: 'sports'       },
  { url: 'https://guardian.ng/category/sport/feed',         source: 'Guardian Sport NG',      topic: 'sports'       },
  { url: 'https://www.vanguardngr.com/category/sports/feed/', source: 'Vanguard Sports',      topic: 'sports'       },
  { url: 'https://feeds.bbci.co.uk/sport/rss.xml',          source: 'BBC Sport',              topic: 'sports'       },
  { url: 'https://www.goal.com/feeds/en/news',              source: 'Goal.com',               topic: 'sports'       },

  // ── Nigerian Entertainment / Music ────────────────────────────────────────
  { url: 'https://www.premiumtimesng.com/entertainment/feed', source: 'Premium Times Entertainment', topic: 'music' },
  { url: 'https://www.pulse.ng/rss',                        source: 'Pulse Nigeria',          topic: 'music'        },
  { url: 'https://punchng.com/topics/entertainment/feed',   source: 'Punch Entertainment',    topic: 'music'        },
  { url: 'https://www.notjustok.com/feed/',                 source: 'NotJustOk',              topic: 'music'        },
  { url: 'https://guardian.ng/category/arts/feed',          source: 'Guardian Arts NG',       topic: 'music'        },

  // ── Nigerian Health ───────────────────────────────────────────────────────
  { url: 'https://guardian.ng/category/health/feed',        source: 'Guardian Health NG',     topic: 'health'       },
  { url: 'https://punchng.com/topics/health/feed',          source: 'Punch Health',           topic: 'health'       },

  // ── Nigerian Tech ─────────────────────────────────────────────────────────
  { url: 'https://techcabal.com/feed/',                     source: 'TechCabal',              topic: 'tech'         },
  { url: 'https://techpoint.africa/feed/',                  source: 'TechPoint Africa',       topic: 'tech'         },

  // ── Nigerian Film / Nollywood ─────────────────────────────────────────────
  { url: 'https://www.pulse.ng/entertainment/rss',          source: 'Pulse Entertainment',    topic: 'film'         },
  { url: 'https://www.premiumtimesng.com/arts-entertainment/feed', source: 'Premium Times Arts', topic: 'film'     },

  // ── Nigerian Fashion / Lifestyle ──────────────────────────────────────────
  { url: 'https://guardian.ng/category/life/feed',          source: 'Guardian Life NG',       topic: 'fashion'      },
  { url: 'https://guardian.ng/category/travel/feed',        source: 'Guardian Travel NG',     topic: 'travel'       },

  // ── International — Africa focus ─────────────────────────────────────────
  // Only shown when Africa-relevant (editorial AI's nigeria_relevance filters noise).
  { url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml', source: 'BBC Africa',         topic: 'politics'     },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml',       source: 'Al Jazeera',            topic: 'politics'     },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml',  source: 'BBC Business',          topic: 'finance'      },
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', source: 'BBC Technology',       topic: 'tech'         },
  { url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', source: 'BBC Science', topic: 'science'  },
  { url: 'https://feeds.bbci.co.uk/news/health/rss.xml',    source: 'BBC Health',            topic: 'health'       },
  { url: 'https://feeds.bbci.co.uk/news/education/rss.xml', source: 'BBC Education',         topic: 'education'    },
  { url: 'https://feeds.bbci.co.uk/culture/rss.xml',        source: 'BBC Culture',           topic: 'culture'      },

  // Global tech / business (only Nigeria-touching items survive Tier-3 filter)
  { url: 'https://techcrunch.com/feed/',                    source: 'TechCrunch',            topic: 'business'     },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', source: 'NY Times Tech', topic: 'tech'    },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Climate.xml',    source: 'NY Times Climate', topic: 'climate' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Movies.xml',     source: 'NY Times Movies', topic: 'film'  },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Travel.xml',     source: 'NY Times Travel', topic: 'travel' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Education.xml',  source: 'NY Times Education', topic: 'education' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Fashion.xml',    source: 'NY Times Fashion', topic: 'fashion' },
];

export const PODCAST_FEEDS: NewsFeed[] = [
  // ── Climate ──────────────────────────────────────────────────────────────
  { url: 'https://feeds.acast.com/public/shows/outrage-optimism', source: 'Outrage + Optimism', topic: 'climate' },
  { url: 'https://podcasts.files.bbci.co.uk/w13xtvb6.rss', source: 'The Climate Question', topic: 'climate' },

  // ── Health ───────────────────────────────────────────────────────────────
  { url: 'https://podcasts.files.bbci.co.uk/p002vsyw.rss', source: 'Health Check', topic: 'health' },
  { url: 'https://feeds.buzzsprout.com/861868.rss', source: 'The Lancet Voice', topic: 'health' },
  { url: 'https://johnshopkinssph.libsyn.com/rss', source: 'Public Health On Call', topic: 'health' },
  { url: 'https://feeds.megaphone.fm/hubermanlab', source: 'Huberman Lab', topic: 'health' },

  // ── Science ──────────────────────────────────────────────────────────────
  { url: 'https://feeds.megaphone.fm/sciencevs', source: 'Science Vs', topic: 'science' },
  { url: 'https://rss.acast.com/nature', source: 'Nature Podcast', topic: 'science' },
  { url: 'https://feeds.simplecast.com/h18ZIZD_', source: 'Science Friday', topic: 'science' },

  // ── Technology ───────────────────────────────────────────────────────────
  { url: 'https://feeds.simplecast.com/6HKOhNgS', source: 'Hard Fork', topic: 'tech' },
  { url: 'https://feeds.megaphone.fm/vergecast', source: 'The Vergecast', topic: 'tech' },
  { url: 'https://feeds.transistor.fm/acquired', source: 'Acquired', topic: 'tech' },
  { url: 'https://lexfridman.com/feed/podcast/', source: 'Lex Fridman Podcast', topic: 'ai' },

  // ── Business & Finance ───────────────────────────────────────────────────
  { url: 'https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/8a94442e-5a74-4fa2-8b8d-ae27003a8d6b/982f5071-765c-403d-969d-ae27003a8d83/podcast.rss', source: 'Odd Lots', topic: 'finance' },
  { url: 'https://feeds.npr.org/510289/podcast.xml', source: 'Planet Money', topic: 'finance' },
  { url: 'https://feeds.npr.org/510313/podcast.xml', source: 'How I Built This', topic: 'business' },

  // ── Politics ─────────────────────────────────────────────────────────────
  { url: 'https://rss.acast.com/theintelligencepodcast', source: 'The Intelligence', topic: 'politics' },
  { url: 'https://podcasts.files.bbci.co.uk/p02nq0gn.rss', source: 'Global News Podcast', topic: 'politics' },
  { url: 'https://feeds.simplecast.com/54nAGcIl', source: 'The Daily', topic: 'politics' },

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

  // ── Fashion & Travel ─────────────────────────────────────────────────────
  { url: 'https://feeds.acast.com/public/shows/the-business-of-fashion-podcast', source: 'The Business of Fashion Podcast', topic: 'fashion' },
  { url: 'https://feeds.megaphone.fm/ZTTIA6764283121', source: 'Zero To Travel', topic: 'travel' },

  // ── Faith & Philosophy ───────────────────────────────────────────────────
  { url: 'https://feeds.megaphone.fm/QCD6036500916', source: 'Philosophize This!', topic: 'faith' },
  { url: 'https://feeds.soundcloud.com/users/soundcloud:users:19642636/sounds.rss', source: 'On Being', topic: 'faith' },
  { url: 'https://partiallyexaminedlife.libsyn.com/rss', source: 'The Partially Examined Life', topic: 'faith' },
];

export interface YoutubeChannel {
  channelId: string;
  source: string;
  topic: string;
}

export const YOUTUBE_CHANNELS: YoutubeChannel[] = [
  { channelId: 'UCsBjURrPoezykLs9EqgamOA', source: 'Fireship',         topic: 'tech'      },
  { channelId: 'UCIALMKvObZNtJ6AmdCLP7Lg', source: 'Bloomberg',        topic: 'business'  },
  { channelId: 'UCCjyq_K1Xwfg8Lndy7lKMpA', source: 'TechCrunch Video', topic: 'startups'  },
  { channelId: 'UCJIfeSCssxSC_Dhc5s7woww', source: 'Lex Clips',        topic: 'ai'        },
  { channelId: 'UCUHW94eEFW7hkUMVaZz4eDg', source: 'MinutePhysics',    topic: 'science'   },
];

// Per-run targets — how many of each type to publish per ingest.
// Round-robin across sources means these spread across all outlets.
// Dedup makes re-runs cheap (only new items hit the AI editorial engine).
export const TARGET_NEWS     = 60;   // was 40; more sources need a higher cap
export const TARGET_PODCASTS = 20;
export const TARGET_CLIPS    = 12;

// How many recent items to pull from each source as candidates.
export const PER_NEWS_FEED      = 10;
export const PER_PODCAST_FEED   = 3;
export const PER_YOUTUBE_CHANNEL = 10;

export const MIN_PODCAST_DURATION_SEC = 300;
export const MAX_PODCAST_DURATION_SEC = 4 * 60 * 60;
export const MIN_CLIP_DURATION_SEC    = 15;
export const MAX_CLIP_DURATION_SEC    = 60;
export const MAX_PODCAST_AGE_DAYS     = 14;

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
