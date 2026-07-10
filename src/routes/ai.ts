import { Router } from 'express';
import { asyncHandler, badRequest } from '../lib/http';
import { requireAuth } from '../middleware/auth';

export const aiRouter = Router();
aiRouter.use(requireAuth);

interface SavedSnippet {
  title: string;
  type: string;
  source: string;
}

// POST /ai/insights-report
// Body: { items: SavedSnippet[] }  (min 3, max 30 used)
// Calls OpenRouter (DeepSeek free) to generate a personal reading-pattern report.
aiRouter.post(
  '/insights-report',
  asyncHandler(async (req, res) => {
    const orKey = process.env.OPENROUTER_API_KEY;
    if (!orKey) throw badRequest('AI service not configured');

    const { items } = req.body as { items?: SavedSnippet[] };
    if (!Array.isArray(items) || items.length < 3) {
      throw badRequest('Need at least 3 saved items for a report');
    }

    const sample = items.slice(0, 30);
    const itemList = sample
      .map((i) => `- [${i.type}] "${i.title}" (${i.source})`)
      .join('\n');

    const prompt = `You are Radar's AI analyst. A Nigerian/African news app user saved these ${sample.length} items:\n\n${itemList}\n\nWrite a SHORT personal insight report:\n- "pattern": 1-2 sentences on the main themes and topics this person follows.\n- "strengths": 1-2 sentences on areas where they are building strong knowledge.\n- "blindSpots": 1-2 sentences on important adjacent topics they should explore.\n\nSpeak directly as "you". Be specific. Keep each field under 40 words.\n\nReturn strict JSON: { "pattern": string, "strengths": string, "blindSpots": string }`;

    try {
      const apiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orKey}`,
          'HTTP-Referer': 'https://radarproapp.com',
          'X-Title': 'Radar',
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-chat',
          max_tokens: 300,
          temperature: 0.4,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Return ONLY valid JSON. No markdown, no explanation.' },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!apiRes.ok) {
        res.status(503).json({ error: 'AI service temporarily unavailable' });
        return;
      }

      const data = (await apiRes.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const raw = (data.choices?.[0]?.message?.content ?? '').trim();
      const parsed = JSON.parse(raw) as { pattern?: string; strengths?: string; blindSpots?: string };

      const topTypes: Record<string, number> = {};
      for (const item of items) {
        topTypes[item.type] = (topTypes[item.type] ?? 0) + 1;
      }

      res.json({
        pattern: String(parsed.pattern ?? ''),
        strengths: String(parsed.strengths ?? ''),
        blindSpots: String(parsed.blindSpots ?? ''),
        topTypes,
        totalItems: items.length,
      });
    } catch {
      res.status(503).json({ error: 'Failed to generate insights report' });
    }
  }),
);
