// Spaced-repetition schedule (PLAYBOOK §4C). Ported from the app's old
// services/api.ts: the cadence is 1 → 3 → 7 → 21 → 60 → 180 days, indexed by
// `step`. Anything past the array length stays at the final interval.
export const REVIEW_SCHEDULE_DAYS = [1, 3, 7, 21, 60, 180];

export function intervalDaysForStep(step: number): number {
  const clamped = Math.max(0, Math.min(step, REVIEW_SCHEDULE_DAYS.length - 1));
  return REVIEW_SCHEDULE_DAYS[clamped]!;
}

/** Returns a new Date `days` after `from` (defaults to now). */
export function dueDateAfter(days: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}
