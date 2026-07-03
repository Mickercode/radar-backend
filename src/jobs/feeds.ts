// Content sources for the ingestion job.
// Nigeria first (PLAYBOOK §10) but global signals matter too — a US Fed move
// hits naira liquidity. The editorial AI's nigeria_relevance score (0-3) does
// the ranking, so we include global sources and let weak items drop at Tier 3.

export interface NewsFeed {
  url: string;
  source: string;
  topic: string;
}

// Mediastack API covers general, business, technology, entertainment, health,
// science, and sports for Nigeria + broader Africa. These RSS feeds supplement
// for niche topics Mediastack doesn't have great coverage for: Nollywood/film,
// fashion, travel, faith, education, and specialist Nigerian tech/economy voices.
export const NEWS_FEEDS: NewsFeed[] = [

  // ── Tech — Nigeria ───────────────────────────────────────────────────────
  { url: 'https://techcabal.com/feed/',                     source: 'TechCabal',              topic: 'tech'         },
  { url: 'https://techpoint.africa/feed/',                  source: 'TechPoint Africa',       topic: 'tech'         },
  { url: 'https://technext24.com/feed/',                    source: 'Technext',               topic: 'tech'         },
  { url: 'https://www.benjamindada.com/feed/',              source: 'Benjamin Dada',          topic: 'tech'         },
  { url: 'https://geeky.com.ng/feed/',                      source: 'Geeky Nigeria',          topic: 'tech'         },

  // ── Tech — Africa ─────────────────────────────────────────────────────────
  { url: 'https://disruptafrica.com/feed/',                 source: 'Disrupt Africa',         topic: 'tech'         },
  { url: 'https://connectingafrica.com/feed/',              source: 'Connecting Africa',       topic: 'tech'         },
  { url: 'https://itweb.africa/rss',                        source: 'ITWeb Africa',           topic: 'tech'         },
  { url: 'https://techcentral.co.za/feed/',                 source: 'TechCentral',            topic: 'tech'         },

  // ── Tech — International ──────────────────────────────────────────────────
  { url: 'https://www.theverge.com/rss/index.xml',          source: 'The Verge',              topic: 'tech'         },
  { url: 'https://www.wired.com/feed/rss',                  source: 'WIRED',                  topic: 'tech'         },
  { url: 'https://feeds.arstechnica.com/arstechnica/index', source: 'Ars Technica',           topic: 'tech'         },
  { url: 'https://www.technologyreview.com/feed/',          source: 'MIT Technology Review',  topic: 'tech'         },

  // ── Business & Finance — Nigeria ─────────────────────────────────────────
  { url: 'https://nairametrics.com/feed/',                  source: 'Nairametrics',           topic: 'economy'      },
  { url: 'https://businessday.ng/feed/',                    source: 'BusinessDay NG',         topic: 'finance'      },
  { url: 'https://www.thisdaylive.com/index.php/business/feed/', source: 'ThisDay Business', topic: 'finance'      },
  { url: 'https://www.thecable.ng/business-economy/feed/', source: 'TheCable Business',      topic: 'finance'      },
  { url: 'https://leadership.ng/business/feed/',            source: 'Leadership Business',    topic: 'finance'      },

  // ── Business & Finance — Africa ───────────────────────────────────────────
  { url: 'https://african.business/feed/',                  source: 'African Business',       topic: 'finance'      },
  { url: 'https://www.theafricareport.com/business/feed/',  source: 'The Africa Report',      topic: 'finance'      },
  { url: 'https://www.howwemadeitinafrica.com/feed/',        source: 'How We Made It In Africa', topic: 'finance'   },
  { url: 'https://www.cnbcafrica.com/feed/',                source: 'CNBC Africa',            topic: 'finance'      },
  { url: 'https://africabusinessplus.com/feed/',            source: 'Africa Business+',       topic: 'finance'      },

  // ── Business & Finance — International ───────────────────────────────────
  // FT, Bloomberg (news), WSJ have no reliable public RSS — Bloomberg covered via YouTube clips
  { url: 'https://feeds.reuters.com/reuters/businessNews',  source: 'Reuters Business',       topic: 'finance'      },
  { url: 'https://www.economist.com/finance-and-economics/rss.xml', source: 'The Economist', topic: 'finance'      },

  // ── Music / Film & TV — Nigeria ──────────────────────────────────────────
  { url: 'https://www.notjustok.com/feed/',                       source: 'NotJustOk',              topic: 'music'  },
  { url: 'https://www.bellanaija.com/music/feed/',                source: 'BellaNaija Music',       topic: 'music'  },
  { url: 'https://www.bellanaija.com/category/nollywood/feed/',   source: 'BellaNaija Nollywood',   topic: 'film'   },
  { url: 'https://www.pulse.ng/entertainment/feed/',              source: 'Pulse Entertainment',    topic: 'music'  },
  { url: 'https://kemifilani.ng/feed/',                           source: 'Kemi Filani',            topic: 'film'   },
  { url: 'https://www.naijavibe.net/feed/',                       source: 'NaijaVibe',              topic: 'music'  },
  { url: 'https://whatkeptmeup.com/feed/',                        source: 'What Kept Me Up',        topic: 'music'  },

  // ── Music / Film & TV — Africa ────────────────────────────────────────────
  { url: 'https://www.musicinafrica.net/feed/',                   source: 'Music In Africa',        topic: 'music'  },
  { url: 'https://www.okayafrica.com/feed/',                      source: 'OkayAfrica',             topic: 'music'  },
  { url: 'https://africasacountry.com/feed/',                     source: 'Africa Is A Country',    topic: 'film'   },
  { url: 'https://thecontinent.org/feed/',                        source: 'The Continent',          topic: 'film'   },
  { url: 'https://afrocritik.com/feed/',                          source: 'Afrocritik',             topic: 'film'   },
  { url: 'https://culturecustodian.com/feed/',                    source: 'The Culture Custodian',  topic: 'music'  },
  { url: 'https://africanfilmpress.com/feed/',                    source: 'Africa Film Press',      topic: 'film'   },
  { url: 'https://www.sinemafocus.com/feed/',                     source: 'Sinema Focus',           topic: 'film'   },
  { url: 'https://akoroko.com/feed/',                             source: 'Akoroko',                topic: 'music'  },

  // ── Music / Film & TV — International ────────────────────────────────────
  { url: 'https://variety.com/feed/',                             source: 'Variety',                topic: 'film'   },
  { url: 'https://www.hollywoodreporter.com/feed/',               source: 'Hollywood Reporter',     topic: 'film'   },
  { url: 'https://deadline.com/feed/',                            source: 'Deadline',               topic: 'film'   },
  { url: 'https://www.billboard.com/feed/',                       source: 'Billboard',              topic: 'music'  },
  { url: 'https://www.indiewire.com/feed/',                       source: 'IndieWire',              topic: 'film'   },

  // ── Nigerian Fashion / Lifestyle ──────────────────────────────────────────
  { url: 'https://www.bellanaija.com/lifestyle/feed/',      source: 'BellaNaija Lifestyle',   topic: 'fashion'      },
  { url: 'https://www.bellanaija.com/beauty/feed/',         source: 'BellaNaija Beauty',      topic: 'fashion'      },

  // ── Travel ────────────────────────────────────────────────────────────────
  // travelnoire.com returns 522 (Cloudflare host error); using NYT only
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Travel.xml', source: 'NY Times Travel', topic: 'travel'     },

  // ── Education ─────────────────────────────────────────────────────────────
  { url: 'https://feeds.bbci.co.uk/news/education/rss.xml', source: 'BBC Education',         topic: 'education'    },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Education.xml', source: 'NY Times Education', topic: 'education' },

  // ── Climate — Nigeria ─────────────────────────────────────────────────────
  { url: 'https://climatereporters.com/feed/',                source: 'Climate Reporters NG',   topic: 'climate'      },
  { url: 'https://www.environewsnigeria.com/feed/',           source: 'EnviroNews Nigeria',      topic: 'climate'      },
  { url: 'https://ncfnigeria.org/blog/feed/',                 source: 'NCF Nigeria',             topic: 'climate'      },

  // ── Climate — Africa ──────────────────────────────────────────────────────
  { url: 'https://africaclimatewire.org/feed/',               source: 'Africa Climate Wire',     topic: 'climate'      },
  { url: 'https://allafrica.com/stories/rss2.0.xml?category=environment', source: 'AllAfrica Environment', topic: 'climate' },
  { url: 'https://news.mongabay.com/feed/?category=africa',  source: 'Mongabay Africa',         topic: 'climate'      },
  { url: 'https://africanarguments.org/feed/',                source: 'African Arguments',       topic: 'climate'      },

  // ── Climate — International ───────────────────────────────────────────────
  { url: 'https://www.carbonbrief.org/feed/',                 source: 'Carbon Brief',            topic: 'climate'      },
  { url: 'https://www.climatechangenews.com/feed/',           source: 'Climate Change News',     topic: 'climate'      },
  { url: 'https://yaleclimateconnections.org/feed/',          source: 'Yale Climate Connections',topic: 'climate'      },
  { url: 'https://insideclimatenews.org/feed/',               source: 'Inside Climate News',     topic: 'climate'      },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Climate.xml', source: 'NY Times Climate', topic: 'climate'   },

  // ── Health — Nigeria ──────────────────────────────────────────────────────
  { url: 'https://nigeriahealthwatch.com/feed/',               source: 'Nigeria Health Watch',    topic: 'health'       },
  { url: 'https://www.premiumtimesng.com/health/feed/',        source: 'Premium Times Health',    topic: 'health'       },
  { url: 'https://healthwise.punchng.com/feed/',               source: 'Healthwise Punch',        topic: 'health'       },
  { url: 'https://dailytrust.com/category/health/feed/',       source: 'Daily Trust Health',      topic: 'health'       },
  { url: 'https://guardian.ng/category/features/health/feed/', source: 'Guardian Health NG',     topic: 'health'       },

  // ── Health — Africa ───────────────────────────────────────────────────────
  { url: 'https://health-e.org.za/feed/',                      source: 'Health-e News',           topic: 'health'       },
  { url: 'https://allafrica.com/stories/rss2.0.xml?category=health', source: 'AllAfrica Health', topic: 'health'       },
  { url: 'https://bhekisisa.org/feed/',                        source: 'Bhekisisa',               topic: 'health'       },
  { url: 'https://www.afro.who.int/feeds/news',                source: 'WHO Africa',              topic: 'health'       },

  // ── Health — International ────────────────────────────────────────────────
  { url: 'https://www.thelancet.com/rssfeed/lancet_current.xml', source: 'The Lancet',           topic: 'health'       },
  { url: 'https://www.bmj.com/rss/current.xml',                source: 'BMJ',                     topic: 'health'       },
  { url: 'https://www.statnews.com/feed/',                     source: 'STAT News',               topic: 'health'       },
  { url: 'https://www.who.int/feeds/entity/news/en/rss.xml',   source: 'WHO',                    topic: 'health'       },
  { url: 'https://healthpolicy-watch.news/feed/',              source: 'Health Policy Watch',     topic: 'health'       },

  // ── Science — Nigeria ─────────────────────────────────────────────────────
  { url: 'https://sciencenigeria.com/feed/',                   source: 'Science Nigeria',         topic: 'science'      },
  { url: 'https://nas.org.ng/feed/',                           source: 'Nigerian Academy of Science', topic: 'science'  },

  // ── Science — Africa ──────────────────────────────────────────────────────
  { url: 'https://www.scidev.net/sub-saharan-africa/feed/',    source: 'SciDev.Net Africa',       topic: 'science'      },
  { url: 'https://www.aasciences.africa/feed/',                source: 'African Academy of Sciences', topic: 'science'  },
  { url: 'https://theconversation.com/africa/articles.atom',   source: 'The Conversation Africa', topic: 'science'      },
  { url: 'https://www.nature.com/subjects/africa.rss',         source: 'Nature Africa',           topic: 'science'      },

  // ── Science — International ───────────────────────────────────────────────
  { url: 'https://feeds.nature.com/nature/rss/current',        source: 'Nature',                  topic: 'science'      },
  { url: 'https://www.science.org/rss/news_current.xml',       source: 'Science',                 topic: 'science'      },
  { url: 'https://www.newscientist.com/feed/home/',            source: 'New Scientist',            topic: 'science'      },
  { url: 'https://www.scientificamerican.com/feed/',           source: 'Scientific American',      topic: 'science'      },
  { url: 'https://www.livescience.com/feeds/all',              source: 'Live Science',             topic: 'science'      },
  { url: 'https://theconversation.com/global/articles.atom',   source: 'The Conversation',        topic: 'science'      },

  // ── Politics — Nigeria ────────────────────────────────────────────────────
  { url: 'https://www.premiumtimesng.com/politics/feed/',      source: 'Premium Times Politics',  topic: 'politics'     },
  { url: 'https://www.thecable.ng/politics/feed/',             source: 'TheCable Politics',        topic: 'politics'     },
  { url: 'https://punchng.com/category/politics/feed/',        source: 'Punch Politics',           topic: 'politics'     },
  { url: 'https://www.thisdaylive.com/index.php/politics/feed/', source: 'ThisDay Politics',       topic: 'politics'     },
  { url: 'https://dailytrust.com/category/politics/feed/',     source: 'Daily Trust Politics',     topic: 'politics'     },

  // ── Politics — Africa ─────────────────────────────────────────────────────
  { url: 'https://www.theafricareport.com/politics/feed/',     source: 'The Africa Report Politics', topic: 'politics'  },
  { url: 'https://africanarguments.org/feed/',                 source: 'African Arguments',        topic: 'politics'     },
  { url: 'https://issafrica.org/iss-today/feed/',              source: 'ISS Africa',               topic: 'politics'     },
  { url: 'https://allafrica.com/stories/rss2.0.xml?category=politics', source: 'AllAfrica Politics', topic: 'politics'  },
  { url: 'https://mg.co.za/politics/feed/',                    source: 'Mail & Guardian Politics', topic: 'politics'     },

  // ── Politics — International ──────────────────────────────────────────────
  { url: 'https://rss.politico.com/politics-news.xml',         source: 'Politico',                topic: 'politics'     },
  { url: 'https://www.foreignaffairs.com/rss.xml',             source: 'Foreign Affairs',          topic: 'politics'     },
  { url: 'https://feeds.bbci.co.uk/news/politics/rss.xml',     source: 'BBC Politics',            topic: 'politics'     },
  { url: 'https://feeds.reuters.com/reuters/worldnews',         source: 'Reuters World',           topic: 'politics'     },
  { url: 'https://www.theguardian.com/world/rss',              source: 'The Guardian World',       topic: 'politics'     },
  { url: 'https://www.chathamhouse.org/rss.xml',               source: 'Chatham House',            topic: 'politics'     },

  // ── Sports — Nigeria ──────────────────────────────────────────────────────
  { url: 'https://www.completesports.com/feed/',            source: 'Complete Sports NG',     topic: 'sports'       },
  { url: 'https://soccernet.ng/feed/',                      source: 'Soccernet NG',           topic: 'sports'       },
  { url: 'https://brila.net/feed/',                         source: 'Brila',                  topic: 'sports'       },
  { url: 'https://punchng.com/category/sports/feed/',       source: 'Punch Sports',           topic: 'sports'       },
  { url: 'https://www.premiumtimesng.com/sports-news/feed/', source: 'Premium Times Sports',  topic: 'sports'       },
  { url: 'https://guardian.ng/sport/feed/',                 source: 'Guardian Sport NG',      topic: 'sports'       },

  // ── Sports — Africa ───────────────────────────────────────────────────────
  { url: 'https://www.kickoff.com/feed/',                   source: 'KickOff',                topic: 'sports'       },
  { url: 'https://sportnewsafrica.com/feed/',               source: 'Sport News Africa',      topic: 'sports'       },
  { url: 'https://feeds.bbci.co.uk/sport/africa/rss.xml',  source: 'BBC Sport Africa',       topic: 'sports'       },

  // ── Sports — International ────────────────────────────────────────────────
  // SuperSport + CAF Online have no public RSS; Goal.com discontinued RSS
  { url: 'https://www.skysports.com/rss/12040',             source: 'Sky Sports',             topic: 'sports'       },
  { url: 'https://www.espn.com/espn/rss/news',              source: 'ESPN',                   topic: 'sports'       },
  { url: 'https://feeds.bbci.co.uk/sport/rss.xml',          source: 'BBC Sport',              topic: 'sports'       },
];

