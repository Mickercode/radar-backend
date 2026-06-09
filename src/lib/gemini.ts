import { env } from '../config/env';
import { ApiError } from './http';

// Thin Gemini client. The AI pipeline (capture, quiz, auto-link) was built on
// Gemini in the old Edge Functions — gemini-2.0-flash for generation and
// text-embedding-004 (768-dim) for embeddings — so we keep both here.

const GEN_MODEL = 'gemini-2.0-flash';
const EMBED_MODEL = 'text-embedding-004';
const GEN_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEN_MODEL}:generateContent`;
const EMBED_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;

// Stored in insight_embedding.model so we can bulk-regenerate if we ever change.
export const EMBEDDING_MODEL_NAME = `gemini-${EMBED_MODEL}`;

function apiKey(): string {
  if (!env.GEMINI_API_KEY) {
    throw new ApiError(503, 'GEMINI_API_KEY is not configured');
  }
  return env.GEMINI_API_KEY;
}

interface GenerateOptions {
  temperature?: number;
  maxOutputTokens?: number;
  responseSchema?: unknown;
}

/**
 * Calls gemini-2.0-flash with JSON-mode and returns the parsed object. Throws
 * a 502 ApiError on transport failure or unparseable output (callers decide how
 * to surface it). The caller is responsible for validating the parsed shape.
 */
export async function generateJson(prompt: string, opts: GenerateOptions = {}): Promise<unknown> {
  const res = await fetch(GEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey() },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.4,
        maxOutputTokens: opts.maxOutputTokens ?? 1024,
        responseMimeType: 'application/json',
        ...(opts.responseSchema ? { responseSchema: opts.responseSchema } : {}),
      },
    }),
  });

  if (!res.ok) {
    throw new ApiError(502, `Gemini generation failed (${res.status})`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new ApiError(502, 'Gemini returned no content');
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(502, 'Gemini returned invalid JSON');
  }
}

/** Embeds text with text-embedding-004; returns a 768-dim vector. */
export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(EMBED_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey() },
    body: JSON.stringify({ content: { parts: [{ text }] } }),
  });
  if (!res.ok) {
    throw new ApiError(502, `Embedding failed (${res.status})`);
  }
  const data = (await res.json()) as { embedding?: { values?: number[] } };
  const values = data.embedding?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new ApiError(502, 'Embedding returned no vector');
  }
  return values;
}
