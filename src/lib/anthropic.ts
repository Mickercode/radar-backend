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

export interface ToolDefinition {
  name: string;
  description?: string;
  schema: Record<string, unknown>;
}

interface GenerateOptions {
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Calls Claude with tool-use (forced tool_choice) and returns the structured
 * arguments from the tool_use content block. More reliable than response_format
 * because Claude natively validates output against the tool's input_schema.
 *
 * Throws a 502 ApiError on transport failure or missing tool output.
 */
export async function generateJson(
  prompt: string,
  tool: ToolDefinition,
  opts: GenerateOptions = {},
): Promise<unknown> {
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
    throw new ApiError(502, `Claude generation failed (${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; name?: string; input?: unknown }>;
  };

  const toolUse = data.content?.find((c) => c.type === 'tool_use' && c.name === tool.name);
  if (!toolUse?.input) throw new ApiError(502, 'Claude returned no tool output');

  return toolUse.input;
}
