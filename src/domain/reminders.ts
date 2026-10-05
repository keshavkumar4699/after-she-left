import { addDays, dayKeyToDate, diffDays, isWithinWindow, lastNDays, minutesOf, toDayKey, weekdayOf } from './dates';
import { missedYesterday } from './progress';
import type { Quote } from './quotes';
import { hashString, mulberry32, shuffle } from './random';
import type { Circumstance, DayKey, Habit, HabitLog, Mistake, TimeOfDay } from './types';

/**
 * Reminder planner. Produces the full list of local notifications the device *should* have for
 * the next 7 days. The notification service reconciles the OS schedule to this list
 * (cancel + reschedule), so planning is idempotent and safe to run on every change.
 */

export type ReminderChannel = 'reminders' | 'prayer' | 'nudges' | 'review';

export type ReminderTrigger =
  | { type: 'daily'; hour: number; minute: number }
  /** weekday uses the OS convention: 1 = Sunday … 7 = Saturday. */
  | { type: 'weekly'; weekday: number; hour: number; minute: number }
  | { type: 'date'; at: number };

export interface DesiredNotification {
  id: string;
  channel: ReminderChannel;
  title: string;
  body: string;
  trigger: ReminderTrigger;
  category?: 'habit' | 'lesson';
  data: { route: string; kind: string; refId?: string };
}

export interface ReminderSettings {
  prayerTime: TimeOfDay;
  reviewTime: TimeOfDay;
  quietHours: { start: TimeOfDay; end: TimeOfDay };
  activeHours: { start: TimeOfDay; end: TimeOfDay };
  privacy: boolean;
  enabled: {
    circumstances: boolean;
    prayer: boolean;
    nudges: boolean;
    review: boolean;
    planning: boolean;
    neverMissTwice: boolean;
  };
}

export interface ReminderInput {
  settings: ReminderSettings;
  circumstances: Circumstance[];
  mistakes: Mistake[];
  habits: Habit[];
  logs: HabitLog[];
  quotes: Quote[];
  /** Per-install seed so quote cycles differ between users but stay stable on one device. */
  seed: number;
  scheduledCircumstanceLimit: number;
  now: Date;
  horizonDays?: number;
}

const NUDGES_PER_WEEK = 4;
const NEVER_MISS_TWICE_AT: TimeOfDay = { hour: 19, minute: 30 };
const PLANNING_AT = { weekday: 1, hour: 19, minute: 0 }; // Sunday 7 PM

/** Day number since epoch, used to walk the quote cycle one step per day. */
function dayNumber(day: DayKey): number {
  return diffDays('1970-01-01', day);
}

/**
 * A quote per day from a seeded permutation of the library, walked one step per day: any given
 * quote comes back only after the whole library has been used (≈ 4 months with 120 quotes).
 */
export function quoteForDay(quotes: Quote[], seed: number, day: DayKey): Quote | null {
  if (quotes.length === 0) return null;
  const order = shuffle(quotes, mulberry32(seed ^ hashString('quote-cycle')));
  return order[((dayNumber(day) % quotes.length) + quotes.length) % quotes.length];
}

function inQuiet(t: TimeOfDay, s: ReminderSettings) {
  return isWithinWindow(t, s.quietHours.start, s.quietHours.end);
}

/** A deterministic time inside the active hours (5-minute steps), avoiding quiet hours. */
function nudgeTime(day: DayKey, seed: number, s: ReminderSettings): TimeOfDay | null {
  const start = minutesOf(s.activeHours.start);
  let end = minutesOf(s.activeHours.end);
  if (end <= start) end += 24 * 60;
  const rand = mulberry32(seed ^ hashString(`nudge-time:${day}`));
  for (let attempt = 0; attempt < 6; attempt++) {
    const m = (start + Math.floor((rand() * (end - start)) / 5) * 5) % (24 * 60);
    const t = { hour: Math.floor(m / 60), minute: m % 60 };
    if (!inQuiet(t, s)) return t;
  }
  return null;
}

