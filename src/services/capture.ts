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
  keyTakeaways: string[];
  why: string;
  howItMattersToYou: string;
  glossary: string[];
  tier: 1 | 2 | 3;
  nigeriaRelevance: 0 | 1 | 2 | 3;
}

function buildPrompt(c: ExtractedContent): string {
  return `You are Radar's editorial AI. Write for ambitious Nigerian/African readers. A secondary school student must understand every sentence.

INPUT (a URL the user wants to remember)
URL: ${c.url}
Title: ${c.title}
Body: ${c.body}

LANGUAGE RULES — never break these:
- Simple English only. Maximum 15 words per sentence.
- No markdown, no dashes, no bullets in prose fields. Plain sentences only.
- Always include Nigerian/African context: naira, fuel prices, data costs, power supply, financial inclusion.
- Each section must do DIFFERENT work.

=== SECTIONS ===

1) TITLE — A clean 6-10 word title. Use the source's title if good; rewrite if it is clickbait.

2) SUMMARY (field: "what") — 2 plain sentences. What happened. Key facts only. Neutral tone.

3) KEY TAKEAWAYS (field: "key_takeaways") — Array of 3 to 5 items. Mix real risks, one opportunity most people miss, and one non-obvious observation. Each is one complete sentence in very simple English. No leading dash, no bullet, no number. Just the sentence.

4) WHY IT MATTERS (field: "why") — About 150 words of plain prose. Show the country-level or society-level impact. How does this change things for Nigeria or Africa as a whole? Connect to real effects people will feel. Not a list. Different from the takeaways.

5) HOW IT MATTERS TO YOU (field: "how_it_matters_to_you") — About 300 words of plain prose. This is the most important section. Speak directly to the reader based on the content topic. Be specific: what should they do right now, what should they stop or avoid, what should they watch for in the coming weeks? Use simple everyday Nigerian examples — going to the market, paying rent, running a small business, using a mobile app, talking to their bank. Make it feel like advice from a smart friend. Not a list. Specific and actionable.

6) GLOSSARY (field: "glossary") — Array of strings. Only words that are difficult or technical in this specific story. Each string: "Word: Simple one-sentence definition relevant to this story." Return empty array if no difficult words.

=== SCORING ===

10/10 TEST — true/false: forwardable, advantage, non_obvious, learnable
NIGERIA RELEVANCE (0-3)
TIER: 1 (>=3 tests + relevance>=2 + edge), 2 (>=3 tests), 3 (<3)

OUTPUT — strict JSON: { "title", "what", "key_takeaways":[], "why", "how_it_matters_to_you", "glossary":[], "forwardable", "advantage", "non_obvious", "learnable", "nigeria_relevance", "tier" }`;
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
        how_it_matters_to_you: { type: 'string' },
        glossary: { type: 'array', items: { type: 'string' } },
        forwardable: { type: 'boolean' },
        advantage: { type: 'boolean' },
        non_obvious: { type: 'boolean' },
        learnable: { type: 'boolean' },
        nigeria_relevance: { type: 'integer', enum: [0, 1, 2, 3] },
        tier: { type: 'integer', enum: [1, 2, 3] },
      },
      required: ['title', 'what', 'key_takeaways', 'why', 'how_it_matters_to_you', 'glossary', 'forwardable', 'advantage', 'non_obvious', 'learnable', 'nigeria_relevance', 'tier'],
    },
  }, {
    temperature: 0.25,
    maxOutputTokens: 2000,
  })) as Record<string, unknown>;

  const stripDash = (s: string) => s.trim().replace(/^[-•*]\s*/, '');
  const rawTakeaways = Array.isArray(parsed.key_takeaways)
    ? (parsed.key_takeaways as unknown[]).filter((k): k is string => typeof k === 'string').map(stripDash)
    : [];
  const rawGlossary = Array.isArray(parsed.glossary)
    ? (parsed.glossary as unknown[]).filter((k): k is string => typeof k === 'string')
    : [];

  return {
    sourceUrl: url,
    title: String(parsed.title || content.title || 'Saved insight'),
    what: stripDash(String(parsed.what || '')),
    keyTakeaways: rawTakeaways,
    why: stripDash(String(parsed.why || '')),
    howItMattersToYou: stripDash(String(parsed.how_it_matters_to_you || '')),
    glossary: rawGlossary,
    tier: (parsed.tier === 1 || parsed.tier === 2 ? parsed.tier : 3) as 1 | 2 | 3,
    nigeriaRelevance: clampScore(parsed.nigeria_relevance),
  };
}
