import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest } from '../lib/http';
import { requireAuth, userId } from '../middleware/auth';
import { generateJson } from '../lib/anthropic';
import { ApiError } from '../lib/http';

// File upload analysis endpoint for PDF/Word documents
export const contentRouter = Router();
contentRouter.use(requireAuth);

// Configure multer for memory storage (files are processed immediately)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word, and text files are allowed.'));
    }
  },
});

// Helper: Extract text from PDF
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    throw new ApiError(422, 'Failed to parse PDF file');
  }
}

// Helper: Extract text from Word document
async function extractTextFromWord(buffer: Buffer): Promise<string> {
  try {
    const mammoth = (await import('mammoth')).default;
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    throw new ApiError(422, 'Failed to parse Word document');
  }
}

// Helper: Extract text from plain text file
function extractTextFromPlain(buffer: Buffer): string {
  return buffer.toString('utf-8');
}

// Helper: Check and increment upload limit
async function checkUploadLimit(uid: string): Promise<{ allowed: boolean; remaining: number }> {
  const FREE_TIER_LIMIT = 5;
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const uploadCount = await prisma.uploadCount.upsert({
    where: { userId_month: { userId: uid, month: monthKey } },
    create: { userId: uid, month: monthKey, count: 0 },
    update: {},
    select: { count: true },
  });

  if (uploadCount.count >= FREE_TIER_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: FREE_TIER_LIMIT - uploadCount.count };
}

// Helper: Increment upload count
async function incrementUploadCount(uid: string): Promise<void> {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  await prisma.uploadCount.upsert({
    where: { userId_month: { userId: uid, month: monthKey } },
    create: { userId: uid, month: monthKey, count: 1 },
    update: { count: { increment: 1 } },
  });
}

function buildAnalysisPrompt(filename: string, text: string): string {
  // Truncate text if too long (keep first 8000 chars for context)
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

5) HOW IT MATTERS TO YOU (field: "edge") — About 300 words of plain prose. This is the most important section. Speak directly to the reader who saved this document. What should they do right now with this information? What should they stop or avoid? What should they watch for? Use simple everyday Nigerian examples. Make it feel like advice from a smart friend. Specific and actionable.

=== SCORING ===

10/10 TEST — true/false: forwardable, advantage, non_obvious, learnable
NIGERIA RELEVANCE (0-3): 0=none 1=tangential 2=relevant 3=Nigeria/Africa-specific
TIER: 1 (>=3 tests + relevance>=2 + edge is concrete), 2 (>=3 tests), 3 (<3)

OUTPUT — strict JSON: { "title", "what", "key_takeaways":[], "why", "edge", "forwardable", "advantage", "non_obvious", "learnable", "nigeria_relevance", "tier" }`;
}

const clampScore = (v: unknown): 0 | 1 | 2 | 3 =>
  Math.max(0, Math.min(3, Number(v ?? 0))) as 0 | 1 | 2 | 3;

// POST /content/analyse/upload → CapturedInsight
// Accepts PDF, Word, or text files and returns an AI-analyzed insight preview
contentRouter.post(
  '/analyse/upload',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw badRequest('No file uploaded');
    }

    const uid = userId(req);

    // Check upload limit
    const limitCheck = await checkUploadLimit(uid);
    if (!limitCheck.allowed) {
      throw new ApiError(402, 'Monthly upload limit reached. Upgrade to premium for unlimited uploads.');
    }

    // Extract text based on file type
    let text: string;
    switch (req.file.mimetype) {
      case 'application/pdf':
        text = await extractTextFromPdf(req.file.buffer);
        break;
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

    if (!text || text.trim().length === 0) {
      throw badRequest('Could not extract text from file');
    }

    // Analyze with AI
    const parsed = (await generateJson(buildAnalysisPrompt(req.file.originalname || 'uploaded document', text), {
      name: 'generate_insight',
      description: 'Generate a structured insight from an uploaded document',
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          what: { type: 'string' },
          key_takeaways: { type: 'array', items: { type: 'string' } },
          why: { type: 'string' },
          edge: { type: 'string' },
          forwardable: { type: 'boolean' },
          advantage: { type: 'boolean' },
          non_obvious: { type: 'boolean' },
          learnable: { type: 'boolean' },
          nigeria_relevance: { type: 'integer', enum: [0, 1, 2, 3] },
          tier: { type: 'integer', enum: [1, 2, 3] },
        },
        required: ['title', 'what', 'key_takeaways', 'why', 'edge', 'forwardable', 'advantage', 'non_obvious', 'learnable', 'nigeria_relevance', 'tier'],
      },
    }, {
      temperature: 0.25,
      maxOutputTokens: 1200,
    })) as Record<string, unknown>;

    // Increment upload count on success
    await incrementUploadCount(uid);

    const stripDash = (s: string) => s.trim().replace(/^[-•*]\s*/, '');
    const rawTakeaways = Array.isArray(parsed.key_takeaways)
      ? (parsed.key_takeaways as unknown[]).filter((k): k is string => typeof k === 'string').map(stripDash)
      : [];

    // Return shape matching CapturedInsight so the FE can use the same result renderer.
    res.json({
      sourceUrl: null,
      title: String(parsed.title || req.file.originalname || 'Uploaded document'),
      what: stripDash(String(parsed.what || '')),
      keyTakeaways: rawTakeaways,
      why: stripDash(String(parsed.why || '')),
      howItMattersToYou: stripDash(String(parsed.edge || '')),
      glossary: [],
      tier: (parsed.tier === 1 || parsed.tier === 2 ? parsed.tier : 3) as 1 | 2 | 3,
      nigeriaRelevance: clampScore(parsed.nigeria_relevance),
    });
  }),
);
