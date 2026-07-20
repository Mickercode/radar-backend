import { prisma } from './prisma';
import { ApiError } from './http';

const FREE_DAILY_LIMIT = 3;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

/**
 * Returns how many analyses the user has done today.
 */
export async function getDailyAnalysisCount(userId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    SELECT count FROM daily_analysis_count
    WHERE user_id = ${userId}::uuid AND date_key = ${todayKey()}
  `;
  return rows[0]?.count ?? 0;
}

/**
 * Checks the daily limit and throws 402 if exceeded.
 * isPremium users skip the check.
 * Call BEFORE running the analysis.
 */
export async function checkAndIncrementDailyLimit(userId: string, isPremium: boolean): Promise<void> {
  if (isPremium) return; // unlimited for paid users

  const used = await getDailyAnalysisCount(userId);
  if (used >= FREE_DAILY_LIMIT) {
    throw new ApiError(
      402,
      `You've used your ${FREE_DAILY_LIMIT} free analyses today. Unlimited analysis is available on Radar Premium — coming soon.`,
    );
  }

  // Increment (upsert)
  await prisma.$executeRaw`
    INSERT INTO daily_analysis_count (id, user_id, date_key, count)
    VALUES (gen_random_uuid(), ${userId}::uuid, ${todayKey()}, 1)
    ON CONFLICT (user_id, date_key) DO UPDATE
      SET count = daily_analysis_count.count + 1
  `;
}
