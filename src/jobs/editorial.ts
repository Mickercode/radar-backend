// Editorial Quality Engine (PLAYBOOK §4A / §9) for the ingestion job.
// Claude 3.5 Sonnet scores each item, rewrites it as What-Why-Edge, and assigns
// a tier. Tier 3 is dropped by the caller. Self-contained (reads env directly)
// so the cron job doesn't pull the API's config/env.

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';
// ~4.5s floor (~13 RPM) — safely under Claude's rate limits.
const MIN_CLAUDE_GAP_MS = 4500;

let lastCallAt = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function throttle() {
  const elapsed = Date.now() - lastCallAt;
  if (elapsed < MIN_CLAUDE_GAP_MS) await sleep(MIN_CLAUDE_GAP_MS - elapsed);
  lastCallAt = Date.now();
}

export interface SummaryResult {
  relevant: boolean;
  what: string;
  key_takeaways: string[];
  why: string;
  how_it_matters_to_you: string;
  glossary: string[];
  forwardable: boolean;
  advantage: boolean;
  non_obvious: boolean;
  learnable: boolean;
  nigeria_relevance: 0 | 1 | 2 | 3;
  tier: 1 | 2 | 3;
}

// On failure return a Tier-3 stub; the caller drops Tier 3, so a transient error
// just defers the item to the next run (dedup hasn't fired). Better than
// publishing a weak summary (§9: "publishing less" is the moat).
function dropOnFailure(): SummaryResult {
  return {
    relevant: false, what: '', key_takeaways: [], why: '',
    how_it_matters_to_you: '', glossary: [],
    forwardable: false, advantage: false, non_obvious: false, learnable: false,
    nigeria_relevance: 0, tier: 3,
  };
}

