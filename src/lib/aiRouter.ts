// Flat round-robin AI provider router.
// See ai-provider-router.md for design rationale — do not reintroduce priority tiers.

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── Provider registry ─────────────────────────────────────────────────────────

interface Provider {
  name: string;
  endpoint: string;
  model: string;
  apiKeyEnv: string;
  // 'bearer' = Authorization: Bearer <key> + /chat/completions format
  // 'anthropic' = x-api-key header + /messages format (custom shaper)
  authStyle: 'bearer' | 'anthropic';
  status?: 'exhausted';
}

const PROVIDERS: Provider[] = [
  {
    name: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    apiKeyEnv: 'GROQ_API_KEY',
    authStyle: 'bearer',
  },
  {
    name: 'Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.0-flash',
    apiKeyEnv: 'GEMINI_API_KEY',
    authStyle: 'bearer',
  },
  {
    name: 'Cerebras',
    // Free tier — model name changes without warning. Update `model` if requests
    // start returning 404/model-not-found; check api.cerebras.ai for current list.
    endpoint: 'https://api.cerebras.ai/v1/chat/completions',
    model: 'gpt-oss-120b',
    apiKeyEnv: 'CEREBRAS_API_KEY',
    authStyle: 'bearer',
  },
  {
    name: 'Anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-haiku-4-5-20251001',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    authStyle: 'anthropic',
  },
  {
    // OpenRouter is currently out of credits. Flip status back to undefined
    // (don't delete the entry) when credits are restored.
    name: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'deepseek/deepseek-chat',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    authStyle: 'bearer',
    status: 'exhausted',
  },
];

// ── Router state (module-level, per process) ──────────────────────────────────

let cursor = 0;

interface CircuitState { failures: number; openUntil: number; }
const circuit = new Map<string, CircuitState>();
const quotaResets = new Map<string, number>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetTimeFromHeader(headers: Headers): number {
  const ra = headers.get('retry-after');
  if (ra) {
    const secs = parseInt(ra, 10);
    if (Number.isFinite(secs) && secs > 0) return Date.now() + secs * 1000;
    const date = Date.parse(ra);
    if (Number.isFinite(date)) return date;
  }
  return Date.now() + 60 * 60 * 1000; // 1-hour default per design doc
}

function isAvailable(p: Provider): boolean {
  if (p.status === 'exhausted') return false;
  if (!process.env[p.apiKeyEnv]) return false;
  if ((quotaResets.get(p.name) ?? 0) > Date.now()) return false;
  const cb = circuit.get(p.name);
  if (cb && cb.failures >= 3 && cb.openUntil > Date.now()) return false;
  return true;
}

function onFailure(name: string) {
  const cb = circuit.get(name) ?? { failures: 0, openUntil: 0 };
  cb.failures++;
  if (cb.failures >= 3) cb.openUntil = Date.now() + 10 * 60 * 1000; // 10 min
  circuit.set(name, cb);
}

function onSuccess(name: string) {
  circuit.set(name, { failures: 0, openUntil: 0 });
  quotaResets.delete(name);
}

// ── Provider callers ──────────────────────────────────────────────────────────
// Returns the text on success, null on hard failure (trips circuit breaker),
// or 'quota' on rate-limit/billing errors (sets quotaResets but does NOT trip
// the circuit breaker — these are transient, not provider health issues).

type ProviderResult = string | null | 'quota';

async function callBearer(p: Provider, prompt: string): Promise<ProviderResult> {
  const key = process.env[p.apiKeyEnv]!;
  const res = await fetch(p.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      ...(p.name === 'OpenRouter' ? { 'HTTP-Referer': 'https://radarproapp.com', 'X-Title': 'Radar' } : {}),
    },
    body: JSON.stringify({
      model: p.model,
      max_tokens: 2500,
      temperature: 0.25,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a precise JSON generator. Respond with ONLY a valid JSON object. No markdown, no code fences, no explanation — raw JSON only.' },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(35_000),
  });

  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 300);
    const isQuota = res.status === 429 || body.includes('quota') || body.includes('insufficient') || body.includes('rate_limit');
    console.warn(`[aiRouter] ${p.name} ${res.status}: ${body}`);
    if (isQuota) { quotaResets.set(p.name, resetTimeFromHeader(res.headers)); return 'quota'; }
    return null;
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? null;
}

