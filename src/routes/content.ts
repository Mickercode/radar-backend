import { Router } from 'express';
import multer from 'multer';
import { asyncHandler, badRequest, ApiError } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { generateJson } from '../lib/anthropic';
import { checkAndIncrementDailyLimit } from '../lib/dailyLimit';
import { prisma } from '../lib/prisma';

export const contentRouter = Router();
contentRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word, and text files are allowed.'));
    }
  },
});

const PDF_PAGE_LIMIT = 20;

async function extractTextFromPdf(buffer: Buffer): Promise<{ text: string; pages: number }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
    const data = await pdfParse(buffer);
    return { text: data.text, pages: data.numpages };
  } catch {
    throw new ApiError(422, 'Failed to parse PDF file');
  }
}

async function extractTextFromWord(buffer: Buffer): Promise<string> {
  try {
    const mammoth = (await import('mammoth')).default;
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch {
    throw new ApiError(422, 'Failed to parse Word document');
  }
}

function extractTextFromPlain(buffer: Buffer): string {
  return buffer.toString('utf-8');
}

function buildAnalysisPrompt(filename: string, text: string): string {
  const truncatedText = text.length > 8000 ? text.slice(0, 8000) + '...' : text;

  return `You are Radar's editorial AI. Write for ambitious Nigerian/African readers. A secondary school student must understand every sentence. PUBLISH LESS, MAKE IT SHARPER, MAKE IT STICK.

INPUT (a document the user wants to understand and remember)
Filename: ${filename}
Document content: ${truncatedText}

LANGUAGE RULES — never break these:
- Simple English only. Maximum 15 words per sentence.
- No markdown, no dashes, no bullets in prose fields. Plain sentences only.
- Always ground insights in Nigerian/African reality: naira, fuel prices, data costs, financial inclusion, small business life.
- Each section must do DIFFERENT work — never repeat the same point.

=== SECTIONS (follow this exact order) ===

1) TITLE — A clean 6-10 word title summarizing the document.

2) SUMMARY (field: "what") — 2 plain sentences. What the document says. Key facts only. Neutral tone.

3) KEY TAKEAWAYS (field: "key_takeaways") — Array of 3 to 5 items. Mix: one real risk, one opportunity most people miss, one non-obvious observation. Each is one complete sentence in very simple English. No dash, no bullet, no number. Just the sentence.

4) WHY IT MATTERS (field: "why") — About 150 words of plain prose. Show the country-level or society-level importance of this document's content. Connect to real effects Nigerians or Africans will feel. Not a list. Different from the takeaways.

5) HOW IT MATTERS TO YOU (field: "edge") — This is the most important section. Write 3 to 4 separate paragraphs, one for each type of person who might read this document. Each paragraph must start with exactly: "If you are a [person type]:" — then give 2 to 4 plain sentences of specific advice. Use Nigerian examples: naira amounts, market prices, mobile apps, daily work routines. Cover: (1) someone who works in or studies this field, (2) a small business owner or trader affected by this topic, (3) an ordinary citizen or family, (4) any other group directly relevant to the document. Tell them what to do, what to stop, what to watch. Direct and specific.

=== SCORING ===

10/10 TEST — true/false: forwardable, advantage, non_obvious, learnable
NIGERIA RELEVANCE (0-3): 0=none 1=tangential 2=relevant 3=Nigeria/Africa-specific
TIER: 1 (>=3 tests + relevance>=2 + edge is concrete), 2 (>=3 tests), 3 (<3)

OUTPUT — strict JSON: { "title", "what", "key_takeaways":[], "why", "edge", "forwardable", "advantage", "non_obvious", "learnable", "nigeria_relevance", "tier" }`;
}

const clampScore = (v: unknown): 0 | 1 | 2 | 3 =>
  Math.max(0, Math.min(3, Number(v ?? 0))) as 0 | 1 | 2 | 3;

// POST /content/analyse/upload → CapturedInsight
contentRouter.post(
  '/analyse/upload',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('No file uploaded');

    // Check daily limit before doing any heavy work
    const uid = req.auth!.userId;
    const user = await prisma.appUser.findUnique({ where: { id: uid }, select: { isPremium: true } });
    await checkAndIncrementDailyLimit(uid, user?.isPremium ?? false);

    let text: string;
    switch (req.file.mimetype) {
      case 'application/pdf': {
        const { text: pdfText, pages } = await extractTextFromPdf(req.file.buffer);
        if (pages > PDF_PAGE_LIMIT) {
          throw new ApiError(400, `This PDF has ${pages} pages. Only documents up to ${PDF_PAGE_LIMIT} pages are supported.`);
        }
        text = pdfText;
        break;
      }
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        text = await extractTextFromWord(req.file.buffer);
        break;
      case 'text/plain':
        text = extractTextFromPlain(req.file.buffer);
        break;
      default:
        throw badRequest('Unsupported file type');
    }

    if (!text || text.trim().length === 0) throw badRequest('Could not extract text from file');

    const parsed = (await generateJson(
      buildAnalysisPrompt(req.file.originalname || 'uploaded document', text),
      {
        name: 'generate_insight',
        description: 'Generate a structured insight from an uploaded document',
        schema: {
          type: 'object',
          properties: {
            title:            { type: 'string' },
            what:             { type: 'string' },
            key_takeaways:    { type: 'array', items: { type: 'string' } },
            why:              { type: 'string' },
            edge:             { type: 'string' },
            forwardable:      { type: 'boolean' },
            advantage:        { type: 'boolean' },
            non_obvious:      { type: 'boolean' },
            learnable:        { type: 'boolean' },
            nigeria_relevance: { type: 'integer', enum: [0, 1, 2, 3] },
            tier:             { type: 'integer', enum: [1, 2, 3] },
          },
          required: ['title', 'what', 'key_takeaways', 'why', 'edge', 'forwardable', 'advantage', 'non_obvious', 'learnable', 'nigeria_relevance', 'tier'],
        },
      },
      { temperature: 0.25, maxOutputTokens: 1200 },
    )) as Record<string, unknown>;

    const stripDash = (s: string) => s.trim().replace(/^[-•*]\s*/, '');
    const rawTakeaways = Array.isArray(parsed.key_takeaways)
      ? (parsed.key_takeaways as unknown[]).filter((k): k is string => typeof k === 'string').map(stripDash)
      : [];

    res.json({
      sourceUrl:         null,
      title:             String(parsed.title || req.file.originalname || 'Uploaded document'),
      what:              stripDash(String(parsed.what || '')),
      keyTakeaways:      rawTakeaways,
      why:               stripDash(String(parsed.why || '')),
      howItMattersToYou: stripDash(String(parsed.edge || '')),
      glossary:          [],
      tier:              (parsed.tier === 1 || parsed.tier === 2 ? parsed.tier : 3) as 1 | 2 | 3,
      nigeriaRelevance:  clampScore(parsed.nigeria_relevance),
    });
  }),
);
