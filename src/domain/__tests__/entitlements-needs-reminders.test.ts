import { DAY_MS, checkLimit, downgradeSelection, effectiveTier, limitsFor, newTrialPlan, trialDaysLeft } from '../entitlements';
import { analyzeNeeds, buildPrayerContext } from '../needs';
import { composeTemplatePrayer } from '../prayer';
import { planNotifications, quoteForDay, type ReminderSettings } from '../reminders';
import type { Circumstance, Goal } from '../types';
import { habit, log, mistake } from './fixtures';

const NOW = new Date(2026, 9, 5, 8, 0).getTime(); // 5 Oct 2026, 08:00 local
const TODAY = '2026-10-05';

describe('pricing & limits', () => {
  it('runs a 14-day trial, then falls back to free', () => {
    const plan = newTrialPlan(NOW);
    expect(effectiveTier(plan, NOW)).toBe('trial');
    expect(trialDaysLeft(plan, NOW + 5 * DAY_MS)).toBe(9);
    expect(effectiveTier(plan, NOW + 14 * DAY_MS + 1)).toBe('free');
    expect(effectiveTier({ ...plan, premiumUntil: NOW + 40 * DAY_MS }, NOW + 20 * DAY_MS)).toBe('premium');
  });

  it('limits free users to 5 habits and 10 goals', () => {
    expect(checkLimit('habits', 4, 'free').ok).toBe(true);
    expect(checkLimit('habits', 5, 'free')).toMatchObject({ ok: false, limit: 5 });
    expect(checkLimit('goals', 10, 'free').ok).toBe(false);
    expect(checkLimit('habits', 500, 'trial').ok).toBe(true);
    expect(limitsFor('free').ads).toBe(true);
    expect(limitsFor('premium').ads).toBe(false);
  });

  it('pauses (never deletes) items above the limit, keeping the user’s picks', () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ id: `h${i}`, updatedAt: i }));
    const { active, paused } = downgradeSelection(items, 5, ['h0']);
    expect(active).toHaveLength(5);
    expect(active).toContain('h0');
    expect(paused).toHaveLength(2);
    expect([...active, ...paused].sort()).toEqual(items.map((i) => i.id).sort());
  });
});

const lateNight: Circumstance = {
  id: 'c1',
  createdAt: 1,
  updatedAt: 1,
  name: 'Late night alone',
  icon: 'weather-night',
  color: '#8B7CF6',
  schedule: { weekdays: [1, 5], time: { hour: 22, minute: 30 } },
  location: null,
  cooldownMin: 120,
};

const goal: Goal = {
  id: 'g1',
  createdAt: 1,
  updatedAt: 1,
  title: 'Financial freedom',
  affirmation: 'It is 28 Feb 2027. I am financially free and my investments cover my expenses',
  measure: 'Passive income ≥ monthly expenses',
  targetDate: '2027-02-28',
  place: 'Home',
  why: 'Freedom to choose',
  category: 'money',
  milestones: [],
  habitIds: [],
  status: 'active',
};

describe('needs analyzer & template prayer', () => {
  it('chooses "resist" after recent slips and on trigger days', () => {
    const m = mistake({ id: 'm1', circumstanceIds: ['c1'] });
    const needs = analyzeNeeds({
      mistakes: [m],
      checkins: [{ id: 'k', createdAt: 1, updatedAt: 1, mistakeIds: ['m1'], outcome: 'repeated', on: '2026-10-02', circumstanceId: 'c1' }],
      circumstances: [lateNight],
      habits: [],
      logs: [],
      goals: [goal],
      today: TODAY, // Monday: Late night alone is scheduled
    });
    expect(needs.theme).toBe('resist');
    expect(needs.topLessons[0].id).toBe('m1');
    expect(needs.circumstancesToday.map((c) => c.id)).toEqual(['c1']);
  });

  it('chooses "discipline" when habits were missed yesterday', () => {
    const gym = habit({ id: 'gym', name: 'Gym' });
    const needs = analyzeNeeds({
      mistakes: [],
      checkins: [],
      circumstances: [],
      habits: [gym],
      logs: [log('gym', '2026-10-04', 'planned'), log('gym', TODAY, 'planned')],
      goals: [],
      today: '2026-10-05',
    });
    expect(needs.theme).toBe('discipline');
    expect(needs.missedYesterday.map((h) => h.id)).toEqual(['gym']);
  });

  it('composes a deterministic, personal prayer with a "not today" list', () => {
    const m = mistake({ id: 'm1' });
    const gym = habit({ id: 'gym', name: 'Gym', twoMinute: 'Put on gym clothes' });
    const needs = analyzeNeeds({
      mistakes: [m],
      checkins: [],
      circumstances: [],
      habits: [gym],
      logs: [log('gym', TODAY, 'planned')],
      goals: [goal],
      today: TODAY,
    });
    const a = composeTemplatePrayer(needs, { day: TODAY, style: 'secular' });
    const b = composeTemplatePrayer(needs, { day: TODAY, style: 'secular' });
    expect(a).toEqual(b);
    expect(a.text).toContain('financially free');
    expect(a.text).toContain('call a friend or journal instead');
    expect(a.text.toLowerCase()).toContain('gym');
    expect(a.dontDoToday).toEqual(["Don't text her when I'm lonely"]);
    expect(a.nudges).toHaveLength(3);

    const faith = composeTemplatePrayer(needs, { day: TODAY, style: 'faith', addressee: 'Bhagwan' });
    expect(faith.text).toContain('Bhagwan');

    const ctx = buildPrayerContext(needs, { day: TODAY, style: 'secular', recentOpenings: [] });
    expect(ctx.lessons[0].dont).toBe("Don't text her when I'm lonely");
    expect(JSON.stringify(ctx)).not.toContain('Lonely and tired'); // the private "why" is never sent
  });
});

