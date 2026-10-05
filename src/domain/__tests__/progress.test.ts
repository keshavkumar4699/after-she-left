import { habitStats, last7DaysProgress, logsForHabit, missedYesterday, weekOverWeek } from '../progress';
import { habit, log } from './fixtures';

const TODAY = '2026-10-05';

describe('last 7 days rings', () => {
  const logs = [
    // two days ago: 3 of 6
    ...['a', 'b', 'c'].map((h) => log(h, '2026-10-03', 'done')),
    ...['d', 'e', 'f'].map((h) => log(h, '2026-10-03', 'planned')),
    // yesterday: 1 of 5
    log('a', '2026-10-04', 'done'),
    ...['b', 'c', 'd', 'e'].map((h) => log(h, '2026-10-04', 'planned')),
    // today: 2 of 5
    log('a', TODAY, 'done'),
    log('b', TODAY, 'done'),
    ...['c', 'd', 'e'].map((h) => log(h, TODAY, 'planned')),
    // 8 days ago: outside the window
    log('a', '2026-09-27', 'done'),
  ];

  it('rolls over the last 7 days ending today', () => {
    const rings = last7DaysProgress(logs, TODAY);
    expect(rings).toHaveLength(7);
    expect(rings[0].day).toBe('2026-09-29');
    expect(rings[6]).toMatchObject({ day: TODAY, label: 'Today', done: 2, planned: 5, isToday: true });
    expect(rings[5]).toMatchObject({ label: 'Yest.', done: 1, planned: 5 });
    expect(rings[4]).toMatchObject({ done: 3, planned: 6, ratio: 0.5 });
    expect(rings[0]).toMatchObject({ isRest: true, planned: 0, ratio: 0 });
  });

  it('moves with the calendar: tomorrow drops the oldest day', () => {
    const rings = last7DaysProgress(logs, '2026-10-06');
    expect(rings[0].day).toBe('2026-09-30');
    expect(rings[6]).toMatchObject({ day: '2026-10-06', isRest: true });
  });

  it('ignores deleted logs and uncounted habits', () => {
    const extra = [...logs, log('z', TODAY, 'done', { deletedAt: 1 })];
    const rings = last7DaysProgress(extra, TODAY, new Set(['a', 'c']));
    expect(rings[6]).toMatchObject({ done: 1, planned: 2 });
  });

  it('compares with the previous 7 days', () => {
    const wow = weekOverWeek(logs, TODAY);
    expect(wow.current.done).toBe(6);
    expect(wow.previous.done).toBe(1);
    expect(wow.deltaDone).toBe(5);
  });
});

describe('habit stats', () => {
  it('computes per-habit cells, ratio and streaks (rest days do not break streaks)', () => {
    const logs = [
      log('g', '2026-09-28', 'done'),
      log('g', '2026-09-30', 'planned'), // missed: breaks the streak
      log('g', '2026-10-01', 'done'),
      log('g', '2026-10-03', 'done'),
      log('g', TODAY, 'planned'), // pending today: does not break it
    ];
    const stats = habitStats(logsForHabit(logs, 'g'), TODAY);
    expect(stats.cells.map((c) => c.state)).toEqual(['rest', 'missed', 'done', 'rest', 'done', 'rest', 'pending']);
    expect(stats.planned7).toBe(4);
    expect(stats.done7).toBe(2);
    expect(stats.streak).toBe(2);
    expect(stats.bestStreak).toBe(2);
    expect(stats.totalDone).toBe(3);
  });

  it('finds habits missed yesterday', () => {
    const gym = habit({ id: 'gym' });
    const read = habit({ id: 'read' });
    const logs = [log('gym', '2026-10-04', 'planned'), log('read', '2026-10-04', 'done')];
    expect(missedYesterday([gym, read], logs, TODAY).map((h) => h.id)).toEqual(['gym']);
  });
});
