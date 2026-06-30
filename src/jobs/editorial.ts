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
  const topicExamples: Record<string, string> = {
    politics:      'Speak to ordinary Nigerians — workers, market traders, students, parents. Explain what this political change means in their daily life: will security improve? Will taxes change? Will their local government get more or less power? What should they do or avoid?',
    economy:       'Speak to salary earners, small business owners, traders, and market women. Explain how this affects the naira in their pocket, prices at the market, cost of running a shop, or getting a loan. Give practical steps: what to buy or sell now, what to delay, how to protect savings.',
    finance:       'Speak to bank customers, people who save or send money, small traders, and anyone who uses mobile banking. Explain new charges, what the policy means for their savings or transfers, and smart ways to manage money right now.',
    tech:          'Speak to tech workers, app users, students learning to code, and small businesses that use technology. Explain how this affects the tools they use, data costs, job opportunities, or the apps they rely on every day.',
    sports:        'Speak to sports fans, people who bet on games, young athletes, and coaches. Explain what this news means for their favourite team or player, how it may affect local leagues, and what opportunities or risks it creates.',
    music:         'Speak to music fans, upcoming artists, producers, and people who earn from music streaming or performing. Explain how this affects Nigerian artists earning from their work, what platforms or deals to watch, and what the change means for the music business.',
    film:          'Speak to movie lovers, Nollywood fans, aspiring filmmakers, and cinema-goers. Explain how this affects the films they watch, the cost of going to cinemas, and what opportunities exist for Nigerian creatives.',
    health:        'Speak to patients, parents, and workers who pay for healthcare. Explain what this means for hospital costs, access to medicine, health insurance, or staying safe. Give clear steps: what to do now, what to watch for, who to contact.',
    education:     'Speak to students, parents paying school fees, and teachers. Explain what this means for school costs, exam systems, learning opportunities, or scholarship access. Give clear steps on what to do or prepare for.',
    business:      'Speak to entrepreneurs, small business owners, market traders, and side-hustle runners. Explain how this affects their costs, customers, taxes, or growth plans. Give actionable tips: what to change in how they operate, what to watch out for.',
    climate:       'Speak to farmers, people who live in flood-prone or drought-affected areas, and urban dwellers dealing with heat or water scarcity. Explain real on-the-ground effects and simple things they can do.',
    fashion:       'Speak to fashion lovers, designers, tailors, and people who buy clothes locally or online. Explain how this affects prices, trends, or opportunities in the Nigerian fashion industry.',
    travel:        'Speak to Nigerians who travel locally or internationally, people planning trips, and those in hospitality. Explain what this means for visa access, flight costs, hotel prices, or safety when travelling.',
    faith:         'Speak to Nigerians of all faiths — church members, mosque goers, community leaders. Explain the human impact of this news and what it means for community life, values, or daily practice.',
  };

  const topicGuide = topicExamples[topic.toLowerCase()]
    ?? `Speak directly to a reader who follows ${topic}. Explain how this news affects their daily life or work. Be specific about what they should do, avoid, or watch for.`;

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

=== SECTIONS (follow this exact order) ===

1) SUMMARY (field: "what") — 2 plain sentences. What happened. Key facts only. Neutral tone.

2) KEY TAKEAWAYS (field: "key_takeaways") — Array of 3 to 5 items. Mix: one real risk, one opportunity most people miss, one non-obvious observation. Each is one complete sentence in very simple English. No dash, no bullet, no number. Just the sentence.

3) WHY IT MATTERS (field: "why") — About 150 words of plain prose. Show the country-level or society-level impact. How does this change things for Nigeria or Africa as a whole? Connect to real effects people will feel. Not a list. Different from the takeaways.

4) HOW IT MATTERS TO YOU (field: "how_it_matters_to_you") — About 300 words of plain prose. This is the most important section. ${topicGuide} Use simple everyday Nigerian examples. Tell the reader exactly what to do, what to stop doing, and what to watch for in the next few weeks or months. Make it feel like advice from a smart friend who knows their situation. Not a list. Not vague. Specific and actionable.

5) GLOSSARY (field: "glossary") — Array of strings. Only words that are difficult or technical in this specific story. Each string: "Word: Simple one-sentence definition relevant to this story." Return empty array if no difficult words.

=== SCORING ===

10/10 TEST — true/false each:
- forwardable: Would a busy person forward this to a friend?
- advantage: Does this give the reader a real edge over others?
- non_obvious: Would a smart reader NOT already know this?
- learnable: Can the reader apply something concrete from this?

NIGERIA RELEVANCE (0-3): 0=none 1=tangential 2=relevant 3=Nigeria/Africa-specific

TIER:
- 1 (Must-see): >=3 tests pass AND nigeria_relevance>=2 AND how_it_matters_to_you is concrete and specific
- 2 (Strong): >=3 tests pass
- 3 (Weak): <3 — dropped

OUTPUT — strict JSON only: { "relevant", "what", "key_takeaways":[], "why", "how_it_matters_to_you", "glossary":[], "forwardable", "advantage", "non_obvious", "learnable", "nigeria_relevance", "tier" }`;
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
    max_tokens: 1800,
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
