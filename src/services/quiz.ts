import { prisma } from '../lib/prisma';
import { ApiError, notFound } from '../lib/http';
import { generateJson } from '../lib/anthropic';
import { toQuizQuestion } from '../lib/serialize';

// "Understand Once" quiz generation (PLAYBOOK §3). Ported from generate-quiz.
// Generates 3 multiple-choice questions for an insight, persists them (so
// repeat takes reuse the same set), and returns them.

const QUESTION_COUNT = 3;

interface GeneratedQuestion {
  question: string;
  options: string[];
  correct_index: number;
}

const RESPONSE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      question: { type: 'string' },
      options: { type: 'array', items: { type: 'string' } },
      correct_index: { type: 'integer' },
    },
    required: ['question', 'options', 'correct_index'],
  },
};

function buildPrompt(i: { title: string; what: string; why: string; edge: string }): string {
  return `You are designing a 3-question multiple-choice quiz to verify the reader actually understood the insight below.

Insight:
Title: ${i.title}
What: ${i.what}
Why: ${i.why}
Edge: ${i.edge}

Rules:
- Exactly 3 questions.
- Each has exactly 4 options.
- Exactly one option is correct, the other three are plausible-but-wrong distractors.
- Test comprehension, not memory of exact wording.
- Cover different angles: one on the WHAT, one on the WHY, one on the EDGE.
- Questions and options must be short and self-contained — no "as mentioned above" references.

Respond as JSON: an array of 3 objects with { question, options (4 strings), correct_index (0..3) }.`;
}

// Validate defensively — the model can drift even with a response schema.
function validate(parsed: unknown): GeneratedQuestion[] | null {
  if (!Array.isArray(parsed)) return null;
  const valid: GeneratedQuestion[] = [];
  for (const q of parsed) {
    if (
      typeof q?.question === 'string' &&
      Array.isArray(q?.options) &&
      q.options.length === 4 &&
      q.options.every((o: unknown) => typeof o === 'string') &&
      typeof q?.correct_index === 'number' &&
      q.correct_index >= 0 &&
      q.correct_index <= 3
    ) {
      valid.push(q as GeneratedQuestion);
    }
  }
  return valid.length === QUESTION_COUNT ? valid : null;
}

/**
 * Generates + persists the quiz for an insight the caller owns, then returns
 * the serialized questions. Called by GET /insights/:id/quiz on a cache miss.
 */
export async function generateQuizQuestions(insightId: string, uid: string) {
  const insight = await prisma.insight.findFirst({
    where: { id: insightId, userId: uid },
    select: { title: true, what: true, why: true, edge: true },
  });
  if (!insight) throw notFound('Insight not found');

  const parsed = await generateJson(buildPrompt(insight), {
    temperature: 0.6,
    maxOutputTokens: 1200,
    responseSchema: RESPONSE_SCHEMA,
  });
  const generated = validate(parsed);
  if (!generated) throw new ApiError(502, 'Quiz generation failed');

  // Replace any partial set so we never cache a mismatched count.
  await prisma.$transaction([
    prisma.insightQuizQuestion.deleteMany({ where: { insightId } }),
    prisma.insightQuizQuestion.createMany({
      data: generated.map((q, i) => ({
        insightId,
        userId: uid,
        question: q.question,
        options: q.options,
        correctIndex: q.correct_index,
        displayOrder: i,
      })),
    }),
  ]);

  const rows = await prisma.insightQuizQuestion.findMany({
    where: { insightId },
    orderBy: { displayOrder: 'asc' },
  });
  return rows.map(toQuizQuestion);
}
