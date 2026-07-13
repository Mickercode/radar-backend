// Editorial Quality Engine (PLAYBOOK §4A / §9) for the ingestion job.
// Provider selection is delegated to aiRouter — flat round-robin, no priority tiers.
import { jsonrepair } from 'jsonrepair';
import { callAI, getRouterStatus } from '../lib/aiRouter';

// Consecutive AI failures — abort ingest early if all providers are down.
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 15;

export function aiIsHealthy(): boolean {
  return consecutiveFailures < MAX_CONSECUTIVE_FAILURES;
}

export function getAiStatus(): 'ok' | 'claude_credits_low' | 'ai_unavailable' {
  if (!aiIsHealthy()) return 'ai_unavailable';
  const { available } = getRouterStatus();
  if (available.length === 0) return 'ai_unavailable';
  return 'ok';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
void sleep; // used by robustJsonParse retry paths if re-added later

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
    politics:   ['a citizen or family affected by government decisions', 'a small business owner or trader navigating policy changes', 'a student or young person building a future', 'a community leader, local official, or civil society member'],
    economy:    ['a salary earner or employee', 'a small business owner, trader, or market woman', 'a student or job seeker', 'an investor, landlord, or property owner'],
    finance:    ['someone who saves money or uses a bank', 'a small business owner or trader who uses mobile banking or POS', 'a student or young person learning to manage money', 'someone who sends or receives remittances from abroad'],
    tech:       ['someone who works in tech or uses apps for work', 'a small business owner using technology to operate or sell', 'a student or someone building digital skills', 'a content creator or freelancer who earns online'],
    sports:     ['a passionate sports fan', 'someone who bets or follows fantasy leagues', 'a young athlete or someone who plays sport locally', 'a coach, club owner, or sports entrepreneur'],
    music:      ['a music fan and daily listener', 'an upcoming artist, singer, or performer', 'a music producer, sound engineer, or studio owner', 'someone who earns from music — streaming, live shows, or brand partnerships'],
    film:       ['a movie lover and regular viewer', 'an aspiring filmmaker, actor, or content creator', 'a cinema owner, distributor, or entertainment entrepreneur', 'someone who follows the film industry for culture or investment'],
    health:     ['an ordinary person managing their own health', 'a parent responsible for a family', 'a healthcare worker, pharmacist, or clinic owner', 'someone navigating health insurance or hospital costs'],
    education:  ['a student — secondary school or university level', 'a parent investing in a child\'s education', 'a teacher, lecturer, or school administrator', 'someone seeking scholarships, skills, or study opportunities abroad'],
    business:   ['a small business owner or trader', 'an employee or salary earner', 'an entrepreneur or startup founder', 'an investor, executive, or corporate professional'],
    climate:    ['a farmer or someone who depends on agriculture or fishing', 'a person living near water, coastline, or flood-risk areas', 'a city dweller dealing with heat, flooding, or energy costs', 'a business owner, policymaker, or investor in the energy transition'],
    fashion:    ['a fashion lover who follows trends and buys regularly', 'a designer, tailor, or fashion student', 'a fashion business owner, boutique operator, or stylist', 'someone who buys or sells clothing, fabric, or beauty products'],
    travel:     ['someone planning a local or international trip', 'a traveller managing visas, passports, or airline costs', 'a hotel owner, travel agent, or tour guide', 'a student or professional relocating abroad for study or work'],
    faith:      ['a regular churchgoer or mosque attendee', 'a pastor, imam, or faith community leader', 'a parent raising children with faith values', 'someone whose business or career intersects with religious institutions'],
    science:    ['a curious person who follows science and discovery', 'a student, researcher, or academic in any field', 'a healthcare worker or practitioner interested in new findings', 'an investor, entrepreneur, or policymaker shaped by scientific advances'],
  };

  const personas = topicPersonas[topic.toLowerCase()]
    ?? ['a regular person navigating daily life', 'a small business owner or trader', 'a student or young adult', 'someone in the professional or formal sector'];

  const personaGuide = personas
    .map((p) => `If you are ${p}: [2-4 specific sentences. What does this news mean for their daily life, work, or future? What should they do, stop, start, or watch? Use concrete examples — specific tools, amounts, habits, or decisions. Only reference Nigerian or African examples where the story genuinely connects to Nigeria or Africa; otherwise use universal examples any reader can act on.]`)
    .join('\n\n');

  return `You are Radar's editorial AI. Write for ambitious readers — curious, busy, and hungry for real understanding. A secondary school student must understand every sentence. PUBLISH LESS, MAKE IT SHARPER, MAKE IT STICK.

INPUT
Title: ${title}
Body: ${body}
Source topic: ${topic}

LANGUAGE RULES — never break these:
- Simple English only. Maximum 15 words per sentence.
- No markdown, no dashes, no bullets in prose fields (what, why, how_it_matters_to_you). Plain sentences only.
- Be deeply human. Use proverbs, analogies, psychology, history, or economics to make the point land.
- Do NOT force a Nigeria or Africa angle if the story has no genuine connection to Nigeria or Africa. Write to the universal human stakes instead.
- Each section must do DIFFERENT work — never repeat the same point across sections.

=== SECTIONS (follow this exact order) ===

1) SUMMARY (field: "what") — 2 plain sentences. What happened. Key facts only. Neutral tone.

2) KEY TAKEAWAYS (field: "key_takeaways") — Array of 3 to 5 items. Mix: one real risk, one opportunity most people miss, one non-obvious observation. Each is one complete sentence in very simple English. No dash, no bullet, no number. Just the sentence.

3) WHY IT MATTERS (field: "why") — Minimum 200 words of plain prose. Do NOT summarise the article. This section is about BIGGER PICTURE and HUMAN STAKES. Go beyond what happened. Ask: what does this reveal about how the world actually works? What timeless tension — power, money, survival, ambition, fairness — does this story expose? Who gains, who loses, and why does it tend to go this way? Use one concrete comparison, a proverb, or a reference to history, economics, or human psychology to make the insight land. Make the reader feel the weight of the story, not just understand the facts. Not a list. Different from the takeaways.

4) THE EDGE (field: "how_it_matters_to_you") — Minimum 200 words total. This is the most important section. Write 3 to 4 separate paragraphs, one for each type of reader. Each paragraph must start with exactly this format: "If you are a [person type]:" — then give 2 to 4 plain sentences of specific, actionable advice. What should they do, stop, start, or watch? Use concrete examples — specific tools, amounts, habits, or decisions. Only use Nigerian or African examples where the story genuinely connects to Nigeria or Africa. Otherwise use universal examples any reader can act on immediately. Be direct. No vague language. No repeated points from earlier sections.

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
- 1 (Must-see): >=3 tests pass AND (nigeria_relevance>=2 OR the story has clear universal significance) AND how_it_matters_to_you is concrete and specific
- 2 (Strong): >=3 tests pass
- 3 (Weak): <3 tests pass — dropped

OUTPUT — strict JSON only: { "relevant", "what", "key_takeaways":[], "why", "how_it_matters_to_you", "glossary":[], "forwardable", "advantage", "non_obvious", "learnable", "nigeria_relevance", "tier" }`;
}