export function planNotifications(input: ReminderInput): DesiredNotification[] {
  const { settings: s, now, seed } = input;
  const horizon = input.horizonDays ?? 7;
  const today = toDayKey(now);
  const days = lastNDays(addDays(today, horizon - 1), horizon); // today … today+horizon-1
  const out: DesiredNotification[] = [];
  const at = (day: DayKey, t: TimeOfDay) => dayKeyToDate(day, t).getTime();

  // 1. Morning prayer (neutral text by design).
  if (s.enabled.prayer) {
    out.push({
      id: 'prayer',
      channel: 'prayer',
      title: 'Your morning prayer is ready',
      body: 'Take one minute to set your intention for today.',
      trigger: { type: 'daily', ...s.prayerTime },
      data: { route: '/prayer', kind: 'prayer' },
    });
  }

  // 2. Scheduled circumstances (free tier: only the first N).
  if (s.enabled.circumstances) {
    const scheduled = input.circumstances
      .filter((c) => !c.deletedAt && !c.paused && c.schedule)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, input.scheduledCircumstanceLimit);
    for (const c of scheduled) {
      const lesson = input.mistakes
        .filter((m) => !m.deletedAt && !m.paused && m.status !== 'archived' && m.circumstanceIds.includes(c.id))
        .sort((a, b) => b.severity - a.severity)[0];
      const title = s.privacy ? 'A gentle reminder' : c.name;
      const body = s.privacy
        ? 'Tap to see your lesson for this moment.'
        : lesson
          ? `If ${lesson.solution.ifThen.if}, then ${lesson.solution.ifThen.then}.`
          : 'Pause. Remember what you learned.';
      const weekdays = c.schedule!.weekdays.length ? c.schedule!.weekdays : [0, 1, 2, 3, 4, 5, 6];
      for (const wd of weekdays) {
        out.push({
          id: `circ:${c.id}:${wd}`,
          channel: 'reminders',
          title,
          body,
          category: 'lesson',
          trigger: { type: 'weekly', weekday: wd + 1, hour: c.schedule!.time.hour, minute: c.schedule!.time.minute },
          data: { route: `/checkin?circumstance=${c.id}`, kind: 'circumstance', refId: c.id },
        });
      }
    }
  }

  // 3. Spaced-review digest: one notification on days with lessons due.
  if (s.enabled.review) {
    const reviewable = input.mistakes.filter((m) => !m.deletedAt && !m.paused && m.status !== 'archived');
    for (const day of days) {
      const due = reviewable.filter((m) => diffDays(m.review.nextReviewOn, day) >= 0).length;
      const when = at(day, s.reviewTime);
      if (due === 0 || when <= now.getTime()) continue;
      out.push({
        id: `review:${day}`,
        channel: 'review',
        title: s.privacy ? 'Time to reflect' : `${due} lesson${due > 1 ? 's' : ''} to review`,
        body: 'Two minutes of review keeps the lesson alive.',
        trigger: { type: 'date', at: when },
        data: { route: '/review', kind: 'review' },
      });
    }
  }

  // 4. Weekly planning, Sunday evening.
  if (s.enabled.planning) {
    out.push({
      id: 'planning',
      channel: 'reminders',
      title: 'Plan your week',
      body: 'Spread your habits across the week. Timing is flexible; showing up is not.',
      trigger: { type: 'weekly', ...PLANNING_AT },
      data: { route: '/planner', kind: 'planning' },
    });
  }

  // 5. Quote nudges: about 4 per week, only on days with habits planned.
  const activeHabits = new Map(input.habits.filter((h) => !h.deletedAt && h.status === 'active').map((h) => [h.id, h]));
  if (s.enabled.nudges && input.quotes.length > 0) {
    for (const day of days) {
      const planned = input.logs.filter(
        (l) => !l.deletedAt && l.day === day && l.status === 'planned' && activeHabits.has(l.habitId),
      );
      if (planned.length === 0) continue;
      const roll = mulberry32(seed ^ hashString(`nudge-day:${day}`))();
      if (roll >= NUDGES_PER_WEEK / 7) continue;
      const time = nudgeTime(day, seed, s);
      if (!time || at(day, time) <= now.getTime()) continue;
      const quote = quoteForDay(input.quotes, seed, day)!;
      const habit = activeHabits.get(planned[0].habitId)!;
      out.push({
        id: `nudge:${day}`,
        channel: 'nudges',
        title: s.privacy ? 'A small step today' : `${habit.emoji} ${habit.name}: ${habit.twoMinute || 'show up today'}`,
        body: `“${quote.text}”${quote.author ? ` · ${quote.author}` : ''}`,
        category: 'habit',
        trigger: { type: 'date', at: at(day, time) },
        data: { route: '/(tabs)/habits', kind: 'nudge', refId: habit.id },
      });
    }
  }

  // 6. Never miss twice: tonight, if a habit was missed yesterday and is still not done today.
  if (s.enabled.neverMissTwice) {
    const missed = missedYesterday([...activeHabits.values()], input.logs, today);
    const doneToday = new Set(input.logs.filter((l) => l.day === today && l.status === 'done').map((l) => l.habitId));
    const stillOpen = missed.filter((h) => !doneToday.has(h.id));
    const when = at(today, NEVER_MISS_TWICE_AT);
    if (stillOpen.length > 0 && when > now.getTime() && !inQuiet(NEVER_MISS_TWICE_AT, s)) {
      out.push({
        id: `nmt:${today}`,
        channel: 'nudges',
        title: 'Never miss twice',
        body: s.privacy
          ? 'One small step today keeps the chain alive.'
          : `You missed ${stillOpen[0].name.toLowerCase()} yesterday. Two minutes today keeps the chain alive.`,
        category: 'habit',
        trigger: { type: 'date', at: when },
        data: { route: '/', kind: 'never-miss-twice', refId: stillOpen[0].id },
      });
    }
  }

  return out;
}

export const weekdayToOs = (weekday: number) => weekday + 1;
export const todayWeekday = (now: Date) => weekdayOf(toDayKey(now));
