import { env } from '../config/env';
import { ApiError } from './http';

// Voyage AI embedding client. Replaces Gemini text-embedding-004 for
// knowledge-graph auto-linking. voyage-4-lite is the latest cost-optimized
// model with 1024-dim output, 32K context, and 200M free tokens per account.
//
// Docs: https://docs.voyageai.com/docs/embeddings
// Pricing: https://docs.voyageai.com/docs/pricing
//         ($0.02 / 1M tokens, 200M free tokens)
// API key: https://dashboard.voyageai.com/api-keys

const EMBED_MODEL = 'voyage-4-lite';
const EMBED_DIMS = 1024;
const EMBED_ENDPOINT = 'https://api.voyageai.com/v1/embeddings';

// Stored in insight_embedding.model so we can bulk-regenerate if we ever change.
export const EMBEDDING_MODEL_NAME = `voyage-${EMBED_MODEL}-${EMBED_DIMS}`;

function apiKey(): string {
  if (!env.VOYAGE_API_KEY) {
    throw new ApiError(503, 'VOYAGE_API_KEY is not configured');
  }
  return env.VOYAGE_API_KEY;
}

/**
 * Embeds a single text string via Voyage AI. Returns a 1024-dim vector.
 * Throws a 502 ApiError on transport failure or unexpected response shape.
 */
export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(EMBED_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      input: text,
      model: EMBED_MODEL,
      output_dimension: EMBED_DIMS,
      input_type: 'document',
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new ApiError(502, `Voyage embedding failed (${res.status}): ${errBody.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    data?: Array<{ embedding: number[] }>;
  };

  const values = data.data?.[0]?.embedding;
  if (!Array.isArray(values) || values.length !== EMBED_DIMS) {
    throw new ApiError(502, `Voyage returned wrong-dimension vector (expected ${EMBED_DIMS}, got ${values?.length ?? 0})`);
  }

  return values;
}