function buildPrompt(title: string, body: string, topic: string): string {
  return `You are Radar's editorial AI. Write for ambitious Nigerian/African readers. A secondary school student must understand every sentence. PUBLISH LESS, MAKE IT SHARPER, MAKE IT STICK.

INPUT
Title: ${title}
Body: ${body}
Source topic: ${topic}

LANGUAGE RULES — never break these:
- Simple English only. Maximum 15 words per sentence.
- No markdown, no dashes, no bullets in prose fields (what, why, how_it_matters_to_you). Plain sentences only.
- Always ground the story in Nigerian/African reality: naira, fuel prices, data costs, power supply, financial inclusion, small business life.
- Each section must do DIFFERENT work — never repeat the same point.

=== SECTIONS ===

1) SUMMARY (field: "what") — 2 plain sentences. What happened. Key facts only. Neutral tone.

2) KEY TAKEAWAYS (field: "key_takeaways") — Array of 3 to 5 items. Mix real risks, one opportunity most people miss, and one non-obvious observation. Each is one complete sentence in very simple English. No leading dash, no bullet symbol, no number. Just the sentence.

3) WHY IT MATTERS (field: "why") — About 150 words of plain prose. Show the country-level or society-level impact. Connect to real changes Nigerians will feel. Not a list. Not a repeat of the takeaways.

4) HOW IT MATTERS TO YOU (field: "how_it_matters_to_you") — About 300 words of plain prose. Speak directly to a reader interested in ${topic}. This is the most important section. Give specific, practical advice: what to do, what to avoid, what to watch for. Use simple everyday Nigerian examples — going to the market, paying rent, running a small business, using a mobile app. Make it feel personal, useful, and specific. Not a list.

5) GLOSSARY (field: "glossary") — Array of strings. Only include words that are difficult or technical in this specific story. Each string: "Word: Simple one-sentence definition relevant to this story." Return an empty array if there are no difficult words.

=== SCORING ===

10/10 TEST — true/false each:
- forwardable: Would a busy person forward this to a friend?
- advantage: Does this give the reader a real edge over others?
- non_obvious: Would a smart reader NOT already know this?
- learnable: Can the reader apply something concrete from this?

NIGERIA RELEVANCE (0-3): 0=none 1=tangential 2=relevant 3=Nigeria/Africa-specific

TIER:
- 1 (Must-see): >=3 tests pass AND nigeria_relevance>=2 AND how_it_matters_to_you is concrete
- 2 (Strong): >=3 tests pass
- 3 (Weak): <3 — dropped

OUTPUT — strict JSON only: { "relevant", "what", "key_takeaways":[], "why", "how_it_matters_to_you", "glossary":[], "forwardable", "advantage", "non_obvious", "learnable", "nigeria_relevance", "tier" }`;

=== SCORING ===

10/10 TEST — true/false each:
- forwardable: Would a busy person forward this?
- advantage: Does this give the reader a real edge?
- non_obvious: Would a smart reader NOT already know this?
- learnable: Can the reader apply something concrete?

NIGERIA RELEVANCE (0-3): 0=none 1=tangential 2=relevant 3=Nigeria/Africa-specific

TIER:
- 1 (Must-see): >=3 tests pass AND nigeria_relevance>=2 AND concrete edge
- 2 (Strong): >=3 tests pass
- 3 (Weak): <3 — dropped

OUTPUT — strict JSON only: { "relevant", "what", "key_takeaways":[], "why", "edge", "forwardable", "advantage", "non_obvious", "learnable", "nigeria_relevance", "tier" }`;
}

export async function generateSummary(
  title: string,
  description: string,
  topic: string,
): Promise<SummaryResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return dropOnFailure();

  const body = description.replace(/<[^>]*>/g, '').trim().slice(0, 2000);
  if (body.length < 40) return dropOnFailure();

  const SUMMARY_TOOL = {
    name: 'generate_summary',
    description: 'Generate an editorial summary with scoring for a content item',
    input_schema: {
      type: 'object',
      properties: {
        relevant: { type: 'boolean' },
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
      required: ['relevant', 'what', 'key_takeaways', 'why', 'how_it_matters_to_you', 'glossary', 'forwardable', 'advantage', 'non_obvious', 'learnable', 'nigeria_relevance', 'tier'],
    },
  };

  const payload = {
    model: CLAUDE_MODEL,
    max_tokens: 1200,
    temperature: 0.25,
    messages: [{ role: 'user', content: buildPrompt(title, body, topic) }],
    tools: [SUMMARY_TOOL],
    tool_choice: { type: 'tool', name: 'generate_summary' },
  };

  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      await throttle();
      const res = await fetch(CLAUDE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'false',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = (await res.text().catch(() => '')).slice(0, 200).replace(/\s+/g, ' ');
        const transient = res.status === 429 || res.status >= 500;
        console.warn(`[editorial] Claude ${res.status}: ${errBody}`);
        if (transient && attempt === 0) {
          const retryAfter = parseInt(res.headers.get('retry-after') ?? '', 10);
          await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 3000);
          continue;
        }
        return dropOnFailure();
      }

      const data = (await res.json()) as {
        content?: Array<{ type: string; name?: string; input?: Record<string, unknown> }>;
      };
      const toolUse = data.content?.find((c) => c.type === 'tool_use' && c.name === 'generate_summary');
      if (!toolUse?.input) return dropOnFailure();

      const p = toolUse.input;
      if (
        typeof p?.what !== 'string' || typeof p?.key_takeaways !== 'object' ||
        typeof p?.why !== 'string' || typeof p?.how_it_matters_to_you !== 'string' ||
        typeof p?.tier !== 'number'
      ) {
        return dropOnFailure();
      }

      const nigeria = Math.max(0, Math.min(3, Number(p.nigeria_relevance ?? 0))) as 0 | 1 | 2 | 3;
      const tier = (p.tier === 1 || p.tier === 2 ? p.tier : 3) as 1 | 2 | 3;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const raw = Array.isArray(p.key_takeaways) ? p.key_takeaways.filter((k: unknown) => typeof k === 'string') : [];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const glossaryRaw = Array.isArray(p.glossary) ? p.glossary.filter((k: unknown) => typeof k === 'string') : [];
      const stripDash = (s: string) => s.trim().replace(/^[-•*]\s*/, '');
      return {
        relevant: p.relevant !== false,
        what: stripDash(String(p.what)),
        key_takeaways: raw.length >= 2 ? raw.map(stripDash) : [stripDash(String(p.what)), stripDash(String(p.why))],
        why: stripDash(String(p.why)),
        how_it_matters_to_you: stripDash(String(p.how_it_matters_to_you)),
        glossary: glossaryRaw,
        forwardable: !!p.forwardable,
        advantage: !!p.advantage,
        non_obvious: !!p.non_obvious,
        learnable: !!p.learnable,
        nigeria_relevance: nigeria,
        tier,
      };
    } catch (e) {
      if (attempt === 0) {
        await sleep(1000);
        continue;
      }
      console.warn('[editorial] Claude call threw:', (e as Error).message);
      return dropOnFailure();
    }
  }
  return dropOnFailure();
}