describe('reminder planner', () => {
  const settings: ReminderSettings = {
    prayerTime: { hour: 6, minute: 30 },
    reviewTime: { hour: 21, minute: 0 },
    quietHours: { start: { hour: 22, minute: 0 }, end: { hour: 7, minute: 0 } },
    activeHours: { start: { hour: 9, minute: 0 }, end: { hour: 20, minute: 0 } },
    privacy: false,
    enabled: { circumstances: true, prayer: true, nudges: true, review: true, planning: true, neverMissTwice: true },
  };
  const quotes = Array.from({ length: 40 }, (_, i) => ({
    id: `q${i}`,
    text: `Quote ${i}`,
    author: 'A',
    theme: 'consistency' as const,
  }));

  it('plans prayer, circumstance, review, planning, nudge and never-miss-twice reminders', () => {
    const gym = habit({ id: 'gym', name: 'Gym' });
    const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];
    const plan = planNotifications({
      settings,
      circumstances: [lateNight],
      mistakes: [mistake({ id: 'm1', circumstanceIds: ['c1'], review: { stage: 0, nextReviewOn: '2026-10-06', lapses: 0 } })],
      habits: [gym],
      logs: [log('gym', '2026-10-04', 'planned'), ...days.map((d) => log('gym', d, 'planned'))],
      quotes,
      seed: 1234,
      scheduledCircumstanceLimit: 3,
      now: new Date(NOW),
    });
    const ids = plan.map((n) => n.id);
    expect(ids).toContain('prayer');
    expect(ids).toEqual(expect.arrayContaining(['circ:c1:1', 'circ:c1:5']));
    expect(plan.find((n) => n.id === 'circ:c1:1')?.trigger).toEqual({ type: 'weekly', weekday: 2, hour: 22, minute: 30 });
    expect(ids).toContain('review:2026-10-06');
    expect(ids).not.toContain('review:2026-10-05');
    expect(ids).toContain('planning');
    expect(ids).toContain(`nmt:${TODAY}`);
    const nudges = plan.filter((n) => n.id.startsWith('nudge:'));
    expect(nudges.length).toBeGreaterThan(0);
    expect(nudges.length).toBeLessThanOrEqual(7);
    for (const n of nudges) {
      const at = new Date((n.trigger as { at: number }).at);
      expect(at.getHours()).toBeGreaterThanOrEqual(9);
      expect(at.getHours()).toBeLessThan(20);
    }
    // Stable: planning twice gives the same result.
    const again = planNotifications({
      settings,
      circumstances: [lateNight],
      mistakes: [],
      habits: [gym],
      logs: days.map((d) => log('gym', d, 'planned')),
      quotes,
      seed: 1234,
      scheduledCircumstanceLimit: 3,
      now: new Date(NOW),
    });
    expect(again.filter((n) => n.id.startsWith('nudge:'))).toEqual(nudges);
  });

  it('hides personal text when notification privacy is on and respects the free-tier limit', () => {
    const plan = planNotifications({
      settings: { ...settings, privacy: true },
      circumstances: [lateNight, { ...lateNight, id: 'c2', createdAt: 2 }],
      mistakes: [mistake({ circumstanceIds: ['c1'] })],
      habits: [],
      logs: [],
      quotes,
      seed: 1,
      scheduledCircumstanceLimit: 1,
      now: new Date(NOW),
    });
    const circ = plan.filter((n) => n.id.startsWith('circ:'));
    expect(circ.every((n) => n.id.startsWith('circ:c1'))).toBe(true);
    expect(circ[0].title).toBe('A gentle reminder');
    expect(circ[0].body).not.toContain('lonely');
  });

  it('cycles through the whole quote library before repeating (any window of N days)', () => {
    for (const start of [0, 13, 27]) {
      const seen = new Set<string>();
      for (let i = 0; i < quotes.length; i++) {
        const day = new Date(Date.UTC(2026, 0, 1 + start + i)).toISOString().slice(0, 10);
        seen.add(quoteForDay(quotes, 99, day)!.id);
      }
      expect(seen.size).toBe(quotes.length);
    }
  });
});
