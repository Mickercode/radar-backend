// ListenNotes API v2 client with monthly budget management.
// Budget: 300 requests/month — tracked in SystemSetting `listennotes_usage`.
// We cap ourselves at 280/month (20 buffer) to stay safely under the limit.

import { PrismaClient } from '@prisma/client';

const API_BASE = 'https://listen-api.listennotes.com/api/v2';
const MONTHLY_CAP = 280; // hard cap before we switch to fallback

const prisma = new PrismaClient();

// ── Budget tracking ───────────────────────────────────────────────────────────

interface UsageRecord {
  month: string;   // "YYYY-MM"
  count: number;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function getUsage(): Promise<UsageRecord> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: 'listennotes_usage' } });
    if (!row) return { month: currentMonth(), count: 0 };
    const parsed = JSON.parse(row.value) as UsageRecord;
    // Reset count if we're in a new month
    if (parsed.month !== currentMonth()) return { month: currentMonth(), count: 0 };
    return parsed;
  } catch {
    return { month: currentMonth(), count: 0 };
  }
}

async function incrementUsage(usage: UsageRecord): Promise<void> {
  const next: UsageRecord = { month: usage.month, count: usage.count + 1 };
  await prisma.systemSetting.upsert({
    where: { key: 'listennotes_usage' },
    create: { key: 'listennotes_usage', value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
}

export async function getListenNotesUsage(): Promise<{ month: string; used: number; remaining: number; cap: number }> {
  const u = await getUsage();
  return { month: u.month, used: u.count, remaining: Math.max(0, MONTHLY_CAP - u.count), cap: MONTHLY_CAP };
}

// ── API calls ─────────────────────────────────────────────────────────────────

export interface ListenNotesEpisode {
  id: string;
  title: string;
  description: string;
  audio: string;               // direct MP3 URL
  thumbnail: string;
  total_length_sec: number;
  pub_date_ms: number;
  podcast: {
    id: string;
    title: string;
    thumbnail: string;
    publisher?: string;
  };
}

interface SearchResponse {
  results: ListenNotesEpisode[];
  count: number;
  total: number;
  next_offset: number;
}

async function listenNotesGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = process.env.LISTENNOTES_API_KEY;
  if (!key) throw new Error('LISTENNOTES_API_KEY not configured');

  const usage = await getUsage();
  if (usage.count >= MONTHLY_CAP) {
    throw new Error(`[listennotes] Monthly budget exhausted (${usage.count}/${MONTHLY_CAP}). Resets ${usage.month}`);
  }

  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      'X-ListenAPI-Key': key,
      'Accept': 'application/json',
    },
  });

  if (res.status === 429) throw new Error('[listennotes] Rate limit hit');
  if (!res.ok) throw new Error(`[listennotes] HTTP ${res.status} for ${path}`);

  // Count this request
  await incrementUsage(usage);

  return res.json() as Promise<T>;
}

// Search for recent episodes matching a query
export async function searchEpisodes(
  query: string,
  options: {
    pageSize?: number;
    minLenMin?: number;
    maxLenMin?: number;
    language?: string;
  } = {}
): Promise<ListenNotesEpisode[]> {
  const { pageSize = 10, minLenMin = 5, maxLenMin = 180, language = 'English' } = options;

  const data = await listenNotesGet<SearchResponse>('/search', {
    q: query,
    type: 'episode',
    language,
    sort_by_date: '1',        // most recent first
    len_min: String(minLenMin),
    len_max: String(maxLenMin),
    page_size: String(pageSize),
    safe_mode: '0',
  });

  return data.results ?? [];
}

// Fetch episodes from a specific podcast
export async function getPodcastEpisodes(podcastId: string, pageSize = 10): Promise<ListenNotesEpisode[]> {
  interface EpisodesResponse { episodes: ListenNotesEpisode[] }
  const data = await listenNotesGet<EpisodesResponse>(`/podcasts/${podcastId}`, {
    next_episode_pub_date: String(Date.now()),
    sort: 'recent_first',
  });
  return (data.episodes ?? []).slice(0, pageSize);
}
