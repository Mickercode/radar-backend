import { Prisma } from '@prisma/client';
import type {
  Content,
  Summary,
  Topic,
  KeyMoment,
  Insight,
  InsightEdge,
  InsightReview,
  InsightQuizQuestion,
  InsightQuizAttempt,
  Note,
} from '@prisma/client';

// Serializers that turn Prisma rows into the app's domain shapes (types/content.ts).
// The backend returns these verbatim so the app's rewired api.ts can `return data`
// with no client-side mapping — this mirrors the old `mapContent`/`mapInsight`
// helpers that used to live in services/api.ts.

const toNum = (d: Prisma.Decimal | null | undefined): number | undefined =>
  d == null ? undefined : d.toNumber();

type ContentWithRelations = Content & {
  summary?: Summary | null;
  topic?: Topic | null;
};

export function toSummary(s: Summary) {
  return {
    id: s.id,
    contentId: s.contentId,
    // Prefer the legacy `summary`, fall back to the §4A `what`, like mapContent did.
    summary: s.summary ?? s.what ?? '',
    keyTakeaways: s.keyTakeaways ?? [],
    whyItMatters: s.whyItMatters ?? s.why ?? '',
    what: s.what ?? undefined,
    why: s.why ?? undefined,
    edge: s.edge ?? undefined,
    tier: (s.tier ?? undefined) as 1 | 2 | 3 | undefined,
    nigeriaRelevance: (s.nigeriaRelevance ?? undefined) as 0 | 1 | 2 | 3 | undefined,
  };
}

export function toContentItem(c: ContentWithRelations) {
  return {
    id: c.id,
    type: c.type,
    title: c.title,
    source: c.source,
    duration: c.duration,
    thumbnailUrl: c.thumbnailUrl ?? undefined,
    audioUrl: c.audioUrl ?? undefined,
    articleUrl: c.articleUrl ?? undefined,
    videoUrl: c.videoUrl ?? undefined,
    externalId: c.externalId ?? undefined,
    aspectRatio: toNum(c.aspectRatio),
    topicId: c.topicId,
    createdAt: c.createdAt.toISOString(),
    summary: c.summary ? toSummary(c.summary) : undefined,
  };
}

export type SerializedContent = ReturnType<typeof toContentItem>;

export function toTopic(t: Topic) {
  return { id: t.id, name: t.name, slug: t.slug, color: t.color };
}

export function toKeyMoment(m: KeyMoment) {
  return { id: m.id, contentId: m.contentId, timestamp: m.timestampSec, label: m.label };
}

// ── Knowledge graph / SRS / quiz (PLAYBOOK §4B, §4C, §3) ────────────────────

export function toInsight(i: Insight) {
  return {
    id: i.id,
    userId: i.userId,
    sourceContentId: i.sourceContentId ?? undefined,
    title: i.title,
    what: i.what,
    why: i.why,
    edge: i.edge,
    sourceText: i.sourceText ?? undefined,
    sourcePositionSec: i.sourcePositionSec ?? undefined,
    tier: i.tier as 1 | 2 | 3,
    tags: i.tags ?? [],
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}

export function toInsightEdge(e: InsightEdge) {
  return {
    id: e.id,
    userId: e.userId,
    fromInsightId: e.fromInsightId,
    toInsightId: e.toInsightId,
    strength: e.strength.toNumber(),
    reason: e.reason ?? undefined,
    source: e.source as 'auto' | 'manual',
    createdAt: e.createdAt.toISOString(),
  };
}

export function toInsightReview(r: InsightReview) {
  return {
    id: r.id,
    userId: r.userId,
    insightId: r.insightId,
    dueAt: r.dueAt.toISOString(),
    lastReviewedAt: r.lastReviewedAt?.toISOString() ?? undefined,
    step: r.step,
    lastGrade: (r.lastGrade ?? undefined) as 0 | 1 | undefined,
    reviewCount: r.reviewCount,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export function toQuizQuestion(q: InsightQuizQuestion) {
  return {
    id: q.id,
    question: q.question,
    options: q.options,
    correctIndex: q.correctIndex,
    displayOrder: q.displayOrder,
  };
}

export function toQuizAttempt(a: InsightQuizAttempt) {
  return {
    id: a.id,
    userId: a.userId,
    insightId: a.insightId,
    correctCount: a.correctCount,
    totalCount: a.totalCount,
    attemptedAt: a.attemptedAt.toISOString(),
  };
}

export function toNote(n: Note) {
  return {
    id: n.id,
    userId: n.userId,
    title: n.title,
    body: n.body,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}
