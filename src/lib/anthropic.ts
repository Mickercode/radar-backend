import { env } from '../config/env';
import { ApiError } from './http';
import { jsonrepair } from 'jsonrepair';

const CLAUDE_MODEL    = 'claude-sonnet-4-6';
const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';

const NM_MODEL    = 'nvidia/nemotron-3-ultra-550b-a55b:free';
const DS_MODEL    = 'deepseek/deepseek-chat';
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

// ── OpenRouter (Nemotron or DeepSeek) ────────────────────────────────────────
async function generateJsonViaOpenRouter(
  model: string,
  prompt: string,
  tool: ToolDefinition,
  opts: GenerateOptions,
): Promise<unknown> {
  const orKey = env.OPENROUTER_API_KEY;
  if (!orKey) throw new Error('no-openrouter-key');

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
      model,
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
    throw new Error(`or-${res.status}: ${errBody}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content ?? '';
  try {
    return JSON.parse(jsonrepair(raw)) as unknown;
  } catch {
    throw new Error('or-invalid-json');
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
 * Generate structured JSON. Priority: Nemotron (free) → DeepSeek (free) → Claude (last resort).
 */
export async function generateJson(
  prompt: string,
  tool: ToolDefinition,
  opts: GenerateOptions = {},
): Promise<unknown> {
  if (env.OPENROUTER_API_KEY) {
    // 1. Nemotron Ultra (free)
    try {
      return await generateJsonViaOpenRouter(NM_MODEL, prompt, tool, opts);
    } catch (nmErr) {
      console.warn('[ai] Nemotron failed, trying DeepSeek:', (nmErr as Error).message);
    }
    // 2. DeepSeek (free)
    try {
      return await generateJsonViaOpenRouter(DS_MODEL, prompt, tool, opts);
    } catch (dsErr) {
      console.warn('[ai] DeepSeek failed, falling back to Claude:', (dsErr as Error).message);
    }
  }

  // 3. Claude (last resort — paid)
  try {
    return await generateJsonViaClaude(prompt, tool, opts);
  } catch (claudeErr) {
    if (claudeErr instanceof ApiError) throw claudeErr;
    throw new ApiError(502, 'AI service is temporarily unavailable. Please try again later.');
  }
}
