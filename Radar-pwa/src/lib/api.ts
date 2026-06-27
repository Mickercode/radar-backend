// Typed API client for the Radar backend.
// Base URL is set via VITE_API_BASE_URL env var (empty = same origin).
const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(BASE + path, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Summary {
  id: string;
  contentId: string;
  summary: string;
  keyTakeaways: string[];
  whyItMatters: string;
  what?: string;
  why?: string;
  howItMattersToYou?: string;
  glossary: string[];
  tier?: 1 | 2 | 3;
  nigeriaRelevance?: 0 | 1 | 2 | 3;
}

export interface ContentItem {
  id: string;
  type: 'news' | 'podcast' | 'clip';
  title: string;
  source: string;
  duration: number;
  thumbnailUrl?: string;
  audioUrl?: string;
  articleUrl?: string;
  videoUrl?: string;
  externalId?: string;
  topicId?: string | null;
  createdAt: string;
  summary?: Summary;
}

export interface Topic {
  id: string;
  name: string;
  slug: string;
  color?: string | null;
}

export interface FeedResult {
  items: ContentItem[];
  isFallback: boolean;
  matchedTopics: number;
}

// ── Endpoints ──────────────────────────────────────────────────────────────────

export const api = {
  topics: () => get<Topic[]>('/topics'),

  feed: (topicIds?: string[], country?: string) => {
    const params: Record<string, string> = {};
    if (topicIds?.length) params.topicIds = topicIds.join(',');
    if (country) params.country = country;
    return get<FeedResult>('/feed', params);
  },

  contentByType: (type: 'news' | 'podcast' | 'clip') =>
    get<ContentItem[]>('/content', { type }),
};
