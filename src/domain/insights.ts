import { addDays, diffDays, formatDay } from './dates';
import { last7DaysProgress, summarize } from './progress';
import type { Checkin, Circumstance, DayKey, HabitLog, ID } from './types';

/** Completion for the last `weeks` rolling 7-day windows, oldest first. */
export function weeklyCompletion(logs: HabitLog[], today: DayKey, weeks = 4) {
  return Array.from({ length: weeks }, (_, i) => {
    const end = addDays(today, -7 * (weeks - 1 - i));
    const s = summarize(last7DaysProgress(logs, end));
    return { end, label: i === weeks - 1 ? 'This week' : formatDay(addDays(end, -6)), ...s };
  });
}

export function lessonStats(checkins: Checkin[], today: DayKey, days = 30) {
  const recent = checkins.filter((c) => !c.deletedAt && diffDays(c.on, today) >= 0 && diffDays(c.on, today) < days);
  const avoided = recent.filter((c) => c.outcome === 'avoided').length;
  const repeated = recent.filter((c) => c.outcome === 'repeated').length;
  const lastRepeat = checkins
    .filter((c) => !c.deletedAt && c.outcome === 'repeated')
    .map((c) => c.on)
    .sort()
    .pop();
  return {
    avoided,
    repeated,
    avoidRate: avoided + repeated === 0 ? 0 : avoided / (avoided + repeated),
    daysSinceRepeat: lastRepeat ? diffDays(lastRepeat, today) : null,
  };
}

export function topTriggers(checkins: Checkin[], circumstances: Circumstance[], limit = 3) {
  const counts = new Map<ID, number>();
  for (const c of checkins) {
    if (c.deletedAt || c.outcome !== 'repeated' || !c.circumstanceId) continue;
    counts.set(c.circumstanceId, (counts.get(c.circumstanceId) ?? 0) + 1);
  }
  const byId = new Map(circumstances.map((c) => [c.id, c]));
  return [...counts.entries()]
    .map(([id, count]) => ({ circumstance: byId.get(id), count }))
    .filter((x): x is { circumstance: Circumstance; count: number } => !!x.circumstance)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
