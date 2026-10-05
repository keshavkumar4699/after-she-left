import { weekDays } from '../dates';
import { selectFocus } from '../focus';
import { distributeWeek } from '../planner';
import { habit, log } from './fixtures';

const TODAY = '2026-10-05'; // Monday

describe('focus selector (previous / current / next)', () => {
  const gym = habit({ id: 'gym', name: 'Gym', timeWindow: 'morning', order: 1 });
  const read = habit({ id: 'read', name: 'Read', timeWindow: 'evening', order: 2 });
  const football = habit({ id: 'football', name: 'Football', timeWindow: 'afternoon', order: 3 });
  const meditate = habit({ id: 'meditate', name: 'Meditate', order: 4 });
  const habits = [gym, read, football, meditate];

  it('current = first not-done today, next = after it, previous = last done', () => {
    const logs = [
      log('gym', TODAY, 'done', { completedAt: 100 }),
      log('football', TODAY, 'planned'),
      log('read', TODAY, 'planned'),
    ];
    const f = selectFocus(habits, logs, TODAY);
    expect(f.previous?.habit.id).toBe('gym');
    expect(f.current?.habit.id).toBe('football'); // afternoon before evening
    expect(f.next?.habit.id).toBe('read');
    expect(f.others.map((h) => h.id)).toEqual(['meditate']);
    expect(f.allDoneToday).toBe(false);
  });

  it('rolls to tomorrow when everything today is done', () => {
    const logs = [
      log('gym', TODAY, 'done', { completedAt: 100 }),
      log('read', TODAY, 'done', { completedAt: 200 }),
      log('football', '2026-10-06', 'planned'),
      log('gym', '2026-10-07', 'planned'),
    ];
    const f = selectFocus(habits, logs, TODAY);
    expect(f.allDoneToday).toBe(true);
    expect(f.current).toMatchObject({ day: '2026-10-06' });
    expect(f.current?.habit.id).toBe('football');
    expect(f.next?.habit.id).toBe('gym');
    expect(f.previous?.habit.id).toBe('read'); // most recent completion not already shown
  });

  it('never shows the same habit twice', () => {
    const logs = [log('gym', TODAY, 'planned'), log('gym', '2026-10-07', 'planned'), log('read', '2026-10-08', 'planned')];
    const f = selectFocus(habits, logs, TODAY);
    expect(f.current?.habit.id).toBe('gym');
    expect(f.next?.habit.id).toBe('read');
  });

  it('falls back to habit order when nothing is planned', () => {
    const f = selectFocus(habits, [], TODAY);
    expect(f.current?.status).toBe('unplanned');
    expect(f.current?.habit.id).toBe('gym');
    expect(f.previous).toBeNull();
  });
});

describe('weekly distribution', () => {
  const week = weekDays(TODAY, 1);

  it('spreads a 3×/week habit evenly (circular gaps)', () => {
    const gym = habit({ id: 'gym', weeklyTarget: 3 });
    const slots = distributeWeek([gym], week, [], TODAY);
    expect(slots.map((s) => s.day)).toEqual(['2026-10-05', '2026-10-08', '2026-10-10']); // Mon, Thu, Sat
  });

  it('respects preferred days and existing plans, and only plans from today on', () => {
    const football = habit({ id: 'fb', weeklyTarget: 2, preferredDays: [3, 6] }); // Wed, Sat
    const slots = distributeWeek([football], week, [], '2026-10-06');
    expect(slots.map((s) => s.day).sort()).toEqual(['2026-10-07', '2026-10-10']);

    const already = [log('fb', '2026-10-07', 'planned')];
    expect(distributeWeek([football], week, already, '2026-10-06').map((s) => s.day)).toEqual(['2026-10-10']);
  });

  it('keeps two hard habits off the same day when possible', () => {
    const gym = habit({ id: 'gym', weeklyTarget: 3, hard: true });
    const run = habit({ id: 'run', weeklyTarget: 3, hard: true });
    const slots = distributeWeek([gym, run], week, [], TODAY);
    const gymDays = new Set(slots.filter((s) => s.habitId === 'gym').map((s) => s.day));
    const runDays = slots.filter((s) => s.habitId === 'run').map((s) => s.day);
    expect(runDays.filter((d) => gymDays.has(d))).toHaveLength(0);
  });

  it('never exceeds the weekly target', () => {
    const daily = habit({ id: 'd', weeklyTarget: 9 });
    expect(distributeWeek([daily], week, [], TODAY)).toHaveLength(7);
  });
});
