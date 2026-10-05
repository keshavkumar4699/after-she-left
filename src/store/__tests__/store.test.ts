import { addDays, toDayKey } from '@/domain/dates';
import { DAY_MS } from '@/domain/entitlements';
import type { Habit } from '@/domain/types';
import { buildDemo } from '../demo';
import { useStore } from '../useStore';

type HabitInput = Omit<Habit, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

const habitInput = (name: string, order = 0): HabitInput => ({
  name,
  emoji: '💪',
  color: '#2DD4BF',
  identity: '',
  twoMinute: 'Start',
  full: 'Do it',
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
  order,
});

const goalInput = (title: string) => ({
  title,
  affirmation: '',
  measure: '',
  targetDate: '2027-02-28',
  targetTime: null,
  place: '',
  why: '',
  category: 'money' as const,
  milestones: [],
  habitIds: [],
  status: 'active' as const,
});

const endTrial = () => useStore.getState().setPlan({ tier: 'trial', trialEndsAt: Date.now() - DAY_MS, premiumUntil: null });

beforeEach(() => {
  useStore.getState().resetAll();
  useStore.getState().completeOnboarding({ displayName: 'Test', beginnerMode: false });
  useStore.getState().updateSettings({ beginnerMode: false });
});

describe('free-tier limits', () => {
  it('allows unlimited habits during the trial', () => {
    for (let i = 0; i < 8; i++) expect(useStore.getState().addHabit(habitInput(`H${i}`, i)).ok).toBe(true);
  });

  it('limits free users to 5 active habits and 10 active goals after the trial', () => {
    endTrial();
    const s = useStore.getState();
    for (let i = 0; i < 5; i++) expect(s.addHabit(habitInput(`H${i}`, i)).ok).toBe(true);
    expect(s.addHabit(habitInput('H5'))).toEqual({ ok: false, reason: 'limit', key: 'habits', limit: 5 });
    for (let i = 0; i < 10; i++) expect(s.addGoal(goalInput(`G${i}`)).ok).toBe(true);
    expect(s.addGoal(goalInput('G10'))).toMatchObject({ ok: false, key: 'goals', limit: 10 });
  });

  it('beginner mode allows at most 3 habits', () => {
    useStore.getState().updateSettings({ beginnerMode: true, beginnerStartedOn: toDayKey() });
    const s = useStore.getState();
    for (let i = 0; i < 3; i++) expect(s.addHabit(habitInput(`H${i}`, i)).ok).toBe(true);
    expect(s.addHabit(habitInput('H3'))).toEqual({ ok: false, reason: 'beginner', limit: 3 });
  });

  it('downgrade pauses (never deletes) items above the free limits', () => {
    const s = useStore.getState();
    const ids = Array.from({ length: 7 }, (_, i) => (s.addHabit(habitInput(`H${i}`, i)) as { id: string }).id);
    endTrial();
    useStore.getState().applyDowngrade({ habitIds: [ids[6]], goalIds: [] });
    const habits = Object.values(useStore.getState().habits);
    expect(habits).toHaveLength(7);
    expect(habits.filter((h) => h.status === 'active')).toHaveLength(5);
    expect(useStore.getState().habits[ids[6]].status).toBe('active');
    useStore.getState().resumePaused();
    expect(Object.values(useStore.getState().habits).every((h) => h.status === 'active')).toBe(true);
  });
});

describe('habit logs', () => {
  it('plans, completes, moves and auto-plans habits', () => {
    const s = useStore.getState();
    const { id } = s.addHabit(habitInput('Gym')) as { id: string };
    const today = toDayKey();
    s.planHabit(id, today);
    expect(useStore.getState().habitLogs[`${id}_${today}`].status).toBe('planned');
    expect(s.toggleDone(id, today)).toBe(true);
    expect(useStore.getState().habitLogs[`${id}_${today}`].status).toBe('done');
    expect(s.toggleDone(id, today)).toBe(false);
    s.moveHabit(id, today, addDays(today, 1));
    expect(useStore.getState().habitLogs[`${id}_${today}`].deletedAt).toBeTruthy();
    expect(useStore.getState().habitLogs[`${id}_${addDays(today, 1)}`].status).toBe('planned');
  });
});

describe('lessons', () => {
  it('a slip resets the review schedule and counts the repeat', () => {
    useStore.getState().loadDemo(buildDemo());
    const before = useStore.getState().mistakes.demo_m_spend;
    useStore.getState().addCheckin({ circumstanceId: 'demo_c_payday', mistakeIds: ['demo_m_spend'], outcome: 'repeated' });
    const after = useStore.getState().mistakes.demo_m_spend;
    expect(after.repeatCount).toBe(before.repeatCount + 1);
    expect(after.review.stage).toBe(0);
    expect(after.review.nextReviewOn).toBe(addDays(toDayKey(), 1));
  });

  it('enforces the free-tier location reminder limit', () => {
    endTrial();
    const s = useStore.getState();
    const loc = { latitude: 1, longitude: 2, radiusM: 200, label: 'A', notifyOnEnter: true, notifyOnExit: false };
    const base = { icon: 'weather-night', color: '#fff', schedule: null, cooldownMin: 60 };
    expect(s.addCircumstance({ ...base, name: 'One', location: loc }).ok).toBe(true);
    expect(s.addCircumstance({ ...base, name: 'Two', location: loc })).toMatchObject({ ok: false, key: 'locationCircumstances', limit: 1 });
    expect(s.addCircumstance({ ...base, name: 'No location', location: null }).ok).toBe(true);
  });
});

describe('AI prayer quota', () => {
  it('gives free users no cloud AI prayers (they get the on-phone composer)', () => {
    endTrial();
    const s = useStore.getState();
    expect(s.aiAllowance(true)).toEqual({ ok: false, remaining: 0 });
    expect(s.aiAllowance(false)).toEqual({ ok: false, remaining: 0 });
  });

  it('gives trial and Premium users a daily cloud prayer and 2 rewrites a day', () => {
    for (let i = 0; i < 2; i++) {
      expect(useStore.getState().aiAllowance(true).ok).toBe(true);
      useStore.getState().recordAiUse(true);
    }
    expect(useStore.getState().aiAllowance(true)).toEqual({ ok: false, remaining: 0 });
    expect(useStore.getState().aiAllowance(false)).toEqual({ ok: true, remaining: 7 });
  });
});