export const PODCAST_FEEDS: NewsFeed[] = [
  // ── Climate ──────────────────────────────────────────────────────────────
  { url: 'https://feeds.acast.com/public/shows/outrage-optimism',          source: 'Outrage + Optimism',        topic: 'climate' },
  { url: 'https://feeds.simplecast.com/4T39_jAj',                           source: 'The Energy Gang',           topic: 'climate' },
  { url: 'https://podcasts.files.bbci.co.uk/w13xtvb6.rss',                  source: 'The Climate Question',      topic: 'climate' },

  // ── Health ───────────────────────────────────────────────────────────────
  { url: 'https://podcasts.files.bbci.co.uk/p002vsyw.rss',                  source: 'Health Check',              topic: 'health'  },
  { url: 'https://feeds.buzzsprout.com/861868.rss',                         source: 'The Lancet Voice',          topic: 'health'  },
  { url: 'https://johnshopkinssph.libsyn.com/rss',                          source: 'Public Health On Call',     topic: 'health'  },

  // ── Science ──────────────────────────────────────────────────────────────
  { url: 'https://feeds.megaphone.fm/sciencevs',                            source: 'Science Vs',                topic: 'science' },
  { url: 'https://rss.acast.com/nature',                                    source: 'Nature Podcast',            topic: 'science' },
  { url: 'https://feeds.simplecast.com/h18ZIZD_',                           source: 'Science Friday',            topic: 'science' },

  // ── Technology ───────────────────────────────────────────────────────────
  { url: 'https://feeds.simplecast.com/6HKOhNgS',                           source: 'Hard Fork',                 topic: 'tech'    },
  { url: 'https://feeds.megaphone.fm/vergecast',                            source: 'The Vergecast',             topic: 'tech'    },
  { url: 'https://feeds.transistor.fm/acquired',                            source: 'Acquired',                  topic: 'tech'    },

  // ── Business & Finance ───────────────────────────────────────────────────
  { url: 'https://feeds.npr.org/510289/podcast.xml',                        source: 'Planet Money',              topic: 'finance' },
  { url: 'https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/8a94442e-5a74-4fa2-8b8d-ae27003a8d6b/982f5071-765c-403d-969d-ae27003a8d83/podcast.rss', source: 'Odd Lots', topic: 'finance' },
  { url: 'https://feeds.npr.org/510313/podcast.xml',                        source: 'How I Built This',          topic: 'business'},

  // ── Politics ─────────────────────────────────────────────────────────────
  { url: 'https://feeds.simplecast.com/54nAGcIl',                           source: 'The Daily',                 topic: 'politics'},
  { url: 'https://podcasts.files.bbci.co.uk/p02nq0gn.rss',                  source: 'Global News Podcast',       topic: 'politics'},
  { url: 'https://rss.acast.com/theintelligencepodcast',                    source: 'The Intelligence',          topic: 'politics'},

  // ── Sports ───────────────────────────────────────────────────────────────
  { url: 'https://podcasts.files.bbci.co.uk/p02nrsln.rss',                  source: 'Football Daily',            topic: 'sports'  },
  { url: 'https://feeds.acast.com/public/shows/the-athletic-fc-podcast',    source: 'The Athletic FC Podcast',   topic: 'sports'  },
  { url: 'https://rss.art19.com/men-in-blazers',                            source: 'Men in Blazers',            topic: 'sports'  },

  // ── Music ────────────────────────────────────────────────────────────────
  { url: 'https://afrobeatsintelligence.substack.com/feed',                 source: 'Afrobeats Intelligence',    topic: 'music'   },
  { url: 'https://songexploder.net/feed/podcast',                           source: 'Song Exploder',             topic: 'music'   },
  { url: 'https://feeds.npr.org/510019/podcast.xml',                        source: 'All Songs Considered',      topic: 'music'   },

  // ── Film & TV ────────────────────────────────────────────────────────────
  { url: 'https://feeds.megaphone.fm/thebigpicture',                        source: 'The Big Picture',           topic: 'film'    },
  { url: 'https://feeds.megaphone.fm/PMC7846561481',                        source: 'IndieWire Screen Talk',     topic: 'film'    },
  { url: 'https://scriptnotes.libsyn.com/rss',                              source: 'Scriptnotes',               topic: 'film'    },

  // ── Education ────────────────────────────────────────────────────────────
  { url: 'https://feeds.buzzsprout.com/2265341.rss',                        source: 'The EdSurge Podcast',       topic: 'education'},
  { url: 'https://feeds.podbean.com/futureu/feed.xml',                      source: 'Future U',                  topic: 'education'},
  { url: 'https://educationnext.org/feed/',                                  source: 'Education Next',            topic: 'education'},

  // ── Fashion, Travel & Lifestyle ───────────────────────────────────────────
  { url: 'https://podcasts.files.bbci.co.uk/p016tmt2.rss',                  source: 'BBC Travel Show',           topic: 'travel'  },
  { url: 'https://feeds.acast.com/public/shows/the-business-of-fashion-podcast', source: 'The Business of Fashion Podcast', topic: 'fashion'},
  { url: 'https://feeds.megaphone.fm/zerototravel',                         source: 'Zero To Travel',            topic: 'travel'  },

  // ── Faith & Philosophy ───────────────────────────────────────────────────
  { url: 'https://philosophizethis.libsyn.com/rss',                         source: 'Philosophize This!',        topic: 'faith'   },
  { url: 'https://onbeing.org/feed/podcast/',                               source: 'On Being',                  topic: 'faith'   },
  { url: 'https://partiallyexaminedlife.libsyn.com/rss', source: 'The Partially Examined Life', topic: 'faith' },
];

