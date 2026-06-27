import { ApiError } from '../lib/http';
import { generateJson } from '../lib/anthropic';
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

function buildPrompt(c: ExtractedContent): string {
  return `You are Radar's editorial AI. Radar delivers sharp, non-obvious insights for ambitious Nigerian/African readers.

INPUT (a URL the user wants to remember)
URL: ${c.url}
Title: ${c.title}
Body: ${c.body}

Rules:
- Write in plain, natural prose. NO dashes, NO bullet points, NO markdown, NO asterisks in any field except key_takeaways.
- Use very simple English. Short sentences. Avoid jargon except where necessary.
- Never repeat the same idea across sections.
- Always include Nigerian/African context: infrastructure, power, cost, financial inclusion, regulatory environment, Nigeria's position in Africa.

The four sections below must each do DIFFERENT work.

=== STRUCTURE ===

1) TITLE — A clean 6-10 word title. Use the source's title if good; rewrite if it's clickbait.

2) SUMMARY (field: "what") — Write 2-3 sentences of plain prose. State what happened and the key facts. Read like a newspaper lead, not a list. Neutral, factual. No dashes, no bullets.

3) KEY TAKEAWAYS (field: "key_takeaways") — Array of 3 or 4 items. Mix:
   - 1-2 real risks (cost, compliance, inequality)
   - 1 opportunity or nuance most people miss
   - 1 non-obvious observation
   Each item: one complete, specific sentence. No leading dash, no bullet symbol, no numbering. Just the sentence.

4) WHY IT MATTERS (field: "why") — Write 2-3 sentences of flowing prose. Connect to human impact, trust, financial inclusion, systemic consequences. Not a repeat of takeaways. No dashes, no bullets.

5) THE EDGE (field: "edge") — The most important section. Write exactly 2 sentences of plain prose. Give a forward-looking or slightly contrarian view. What smart readers should think or watch for. No dashes, no bullets. FORBIDDEN: "Stay informed", "Keep an eye on", "Proactively assess".

=== SCORING ===

10/10 TEST — true/false: forwardable, advantage, non_obvious, learnable
NIGERIA RELEVANCE (0-3)
TIER: 1 (>=3 tests + relevance>=2 + edge), 2 (>=3 tests), 3 (<3)

OUTPUT — strict JSON: { "title", "what", "key_takeaways":[], "why", "edge", "forwardable", "advantage", "non_obvious", "learnable", "nigeria_relevance", "tier" }`;
}

const clampScore = (v: unknown): 0 | 1 | 2 | 3 =>
  Math.max(0, Math.min(3, Number(v ?? 0))) as 0 | 1 | 2 | 3;

export async function captureUrl(url: string): Promise<CapturedInsight> {
  const content = await fetchClean(url);
  if (!content) throw new ApiError(502, 'Could not fetch or parse that URL');

  const parsed = (await generateJson(buildPrompt(content), {
    name: 'generate_insight',
    description: 'Generate a structured insight with summary, takeaways, and analysis for a captured URL',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        what: { type: 'string' },
        key_takeaways: { type: 'array', items: { type: 'string' } },
        why: { type: 'string' },
        edge: { type: 'string' },
        forwardable: { type: 'boolean' },
        advantage: { type: 'boolean' },
        non_obvious: { type: 'boolean' },
        learnable: { type: 'boolean' },
        nigeria_relevance: { type: 'integer', enum: [0, 1, 2, 3] },
        tier: { type: 'integer', enum: [1, 2, 3] },
      },
      required: ['title', 'what', 'key_takeaways', 'why', 'edge', 'forwardable', 'advantage', 'non_obvious', 'learnable', 'nigeria_relevance', 'tier'],
    },
  }, {
    temperature: 0.25,
    maxOutputTokens: 1200,
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
