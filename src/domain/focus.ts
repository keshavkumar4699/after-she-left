import { addDays, diffDays } from './dates';
import type { DayKey, Habit, HabitLog, HabitLogStatus, ID, TimeWindow } from './types';

/**
 * The Habits tab shows only three habits: Previous, Current and Next. Everything else is
 * tucked behind one "All habits" button, so attention stays on what matters now.
 */

export interface FocusSlot {
  habit: Habit;
  day: DayKey;
  status: HabitLogStatus | 'unplanned';
}

export interface FocusSelection {
  previous: FocusSlot | null;
  current: FocusSlot | null;
  next: FocusSlot | null;
  /** All other active habits (for the "All habits" sheet). */
  others: Habit[];
  allDoneToday: boolean;
}

const WINDOW_RANK: Record<TimeWindow, number> = { morning: 0, afternoon: 1, evening: 2, anytime: 3 };

export function orderHabits(a: Habit, b: Habit): number {
  return WINDOW_RANK[a.timeWindow] - WINDOW_RANK[b.timeWindow] || a.order - b.order || a.createdAt - b.createdAt;
}

/** The day's plan, ordered by time window → stack order → creation. */
export function dayPlan(day: DayKey, habits: Map<ID, Habit>, logs: HabitLog[]): FocusSlot[] {
  return logs
    .filter((l) => l.day === day && !l.deletedAt)
    .map((l) => ({ log: l, habit: habits.get(l.habitId) }))
    .filter((x): x is { log: HabitLog; habit: Habit } => !!x.habit && x.habit.status === 'active' && !x.habit.deletedAt)
    .sort((x, y) => orderHabits(x.habit, y.habit))
    .map(({ log, habit }) => ({ habit, day, status: log.status }));
}

export function selectFocus(habitList: Habit[], logs: HabitLog[], today: DayKey): FocusSelection {
  const active = habitList.filter((h) => h.status === 'active' && !h.deletedAt).sort(orderHabits);
  const habits = new Map(active.map((h) => [h.id, h]));
  const liveLogs = logs.filter((l) => !l.deletedAt && habits.has(l.habitId));

  const todayPlan = dayPlan(today, habits, liveLogs);
  const pendingToday = todayPlan.filter((s) => s.status === 'planned');
  const allDoneToday = todayPlan.length > 0 && pendingToday.length === 0;

  // Upcoming planned slots: rest of today, then the next 6 days.
  const upcoming: FocusSlot[] = [...pendingToday];
  for (let i = 1; i <= 6; i++) {
    const day = addDays(today, i);
    upcoming.push(...dayPlan(day, habits, liveLogs).filter((s) => s.status === 'planned'));
  }

  // Completions in the last 7 days, most recent first.
  const doneLogs = liveLogs
    .filter((l) => l.status === 'done' && diffDays(l.day, today) >= 0 && diffDays(l.day, today) < 7)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0) || (a.day < b.day ? 1 : -1));

  let current: FocusSlot | null = upcoming[0] ?? null;
  // Next is the first upcoming slot of a *different* habit, so the three cards are distinct.
  let next: FocusSlot | null = upcoming.find((s) => s.habit.id !== current?.habit.id) ?? null;

  // Nothing planned at all: fall back to the habit order so the screen is never empty.
  if (!current && active.length > 0) {
    const recentlyDone = doneLogs[0]?.habitId;
    const candidates = [...active.filter((h) => h.id !== recentlyDone), ...active.filter((h) => h.id === recentlyDone)];
    current = candidates[0] ? { habit: candidates[0], day: today, status: 'unplanned' } : null;
    next = candidates[1] ? { habit: candidates[1], day: today, status: 'unplanned' } : null;
  }

  const taken = new Set([current?.habit.id, next?.habit.id].filter(Boolean) as ID[]);
  const lastDone = doneLogs.find((l) => !taken.has(l.habitId));
  const previous: FocusSlot | null = lastDone
    ? { habit: habits.get(lastDone.habitId)!, day: lastDone.day, status: 'done' }
    : null;

  const shown = new Set([previous?.habit.id, current?.habit.id, next?.habit.id].filter(Boolean) as ID[]);
  return {
    previous,
    current,
    next,
    others: active.filter((h) => !shown.has(h.id)),
    allDoneToday,
  };
}
