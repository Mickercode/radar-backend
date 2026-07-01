// Editorial Quality Engine (PLAYBOOK §4A / §9) for the ingestion job.
// Primary: OpenRouter/DeepSeek. Fallback: Claude. Circuit-breaker on billing errors.

const CLAUDE_MODEL    = 'claude-sonnet-4-6';
const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const OR_MODEL        = 'deepseek/deepseek-chat:free';
const OR_ENDPOINT     = 'https://openrouter.ai/api/v1/chat/completions';

// Claude throttle — ~13 RPM cap. Not applied to OpenRouter.
const MIN_CLAUDE_GAP_MS = 4500;
let lastClaudeCallAt = 0;

// Circuit breaker: once billing fails, skip Claude for the rest of this process run.
let claudeBillingFailed = false;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function throttleClaude() {
  const elapsed = Date.now() - lastClaudeCallAt;
  if (elapsed < MIN_CLAUDE_GAP_MS) await sleep(MIN_CLAUDE_GAP_MS - elapsed);
  lastClaudeCallAt = Date.now();
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

function dropOnFailure(): SummaryResult {
  return {
    relevant: false, what: '', key_takeaways: [], why: '',
    how_it_matters_to_you: '', glossary: [],
    forwardable: false, advantage: false, non_obvious: false, learnable: false,
    nigeria_relevance: 0, tier: 3,
  };
}

function parseSummaryResult(p: Record<string, unknown>): SummaryResult | null {
  if (typeof p?.what !== 'string' || typeof p?.why !== 'string' || typeof p?.tier !== 'number') return null;
  const stripDash = (s: string) => s.trim().replace(/^[-•*]\s*/, '');
  const raw = Array.isArray(p.key_takeaways) ? (p.key_takeaways as unknown[]).filter((k): k is string => typeof k === 'string') : [];
  const glossaryRaw = Array.isArray(p.glossary) ? (p.glossary as unknown[]).filter((k): k is string => typeof k === 'string') : [];
  const nigeria = Math.max(0, Math.min(3, Number(p.nigeria_relevance ?? 0))) as 0 | 1 | 2 | 3;
  const tier = (p.tier === 1 || p.tier === 2 ? p.tier : 3) as 1 | 2 | 3;
  return {
    relevant: p.relevant !== false,
    what: stripDash(String(p.what)),
    key_takeaways: raw.length >= 2 ? raw.map(stripDash) : [stripDash(String(p.what)), stripDash(String(p.why))],
    why: stripDash(String(p.why)),
    how_it_matters_to_you: stripDash(String(p.how_it_matters_to_you ?? '')),
    glossary: glossaryRaw,
    forwardable: !!p.forwardable,
    advantage: !!p.advantage,
    non_obvious: !!p.non_obvious,
    learnable: !!p.learnable,
    nigeria_relevance: nigeria,
    tier,
  };
}

function buildPrompt(title: string, body: string, topic: string): string {
  const topicPersonas: Record<string, string[]> = {
    politics:   ['a normal citizen or family', 'a small business owner or trader', 'a student or young person', 'a community leader or landlord'],
    economy:    ['a salary earner or employee', 'a small business owner, trader, or market woman', 'a student or job seeker', 'a landlord or property owner'],
    finance:    ['a bank customer or someone who saves money', 'a small business owner or trader who uses POS or mobile banking', 'a student or young person managing money', 'someone who sends or receives money from family abroad'],
    tech:       ['someone who works in tech or uses apps for work', 'a small business owner using technology to sell or operate', 'a student or someone learning digital skills', 'a content creator or freelancer who works online'],
    sports:     ['a sports fan who watches matches', 'someone who bets on sports', 'a young athlete or someone who plays sport locally', 'a coach, club owner, or sports business owner'],
    music:      ['a music fan and listener', 'an upcoming artist, singer, or performer', 'a music producer, sound engineer, or studio owner', 'someone who earns money from music — streaming, shows, or promotions'],
    film:       ['a movie lover and cinema-goer', 'an aspiring filmmaker, actor, or content creator', 'a cinema owner or film distributor', 'a Nollywood fan following the industry'],
    health:     ['an ordinary person or patient', 'a parent with children', 'a small healthcare worker or pharmacy owner', 'someone paying for health insurance or hospital bills'],
    education:  ['a student — secondary school or university', 'a parent paying school fees', 'a teacher or school administrator', 'someone looking for scholarships or study opportunities'],
    business:   ['a small business owner or trader', 'an employee or salary earner', 'an entrepreneur or startup founder', 'a market trader or artisan who works daily'],
    climate:    ['a farmer or someone who grows food', 'a person living near water, coast, or flood-risk area', 'a city dweller dealing with heat, flooding, or water shortage', 'a small business owner affected by weather or energy costs'],
    fashion:    ['a fashion lover who buys clothes regularly', 'a designer, tailor, or fashion student', 'a fashion business owner or boutique operator', 'someone who buys or sells fabric or clothes in the market'],
    travel:     ['someone planning a local or international trip', 'a traveller who needs a visa or passport', 'a hotel owner, travel agent, or tour guide', 'a student or worker going abroad for school or work'],
    faith:      ['a regular church member or mosque attendee', 'a faith community leader or pastor', 'a parent raising children in a faith community', 'someone whose work or life intersects with faith organisations'],
  };

  const personas = topicPersonas[topic.toLowerCase()]
    ?? ['a normal citizen or family', 'a small business owner or trader', 'a student or young person', 'someone in the formal or professional sector'];

  const personaGuide = personas
    .map((p) => `If you are ${p}: [2-4 specific sentences. What this means for them. What they should do or avoid. Use real Nigerian examples — naira amounts, local shops, mobile apps, daily routines.]`)
    .join('\n\n');

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

4) HOW IT MATTERS TO YOU (field: "how_it_matters_to_you") — This is the most important section. Write 3 to 4 separate paragraphs, one for each type of reader. Each paragraph must start with exactly this format: "If you are a [person type]:" — then give 2 to 4 plain sentences of specific advice for that person. Use Nigerian examples: naira amounts, market prices, mobile apps, daily routines. Tell them what to do, what to stop, what to watch. Be direct. No vague language. No repeated points from earlier sections.

Write these paragraphs in order:
${personaGuide}

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

// ── OpenRouter / DeepSeek ─────────────────────────────────────────────────────

async function callOpenRouter(prompt: string, apiKey: string): Promise<SummaryResult | null> {
  try {
    const res = await fetch(OR_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://radarproapp.com',
        'X-Title': 'Radar',
      },
      body: JSON.stringify({
        model: OR_MODEL,
        max_tokens: 1800,
        temperature: 0.25,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a precise JSON generator. Respond with ONLY a valid JSON object. No markdown, no code fences, no explanation — raw JSON only.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const errBody = (await res.text().catch(() => '')).slice(0, 200);
      console.warn(`[editorial] OpenRouter ${res.status}: ${errBody}`);
      return null;
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parseSummaryResult(parsed);
  } catch (e) {
    console.warn('[editorial] OpenRouter call threw:', (e as Error).message);
    return null;
  }
}

// ── Claude (fallback) ─────────────────────────────────────────────────────────

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

async function callClaude(prompt: string, apiKey: string): Promise<SummaryResult | null> {
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      await throttleClaude();
      const res = await fetch(CLAUDE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 1800,
          temperature: 0.25,
          messages: [{ role: 'user', content: prompt }],
          tools: [SUMMARY_TOOL],
          tool_choice: { type: 'tool', name: 'generate_summary' },
        }),
      });

      if (!res.ok) {
        const errBody = (await res.text().catch(() => '')).slice(0, 300).replace(/\s+/g, ' ');
        console.warn(`[editorial] Claude ${res.status}: ${errBody}`);
        // Billing error — trip the circuit breaker and bail immediately
        if (res.status === 400 && errBody.includes('credit balance')) {
          claudeBillingFailed = true;
          return null;
        }
        const transient = res.status === 429 || res.status >= 500;
        if (transient && attempt === 0) {
          const retryAfter = parseInt(res.headers.get('retry-after') ?? '', 10);
          await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 3000);
          continue;
        }
        return null;
      }

      const data = (await res.json()) as {
        content?: Array<{ type: string; name?: string; input?: Record<string, unknown> }>;
      };
      const toolUse = data.content?.find((c) => c.type === 'tool_use' && c.name === 'generate_summary');
      if (!toolUse?.input) return null;
      return parseSummaryResult(toolUse.input);
    } catch (e) {
      if (attempt === 0) { await sleep(1000); continue; }
      console.warn('[editorial] Claude call threw:', (e as Error).message);
      return null;
    }
  }
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateSummary(
  title: string,
  description: string,
  topic: string,
): Promise<SummaryResult> {
  const orKey  = process.env.OPENROUTER_API_KEY;
  const claudeKey = process.env.ANTHROPIC_API_KEY;

  const body = description.replace(/<[^>]*>/g, '').trim().slice(0, 2000);
  if (body.length < 40) return dropOnFailure();

  const prompt = buildPrompt(title, body, topic);

  // Primary: OpenRouter/DeepSeek
  if (orKey) {
    const result = await callOpenRouter(prompt, orKey);
    if (result) return result;
  }

  // Fallback: Claude (skip if billing already failed this run)
  if (claudeKey && !claudeBillingFailed) {
    const result = await callClaude(prompt, claudeKey);
    if (result) return result;
  }

  return dropOnFailure();
}
