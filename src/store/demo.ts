import { addDays, lastNDays, toDayKey, weekDays } from '@/domain/dates';
import { newTrialPlan, DAY_MS } from '@/domain/entitlements';
import { logId } from '@/domain/planner';
import { mulberry32 } from '@/domain/random';
import { initialReview } from '@/domain/review';
import type { Checkin, Circumstance, Goal, Habit, HabitLog, Mistake } from '@/domain/types';
import type { DataState } from './types';

/**
 * Realistic sample data relative to today, so the app can be explored (and screenshotted)
 * without typing everything in first. Loaded from onboarding or Settings → Developer.
 */
export function buildDemo(name = 'Keshav'): Partial<DataState> {
  const today = toDayKey();
  const t = Date.now();
  const rand = mulberry32(20261005);

  const habit = (h: Partial<Habit> & Pick<Habit, 'id' | 'name' | 'emoji'>, i: number): Habit => ({
    createdAt: t - (30 - i) * DAY_MS,
    updatedAt: t - (30 - i) * DAY_MS,
    color: '#2DD4BF',
    identity: '',
    twoMinute: '',
    full: '',
    level: 1,
    weeklyTarget: 3,
    preferredDays: [],
    timeWindow: 'anytime',
    intention: { behavior: '', when: '', where: '' },
    stackAfter: '',
    reward: '',
    bundle: '',
    hard: false,
    status: 'active',
    goalId: null,
    order: i,
    ...h,
  });

  const habits: Habit[] = [
    habit(
      {
        id: 'demo_gym',
        name: 'Gym',
        emoji: '💪',
        color: '#2DD4BF',
        identity: 'I am someone who takes care of my body',
        twoMinute: 'Put on my gym clothes',
        full: 'Train for 45 minutes and do 20 pushups',
        weeklyTarget: 3,
        timeWindow: 'morning',
        hard: true,
        intention: { behavior: 'train', when: 'before work', where: 'the gym near home' },
        stackAfter: 'I drink my morning water',
        reward: 'a protein smoothie',
        bundle: 'my favourite podcast only at the gym',
        level: 2,
      },
      0,
    ),
    habit(
      {
        id: 'demo_football',
        name: 'Football',
        emoji: '⚽',
        color: '#F5B544',
        identity: 'I am an active person who plays',
        twoMinute: 'Pack my football bag',
        full: 'Play a 60-minute game with friends',
        weeklyTarget: 2,
        timeWindow: 'evening',
        hard: true,
        preferredDays: [3, 6],
        intention: { behavior: 'play football', when: 'after work', where: 'the city turf' },
        stackAfter: 'I close my laptop',
        reward: 'dinner with the team',
      },
      1,
    ),
    habit(
      {
        id: 'demo_read',
        name: 'Read',
        emoji: '📖',
        color: '#8B7CF6',
        identity: 'I am a reader',
        twoMinute: 'Read one page',
        full: 'Read 10 pages',
        weeklyTarget: 5,
        timeWindow: 'evening',
        intention: { behavior: 'read', when: 'at 10 PM', where: 'my bed, phone in the kitchen' },
        stackAfter: 'I brush my teeth',
        reward: 'a cup of chamomile tea',
      },
      2,
    ),
    habit(
      {
        id: 'demo_meditate',
        name: 'Meditate',
        emoji: '🧘',
        color: '#60A5FA',
        identity: 'I am calm and in control',
        twoMinute: 'Take ten slow breaths',
        full: 'Meditate for 10 minutes',
        weeklyTarget: 4,
        timeWindow: 'morning',
        stackAfter: 'I make my bed',
        reward: 'my first coffee',
      },
      3,
    ),
    habit(
      {
        id: 'demo_save',
        name: 'Save money',
        emoji: '💰',
        color: '#A3E635',
        identity: 'I am someone who builds wealth',
        twoMinute: 'Move ₹100 to savings',
        full: 'Review spending and move 20% of income to investments',
        weeklyTarget: 1,
        timeWindow: 'anytime',
        preferredDays: [0],
        reward: 'watching the savings bar grow',
      },
      4,
    ),
  ];

  // Logs for the last 13 days + a plan for the rest of this week.
  const habitLogs: Record<string, HabitLog> = {};
  const schedule: Record<string, number[]> = {
    demo_gym: [1, 3, 5],
    demo_football: [3, 6],
    demo_read: [0, 1, 2, 4, 5],
    demo_meditate: [1, 2, 4, 6],
    demo_save: [0],
  };
  const past = lastNDays(addDays(today, -1), 13);
  for (const day of past) {
    const wd = new Date(`${day}T12:00:00Z`).getUTCDay();
    for (const h of habits) {
      if (!schedule[h.id].includes(wd)) continue;
      const roll = rand();
      const done = roll < (h.id === 'demo_read' ? 0.92 : h.id === 'demo_football' ? 0.55 : 0.72);
      habitLogs[logId(h.id, day)] = {
        id: logId(h.id, day),
        habitId: h.id,
        day,
        status: done ? 'done' : 'planned',
        completedAt: done ? new Date(`${day}T${h.timeWindow === 'morning' ? '07' : '20'}:30:00`).getTime() : null,
        difficulty: done ? (h.id === 'demo_read' ? 'easy' : rand() < 0.6 ? 'right' : 'hard') : null,
        updatedAt: t,
      };
    }
  }
  // Today: gym done, read + meditate still pending, plus the rest of the week.
  for (const day of weekDays(today, 1).filter((d) => d >= today)) {
    const wd = new Date(`${day}T12:00:00Z`).getUTCDay();
    for (const h of habits) {
      if (!schedule[h.id].includes(wd) && !(day === today && (h.id === 'demo_gym' || h.id === 'demo_meditate' || h.id === 'demo_read'))) continue;
      const done = day === today && h.id === 'demo_gym';
      habitLogs[logId(h.id, day)] = {
        id: logId(h.id, day),
        habitId: h.id,
        day,
        status: done ? 'done' : 'planned',
        completedAt: done ? t - 2 * 3600_000 : null,
        difficulty: done ? 'right' : null,
        updatedAt: t,
      };
    }
  }
  // Yesterday's reading missed → "never miss twice" shows up.
  const y = addDays(today, -1);
  habitLogs[logId('demo_read', y)] = { id: logId('demo_read', y), habitId: 'demo_read', day: y, status: 'planned', updatedAt: t };

  const circumstances: Circumstance[] = [
    {
      id: 'demo_c_night',
      createdAt: t - 20 * DAY_MS,
      updatedAt: t - 20 * DAY_MS,
      name: 'Late night alone',
      icon: 'weather-night',
      color: '#8B7CF6',
      schedule: { weekdays: [], time: { hour: 22, minute: 30 } },
      location: null,
      cooldownMin: 120,
    },
    {
      id: 'demo_c_payday',
      createdAt: t - 18 * DAY_MS,
      updatedAt: t - 18 * DAY_MS,
      name: 'Payday weekend',
      icon: 'cash-multiple',
      color: '#F5B544',
      schedule: { weekdays: [5, 6], time: { hour: 18, minute: 0 } },
      location: null,
      cooldownMin: 120,
    },
    {
      id: 'demo_c_mall',
      createdAt: t - 10 * DAY_MS,
      updatedAt: t - 10 * DAY_MS,
      name: 'Near the mall',
      icon: 'map-marker-radius',
      color: '#F27474',
      schedule: null,
      location: { latitude: 28.5273, longitude: 77.2193, radiusM: 300, label: 'Select City Walk', notifyOnEnter: true, notifyOnExit: false },
      cooldownMin: 240,
    },
  ];

  const mistake = (m: Partial<Mistake> & Pick<Mistake, 'id' | 'title' | 'solution'>, daysAgo: number): Mistake => ({
    createdAt: t - daysAgo * DAY_MS,
    updatedAt: t - daysAgo * DAY_MS,
    story: '',
    why: '',
    occurredOn: addDays(today, -daysAgo),
    category: 'relationships',
    severity: 3,
    emotions: [],
    circumstanceIds: [],
    status: 'active',
    repeatCount: 0,
    lastRepeatedOn: null,
    review: initialReview(addDays(today, -daysAgo)),
    ...m,
  });

  const mistakes: Mistake[] = [
    mistake(
      {
        id: 'demo_m_text',
        title: 'Texted her at 2 AM',
        story: 'Couldn’t sleep, scrolled old photos and sent a long message. Felt worse the next morning.',
        why: 'Lonely, tired and the phone was in bed with me.',
        severity: 5,
        emotions: ['lonely', 'sad', 'tired'],
        circumstanceIds: ['demo_c_night'],
        repeatCount: 1,
        lastRepeatedOn: addDays(today, -6),
        solution: {
          summary: 'Protect my nights: phone charges in the kitchen after 10:30 PM.',
          steps: ['Charge the phone in the kitchen', 'Keep a journal by the bed', 'Call Rahul if the urge is strong'],
          ifThen: { if: 'I feel lonely late at night', then: 'write three lines in my journal and call a friend in the morning' },
          dont: 'Don’t text her when I’m lonely at night',
        },
        review: { stage: 1, nextReviewOn: today, lastReviewedOn: addDays(today, -3), lapses: 1 },
      },
      21,
    ),
    mistake(
      {
        id: 'demo_m_spend',
        title: 'Impulse shopping after a bad day',
        story: 'Spent ₹18,000 on things I didn’t need to feel better.',
        why: 'Stress at work and payday in my account.',
        category: 'money',
        severity: 4,
        emotions: ['stressed', 'bored'],
        circumstanceIds: ['demo_c_payday', 'demo_c_mall'],
        solution: {
          summary: 'Wait 48 hours before any purchase over ₹2,000.',
          steps: ['Add it to a wishlist', 'Wait 48 hours', 'Buy only if it fits the budget'],
          ifThen: { if: 'I want to buy something to feel better', then: 'add it to my wishlist and go for a walk instead' },
          dont: 'Don’t buy things to fix a feeling',
        },
        review: { stage: 2, nextReviewOn: addDays(today, 2), lastReviewedOn: addDays(today, -5), lapses: 0 },
      },
      18,
    ),
    mistake(
      {
        id: 'demo_m_skip',
        title: 'Quit the gym for two weeks',
        story: 'Missed one session, then told myself the week was ruined.',
        why: 'All-or-nothing thinking.',
        category: 'health',
        severity: 3,
        emotions: ['ashamed'],
        solution: {
          summary: 'Never miss twice. A tiny session still counts.',
          steps: ['Keep the gym bag packed', 'If short on time, do 10 minutes'],
          ifThen: { if: 'I miss a workout', then: 'do a 10-minute version the next day, no matter what' },
          dont: 'Don’t let one miss become two',
        },
        status: 'learned',
        review: { stage: 4, nextReviewOn: addDays(today, 20), lastReviewedOn: addDays(today, -10), lapses: 0 },
      },
      30,
    ),
  ];

  const checkins: Checkin[] = [
    { id: 'demo_k1', createdAt: t, updatedAt: t, circumstanceId: 'demo_c_night', mistakeIds: ['demo_m_text'], outcome: 'repeated', on: addDays(today, -6) },
    { id: 'demo_k2', createdAt: t, updatedAt: t, circumstanceId: 'demo_c_night', mistakeIds: ['demo_m_text'], outcome: 'avoided', on: addDays(today, -4) },
    { id: 'demo_k3', createdAt: t, updatedAt: t, circumstanceId: 'demo_c_payday', mistakeIds: ['demo_m_spend'], outcome: 'avoided', on: addDays(today, -3) },
    { id: 'demo_k4', createdAt: t, updatedAt: t, circumstanceId: 'demo_c_night', mistakeIds: ['demo_m_text'], outcome: 'avoided', on: addDays(today, -1) },
  ];

  const goals: Goal[] = [
    {
      id: 'demo_g_money',
      createdAt: t - 25 * DAY_MS,
      updatedAt: t - 25 * DAY_MS,
      title: 'Financial freedom',
      affirmation: 'It is 28 February 2027. I am financially free: my investments pay for my monthly expenses',
      measure: 'Passive income ≥ ₹60,000 per month',
      targetDate: '2027-02-28',
      targetTime: { hour: 9, minute: 0 },
      place: 'At my desk at home, checking my portfolio',
      why: 'Freedom to choose my work and help my parents',
      category: 'money',
      milestones: [
        { id: 'ms1', title: 'Emergency fund: 6 months', dueOn: addDays(today, -20), done: true },
        { id: 'ms2', title: 'Clear the credit card', dueOn: addDays(today, 12), done: false },
        { id: 'ms3', title: 'Invest 20% every month for 6 months', dueOn: '2027-01-31', done: false },
      ],
      habitIds: ['demo_save'],
      status: 'active',
    },
    {
      id: 'demo_g_run',
      createdAt: t - 12 * DAY_MS,
      updatedAt: t - 12 * DAY_MS,
      title: 'Run a half marathon',
      affirmation: 'It is 14 December 2026. I crossed the half-marathon finish line strong and smiling',
      measure: 'Finish 21.1 km under 2 hours 15 minutes',
      targetDate: '2026-12-14',
      targetTime: { hour: 6, minute: 0 },
      place: 'Delhi half marathon',
      why: 'Proof that I can commit to something hard',
      category: 'health',
      milestones: [
        { id: 'ms4', title: 'Run 10 km without stopping', dueOn: addDays(today, 20), done: false },
        { id: 'ms5', title: 'Register for the race', dueOn: addDays(today, 5), done: true },
      ],
      habitIds: ['demo_gym'],
      status: 'active',
    },
  ];

  const toRecord = <T extends { id: string }>(items: T[]) => Object.fromEntries(items.map((i) => [i.id, i]));

  return {
    settings: {
      displayName: name,
      beginnerMode: false,
      beginnerStartedOn: addDays(today, -30),
      onboarded: true,
    } as DataState['settings'],
    plan: { ...newTrialPlan(t - 5 * DAY_MS) },
    habits: toRecord(habits),
    habitLogs,
    circumstances: toRecord(circumstances),
    mistakes: toRecord(mistakes),
    checkins: toRecord(checkins),
    goals: toRecord(goals),
    prayers: {},
  };
}
