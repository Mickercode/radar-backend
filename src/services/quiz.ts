import { ApiError } from '../lib/http';

// AI-backed quiz generation lands in the AI-pipeline chunk (it ports the old
// `generate-quiz` Edge Function). Until then, GET /insights/:id/quiz serves
// cached questions if they exist and surfaces this clear 503 if none do, rather
// than silently returning an empty quiz.
export async function generateQuizQuestions(_insightId: string): Promise<never> {
  throw new ApiError(
    503,
    'Quiz generation is not available yet (comes online in the AI pipeline chunk).',
  );
}
