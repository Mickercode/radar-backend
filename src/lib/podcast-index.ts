import crypto from 'crypto';
import { env } from '../config/env';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PodcastFeed {
  id: number;
  title: string;
  url: string;           // RSS feed URL
  image: string;         // artwork URL
  description: string;
  author?: string;
  language: string;
  categories?: Record<string, string>;
  itunesId?: number;
}

export interface PodcastEpisode {
  id: number;
  title: string;
  enclosureUrl: string;  // direct audio URL
  enclosureType: string;  // e.g. "audio/mpeg"
  description: string;
  duration: number;       // seconds
  datePublished: number;  // unix timestamp
  feedId: number;
  feedTitle: string;
  feedImage?: string;
}

export interface PodcastSearchResult {
  status: boolean;
  feeds: PodcastFeed[];
  count: number;
}

export interface EpisodeResult {
  status: boolean;
  items: PodcastEpisode[];
  count: number;
}

// ── API client ────────────────────────────────────────────────────────────────

const BASE = 'https://api.podcastindex.org/api/1.0';

/**
 * Build HMAC-SHA1 auth headers required by Podcast Index.
 * Concatenation: APIKey + APISecret + UnixTimestamp
 */
function authHeaders(): Record<string, string> {
  const apiKey = env.PODCAST_INDEX_API_KEY ?? '';
  const apiSecret = env.PODCAST_INDEX_API_SECRET ?? '';
  const ts = Math.floor(Date.now() / 1000).toString();
  const hash = crypto
    .createHmac('sha1', apiSecret)
    .update(apiKey + apiSecret + ts)
    .digest('hex');

  return {
    'User-Agent': 'Radar/1.0',
    'X-Auth-Key': apiKey,
    'X-Auth-Date': ts,
    Authorization: hash,
  };
}

function hasCredentials(): boolean {
  return !!(env.PODCAST_INDEX_API_KEY && env.PODCAST_INDEX_API_SECRET);
}

/**
 * Search for podcasts by term.
 * GET /search/byterm?q=<term>&max=<max>
 */
export async function searchPodcasts(q: string, max = 20): Promise<PodcastSearchResult> {
  if (!hasCredentials()) {
    console.warn('[podcast-index] No API credentials — returning empty search');
    return { status: false, feeds: [], count: 0 };
  }

  const url = `${BASE}/search/byterm?q=${encodeURIComponent(q)}&max=${max}`;
  const res = await fetch(url, { headers: authHeaders() });

  if (!res.ok) {
    console.error(`[podcast-index] search failed: ${res.status} ${res.statusText}`);
    return { status: false, feeds: [], count: 0 };
  }

  return res.json() as Promise<PodcastSearchResult>;
}

/**
 * Get episodes for a podcast feed by Podcast Index feed ID.
 * GET /episodes/byfeedid?id=<id>&max=<max>
 */
export async function getEpisodes(feedId: number, max = 20): Promise<EpisodeResult> {
  if (!hasCredentials()) {
    console.warn('[podcast-index] No API credentials — returning empty episodes');
    return { status: false, items: [], count: 0 };
  }

  const url = `${BASE}/episodes/byfeedid?id=${feedId}&max=${max}`;
  const res = await fetch(url, { headers: authHeaders() });

  if (!res.ok) {
    console.error(`[podcast-index] episodes failed: ${res.status} ${res.statusText}`);
    return { status: false, items: [], count: 0 };
  }

  return res.json() as Promise<EpisodeResult>;
}

/**
 * Get episodes by RSS feed URL.
 * GET /episodes/byfeedurl?url=<encoded>&max=<max>
 */
export async function getEpisodesByFeedUrl(feedUrl: string, max = 20): Promise<EpisodeResult> {
  if (!hasCredentials()) {
    console.warn('[podcast-index] No API credentials — returning empty episodes');
    return { status: false, items: [], count: 0 };
  }

  const url = `${BASE}/episodes/byfeedurl?url=${encodeURIComponent(feedUrl)}&max=${max}`;
  const res = await fetch(url, { headers: authHeaders() });

  if (!res.ok) {
    console.error(`[podcast-index] episodes by feed URL failed: ${res.status} ${res.statusText}`);
    return { status: false, items: [], count: 0 };
  }

  return res.json() as Promise<EpisodeResult>;
}
