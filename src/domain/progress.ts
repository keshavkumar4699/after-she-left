import { addDays, diffDays, lastNDays, relativeDayLabel } from './dates';
import type { DayKey, Habit, HabitLog, ID } from './types';

/**
 * Progress maths for the rings. Every ring in the app shows a rolling window of the
 * **last 7 days** (6 days ago … today), never a calendar week.
 */

export interface DayProgress {
  day: DayKey;
  label: string;
  done: number;
  planned: number;
  /** done / planned, 0 when nothing was planned. */
  ratio: number;
  isToday: boolean;
  /** Nothing planned: shown as a grey "rest" ring. */
  isRest: boolean;
}

const isLive = (log: HabitLog) => !log.deletedAt;

/** Index logs by day for quick lookups. */
export function logsByDay(logs: Iterable<HabitLog>): Map<DayKey, HabitLog[]> {
  const map = new Map<DayKey, HabitLog[]>();
  for (const log of logs) {
    if (!isLive(log)) continue;
    const list = map.get(log.day);
    if (list) list.push(log);
    else map.set(log.day, [log]);
  }
  return map;
}

/** Progress for one day across all counted habits. */
export function dayProgress(
  day: DayKey,
  logs: HabitLog[] | undefined,
  today: DayKey,
  countedHabitIds?: Set<ID>,
): DayProgress {
  const relevant = (logs ?? []).filter((l) => isLive(l) && (!countedHabitIds || countedHabitIds.has(l.habitId)));
  const planned = relevant.length;
  const done = relevant.filter((l) => l.status === 'done').length;
  return {
    day,
    label: relativeDayLabel(day, today),
    done,
    planned,
    ratio: planned === 0 ? 0 : done / planned,
    isToday: day === today,
    isRest: planned === 0,
  };
}

/** The dashboard rings: 7 entries, oldest first, ending today. */
export function last7DaysProgress(
  logs: Iterable<HabitLog>,
  today: DayKey,
  countedHabitIds?: Set<ID>,
): DayProgress[] {
  const byDay = logsByDay(logs);
  return lastNDays(today, 7).map((day) => dayProgress(day, byDay.get(day), today, countedHabitIds));
}

export interface WindowSummary {
  done: number;
  planned: number;
  ratio: number;
}

export function summarize(days: DayProgress[]): WindowSummary {
  const done = days.reduce((s, d) => s + d.done, 0);
  const planned = days.reduce((s, d) => s + d.planned, 0);
  return { done, planned, ratio: planned === 0 ? 0 : done / planned };
}

/** Last 7 days vs the 7 days before (the "compete with yourself" number). */
export function weekOverWeek(logs: HabitLog[], today: DayKey, countedHabitIds?: Set<ID>) {
  const current = summarize(last7DaysProgress(logs, today, countedHabitIds));
  const previous = summarize(last7DaysProgress(logs, addDays(today, -7), countedHabitIds));
  return { current, previous, deltaDone: current.done - previous.done, deltaRatio: current.ratio - previous.ratio };
}

/* ------------------------------------------------------------------------------------------ */
/* Per-habit                                                                                  */
/* ------------------------------------------------------------------------------------------ */

export type CellState = 'done' | 'missed' | 'pending' | 'skipped' | 'rest';

export interface HabitDayCell {
  day: DayKey;
  label: string;
  state: CellState;
}

export function cellState(log: HabitLog | undefined, day: DayKey, today: DayKey): CellState {
  if (!log || log.deletedAt) return 'rest';
  if (log.status === 'done') return 'done';
  if (log.status === 'skipped') return 'skipped';
  return diffDays(today, day) < 0 ? 'missed' : 'pending';
}

export function logsForHabit(logs: Iterable<HabitLog>, habitId: ID): Map<DayKey, HabitLog> {
  const map = new Map<DayKey, HabitLog>();
  for (const log of logs) if (log.habitId === habitId && !log.deletedAt) map.set(log.day, log);
  return map;
}

export interface HabitStats {
  cells: HabitDayCell[];
  /** Planned days in the last 7 that were completed. */
  done7: number;
  planned7: number;
  ratio7: number;
  /** Consecutive planned days completed (rest days don't break a streak). */
  streak: number;
  bestStreak: number;
  totalDone: number;
}

export function habitStats(habitLogs: Map<DayKey, HabitLog>, today: DayKey): HabitStats {
  const cells = lastNDays(today, 7).map((day) => ({
    day,
    label: relativeDayLabel(day, today),
    state: cellState(habitLogs.get(day), day, today),
  }));
  const planned7 = cells.filter((c) => c.state !== 'rest').length;
  const done7 = cells.filter((c) => c.state === 'done').length;

  // Streaks over all planned days, oldest → newest.
  const planned = [...habitLogs.values()]
    .filter((l) => !l.deletedAt && l.status !== 'skipped' && diffDays(l.day, today) >= 0)
    .sort((a, b) => (a.day < b.day ? -1 : 1));
  let run = 0;
  let best = 0;
  for (const log of planned) {
    if (log.status === 'done') {
      run += 1;
      best = Math.max(best, run);
    } else if (log.day !== today) {
      run = 0; // a pending log today doesn't break the streak yet
    }
  }
  return {
    cells,
    done7,
    planned7,
    ratio7: planned7 === 0 ? 0 : done7 / planned7,
    streak: run,
    bestStreak: best,
    totalDone: planned.filter((l) => l.status === 'done').length,
  };
}

/** How many times a habit is planned/done in a set of days (for weekly targets). */
export function countInDays(habitLogs: Map<DayKey, HabitLog>, days: DayKey[]) {
  let planned = 0;
  let done = 0;
  for (const day of days) {
    const log = habitLogs.get(day);
    if (!log || log.deletedAt) continue;
    planned += 1;
    if (log.status === 'done') done += 1;
  }
  return { planned, done };
}

/** Habits that were planned yesterday but not done ("never miss twice"). */
export function missedYesterday(habits: Habit[], logs: Iterable<HabitLog>, today: DayKey): Habit[] {
  const yesterday = addDays(today, -1);
  const missedIds = new Set<ID>();
  for (const log of logs) {
    if (log.day === yesterday && !log.deletedAt && log.status === 'planned') missedIds.add(log.habitId);
  }
  return habits.filter((h) => missedIds.has(h.id) && h.status === 'active' && !h.deletedAt);
}
