import { addDays, diffDays, lastNDays } from './dates';
import type { DayKey, Habit, HabitLog } from './types';

/**
 * Atomic Habits coaching rules:
 *  - Beginner mode: start tiny (two-minute versions, max 3 habits) and build consistency first.
 *  - Goldilocks rule: keep each habit between too easy and too hard, so it stays exciting.
 */

export const BEGINNER_DAYS = 21;
export const BEGINNER_MAX_HABITS = 3;
export const UNLOCK_AFTER_DAYS = 14;
export const UNLOCK_CONSISTENCY = 0.8;

export interface BeginnerStatus {
  active: boolean;
  dayNumber: number;
  daysLeft: number;
  consistency: number;
  maxHabits: number;
  /** Reason shown when beginner mode just ended. */
  graduatedBy?: 'time' | 'consistency';
}

/** Share of planned habit-days completed in the last `days` days (excluding today). */
export function consistency(logs: HabitLog[], today: DayKey, days = 14): number {
  const window = new Set(lastNDays(addDays(today, -1), days));
  const relevant = logs.filter((l) => !l.deletedAt && window.has(l.day) && l.status !== 'skipped');
  if (relevant.length === 0) return 0;
  return relevant.filter((l) => l.status === 'done').length / relevant.length;
}

export function beginnerStatus(
  enabled: boolean,
  startedOn: DayKey,
  logs: HabitLog[],
  today: DayKey,
): BeginnerStatus {
  const elapsed = Math.max(0, diffDays(startedOn, today));
  const rate = consistency(logs, today);
  const byTime = elapsed >= BEGINNER_DAYS;
  const byConsistency = elapsed >= UNLOCK_AFTER_DAYS && rate >= UNLOCK_CONSISTENCY;
  const active = enabled && !byTime && !byConsistency;
  return {
    active,
    dayNumber: Math.min(elapsed + 1, BEGINNER_DAYS),
    daysLeft: Math.max(0, BEGINNER_DAYS - elapsed),
    consistency: rate,
    maxHabits: active ? BEGINNER_MAX_HABITS : Number.POSITIVE_INFINITY,
    graduatedBy: !enabled ? undefined : byConsistency ? 'consistency' : byTime ? 'time' : undefined,
  };
}

export type SuggestionKind = 'level-up' | 'scale-down' | 'keep';

export interface DifficultySuggestion {
  kind: SuggestionKind;
  completion: number;
  easyShare: number;
  hardShare: number;
  sample: number;
  message: string;
}

/**
 * Goldilocks rule over the last 14 days:
 *  - ≥80% done and mostly "too easy" → level up a little (+5–10%).
 *  - <50% done or mostly "too hard"  → scale down.
 */
export function difficultySuggestion(habit: Habit, logs: HabitLog[], today: DayKey): DifficultySuggestion {
  const window = new Set(lastNDays(today, 14));
  const mine = logs.filter(
    (l) => l.habitId === habit.id && !l.deletedAt && window.has(l.day) && (l.day !== today || l.status === 'done'),
  );
  const planned = mine.filter((l) => l.status !== 'skipped');
  const done = planned.filter((l) => l.status === 'done');
  const rated = done.filter((l) => l.difficulty);
  const easyShare = rated.length ? rated.filter((l) => l.difficulty === 'easy').length / rated.length : 0;
  const hardShare = rated.length ? rated.filter((l) => l.difficulty === 'hard').length / rated.length : 0;
  const completion = planned.length ? done.length / planned.length : 0;

  const base = { completion, easyShare, hardShare, sample: planned.length };
  if (planned.length < 4) {
    return { ...base, kind: 'keep', message: 'Keep showing up. We will tune the difficulty after a few sessions.' };
  }
  if (completion >= 0.8 && easyShare >= 0.6) {
    return {
      ...base,
      kind: 'level-up',
      message: `${habit.name} looks too easy. Make it a little harder so it stays exciting.`,
    };
  }
  if (completion < 0.5 || hardShare >= 0.5) {
    return {
      ...base,
      kind: 'scale-down',
      message: `${habit.name} feels heavy. Shrink it until showing up is easy again.`,
    };
  }
  return { ...base, kind: 'keep', message: `${habit.name} is in the sweet spot: hard enough to matter, easy enough to do.` };
}

/**
 * Scale the numbers in a habit description: "20 pushups" → "22 pushups" (+10%).
 * Always moves by at least 1 so a level-up is visible.
 */
export function scaleNumbers(text: string, factor: number): string {
  return text.replace(/\d+(\.\d+)?/g, (match) => {
    const n = Number(match);
    if (!Number.isFinite(n) || n === 0) return match;
    let next = Math.round(n * factor);
    if (factor > 1 && next <= n) next = n + 1;
    if (factor < 1 && next >= n) next = Math.max(1, n - 1);
    return String(Math.max(1, next));
  });
}
