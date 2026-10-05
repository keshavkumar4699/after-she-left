import { logId } from '../planner';
import { initialReview } from '../review';
import type { DayKey, Habit, HabitLog, HabitLogStatus, Mistake } from '../types';

let seq = 0;

export function habit(partial: Partial<Habit> = {}): Habit {
  seq += 1;
  return {
    id: partial.id ?? `h${seq}`,
    createdAt: seq,
    updatedAt: seq,
    name: `Habit ${seq}`,
    emoji: '💪',
    color: '#2DD4BF',
    identity: 'I am someone who shows up',
    twoMinute: 'Put on shoes',
    full: 'Do 20 pushups',
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
    order: seq,
    ...partial,
  };
}

export function log(habitId: string, day: DayKey, status: HabitLogStatus, extra: Partial<HabitLog> = {}): HabitLog {
  return { id: logId(habitId, day), habitId, day, status, updatedAt: 0, ...extra };
}

export function mistake(partial: Partial<Mistake> = {}): Mistake {
  seq += 1;
  return {
    id: partial.id ?? `m${seq}`,
    createdAt: seq,
    updatedAt: seq,
    title: 'Texted her at 2 AM',
    story: '',
    why: 'Lonely and tired',
    occurredOn: '2026-09-01',
    category: 'relationships',
    severity: 4,
    emotions: ['lonely'],
    solution: {
      summary: 'Phone away after 11 PM',
      steps: ['Charge phone in kitchen'],
      ifThen: { if: 'I feel lonely late at night', then: 'call a friend or journal instead' },
      dont: "Don't text her when I'm lonely",
    },
    circumstanceIds: [],
    status: 'active',
    repeatCount: 0,
    review: initialReview('2026-09-01'),
    ...partial,
  };
}
