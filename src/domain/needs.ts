import { addDays, diffDays, weekdayOf } from './dates';
import { habitStats, logsForHabit, missedYesterday } from './progress';
import type {
  Checkin,
  Circumstance,
  DayKey,
  FocusTheme,
  Goal,
  Habit,
  HabitLog,
  Mistake,
  Mood,
} from './types';

/**
 * Needs analyzer: reads recent records and decides what kind of prayer the user needs today.
 * Deterministic and explainable: every theme score comes from a named signal.
 */

export interface NeedsInput {
  mistakes: Mistake[];
  checkins: Checkin[];
  circumstances: Circumstance[];
  habits: Habit[];
  logs: HabitLog[];
  goals: Goal[];
  mood?: Mood | null;
  today: DayKey;
}

export interface Signal {
  theme: FocusTheme;
  weight: number;
  reason: string;
}

export interface Needs {
  theme: FocusTheme;
  scores: Record<FocusTheme, number>;
  signals: Signal[];
  topLessons: Mistake[];
  circumstancesToday: Circumstance[];
  missedYesterday: Habit[];
  plannedToday: Habit[];
  activeGoals: Goal[];
  streakWins: { habit: Habit; streak: number }[];
}

/** Tie-break order: protect first, then build, then celebrate. */
const PRIORITY: FocusTheme[] = ['resist', 'discipline', 'forgiveness', 'courage', 'purpose', 'gratitude'];

const MOOD_SIGNALS: Record<Mood, Signal[]> = {
  low: [{ theme: 'forgiveness', weight: 3, reason: 'You said you feel low' }],
  anxious: [{ theme: 'courage', weight: 3, reason: 'You said you feel anxious' }],
  lonely: [
    { theme: 'resist', weight: 2, reason: 'Loneliness is a common trigger' },
    { theme: 'forgiveness', weight: 1, reason: 'You said you feel lonely' },
  ],
  angry: [{ theme: 'resist', weight: 2, reason: 'Anger makes old mistakes tempting' }],
  motivated: [{ theme: 'purpose', weight: 2, reason: 'You feel motivated: aim it' }],
  calm: [{ theme: 'gratitude', weight: 1, reason: 'A calm morning' }],
};

