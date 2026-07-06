// Clean-content extraction via Jina Reader (https://r.jina.ai/{url}) — a free,
// no-key service that returns markdown extracted from any web page. Far more
// reliable than a hand-rolled HTML parser. Ported from the capture-url fn.

const JINA_READER_BASE = 'https://r.jina.ai/';

export interface ExtractedContent {
  title: string;
  body: string;
  url: string;
}

// Jina returns text shaped like:
//   Title: <article title>
//   URL Source: <url>
//   Markdown Content:
//   <body markdown>
// We pull the title and treat everything after "Markdown Content:" as body,
// truncating to 4000 chars to keep the LLM input tight without losing the lede.
export async function fetchClean(url: string): Promise<ExtractedContent | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    let res: Response;
    try {
      res = await fetch(`${JINA_READER_BASE}${url}`, {
        headers: { Accept: 'text/plain', 'User-Agent': 'Radar/1.0' },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      console.error('[jina] fetch failed:', res.status);
      return null;
    }
    const text = await res.text();
    const titleMatch = text.match(/^Title:\s*(.+)$/m);
    const title = titleMatch?.[1]?.trim() ?? '';

    const marker = 'Markdown Content:';
    const splitIdx = text.indexOf(marker);
    const body = splitIdx >= 0 ? text.slice(splitIdx + marker.length).trim() : text;

    if (!title && body.length < 100) return null;
    return { title, body: body.slice(0, 4000), url };
  } catch (e) {
    console.error('[jina] error:', e);
    return null;
  }
}
