import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/http';
import { embedText, EMBEDDING_MODEL_NAME } from '../lib/voyage';

// Knowledge-graph auto-linking (PLAYBOOK §4B). Ported from link-insight:
//   1. embed the insight (title+what+why+edge) via Voyage AI (embeddings only)
//   2. upsert into insight_embedding
//   3. find the top-N most similar insights for the same user (pgvector cosine)
//   4. write `source = 'auto'` edges for matches above the threshold
//
// Note: Text generation (ingest, capture, quiz) uses Claude. Embeddings use
// Voyage AI (voyage-4-lite, 1024-dim) — no Google/Gemini dependency.
//
// Prisma can't express vector operators, so the embedding write and the
// similarity search use raw SQL. The embedding column is `vector(1024)`; pgvector
// accepts a `'[a,b,c]'` text literal cast to ::vector.

const SIMILARITY_THRESHOLD = 0.75;
const MATCH_COUNT = 5;

export interface AutolinkResult {
  embedded: boolean;
  links: number;
}

export async function autolinkInsight(insightId: string, uid: string): Promise<AutolinkResult> {
  const insight = await prisma.insight.findFirst({
    where: { id: insightId, userId: uid },
    select: { title: true, what: true, why: true, edge: true },
  });
  if (!insight) throw notFound('Insight not found');

  const text = [insight.title, insight.what, insight.why, insight.edge]
    .filter(Boolean)
    .join('\n\n');
  const embedding = await embedText(text);
  const vector = `[${embedding.join(',')}]`;

  // Upsert the embedding (re-runs after an edit replace it).
  await prisma.$executeRaw`
    INSERT INTO insight_embedding (insight_id, user_id, embedding, model)
    VALUES (${insightId}::uuid, ${uid}::uuid, ${vector}::vector, ${EMBEDDING_MODEL_NAME})
    ON CONFLICT (insight_id)
    DO UPDATE SET embedding = EXCLUDED.embedding, model = EXCLUDED.model, created_at = now()`;

  // Cosine similarity = 1 - distance. Scoped to this user, excluding self.
  const matches = await prisma.$queryRaw<{ insight_id: string; similarity: number }[]>`
    SELECT insight_id, 1 - (embedding <=> ${vector}::vector) AS similarity
    FROM insight_embedding
    WHERE user_id = ${uid}::uuid AND insight_id <> ${insightId}::uuid
    ORDER BY embedding <=> ${vector}::vector
    LIMIT ${MATCH_COUNT}`;

  const links = matches.filter((m) => Number(m.similarity) >= SIMILARITY_THRESHOLD);

  if (links.length > 0) {
    await prisma.insightEdge.createMany({
      data: links.map((m) => ({
        userId: uid,
        fromInsightId: insightId,
        toInsightId: m.insight_id,
        strength: new Prisma.Decimal(Number(m.similarity).toFixed(3)),
        source: 'auto',
      })),
      skipDuplicates: true,
    });
  }

  return { embedded: true, links: links.length };
}