export function analyzeNeeds(input: NeedsInput): Needs {
  const { today } = input;
  const signals: Signal[] = [];
  const mistakes = input.mistakes.filter((m) => !m.deletedAt && !m.paused && m.status !== 'archived');
  const habits = input.habits.filter((h) => !h.deletedAt && h.status === 'active');
  const circumstances = input.circumstances.filter((c) => !c.deletedAt && !c.paused);

  // 1. Mistakes repeated in the last 14 days.
  const recentRepeats = input.checkins.filter(
    (c) => !c.deletedAt && c.outcome === 'repeated' && diffDays(c.on, today) >= 0 && diffDays(c.on, today) < 14,
  );
  if (recentRepeats.length > 0) {
    signals.push({
      theme: 'resist',
      weight: Math.min(9, 3 * recentRepeats.length),
      reason: `${recentRepeats.length} slip${recentRepeats.length > 1 ? 's' : ''} in the last 2 weeks`,
    });
    signals.push({ theme: 'forgiveness', weight: 1, reason: 'Slips need self-forgiveness too' });
  }

  // 2. Circumstances scheduled for today's weekday.
  const weekday = weekdayOf(today);
  const circumstancesToday = circumstances.filter(
    (c) => c.schedule && (c.schedule.weekdays.length === 0 || c.schedule.weekdays.includes(weekday)),
  );
  if (circumstancesToday.length > 0) {
    signals.push({
      theme: 'resist',
      weight: 2 * circumstancesToday.length,
      reason: `Today has ${circumstancesToday.map((c) => c.name).join(', ')}`,
    });
  }

  // 3. Habits missed yesterday → never miss twice.
  const missed = missedYesterday(habits, input.logs, today);
  if (missed.length > 0) {
    signals.push({
      theme: 'discipline',
      weight: 2 * missed.length,
      reason: `Missed yesterday: ${missed.map((h) => h.name).join(', ')}`,
    });
  }

  // 4. Streak wins → gratitude.
  const streakWins = habits
    .map((habit) => ({ habit, streak: habitStats(logsForHabit(input.logs, habit.id), today).streak }))
    .filter((s) => s.streak >= 5)
    .sort((a, b) => b.streak - a.streak);
  if (streakWins.length > 0) {
    signals.push({ theme: 'gratitude', weight: 2, reason: `${streakWins[0].habit.name}: ${streakWins[0].streak} in a row` });
  }

  // 5. Goals with something due soon → purpose.
  const activeGoals = input.goals.filter((g) => !g.deletedAt && g.status === 'active');
  const goalsNear = activeGoals.filter(
    (g) =>
      diffDays(today, g.targetDate) <= 60 ||
      g.milestones.some((m) => !m.done && m.dueOn && diffDays(today, m.dueOn) >= 0 && diffDays(today, m.dueOn) <= 14),
  );
  if (goalsNear.length > 0) {
    signals.push({ theme: 'purpose', weight: 2, reason: `${goalsNear[0].title} is getting close` });
  }

  // 6. Mood check-in.
  if (input.mood) signals.push(...MOOD_SIGNALS[input.mood]);

  // Baseline: purpose is always present.
  signals.push({ theme: 'purpose', weight: 1, reason: 'Remember why you started' });

  const scores = Object.fromEntries(PRIORITY.map((t) => [t, 0])) as Record<FocusTheme, number>;
  for (const s of signals) scores[s.theme] += s.weight;
  const theme = PRIORITY.reduce((best, t) => (scores[t] > scores[best] ? t : best), PRIORITY[0]);

  // Lessons that matter most today.
  const todayCircIds = new Set(circumstancesToday.map((c) => c.id));
  const repeatedIds = new Set(recentRepeats.flatMap((c) => c.mistakeIds));
  const topLessons = [...mistakes]
    .sort(
      (a, b) =>
        Number(repeatedIds.has(b.id)) - Number(repeatedIds.has(a.id)) ||
        Number(b.circumstanceIds.some((id) => todayCircIds.has(id))) -
          Number(a.circumstanceIds.some((id) => todayCircIds.has(id))) ||
        Number(b.status === 'active') - Number(a.status === 'active') ||
        b.severity - a.severity ||
        b.updatedAt - a.updatedAt,
    )
    .slice(0, 3);

  const plannedTodayIds = new Set(
    input.logs.filter((l) => !l.deletedAt && l.day === today).map((l) => l.habitId),
  );

  return {
    theme,
    scores,
    signals: signals.sort((a, b) => b.weight - a.weight),
    topLessons,
    circumstancesToday,
    missedYesterday: missed,
    plannedToday: habits.filter((h) => plannedTodayIds.has(h.id)),
    activeGoals,
    streakWins,
  };
}

export const THEME_LABELS: Record<FocusTheme, string> = {
  resist: 'Strength to resist',
  discipline: 'Discipline',
  forgiveness: 'Self-forgiveness',
  courage: 'Courage',
  purpose: 'Purpose',
  gratitude: 'Gratitude',
};

/** Compact, privacy-minimal context sent to the AI prayer function. */
export interface PrayerContext {
  day: DayKey;
  theme: FocusTheme;
  style: 'secular' | 'spiritual' | 'faith';
  addressee?: string;
  name?: string;
  mood?: Mood | null;
  lessons: { ifThen: string; dont: string }[];
  goals: string[];
  habitsToday: string[];
  recentOpenings: string[];
}

export function buildPrayerContext(
  needs: Needs,
  opts: {
    day: DayKey;
    style: PrayerContext['style'];
    addressee?: string;
    name?: string;
    mood?: Mood | null;
    recentOpenings: string[];
  },
): PrayerContext {
  return {
    day: opts.day,
    theme: needs.theme,
    style: opts.style,
    addressee: opts.addressee?.slice(0, 40),
    name: opts.name?.slice(0, 40),
    mood: opts.mood ?? null,
    lessons: needs.topLessons.map((m) => ({
      ifThen: `If ${m.solution.ifThen.if}, then ${m.solution.ifThen.then}`.slice(0, 220),
      dont: m.solution.dont.slice(0, 140),
    })),
    goals: needs.activeGoals.slice(0, 3).map((g) => (g.affirmation || g.title).slice(0, 200)),
    habitsToday: needs.plannedToday.slice(0, 6).map((h) => h.name.slice(0, 60)),
    recentOpenings: opts.recentOpenings.slice(0, 7).map((s) => s.slice(0, 120)),
  };
}

export const yesterdayOf = (day: DayKey) => addDays(day, -1);
