import { hashString, mulberry32, pick } from './random';
import type { Needs } from './needs';
import type { FocusTheme, Habit, PrayerContent, PrayerStyle } from './types';

/**
 * Template prayer composer: the offline fallback when the AI prayer is unavailable or out of
 * quota. Deterministic per day + theme, varied in wording, and built from the user's records.
 */

const TITLES: Record<FocusTheme, string[]> = {
  resist: ['Stronger than the old pull', 'I choose who I become', 'Steady hands, clear mind', 'Not today, not again'],
  discipline: ['Never miss twice', 'Small promises, kept', 'Show up, even small', 'The quiet work counts'],
  forgiveness: ['Gentle, not giving up', 'I begin again', 'Kind to myself, firm with my habits', 'A clean page'],
  courage: ['Brave enough to begin', 'One step through the fear', 'Calm in the storm', 'I can do hard things'],
  purpose: ['Living on purpose', 'Already becoming', 'Eyes on the horizon', 'Why I rise'],
  gratitude: ['Thankful for the climb', 'Look how far I came', 'Grateful and growing', 'Proof that I can'],
};

const THEME_LINES: Record<FocusTheme, string[]> = {
  resist: [
    'The old pull will come today, and I will recognise it for what it is: a feeling, not a command.',
    'I know my triggers now. When they show up, I will pause, breathe, and choose the person I am becoming.',
    'Today I protect my peace. I will not trade a lifetime of growth for a moment of relief.',
  ],
  discipline: [
    'Missing once is an accident; missing twice is a new habit. Today I get back on track.',
    'I do not need motivation to begin. I need the next small step, and I will take it.',
    'My habits are votes for the person I want to be. Today I cast them on purpose.',
  ],
  forgiveness: [
    'I made mistakes, and I am more than them. I learn, I forgive myself, and I keep walking.',
    'Yesterday does not define me. Today I start again with a lighter heart and a clearer plan.',
    'I speak to myself the way I would speak to a friend who is trying: honest, kind and hopeful.',
  ],
  courage: [
    'Fear is a sign that I am growing. I will feel it and take the step anyway.',
    'I do not have to see the whole staircase. I only have to climb the step in front of me.',
    'I breathe slowly, I stay present, and I act from strength instead of worry.',
  ],
  purpose: [
    'I remember why I started. Every small action today is a brick in the life I am building.',
    'My future is not a wish. It is the sum of what I repeat, and today I repeat what matters.',
    'I live today as the person who has already reached the goal: calm, focused and consistent.',
  ],
  gratitude: [
    'I am grateful for how far I have come. The streak is proof that I can trust myself again.',
    'Today I notice the progress, not only the distance. Small wins are still wins.',
    'Thank you for the strength I have found. I will use it well today.',
  ],
};

const OPENINGS: Record<PrayerStyle, string[]> = {
  secular: ['This morning I remind myself who I am becoming.', 'Today begins with a choice, and I choose growth.', 'I take a slow breath and set my intention for today.'],
  spiritual: ['To the Universe that holds me,', 'Dear God, Source of all good,', 'To the light that guides me,'],
  faith: ['Dear {addressee},', '{addressee}, I come to you this morning.', 'Thank you, {addressee}, for this new day.'],
};

const CLOSINGS: Record<PrayerStyle, string[]> = {
  secular: ['I am ready. Let today count.', 'One day at a time, one choice at a time.', 'I keep my promises to myself today.'],
  spiritual: ['Guide my steps today, and let me walk them with patience.', 'May I live this day with strength and grace.', 'Hold me steady today. I am ready.'],
  faith: ['Give me strength for today, {addressee}. I trust you.', 'Walk with me today, {addressee}.', 'With your help, {addressee}, I begin.'],
};

const PURPOSE_DEFAULTS = [
  'Become someone my future self will thank.',
  'Grow quietly, consistently and with self-respect.',
  'Turn every lesson into a better tomorrow.',
];

