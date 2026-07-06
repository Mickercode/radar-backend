import { env } from '../config/env';
import { ApiError } from './http';

const CLAUDE_MODEL    = 'claude-sonnet-4-6';
const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';

// Nemotron (NVIDIA) via OpenRouter — free tier, used for file/link analysis.
// Check https://openrouter.ai/models for the latest Nemotron model ID.
const NM_MODEL    = 'nvidia/llama-3.3-nemotron-super-49b-v1:free';
const OR_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export interface ToolDefinition {
  name: string;
  description?: string;
  schema: Record<string, unknown>;
}

interface GenerateOptions {
  temperature?: number;
  maxOutputTokens?: number;
}

// ── OpenRouter fallback ───────────────────────────────────────────────────────
// Uses the OpenAI chat-completions format with json_object response_format.
// Called automatically when Claude fails (billing, rate-limit, etc.).
async function generateJsonViaNemotron(
  prompt: string,
  tool: ToolDefinition,
  opts: GenerateOptions,
): Promise<unknown> {
  const orKey = env.OPENROUTER_API_KEY;
  if (!orKey) throw new ApiError(503, 'AI service is temporarily unavailable. Please try again later.');

  const systemPrompt = `You are a precise JSON generator. ${tool.description ?? ''}
Respond with ONLY a valid JSON object matching this schema:
${JSON.stringify(tool.schema, null, 2)}
No markdown, no code fences, no explanation — raw JSON only.`;

  const res = await fetch(OR_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${orKey}`,
      'HTTP-Referer': 'https://radarproapp.com',
      'X-Title': 'Radar',
    },
    body: JSON.stringify({
      model: NM_MODEL,
      max_tokens: opts.maxOutputTokens ?? 1024,
      temperature: opts.temperature ?? 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new ApiError(502, `OpenRouter generation failed (${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content ?? '';
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new ApiError(502, 'OpenRouter returned invalid JSON');
  }
}

// ── Primary: Claude via Anthropic API ────────────────────────────────────────
async function generateJsonViaClaude(
  prompt: string,
  tool: ToolDefinition,
  opts: GenerateOptions,
): Promise<unknown> {
  if (!env.ANTHROPIC_API_KEY) throw new ApiError(503, 'no-claude-key');

  const res = await fetch(CLAUDE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: opts.maxOutputTokens ?? 1024,
      temperature: opts.temperature ?? 0.4,
      messages: [{ role: 'user', content: prompt }],
      tools: [
        {
          name: tool.name,
          description: tool.description ?? 'Generate structured output',
          input_schema: tool.schema,
        },
      ],
      tool_choice: { type: 'tool', name: tool.name },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    // 529 = Anthropic overloaded; 402 = billing; 401 = bad key — all warrant fallback.
    throw new Error(`claude-${res.status}: ${errBody}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; name?: string; input?: unknown }>;
  };
  const toolUse = data.content?.find((c) => c.type === 'tool_use' && c.name === tool.name);
  if (!toolUse?.input) throw new Error('claude-no-output');
  return toolUse.input;
}

/**
 * Generate structured JSON using OpenRouter/DeepSeek (primary) with automatic
 * fallback to Claude when OpenRouter is unavailable or the key is missing.
 */
export async function generateJson(
  prompt: string,
  tool: ToolDefinition,
  opts: GenerateOptions = {},
): Promise<unknown> {
  // Primary: Nemotron (NVIDIA) via OpenRouter — free tier, offloads DeepSeek
  if (env.OPENROUTER_API_KEY) {
    try {
      return await generateJsonViaNemotron(prompt, tool, opts);
    } catch (nmErr) {
      console.warn('[ai] Nemotron unavailable, falling back to Claude:', (nmErr as Error).message);
    }
  }

  // Fallback: Claude
  try {
    return await generateJsonViaClaude(prompt, tool, opts);
  } catch (claudeErr) {
    if (claudeErr instanceof ApiError) throw claudeErr;
    throw new ApiError(502, 'AI service is temporarily unavailable. Please try again later.');
  }
}