export interface YoutubeChannel {
  channelId: string;
  source: string;
  topic: string;
}

// Channel IDs: find them at youtube.com/@ChannelName → About → Share → Copy channel ID
export const YOUTUBE_CHANNELS: YoutubeChannel[] = [
  // ── Verified global channels ──────────────────────────────────────────────
  { channelId: 'UCsBjURrPoezykLs9EqgamOA', source: 'Fireship',       topic: 'tech'      },
  { channelId: 'UCIALMKvObZNtJ6AmdCLP7Lg', source: 'Bloomberg',      topic: 'economy'   },
  { channelId: 'UCCjyq_K1Xwfg8Lndy7lKMpA', source: 'TechCrunch',    topic: 'tech'      },
  { channelId: 'UCJIfeSCssxSC_Dhc5s7woww', source: 'Lex Clips',      topic: 'tech'      },
  { channelId: 'UCnUYZLuoy1rq1aVMwx4aTzw', source: 'GQ',             topic: 'fashion'   },
  { channelId: 'UCqZQlzSHbVJrwrn5XvzrzcA', source: 'ESPN FC',        topic: 'sports'    },
  { channelId: 'UCB_qr75-ydFVKSF9Dmo6izg', source: 'Al Jazeera Eng', topic: 'politics'  },
  // ── Add Nigerian channel IDs below (get from youtube.com/@channel → About) ─
  // { channelId: 'PASTE_CHANNELS_TV_ID',   source: 'Channels TV',    topic: 'politics'  },
  // { channelId: 'PASTE_TVC_NEWS_ID',      source: 'TVC News',       topic: 'politics'  },
  // { channelId: 'PASTE_NOTJUSTOK_ID',     source: 'NotJustOk TV',   topic: 'music'     },
];

// Per-run targets — how many of each type to publish per ingest.
// Round-robin across sources means these spread across all outlets.
// Dedup makes re-runs cheap (only new items hit the AI editorial engine).
// Kept low to fit within Render free-tier 512 MB — ingest runs every 3h so
// smaller batches accumulate. Increase once you're on a paid instance.
export const TARGET_NEWS     = 60;
export const TARGET_PODCASTS = 8;
export const TARGET_CLIPS    = 5;

// How many recent items to pull from each source as candidates.
export const PER_NEWS_FEED      = 5;
export const PER_PODCAST_FEED   = 2;
export const PER_YOUTUBE_CHANNEL = 5;

export const MIN_PODCAST_DURATION_SEC = 300;
export const MAX_PODCAST_DURATION_SEC = 4 * 60 * 60;
export const MIN_CLIP_DURATION_SEC    = 60;       // at least 1 minute
export const MAX_CLIP_DURATION_SEC    = 20 * 60;  // up to 20 minutes
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
