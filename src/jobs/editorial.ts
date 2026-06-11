// Editorial Quality Engine (PLAYBOOK §4A / §9) for the ingestion job.
// Gemini 2.0 Flash scores each item, rewrites it as What-Why-Edge, and assigns
// a tier. Tier 3 is dropped by the caller. Self-contained (reads env directly)
// so the cron job doesn't pull the API's config/env.

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
// Gemini free tier ~15 RPM — a 4.5s floor keeps us under it.
const MIN_GEMINI_GAP_MS = 4500;

let lastCallAt = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function throttle() {
  const elapsed = Date.now() - lastCallAt;
  if (elapsed < MIN_GEMINI_GAP_MS) await sleep(MIN_GEMINI_GAP_MS - elapsed);
  lastCallAt = Date.now();
}

export interface SummaryResult {
  relevant: boolean;
  what: string;
  why: string;
  edge: string;
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
    relevant: false, what: '', why: '', edge: '',
    forwardable: false, advantage: false, non_obvious: false, learnable: false,
    nigeria_relevance: 0, tier: 3,
  };
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    relevant: { type: 'boolean' },
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
  required: ['relevant', 'what', 'why', 'edge', 'forwardable', 'advantage', 'non_obvious', 'learnable', 'nigeria_relevance', 'tier'],
};

function buildPrompt(title: string, body: string, topic: string): string {
  return `You are Radar's editorial AI. Radar publishes at most 10 high-quality insights daily for ambitious Nigerian/African readers — students, founders, professionals. PUBLISH LESS, MAKE IT SHARPER, MAKE IT STICK.

INPUT
Title: ${title}
Body: ${body}
Source topic: ${topic}

In ONE response, do FIVE things:

1) RELEVANCE — Is this real signal? Mark relevant: false ONLY if: trailer/promo/ad/"introducing" content; off-topic from "${topic}"; or pure entertainment with no insight. When in doubt, mark relevant: true.

2) REWRITE in What-Why-Edge format (PLAYBOOK §4):
   - what: 1-2 sentences. The clear fact. Plain English. No clickbait.
   - why: 1-2 sentences. Why it matters — especially for a Nigerian / African reader. Tie to real-world impact.
   - edge: 1 sentence. What a smart person should DO with this — concrete action or non-obvious takeaway. FORBIDDEN: "Stay informed", "Keep an eye on", "Be aware".
   Rules: max 4-6 lines total; one idea only; no marketing language.

3) SCORE against the 10/10 TEST (PLAYBOOK §9), true/false each: forwardable, advantage, non_obvious, learnable.

4) NIGERIA RELEVANCE (0-3): 0 none, 1 tangential, 2 relevant, 3 Nigeria/Africa-specific.

5) TIER: 1 (passes >=3 tests AND nigeria_relevance>=2 AND concrete edge); 2 (passes >=3 tests); 3 (passes <3 — will be dropped).

OUTPUT — strict JSON only.`;
}

export async function generateSummary(
  title: string,
  description: string,
  topic: string,
): Promise<SummaryResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return dropOnFailure();

  const body = description.replace(/<[^>]*>/g, '').trim().slice(0, 2000);
  if (body.length < 40) return dropOnFailure();

  const payload = {
    contents: [{ parts: [{ text: buildPrompt(title, body, topic) }] }],
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: 800,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      await throttle();
      const res = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const transient = res.status === 429 || res.status >= 500;
        if (transient && attempt === 0) {
          const retryAfter = parseInt(res.headers.get('retry-after') ?? '', 10);
          await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 3000);
          continue;
        }
        return dropOnFailure();
      }

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return dropOnFailure();

      const p = JSON.parse(text);
      if (
        typeof p?.what !== 'string' || typeof p?.why !== 'string' ||
        typeof p?.edge !== 'string' || typeof p?.tier !== 'number'
      ) {
        return dropOnFailure();
      }

      const nigeria = Math.max(0, Math.min(3, Number(p.nigeria_relevance ?? 0))) as 0 | 1 | 2 | 3;
      const tier = (p.tier === 1 || p.tier === 2 ? p.tier : 3) as 1 | 2 | 3;
      return {
        relevant: p.relevant !== false,
        what: String(p.what).trim(),
        why: String(p.why).trim(),
        edge: String(p.edge).trim(),
        forwardable: !!p.forwardable,
        advantage: !!p.advantage,
        non_obvious: !!p.non_obvious,
        learnable: !!p.learnable,
        nigeria_relevance: nigeria,
        tier,
      };
    } catch {
      if (attempt === 0) {
        await sleep(1000);
        continue;
      }
      return dropOnFailure();
    }
  }
  return dropOnFailure();
}
