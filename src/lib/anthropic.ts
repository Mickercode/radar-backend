import { env } from '../config/env';
import { ApiError } from './http';

// Anthropic Claude client for AI generation
const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';
const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';

function apiKey(): string {
  if (!env.ANTHROPIC_API_KEY) {
    throw new ApiError(503, 'ANTHROPIC_API_KEY is not configured');
  }
  return env.ANTHROPIC_API_KEY;
}

interface GenerateOptions {
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Calls Claude with JSON-mode and returns the parsed object. Throws
 * a 502 ApiError on transport failure or unparseable output.
 */
export async function generateJson(prompt: string, opts: GenerateOptions = {}): Promise<unknown> {
  const res = await fetch(CLAUDE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'false',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: opts.maxOutputTokens ?? 1024,
      temperature: opts.temperature ?? 0.4,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new ApiError(502, `Claude generation failed (${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const text = data.content?.[0]?.text;
  if (!text) throw new ApiError(502, 'Claude returned no content');

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(502, 'Claude returned invalid JSON');
  }
}
