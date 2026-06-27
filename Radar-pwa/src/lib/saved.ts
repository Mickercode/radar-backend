import type { ContentItem } from './api';

const KEY = 'radar:saved';

export interface SavedItem {
  id: string;             // contentId
  type: 'news' | 'podcast' | 'clip';
  title: string;
  source: string;
  thumbnailUrl?: string;
  audioUrl?: string;
  articleUrl?: string;
  videoUrl?: string;
  externalId?: string;
  summary?: string;       // brief snippet (what/summary field)
  keyTakeaways: string[];
  howItMattersToYou?: string;
  glossary: string[];
  savedAt: string;
}

function load(): SavedItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as SavedItem[];
  } catch {
    return [];
  }
}

function persist(items: SavedItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function getSavedItems(): SavedItem[] {
  return load().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function isSaved(contentId: string): boolean {
  return load().some((i) => i.id === contentId);
}

export function saveItem(content: ContentItem) {
  const items = load();
  if (items.some((i) => i.id === content.id)) return;
  const item: SavedItem = {
    id: content.id,
    type: content.type,
    title: content.title,
    source: content.source,
    thumbnailUrl: content.thumbnailUrl,
    audioUrl: content.audioUrl,
    articleUrl: content.articleUrl,
    videoUrl: content.videoUrl,
    externalId: content.externalId,
    summary: content.summary?.what ?? content.summary?.summary,
    keyTakeaways: content.summary?.keyTakeaways ?? [],
    howItMattersToYou: content.summary?.howItMattersToYou,
    glossary: content.summary?.glossary ?? [],
    savedAt: new Date().toISOString(),
  };
  persist([item, ...items]);
}

export function unsaveItem(contentId: string) {
  persist(load().filter((i) => i.id !== contentId));
}
