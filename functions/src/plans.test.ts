import assert from 'node:assert/strict';
import { test } from 'node:test';

import { aiLimits, DAY_MS, effectiveTier, isoWeekKey, isPlausibleDay, planFromRevenueCat } from './plans';
import { PrayerContextSchema, PrayerOutputSchema, toPrayerContent } from './schema';

const NOW = Date.UTC(2026, 9, 5, 12);

test('trial, premium and free tiers', () => {
  assert.equal(effectiveTier({ trialEndsAt: NOW + DAY_MS }, NOW), 'trial');
  assert.equal(effectiveTier({ trialEndsAt: NOW - DAY_MS }, NOW), 'free');
  assert.equal(effectiveTier({ trialEndsAt: NOW - DAY_MS, premiumUntil: NOW + DAY_MS }, NOW), 'premium');
  // No plan document yet: fall back to the account creation time.
  assert.equal(effectiveTier(undefined, NOW, NOW - 3 * DAY_MS), 'trial');
  assert.equal(effectiveTier(undefined, NOW, NOW - 20 * DAY_MS), 'free');
  assert.deepEqual(aiLimits('free'), { perWeek: 3, regenPerDay: 0 });
  assert.deepEqual(aiLimits('trial'), { perWeek: 7, regenPerDay: 2 });
});

test('only plausible days are accepted', () => {
  assert.equal(isPlausibleDay('2026-10-05', NOW), true);
  assert.equal(isPlausibleDay('2026-10-04', NOW), true);
  assert.equal(isPlausibleDay('2026-10-08', NOW), false);
  assert.equal(isPlausibleDay('2027-02-29', NOW), false);
  assert.equal(isoWeekKey('2026-10-05'), '2026-W41');
});

test('RevenueCat events map to plans', () => {
  assert.deepEqual(planFromRevenueCat('INITIAL_PURCHASE', NOW + 30 * DAY_MS, NOW)?.tier, 'premium');
  assert.equal(planFromRevenueCat('CANCELLATION', NOW + 10 * DAY_MS, NOW)?.willRenew, false);
  assert.equal(planFromRevenueCat('EXPIRATION', NOW, NOW)?.tier, 'free');
  assert.equal(planFromRevenueCat('TEST', null, NOW), null);
});

test('context and output validation', () => {
  const ok = PrayerContextSchema.safeParse({
    day: '2026-10-05',
    theme: 'resist',
    style: 'secular',
    lessons: [{ ifThen: 'If I feel lonely, then I call a friend', dont: "Don't text her" }],
    goals: ['It is 28 Feb 2027. I am financially free'],
    habitsToday: ['Gym'],
    recentOpenings: [],
  });
  assert.equal(ok.success, true);
  assert.equal(PrayerContextSchema.safeParse({ day: 'x', theme: 'resist' }).success, false);

  const out = PrayerOutputSchema.parse({
    title: '“Steady hands”',
    prayer: 'Today I choose who I become.\n\n\n\nI show up for the gym, even for two minutes, and I keep my promises.',
    purposeLine: 'Grow quietly.',
    dontDoToday: ["Don't text her", 'No impulse buys', 'Extra', 'Too many'],
    nudges: ['Shoes on', 'One page', 'Ten breaths', 'Extra'],
    focusTheme: 'resist',
  });
  const content = toPrayerContent(out);
  assert.equal(content.title, 'Steady hands');
  assert.equal(content.dontDoToday.length, 3);
  assert.equal(content.nudges.length, 3);
  assert.ok(!content.text.includes('\n\n\n'));
});