/** Lower-case the first letter, except the pronoun "I" ("I feel…", "I'm…"). */
function lowerFirst(s: string): string {
  if (!s || /^I([\s'’]|$)/.test(s)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function trimDot(s: string): string {
  return s.trim().replace(/[.!\s]+$/, '');
}

function listToText(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export interface TemplateOptions {
  day: string;
  style: PrayerStyle;
  addressee?: string;
}

export function composeTemplatePrayer(needs: Needs, opts: TemplateOptions, salt = 0): PrayerContent {
  const rand = mulberry32(hashString(`${opts.day}:${needs.theme}:${salt}`));
  const addressee = opts.addressee?.trim() || 'God';
  const fill = (s: string) => s.replaceAll('{addressee}', addressee);

  const lines: string[] = [];
  lines.push(fill(pick(OPENINGS[opts.style], rand)));
  lines.push(pick(THEME_LINES[needs.theme], rand));

  const goal = needs.activeGoals[0];
  if (goal) {
    lines.push(goal.affirmation ? trimDot(goal.affirmation) + '.' : `I am becoming someone who ${lowerFirst(trimDot(goal.title))}.`);
  }

  const lesson = needs.topLessons[0];
  if (lesson?.solution.ifThen.if && lesson.solution.ifThen.then) {
    lines.push(`When ${lowerFirst(trimDot(lesson.solution.ifThen.if))}, I will ${lowerFirst(trimDot(lesson.solution.ifThen.then))}.`);
  }

  if (needs.missedYesterday.length > 0) {
    lines.push(`Missing once is human. Today I show up for ${listToText(needs.missedYesterday.map((h) => h.name))} again, and I don't miss twice.`);
  } else if (needs.plannedToday.length > 0) {
    lines.push(`Today I show up for ${listToText(needs.plannedToday.slice(0, 3).map((h) => h.name))}, even if only for two minutes.`);
  }

  if (needs.streakWins[0] && needs.theme === 'gratitude') {
    const { habit, streak } = needs.streakWins[0];
    lines.push(`${streak} times in a row for ${habit.name}. I honour that by continuing.`);
  }

  lines.push(fill(pick(CLOSINGS[opts.style], rand)));

  const dontDoToday = needs.topLessons
    .map((m) => trimDot(m.solution.dont))
    .filter(Boolean)
    .slice(0, 3);

  return {
    title: pick(TITLES[needs.theme], rand),
    text: lines.join('\n\n'),
    purposeLine: goal ? trimDot(goal.affirmation || goal.title) : pick(PURPOSE_DEFAULTS, rand),
    dontDoToday,
    nudges: buildNudges(needs.plannedToday, rand),
    theme: needs.theme,
  };
}

function buildNudges(habits: Habit[], rand: () => number): string[] {
  const nudges: string[] = [];
  for (const h of habits.slice(0, 3)) {
    const options = [
      h.twoMinute ? `Two minutes counts: ${lowerFirst(trimDot(h.twoMinute))}.` : null,
      h.stackAfter ? `After ${lowerFirst(trimDot(h.stackAfter))}, it's time for ${h.name}.` : null,
      h.reward ? `${h.name} first, then ${lowerFirst(trimDot(h.reward))}.` : null,
      h.identity ? `${trimDot(h.identity)}. Prove it today.` : null,
    ].filter((x): x is string => !!x);
    if (options.length) nudges.push(pick(options, rand));
  }
  const fallback = [
    'Small is how big things start.',
    'Show up today; perfection can wait.',
    'Do it badly if you have to, but do it.',
    'Your future self is watching. Make them proud.',
  ].filter((line) => !nudges.includes(line));
  while (nudges.length < 3 && fallback.length > 0) {
    nudges.push(fallback.splice(Math.floor(rand() * fallback.length), 1)[0]);
  }
  return nudges.slice(0, 3);
}

/** The first line of a prayer; used to avoid repeating openings. */
export function openingOf(text: string): string {
  return text.split('\n')[0]?.slice(0, 120) ?? '';
}
