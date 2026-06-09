-- Run once after the first `prisma migrate` (Prisma can't express vector
-- indexes). Re-runnable. Speeds up the cosine-similarity search in
-- src/services/autolink.ts; the query is correct without it, just slower.
CREATE INDEX IF NOT EXISTS insight_embedding_hnsw_idx
  ON insight_embedding USING hnsw (embedding vector_cosine_ops);
