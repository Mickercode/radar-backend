import { ApiError } from '../lib/http';
import { generateJson } from '../lib/gemini';
import { fetchClean, type ExtractedContent } from '../lib/jina';

// "Save to Radar" — turns an arbitrary URL into a publishable What-Why-Edge
// insight (PLAYBOOK §3, Desmond feedback #2). Ported from the capture-url fn.
// Returns a preview; the client decides whether to commit it via POST /insights.

export interface CapturedInsight {
  sourceUrl: string;
  title: string;
  what: string;
  why: string;
  edge: string;
  tier: 1 | 2 | 3;
  nigeriaRelevance: 0 | 1 | 2 | 3;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    what: { type: 'string' },
    why: { type: 'string' },
    edge: { type: 'string' },
    forwardable: { type: 'boolean' },
    advantage: { type: 'boolean' },
    non_obvious: { type: 'boolean' },
    learnable: { type: 'boolean' },
    nigeria_relevance: { type: 'integer' },
    tier: { type: 'integer' },
  },
  required: [
    'title', 'what', 'why', 'edge',
    'forwardable', 'advantage', 'non_obvious', 'learnable',
    'nigeria_relevance', 'tier',
  ],
};

function buildPrompt(c: ExtractedContent): string {
  // Kept aligned with the §4A editorial prompt from ingest-content/capture-url.
  return `You are Radar's editorial AI. Radar publishes insights in What-Why-Edge format for ambitious Nigerian / African readers.

INPUT (a URL the user wants to remember)
URL: ${c.url}
Title: ${c.title}
Body: ${c.body}

Produce a structured insight:

1) TITLE — A clean 6-10 word title (use the source's title if good; rewrite if it's clickbait or ugly).

2) WHAT-WHY-EDGE (PLAYBOOK §4):
   - what: 1-2 sentences. The clear fact / claim. Plain English.
   - why: 1-2 sentences. Why it matters, especially for a Nigerian / African reader.
   - edge: 1 sentence. Concrete action or non-obvious takeaway. FORBIDDEN: "Stay informed", "Keep an eye on", "Be aware".

3) 10/10 TEST (§9). For each, true or false:
   - forwardable: Would a busy reader forward this?
   - advantage: Does this give the reader a real edge (money, knowledge, decision)?
   - non_obvious: Would a smart reader NOT already know this?
   - learnable: Can the reader actually apply something concrete?

4) NIGERIA RELEVANCE (0-3): 0=none, 1=tangential, 2=relevant, 3=Nigeria/Africa-specific.

5) TIER:
   - 1 (Must-see): >=3 of the 10/10 Tests pass AND nigeria_relevance >= 2 AND concrete edge.
   - 2 (Strong): >=3 of the 10/10 Tests pass.
   - 3 (Weak): <3 — flag but still return; the client decides whether to save it.

OUTPUT — strict JSON only.`;
}

const clampScore = (v: unknown): 0 | 1 | 2 | 3 =>
  Math.max(0, Math.min(3, Number(v ?? 0))) as 0 | 1 | 2 | 3;

export async function captureUrl(url: string): Promise<CapturedInsight> {
  const content = await fetchClean(url);
  if (!content) throw new ApiError(502, 'Could not fetch or parse that URL');

  const parsed = (await generateJson(buildPrompt(content), {
    temperature: 0.25,
    maxOutputTokens: 800,
    responseSchema: RESPONSE_SCHEMA,
  })) as Record<string, unknown>;

  return {
    sourceUrl: url,
    title: String(parsed.title || content.title || 'Saved insight'),
    what: String(parsed.what || ''),
    why: String(parsed.why || ''),
    edge: String(parsed.edge || ''),
    tier: (parsed.tier === 1 || parsed.tier === 2 ? parsed.tier : 3) as 1 | 2 | 3,
    nigeriaRelevance: clampScore(parsed.nigeria_relevance),
  };
}