// ── JSON helpers ──────────────────────────────────────────────────────────────

// Walk the text and extract the first balanced { ... } block regardless of preamble.
function extractJsonObject(text: string): string | null {
  let depth = 0, inString = false, escape = false, start = -1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (escape)        { escape = false; continue; }
    if (c === '\\' && inString) { escape = true; continue; }
    if (c === '"')     { inString = !inString; continue; }
    if (inString)      continue;
    if (c === '{')     { if (depth++ === 0) start = i; }
    else if (c === '}') { if (--depth === 0 && start !== -1) return text.slice(start, i + 1); }
  }
  return null;
}

function robustJsonParse(raw: string, label?: string): Record<string, unknown> | null {
  // Strip reasoning/thinking blocks emitted by reasoning models before the JSON
  let s = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Strip markdown code fences
  s = s.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim();

  // Walk balanced braces to find the outermost JSON object
  const extracted = extractJsonObject(s);
  if (extracted) {
    try { return JSON.parse(extracted) as Record<string, unknown>; } catch {}
    try { return JSON.parse(jsonrepair(extracted)) as Record<string, unknown>; } catch {}
  }

  // Last-resort: try the whole string
  try { return JSON.parse(jsonrepair(s)) as Record<string, unknown>; } catch {}

  if (label) console.warn(`[editorial] ${label} raw (first 400):`, raw.slice(0, 400));
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateSummary(
  title: string,
  description: string,
  topic: string,
): Promise<SummaryResult> {
  const cleaned = description.replace(/<[^>]*>/g, '').trim().slice(0, 2000);
  const body = cleaned.length >= 40 ? cleaned : title;
  if (body.length < 5) return dropOnFailure();

  const prompt = buildPrompt(title, body, topic);
  const raw = await callAI(prompt);

  if (raw) {
    const parsed = robustJsonParse(raw, 'aiRouter');
    if (parsed) {
      const result = parseSummaryResult(parsed);
      if (result) { consecutiveFailures = 0; return result; }
    }
    console.warn('[editorial] could not parse AI response JSON');
  }

  consecutiveFailures++;
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    console.error(`[editorial] AI providers failed ${consecutiveFailures} times in a row — aborting remaining items`);
  }
  return dropOnFailure();
}
