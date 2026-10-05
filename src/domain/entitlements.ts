import type { ID, PlanState, PlanTier, Timestamp } from './types';

/**
 * Pricing model: 14-day free trial of everything → $20/month Premium. Without Premium the app
 * shows ads and applies the free-tier limits below. App lock and data export are never paywalled.
 */

export const TRIAL_DAYS = 14;
export const PRICE_USD_MONTHLY = 20;
export const DAY_MS = 86_400_000;

export interface Limits {
  habits: number;
  goals: number;
  mistakes: number;
  locationCircumstances: number;
  scheduledCircumstances: number;
  aiPrayersPerWeek: number;
  regenerationsPerDay: number;
  monthHistoryMonths: number;
  fullInsights: boolean;
  ads: boolean;
}

const UNLIMITED = Number.POSITIVE_INFINITY;

export const LIMITS: Record<'free' | 'premium', Limits> = {
  free: {
    habits: 5,
    goals: 10,
    mistakes: 25,
    locationCircumstances: 1,
    scheduledCircumstances: 3,
    aiPrayersPerWeek: 3,
    regenerationsPerDay: 0,
    monthHistoryMonths: 3,
    fullInsights: false,
    ads: true,
  },
  premium: {
    habits: UNLIMITED,
    goals: UNLIMITED,
    mistakes: UNLIMITED,
    locationCircumstances: 95, // Android allows 100 geofences per app; keep headroom.
    scheduledCircumstances: UNLIMITED,
    aiPrayersPerWeek: 7,
    regenerationsPerDay: 2,
    monthHistoryMonths: UNLIMITED,
    fullInsights: true,
    ads: false,
  },
};

export type LimitKey = 'habits' | 'goals' | 'mistakes' | 'locationCircumstances' | 'scheduledCircumstances';

export const LIMIT_LABELS: Record<LimitKey, string> = {
  habits: 'active habits',
  goals: 'active goals',
  mistakes: 'lessons',
  locationCircumstances: 'location reminders',
  scheduledCircumstances: 'scheduled reminders',
};

export function newTrialPlan(now: Timestamp): PlanState {
  return { tier: 'trial', trialStartedAt: now, trialEndsAt: now + TRIAL_DAYS * DAY_MS, premiumUntil: null, source: 'local' };
}

/** The tier that applies right now, after trial expiry and subscription end are considered. */
export function effectiveTier(plan: PlanState, now: Timestamp): PlanTier {
  if (plan.premiumUntil && plan.premiumUntil > now) return 'premium';
  if (plan.tier === 'premium' && !plan.premiumUntil) return 'premium';
  if (now < plan.trialEndsAt) return 'trial';
  return 'free';
}

export function limitsFor(tier: PlanTier): Limits {
  return tier === 'free' ? LIMITS.free : LIMITS.premium;
}

export function trialDaysLeft(plan: PlanState, now: Timestamp): number {
  return Math.max(0, Math.ceil((plan.trialEndsAt - now) / DAY_MS));
}

export interface LimitCheck {
  ok: boolean;
  used: number;
  limit: number;
  key: LimitKey;
}

export function checkLimit(key: LimitKey, used: number, tier: PlanTier): LimitCheck {
  const limit = limitsFor(tier)[key];
  return { ok: used < limit, used, limit, key };
}

export function formatLimit(limit: number): string {
  return Number.isFinite(limit) ? String(limit) : 'Unlimited';
}

/**
 * Downgrade to free: nothing is deleted. Keep `limit` items active (the user's picks first, then
 * the most recently updated) and pause the rest until the user upgrades again.
 */
export function downgradeSelection<T extends { id: ID; updatedAt: Timestamp }>(
  items: T[],
  limit: number,
  keepIds: ID[] = [],
): { active: ID[]; paused: ID[] } {
  if (items.length <= limit) return { active: items.map((i) => i.id), paused: [] };
  const keep = new Set(keepIds);
  const ranked = [...items].sort(
    (a, b) => Number(keep.has(b.id)) - Number(keep.has(a.id)) || b.updatedAt - a.updatedAt,
  );
  return { active: ranked.slice(0, limit).map((i) => i.id), paused: ranked.slice(limit).map((i) => i.id) };
}

/** Comparison rows for the pricing page. */
export const PLAN_FEATURES: { label: string; free: string; premium: string }[] = [
  { label: 'Active habits', free: '5', premium: 'Unlimited' },
  { label: 'Active goals', free: '10', premium: 'Unlimited' },
  { label: 'Lessons (mistakes)', free: '25', premium: 'Unlimited' },
  { label: 'Location reminders', free: '1', premium: 'Up to 95' },
  { label: 'Scheduled reminders', free: '3', premium: 'Unlimited' },
  { label: 'AI daily prayer', free: '3 per week', premium: 'Daily + 2 rewrites' },
  { label: 'Habit history', free: '3 months', premium: 'Full' },
  { label: 'Insights', free: 'Basic', premium: 'Full' },
  { label: 'Ads', free: 'Yes', premium: 'None' },
  { label: 'App lock, export, cloud sync', free: 'Included', premium: 'Included' },
];
