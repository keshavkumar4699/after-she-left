import { diffDays, weekdayOf } from './dates';
import type { DayKey, Habit, HabitLog, ID } from './types';

/**
 * Weekly planner: habits have a *weekly* target (gym 3×, football 2×) instead of fixed times.
 * `distributeWeek` spreads the remaining sessions over the week's remaining days:
 *   - evenly (maximise the circular gap between sessions of the same habit),
 *   - preferring the habit's preferred weekdays,
 *   - balancing the daily load,
 *   - keeping hard habits off the same and adjacent days when possible.
 */

export interface PlannedSlot {
  habitId: ID;
  day: DayKey;
}

export function distributeWeek(
  habits: Habit[],
  week: DayKey[],
  logs: HabitLog[],
  today: DayKey,
): PlannedSlot[] {
  const active = habits.filter((h) => h.status === 'active' && !h.deletedAt);
  const live = logs.filter((l) => !l.deletedAt && week.includes(l.day));
  const openDays = week.filter((d) => diffDays(today, d) >= 0);
  const hardIds = new Set(active.filter((h) => h.hard).map((h) => h.id));

  // Current load per day and which habits sit on which day.
  const load = new Map<DayKey, number>(week.map((d) => [d, 0]));
  const hardOn = new Map<DayKey, number>(week.map((d) => [d, 0]));
  const habitDays = new Map<ID, Set<DayKey>>();
  for (const log of live) {
    load.set(log.day, (load.get(log.day) ?? 0) + 1);
    if (hardIds.has(log.habitId)) hardOn.set(log.day, (hardOn.get(log.day) ?? 0) + 1);
    const set = habitDays.get(log.habitId) ?? new Set<DayKey>();
    set.add(log.day);
    habitDays.set(log.habitId, set);
  }

  const result: PlannedSlot[] = [];
  // Place demanding habits first: hard ones, then higher targets.
  const ordered = [...active].sort(
    (a, b) => Number(b.hard) - Number(a.hard) || b.weeklyTarget - a.weeklyTarget || a.order - b.order,
  );

  for (const habit of ordered) {
    const chosen = habitDays.get(habit.id) ?? new Set<DayKey>();
    let remaining = Math.min(7, habit.weeklyTarget) - chosen.size;
    while (remaining > 0) {
      const candidates = openDays.filter((d) => !chosen.has(d));
      if (candidates.length === 0) break;
      let best: DayKey | null = null;
      let bestScore = -Infinity;
      for (const day of candidates) {
        const idx = week.indexOf(day);
        // Circular gap to the nearest existing session of this habit (7 = none yet).
        let gap = 7;
        for (const other of chosen) {
          const j = week.indexOf(other);
          const raw = Math.abs(idx - j);
          gap = Math.min(gap, raw, 7 - raw);
        }
        let score = gap * 3 - (load.get(day) ?? 0) * 2;
        if (habit.preferredDays.length > 0 && habit.preferredDays.includes(weekdayOf(day))) score += 10;
        if (habit.hard) {
          if ((hardOn.get(day) ?? 0) > 0) score -= 5;
          const prev = week[idx - 1];
          const next = week[idx + 1];
          if ((prev && (hardOn.get(prev) ?? 0) > 0) || (next && (hardOn.get(next) ?? 0) > 0)) score -= 3;
        }
        if (score > bestScore) {
          bestScore = score;
          best = day;
        }
      }
      if (!best) break;
      chosen.add(best);
      load.set(best, (load.get(best) ?? 0) + 1);
      if (habit.hard) hardOn.set(best, (hardOn.get(best) ?? 0) + 1);
      result.push({ habitId: habit.id, day: best });
      remaining -= 1;
    }
    habitDays.set(habit.id, chosen);
  }
  return result;
}

/** Planned vs target per habit for a week (shown above the planner). */
export function weeklyCoverage(habits: Habit[], week: DayKey[], logs: HabitLog[]) {
  const live = logs.filter((l) => !l.deletedAt && week.includes(l.day));
  return habits
    .filter((h) => h.status === 'active' && !h.deletedAt)
    .map((h) => {
      const mine = live.filter((l) => l.habitId === h.id);
      return {
        habit: h,
        planned: mine.length,
        done: mine.filter((l) => l.status === 'done').length,
        target: h.weeklyTarget,
      };
    });
}

export const logId = (habitId: ID, day: DayKey) => `${habitId}_${day}`;
