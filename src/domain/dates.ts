import type { DayKey, TimeOfDay } from './types';

/**
 * Calendar helpers built on local `DayKey` strings (`YYYY-MM-DD`). Day arithmetic goes through
 * UTC so it is immune to DST transitions; only `toDayKey` reads the local clock.
 */

const MS_PER_DAY = 86_400_000;

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
export const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
export const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const pad = (n: number) => String(n).padStart(2, '0');

export function makeDayKey(year: number, month: number, day: number): DayKey {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Local calendar day of a Date (or now). */
export function toDayKey(date: Date = new Date()): DayKey {
  return makeDayKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function parseDayKey(key: DayKey): { year: number; month: number; day: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { year: y, month: m, day: d };
}

function toUtcMs(key: DayKey): number {
  const { year, month, day } = parseDayKey(key);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMs(ms: number): DayKey {
  const d = new Date(ms);
  return makeDayKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Local midnight of a day key, as a Date. */
export function dayKeyToDate(key: DayKey, time: TimeOfDay = { hour: 0, minute: 0 }): Date {
  const { year, month, day } = parseDayKey(key);
  return new Date(year, month - 1, day, time.hour, time.minute, 0, 0);
}

export function addDays(key: DayKey, n: number): DayKey {
  return fromUtcMs(toUtcMs(key) + n * MS_PER_DAY);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: DayKey, b: DayKey): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / MS_PER_DAY);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(key: DayKey): number {
  return new Date(toUtcMs(key)).getUTCDay();
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** True only for dates that exist on the calendar (29 Feb only in leap years). */
export function isValidDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

export function isValidDayKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const { year, month, day } = parseDayKey(key);
  return isValidDate(year, month, day);
}

/** The `n` days ending today, oldest first: [today-(n-1) … today]. */
export function lastNDays(today: DayKey, n: number): DayKey[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}

export function startOfWeek(key: DayKey, weekStartsOn: 0 | 1 = 1): DayKey {
  const offset = (weekdayOf(key) - weekStartsOn + 7) % 7;
  return addDays(key, -offset);
}

export function weekDays(key: DayKey, weekStartsOn: 0 | 1 = 1): DayKey[] {
  const start = startOfWeek(key, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** ISO-8601 week id, e.g. `2026-W41`. Used for weekly quotas. */
export function isoWeekKey(key: DayKey): string {
  const ms = toUtcMs(key);
  const d = new Date(ms);
  const dayNum = (d.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(ms + (3 - dayNum) * MS_PER_DAY);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  const week = Math.floor((thursday.getTime() - yearStart) / MS_PER_DAY / 7) + 1;
  return `${thursday.getUTCFullYear()}-W${pad(week)}`;
}

/**
 * Month grid for a calendar view: rows of 7 cells, `null` for padding cells outside the month.
 */
export function monthMatrix(year: number, month: number, weekStartsOn: 0 | 1 = 1): (DayKey | null)[][] {
  const first = makeDayKey(year, month, 1);
  const lead = (weekdayOf(first) - weekStartsOn + 7) % 7;
  const total = daysInMonth(year, month);
  const cells: (DayKey | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => makeDayKey(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (DayKey | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/* ------------------------------------------------------------------------------------------ */
/* Formatting                                                                                 */
/* ------------------------------------------------------------------------------------------ */

/** "Today", "Yest.", "Tmrw" or the short weekday. */
export function relativeDayLabel(key: DayKey, today: DayKey, short = true): string {
  const delta = diffDays(today, key);
  if (delta === 0) return 'Today';
  if (delta === -1) return short ? 'Yest.' : 'Yesterday';
  if (delta === 1) return short ? 'Tmrw' : 'Tomorrow';
  return short ? WEEKDAY_SHORT[weekdayOf(key)] : WEEKDAY_LONG[weekdayOf(key)];
}

/** "5 Oct", "5 Oct 2027" (year shown when different from `refYear`). */
export function formatDay(key: DayKey, opts: { withYear?: boolean; withWeekday?: boolean } = {}): string {
  const { year, month, day } = parseDayKey(key);
  const parts = [`${day} ${MONTH_SHORT[month - 1]}`];
  if (opts.withYear) parts.push(String(year));
  const text = parts.join(' ');
  return opts.withWeekday ? `${WEEKDAY_SHORT[weekdayOf(key)]}, ${text}` : text;
}

export function formatLongDay(key: DayKey): string {
  const { year, month, day } = parseDayKey(key);
  return `${WEEKDAY_LONG[weekdayOf(key)]}, ${day} ${MONTH_LONG[month - 1]} ${year}`;
}

export function formatTime(t: TimeOfDay, use24h = false): string {
  if (use24h) return `${pad(t.hour)}:${pad(t.minute)}`;
  const suffix = t.hour < 12 ? 'AM' : 'PM';
  const h = t.hour % 12 === 0 ? 12 : t.hour % 12;
  return `${h}:${pad(t.minute)} ${suffix}`;
}

export function minutesOf(t: TimeOfDay): number {
  return t.hour * 60 + t.minute;
}

/** True when `t` falls in [start, end), supporting windows that wrap midnight (22:00–07:00). */
export function isWithinWindow(t: TimeOfDay, start: TimeOfDay, end: TimeOfDay): boolean {
  const m = minutesOf(t);
  const s = minutesOf(start);
  const e = minutesOf(end);
  if (s === e) return false;
  return s < e ? m >= s && m < e : m >= s || m < e;
}

export function greetingFor(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
