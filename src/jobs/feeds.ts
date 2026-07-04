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
  { url: 'https://itweb.africa/rss',                        source: 'ITWeb Africa',           topic: 'tech'         },
  { url: 'https://techcentral.co.za/feed/',                 source: 'TechCentral',            topic: 'tech'         },
  { url: 'https://www.techzim.co.zw/feed/',                 source: 'Techzim',                topic: 'tech'         },

  // ── Tech — International ──────────────────────────────────────────────────
  { url: 'https://www.theverge.com/rss/index.xml',          source: 'The Verge',              topic: 'tech'         },
  { url: 'https://www.wired.com/feed/rss',                  source: 'WIRED',                  topic: 'tech'         },
  { url: 'https://feeds.arstechnica.com/arstechnica/index', source: 'Ars Technica',           topic: 'tech'         },
  { url: 'https://www.technologyreview.com/feed/',          source: 'MIT Technology Review',  topic: 'tech'         },

  // ── Tech > Security sub-feed (keywords: cybersecurity, hack, breach, malware) ──
  { url: 'https://feeds.feedburner.com/TheHackersNews',     source: 'The Hacker News',        topic: 'tech'         },
  { url: 'https://krebsonsecurity.com/feed/',               source: 'Krebs on Security',      topic: 'tech'         },
  { url: 'https://www.darkreading.com/rss.xml',             source: 'Dark Reading',           topic: 'tech'         },
  { url: 'https://www.bleepingcomputer.com/feed/',          source: 'BleepingComputer',       topic: 'tech'         },
  { url: 'https://www.securityweek.com/feed/',              source: 'SecurityWeek',           topic: 'tech'         },

  // ── Tech > Telecom sub-feed (keywords: mtn, airtel, 5g, telecom, broadband) ───
  { url: 'https://www.lightreading.com/rss.xml',            source: 'Light Reading',          topic: 'tech'         },
  { url: 'https://www.mobileworldlive.com/feed/',           source: 'Mobile World Live',      topic: 'tech'         },
  { url: 'https://www.telecompaper.com/rss/news',           source: 'Telecompaper',           topic: 'tech'         },

  // ── Business & Finance — Nigeria ─────────────────────────────────────────
  { url: 'https://nairametrics.com/feed/',                  source: 'Nairametrics',           topic: 'economy'      },
  { url: 'https://businessday.ng/feed/',                    source: 'BusinessDay NG',         topic: 'finance'      },
  { url: 'https://www.thisdaylive.com/index.php/business/feed/', source: 'ThisDay Business', topic: 'finance'      },
  { url: 'https://leadership.ng/business/feed/',            source: 'Leadership Business',    topic: 'finance'      },

  // ── Business & Finance — Africa ───────────────────────────────────────────
  { url: 'https://www.howwemadeitinafrica.com/feed/',        source: 'How We Made It In Africa', topic: 'finance'   },
  { url: 'https://www.theafricareport.com/feed/',           source: 'The Africa Report',      topic: 'finance'      },

  // ── Business & Finance — International ───────────────────────────────────
  // Reuters public RSS deprecated 2020; Bloomberg covered via YouTube clips
  { url: 'https://www.economist.com/finance-and-economics/rss.xml', source: 'The Economist', topic: 'finance'      },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC Business',           topic: 'finance'      },

  // ── Finance > Crypto sub-feed (keywords: bitcoin, crypto, blockchain, web3) ───
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk',               topic: 'finance'      },
  { url: 'https://cointelegraph.com/rss',                   source: 'Cointelegraph',          topic: 'finance'      },
  { url: 'https://decrypt.co/feed',                         source: 'Decrypt',                topic: 'finance'      },

  // ── Finance > Naira/FX sub-feed (keywords: naira, forex, exchange rate, dollar) ─
  { url: 'https://nairametrics.com/tag/naira/feed/',         source: 'Nairametrics Naira',     topic: 'finance'      },
  { url: 'https://nairametrics.com/tag/forex/feed/',         source: 'Nairametrics FX',        topic: 'finance'      },

  // ── Finance > Investment sub-feed (keywords: invest, stock, bond, etf, dividend) ─
  { url: 'https://nairametrics.com/tag/investment/feed/',    source: 'Nairametrics Investment', topic: 'finance'    },

  // ── Finance > Insurance sub-feed (keywords: insurance, pension, naicom, pencom) ─
  { url: 'https://nairametrics.com/category/insurance/feed/', source: 'Nairametrics Insurance', topic: 'finance'   },

  // ── Music / Film & TV — Nigeria ──────────────────────────────────────────
  { url: 'https://www.notjustok.com/feed/',                       source: 'NotJustOk',              topic: 'music'  },
  { url: 'https://www.bellanaija.com/music/feed/',                source: 'BellaNaija Music',       topic: 'music'  },
  { url: 'https://www.bellanaija.com/category/nollywood/feed/',   source: 'BellaNaija Nollywood',   topic: 'film'   },
  { url: 'https://www.pulse.ng/rss.xml',                            source: 'Pulse Entertainment',    topic: 'music'  },
  { url: 'https://kemifilani.ng/feed/',                           source: 'Kemi Filani',            topic: 'film'   },
  { url: 'https://www.naijavibe.net/feed/',                       source: 'NaijaVibe',              topic: 'music'  },
  { url: 'https://whatkeptmeup.com/feed/',                        source: 'What Kept Me Up',        topic: 'music'  },

  // ── Music / Film & TV — Africa ────────────────────────────────────────────
  { url: 'https://www.okayafrica.com/rss',                        source: 'OkayAfrica',             topic: 'music'  },
  { url: 'https://africasacountry.com/feed/',                     source: 'Africa Is A Country',    topic: 'film'   },
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

  // ── Music > Gospel sub-feed (keywords: gospel, worship, praise, christian music) ─
  { url: 'https://ccmmagazine.com/feed/',                         source: 'CCM Magazine',           topic: 'music'  },
  { url: 'https://relevantmagazine.com/feed/',                    source: 'Relevant Magazine',      topic: 'music'  },
  { url: 'https://www.christianpost.com/rss/',                    source: 'Christian Post Music',   topic: 'music'  },

  // ── Music > Hip-Hop sub-feed (keywords: hip hop, rap, trap, olamide, falz) ──────
  { url: 'https://www.xxlmag.com/feed/',                          source: 'XXL Magazine',           topic: 'music'  },
  { url: 'https://pitchfork.com/rss/news/rss.xml',               source: 'Pitchfork',              topic: 'music'  },

  // ── Music > Industry sub-feed (keywords: record label, streaming, music award) ──
  { url: 'https://www.musicbusinessworldwide.com/feed/',          source: 'Music Business Worldwide', topic: 'music'},
  { url: 'https://www.billboard.com/c/music-news/feed/',          source: 'Billboard Music News',   topic: 'music'  },

  // ── Fashion / Travel & Lifestyle — Nigeria ───────────────────────────────
  { url: 'https://www.bellanaija.com/lifestyle/feed/',          source: 'BellaNaija Lifestyle',   topic: 'fashion'   },
  { url: 'https://www.bellanaija.com/beauty/feed/',             source: 'BellaNaija Beauty',      topic: 'fashion'   },
  { url: 'https://www.bellanaijastyle.com/feed/',               source: 'BellaNaija Style',       topic: 'fashion'   },
  { url: 'https://genevievemagazine.com/feed/',                 source: 'Genevieve Magazine',     topic: 'fashion'   },
  { url: 'https://www.pulse.ng/lifestyle/rss.xml',              source: 'Pulse Lifestyle',        topic: 'fashion'   },
  { url: 'https://www.zikoko.com/feed/',                        source: 'Zikoko',                 topic: 'fashion'   },
  { url: 'https://itsred.tv/feed/',                             source: 'REDTV',                  topic: 'fashion'   },

  // ── Fashion / Travel & Lifestyle — Africa ─────────────────────────────────
  { url: 'https://afrobella.com/feed/',                         source: 'Afrobella',              topic: 'fashion'   },
  { url: 'https://twyg.co.za/feed/',                            source: 'Twyg',                   topic: 'fashion'   },
  { url: 'https://www.africanexponent.com/rss',                 source: 'African Exponent',       topic: 'travel'    },

  // ── Fashion / Travel & Lifestyle — International ──────────────────────────
  // travelnoire.com returns 522 (Cloudflare host error)
  // CultureTrip has no category-level RSS; GQ + Vogue covered via YouTube clips
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Travel.xml', source: 'NY Times Travel',  topic: 'travel'    },
  { url: 'https://www.cntraveler.com/feed/rss',                 source: 'Condé Nast Traveler',   topic: 'travel'    },
  { url: 'https://www.lonelyplanet.com/news/feed',              source: 'Lonely Planet',          topic: 'travel'    },
  { url: 'https://www.vogue.com/feed/rss',                      source: 'Vogue',                  topic: 'fashion'   },

  // ── Education — Nigeria ───────────────────────────────────────────────────
  { url: 'https://educeleb.com/feed/',                          source: 'EduCeleb',               topic: 'education'    },

  // ── Education — International ─────────────────────────────────────────────
  { url: 'https://feeds.bbci.co.uk/news/education/rss.xml',    source: 'BBC Education',          topic: 'education'    },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Education.xml', source: 'NY Times Education', topic: 'education' },
  { url: 'https://hechingerreport.org/feed/',                   source: 'The Hechinger Report',   topic: 'education'    },
  { url: 'https://www.edweek.org/feed',                         source: 'Education Week',         topic: 'education'    },
  { url: 'https://campustechnology.com/rss-feeds/rss.aspx',    source: 'Campus Technology',      topic: 'education'    },

  // ── Climate — Nigeria ─────────────────────────────────────────────────────
  { url: 'https://www.environewsnigeria.com/feed/',           source: 'EnviroNews Nigeria',      topic: 'climate'      },
  { url: 'https://ncfnigeria.org/blog/feed/',                 source: 'NCF Nigeria',             topic: 'climate'      },

  // ── Climate — Africa ──────────────────────────────────────────────────────
  { url: 'https://allafrica.com/environment/rss2.0.xml',      source: 'AllAfrica Environment',  topic: 'climate'      },
  { url: 'https://news.mongabay.com/feed/?category=africa',  source: 'Mongabay Africa',         topic: 'climate'      },
  { url: 'https://theelephant.info/feed/',                    source: 'The Elephant',            topic: 'climate'      },

  // ── Climate — International ───────────────────────────────────────────────
  { url: 'https://www.carbonbrief.org/feed/',                 source: 'Carbon Brief',            topic: 'climate'      },
  { url: 'https://www.climatechangenews.com/feed/',           source: 'Climate Change News',     topic: 'climate'      },
  { url: 'https://yaleclimateconnections.org/feed/',          source: 'Yale Climate Connections',topic: 'climate'      },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Climate.xml', source: 'NY Times Climate', topic: 'climate'   },
  { url: 'https://feeds.nature.com/nclimate/rss/current',            source: 'Nature Climate Change', topic: 'climate' },
  { url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', source: 'BBC Environment', topic: 'climate' },

  // ── Health — Nigeria ──────────────────────────────────────────────────────
  { url: 'https://nigeriahealthwatch.com/feed/',               source: 'Nigeria Health Watch',    topic: 'health'       },
  { url: 'https://www.premiumtimesng.com/health/feed/',        source: 'Premium Times Health',    topic: 'health'       },
  { url: 'https://healthwise.punchng.com/feed/',               source: 'Healthwise Punch',        topic: 'health'       },
  { url: 'https://dailytrust.com/category/health/feed/',       source: 'Daily Trust Health',      topic: 'health'       },
  { url: 'https://guardian.ng/category/features/health/feed/', source: 'Guardian Health NG',     topic: 'health'       },

  // ── Health — Africa ───────────────────────────────────────────────────────
  { url: 'https://health-e.org.za/feed/',                      source: 'Health-e News',           topic: 'health'       },
  { url: 'https://allafrica.com/health/rss2.0.xml',             source: 'AllAfrica Health',       topic: 'health'       },
  { url: 'https://bhekisisa.org/feed/',                        source: 'Bhekisisa',               topic: 'health'       },
  { url: 'https://www.afro.who.int/rss.xml',                  source: 'WHO Africa',              topic: 'health'       },
  { url: 'https://africacdc.org/feed/',                        source: 'Africa CDC',              topic: 'health'       },
  { url: 'https://www.medicalbrief.co.za/feed/',               source: 'MedicalBrief',            topic: 'health'       },

  // ── Health — International ────────────────────────────────────────────────
  { url: 'https://www.thelancet.com/rssfeed/lancet_current.xml', source: 'The Lancet',           topic: 'health'       },
  { url: 'https://www.nejm.org/action/showFeed?type=etoc&feed=rss&jc=nejm', source: 'NEJM',       topic: 'health'       },
  { url: 'https://www.statnews.com/feed/',                     source: 'STAT News',               topic: 'health'       },
  { url: 'https://www.who.int/rss-feeds/news-english.xml',    source: 'WHO',                     topic: 'health'       },
  { url: 'https://healthpolicy-watch.news/feed/',              source: 'Health Policy Watch',     topic: 'health'       },

  // ── Science — Nigeria ─────────────────────────────────────────────────────
  { url: 'https://nas.org.ng/feed/',                           source: 'Nigerian Academy of Science', topic: 'science'  },

  // ── Science — Africa ──────────────────────────────────────────────────────
  { url: 'https://www.scidev.net/sub-saharan-africa/feed/',    source: 'SciDev.Net Africa',       topic: 'science'      },
  { url: 'https://theconversation.com/africa/articles.atom',   source: 'The Conversation Africa', topic: 'science'      },
  { url: 'https://www.aasciences.africa/news/feed/',           source: 'African Academy of Sciences', topic: 'science'  },

  // ── Science — International ───────────────────────────────────────────────
  { url: 'https://feeds.nature.com/nature/rss/current',        source: 'Nature',                  topic: 'science'      },
  { url: 'https://www.science.org/rss/news_current.xml',       source: 'Science',                 topic: 'science'      },
  { url: 'https://www.newscientist.com/feed/home/',            source: 'New Scientist',            topic: 'science'      },
  { url: 'https://www.sciencedaily.com/rss/all.xml',           source: 'Science Daily',           topic: 'science'      },
  { url: 'https://www.livescience.com/feeds/all',              source: 'Live Science',             topic: 'science'      },
  { url: 'https://theconversation.com/global/articles.atom',   source: 'The Conversation',        topic: 'science'      },

  // ── Science > Space sub-feed (keywords: space, nasa, satellite, rocket, orbit) ─
  { url: 'https://www.space.com/feeds/all',                    source: 'Space.com',               topic: 'science'      },
  { url: 'https://spacenews.com/feed/',                        source: 'SpaceNews',               topic: 'science'      },
  { url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss',     source: 'NASA',                    topic: 'science'      },
  { url: 'https://www.planetary.org/blogs/feed',               source: 'The Planetary Society',   topic: 'science'      },

  // ── Politics — Nigeria ────────────────────────────────────────────────────
  { url: 'https://www.premiumtimesng.com/politics/feed/',      source: 'Premium Times Politics',  topic: 'politics'     },
  { url: 'https://punchng.com/feed/',                          source: 'Punch NG',                 topic: 'politics'     },
  { url: 'https://www.thisdaylive.com/index.php/politics/feed/', source: 'ThisDay Politics',       topic: 'politics'     },
  { url: 'https://dailytrust.com/category/politics/feed/',     source: 'Daily Trust Politics',     topic: 'politics'     },

  // ── Politics — Africa ─────────────────────────────────────────────────────
  { url: 'https://issafrica.org/iss-today/feed/',              source: 'ISS Africa',               topic: 'politics'     },
  { url: 'https://allafrica.com/stories/rss2.0.xml',          source: 'AllAfrica Politics',        topic: 'politics'     },
  { url: 'https://www.theafricareport.com/feed/',              source: 'The Africa Report',        topic: 'politics'     },

  // ── Politics — International ──────────────────────────────────────────────
  { url: 'https://rss.politico.com/politics-news.xml',         source: 'Politico',                topic: 'politics'     },
  { url: 'https://www.foreignaffairs.com/rss.xml',             source: 'Foreign Affairs',          topic: 'politics'     },
  { url: 'https://feeds.bbci.co.uk/news/politics/rss.xml',     source: 'BBC Politics',            topic: 'politics'     },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml',        source: 'BBC World',               topic: 'politics'     },
  { url: 'https://www.theguardian.com/world/rss',              source: 'The Guardian World',       topic: 'politics'     },

  // ── Faith & Philosophy — Nigeria ─────────────────────────────────────────
  { url: 'https://muslimnews.com.ng/feed/',                        source: 'Muslim News Nigeria',     topic: 'faith'        },

  // ── Faith & Philosophy — Africa ───────────────────────────────────────────
  { url: 'https://theelephant.info/feed/',                         source: 'The Elephant',            topic: 'faith'        },
  { url: 'https://africasacountry.com/feed/',                      source: 'Africa Is A Country',     topic: 'faith'        },
  { url: 'https://allafrica.com/stories/rss2.0.xml',               source: 'AllAfrica Religion',      topic: 'faith'        },

  // ── Faith & Philosophy — International ────────────────────────────────────
  { url: 'https://aeon.co/feed.rss',                               source: 'Aeon',                    topic: 'faith'        },
  { url: 'https://philosophynow.org/rss',                          source: 'Philosophy Now',           topic: 'faith'        },
  { url: 'https://religionnews.com/feed/',                         source: 'Religion News Service',   topic: 'faith'        },
  { url: 'https://newhumanist.org.uk/feed/',                       source: 'New Humanist',            topic: 'faith'        },

  // ── Sports — Nigeria ──────────────────────────────────────────────────────
  { url: 'https://www.completesports.com/feed/',            source: 'Complete Sports NG',     topic: 'sports'       },
  { url: 'https://soccernet.ng/feed/',                      source: 'Soccernet NG',           topic: 'sports'       },
  { url: 'https://brila.net/feed/',                         source: 'Brila',                  topic: 'sports'       },
  { url: 'https://punchng.com/feed/',                        source: 'Punch NG Sports',        topic: 'sports'       },
  { url: 'https://www.premiumtimesng.com/sports-news/feed/', source: 'Premium Times Sports',  topic: 'sports'       },

  // ── Sports — Africa ───────────────────────────────────────────────────────
  { url: 'https://feeds.bbci.co.uk/sport/africa/rss.xml',  source: 'BBC Sport Africa',       topic: 'sports'       },
  { url: 'https://www.supersport.com/rss',                  source: 'SuperSport',             topic: 'sports'       },

  // ── Sports — International ────────────────────────────────────────────────
  // SuperSport + CAF Online have no public RSS; Goal.com discontinued RSS
  { url: 'https://www.skysports.com/rss/12040',             source: 'Sky Sports',             topic: 'sports'       },
  { url: 'https://www.espn.com/espn/rss/news',              source: 'ESPN',                   topic: 'sports'       },
  { url: 'https://feeds.bbci.co.uk/sport/rss.xml',          source: 'BBC Sport',              topic: 'sports'       },

  // ── Sports > Football sub-feed (keywords: football, super eagles, premier league) ─
  { url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', source: 'BBC Sport Football',    topic: 'sports'       },
  { url: 'https://www.skysports.com/rss/12040',             source: 'Sky Sports Football',    topic: 'sports'       },
  { url: 'https://talksport.com/feed/',                     source: 'talkSPORT',              topic: 'sports'       },

  // ── Sports > Basketball sub-feed (keywords: basketball, nba, d'tigers, fiba) ────
  { url: 'https://www.basketballnews.com/feed/',            source: 'Basketball News',        topic: 'sports'       },
  { url: 'https://www.nba.com/news/rss.xml',                source: 'NBA News',               topic: 'sports'       },

  // ── Sports > Athletics sub-feed (keywords: athletics, sprints, olympics, track) ─
  { url: 'https://worldathletics.org/rss/news',             source: 'World Athletics',        topic: 'sports'       },
  { url: 'https://athleticsweekly.com/feed/',               source: 'Athletics Weekly',       topic: 'sports'       },
  { url: 'https://www.insidethegames.biz/rss.xml',          source: 'Inside the Games',       topic: 'sports'       },
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
  { url: 'https://feeds.npr.org/510310/podcast.xml',                        source: 'Tiny Desk Concerts',        topic: 'music'   },

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
  { url: 'https://feeds.simplecast.com/4T39_jAj',                           source: 'Lonely Planet Podcast',     topic: 'travel'  },

  // ── Faith & Philosophy ───────────────────────────────────────────────────
  { url: 'https://philosophizethis.libsyn.com/rss',                         source: 'Philosophize This!',        topic: 'faith'   },
  { url: 'https://feeds.simplecast.com/R7C8TjLD',                           source: 'On Being',                  topic: 'faith'   },
  { url: 'https://partiallyexaminedlife.libsyn.com/rss', source: 'The Partially Examined Life', topic: 'faith' },

  // ── Tech > Security sub-feed podcasts ────────────────────────────────────
  { url: 'https://feeds.megaphone.fm/darknetdiaries',                        source: 'Darknet Diaries',           topic: 'tech'    },
  { url: 'https://risky.biz/feeds/risky-business/',                          source: 'Risky Business',            topic: 'tech'    },
  { url: 'https://feeds.twit.tv/sn.xml',                                     source: 'Security Now',              topic: 'tech'    },

  // ── Finance > Crypto sub-feed podcasts ───────────────────────────────────
  { url: 'https://unchained.libsyn.com/rss',                                 source: 'Unchained',                 topic: 'finance' },
  { url: 'https://feeds.simplecast.com/what-bitcoin-did',                   source: 'What Bitcoin Did',          topic: 'finance' },

  // ── Science > Space sub-feed podcasts ────────────────────────────────────
  { url: 'https://feeds.simplecast.com/startalk',                           source: 'StarTalk Radio',            topic: 'science' },
  { url: 'https://astronomycast.libsyn.com/rss',                             source: 'Astronomy Cast',            topic: 'science' },

  // ── Sports > Basketball sub-feed podcasts ────────────────────────────────
  { url: 'https://feeds.megaphone.fm/theringer-nba',                        source: 'The Ringer NBA Show',       topic: 'sports'  },

  // ── Music > Hip-Hop sub-feed podcasts ────────────────────────────────────
  { url: 'https://feeds.megaphone.fm/drinkchamps',                           source: 'Drink Champs',              topic: 'music'   },

  // ── Music > Gospel sub-feed podcasts ─────────────────────────────────────
  { url: 'https://elevation.church/podcast/feed/',                          source: 'Elevation Church',          topic: 'music'   },
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
  { channelId: 'UCSHZKyawb77ixDdsGog4iWA', source: 'Lex Fridman',    topic: 'science'   },
  { channelId: 'UCnUYZLuoy1rq1aVMwx4aTzw', source: 'GQ',             topic: 'fashion'   },
  { channelId: 'UCqZQlzSHbVJrwrn5XvzrzcA', source: 'ESPN FC',        topic: 'sports'    },
  { channelId: 'UCB_qr75-ydFVKSF9Dmo6izg', source: 'Al Jazeera Eng', topic: 'politics'  },
  // ── Add Nigerian channel IDs below (get from youtube.com/@channel → About) ─
  // { channelId: 'PASTE_CHANNELS_TV_ID',   source: 'Channels TV',    topic: 'politics'  },
  // { channelId: 'PASTE_TVC_NEWS_ID',      source: 'TVC News',       topic: 'politics'  },
  // { channelId: 'PASTE_NOTJUSTOK_ID',     source: 'NotJustOk TV',   topic: 'music'     },
  // ── Needs channel ID verification before enabling ──────────────────────────
  // { channelId: 'PASTE_CONVERSATION_AFRICA_ID', source: 'The Conversation Africa', topic: 'science' },
  // { channelId: 'PASTE_AFROPOLITAN_ID',         source: 'Afropolitan',             topic: 'tech'    },
  // { channelId: 'PASTE_TECHPOINT_AFRICA_ID',    source: 'Techpoint Unscripted',    topic: 'tech'    },
];

// Per-run targets — how many items of each type to publish per hourly ingest.
// Mediastack and RSS each get their own budget so neither starves the other.
// Dedup (alreadyHave) makes re-runs cheap: only genuinely new articles hit the AI.
export const TARGET_MEDIASTACK = 20;  // Mediastack (Nigeria + Africa API)
export const TARGET_NEWS       = 40;  // RSS news feeds (75+ sources, shuffled)
export const TARGET_PODCASTS   = 15;  // Podcast feeds (38 sources, shuffled)
export const TARGET_CLIPS      =  8;  // YouTube clips

// How many recent items to pull from each source as candidates per run.
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