async function callAnthropic(p: Provider, prompt: string): Promise<ProviderResult> {
  const key = process.env[p.apiKeyEnv]!;
  const res = await fetch(p.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: p.model,
      max_tokens: 2500,
      temperature: 0.25,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(35_000),
  });

  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 300);
    const isQuota = res.status === 429 || res.status === 529;
    const isBilling = res.status === 400 && body.includes('credit');
    console.warn(`[aiRouter] ${p.name} ${res.status}: ${body}`);
    if (isQuota || isBilling) { quotaResets.set(p.name, resetTimeFromHeader(res.headers)); return 'quota'; }
    return null;
  }

  const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
  return data.content?.find(c => c.type === 'text')?.text ?? null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface RouterStatus {
  available: string[];
  unavailable: { name: string; reason: string }[];
}

export function getRouterStatus(): RouterStatus {
  const available: string[] = [];
  const unavailable: { name: string; reason: string }[] = [];
  for (const p of PROVIDERS) {
    if (p.status === 'exhausted') { unavailable.push({ name: p.name, reason: 'exhausted' }); continue; }
    if (!process.env[p.apiKeyEnv]) { unavailable.push({ name: p.name, reason: 'no-key' }); continue; }
    const qr = quotaResets.get(p.name) ?? 0;
    if (qr > Date.now()) { unavailable.push({ name: p.name, reason: `quota-until-${new Date(qr).toISOString()}` }); continue; }
    const cb = circuit.get(p.name);
    if (cb && cb.failures >= 3 && cb.openUntil > Date.now()) { unavailable.push({ name: p.name, reason: `circuit-open-until-${new Date(cb.openUntil).toISOString()}` }); continue; }
    available.push(p.name);
  }
  return { available, unavailable };
}

/**
 * Call the AI with a prompt. Tries providers in rotation starting from cursor,
 * skipping unavailable ones. Returns the raw text response or null if all fail.
 */
export async function callAI(prompt: string): Promise<string | null> {
  const startCursor = cursor;
  let tried = 0;

  for (let i = 0; i < PROVIDERS.length; i++) {
    const idx = (startCursor + i) % PROVIDERS.length;
    const p = PROVIDERS[idx]!;

    if (!isAvailable(p)) continue;
    tried++;

    try {
      const result = p.authStyle === 'anthropic'
        ? await callAnthropic(p, prompt)
        : await callBearer(p, prompt);

      if (result && result !== 'quota') {
        onSuccess(p.name);
        cursor = (idx + 1) % PROVIDERS.length; // advance cursor past successful provider
        return result;
      }
      // 'quota' = rate-limited or billing issue; quotaResets already set — don't trip circuit
      if (result !== 'quota') onFailure(p.name);
    } catch (e) {
      const msg = (e as Error).message ?? '';
      // Timeout or network error
      if (msg.includes('TimeoutError') || msg.includes('ETIMEDOUT') || msg.includes('fetch')) {
        console.warn(`[aiRouter] ${p.name} network error: ${msg.slice(0, 80)}`);
      }
      onFailure(p.name);
    }

    await sleep(300); // brief pause between provider attempts
  }

  if (tried === 0) {
    // No provider was attempted. If any are just quota-limited (not hard-failed),
    // wait for the nearest reset and retry once — this handles Groq's ~12s TPM window.
    const resets = [...quotaResets.values()].filter(t => t > Date.now());
    const minReset = resets.length ? Math.min(...resets) : 0;
    const waitMs = minReset - Date.now();
    if (waitMs > 0 && waitMs <= 35_000) {
      await sleep(waitMs + 300);
      for (let i = 0; i < PROVIDERS.length; i++) {
        const idx = (startCursor + i) % PROVIDERS.length;
        const p = PROVIDERS[idx]!;
        if (!isAvailable(p)) continue;
        try {
          const result = p.authStyle === 'anthropic'
            ? await callAnthropic(p, prompt)
            : await callBearer(p, prompt);
          if (result && result !== 'quota') {
            onSuccess(p.name);
            cursor = (idx + 1) % PROVIDERS.length;
            return result;
          }
          if (result !== 'quota') onFailure(p.name);
        } catch { onFailure(p.name); }
      }
    }
    console.warn('[aiRouter] no providers available (all exhausted/rate-limited/no-key)');
  }
  return null;
}
