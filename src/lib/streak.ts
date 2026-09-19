import { format, subDays } from "date-fns";

/** Count consecutive days (yyyy-MM-dd keys) ending today, or yesterday if
 *  today has no entries yet. */
export function calcStreak(keys: string[], now: Date = new Date()): number {
  const set = new Set(keys);
  let cursor = format(now, "yyyy-MM-dd");
  if (!set.has(cursor)) {
    cursor = format(subDays(now, 1), "yyyy-MM-dd");
  }
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    const cursorDate = new Date(`${cursor}T12:00:00`);
    cursor = format(subDays(cursorDate, 1), "yyyy-MM-dd");
  }
  return streak;
}
