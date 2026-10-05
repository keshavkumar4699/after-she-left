/**
 * Server-side view of the pricing model. Mirrors `src/domain/entitlements.ts` in the app; the
 * server is the source of truth for anything that costs money (AI prayers).
 */

export const TRIAL_DAYS = 14;
export const DAY_MS = 86_400_000;

export type Tier = 'trial' | 'premium' | 'free';

export interface ServerPlan {
  tier?: Tier;
  trialStartedAt?: number;
  trialEndsAt?: number;
  premiumUntil?: number | null;
}

/** Cloud AI prayers. Free prayers are composed on the phone, so the free plan gets none. */
export const AI_LIMITS: Record<'free' | 'premium', { perWeek: number; regenPerDay: number }> = {
  free: { perWeek: 0, regenPerDay: 0 },
  premium: { perWeek: 7, regenPerDay: 2 },
};

export function effectiveTier(plan: ServerPlan | undefined, now: number, accountCreatedAt?: number): Tier {
  if (plan?.premiumUntil && plan.premiumUntil > now) return 'premium';
  const trialEnds = plan?.trialEndsAt ?? (accountCreatedAt ? accountCreatedAt + TRIAL_DAYS * DAY_MS : 0);
  if (now < trialEnds) return 'trial';
  return 'free';
}

export function aiLimits(tier: Tier) {
  return tier === 'free' ? AI_LIMITS.free : AI_LIMITS.premium;
}

/** ISO-8601 week id for a `YYYY-MM-DD` day, e.g. `2026-W41`. */
export function isoWeekKey(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const dayNum = (new Date(ms).getUTCDay() + 6) % 7;
  const thursday = new Date(ms + (3 - dayNum) * DAY_MS);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  const week = Math.floor((thursday.getTime() - yearStart) / DAY_MS / 7) + 1;
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * The client sends its local calendar day. Accept it only when it is within a day of the
 * server's UTC date (covers every time zone) so quotas can't be gamed with arbitrary dates.
 */
export function isPlausibleDay(day: string, now: number): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const [y, m, d] = day.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return false;
  const today = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());
  return Math.abs(ms - today) <= DAY_MS;
}

export type RevenueCatEventType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'PRODUCT_CHANGE'
  | 'UNCANCELLATION'
  | 'NON_RENEWING_PURCHASE'
  | 'SUBSCRIPTION_EXTENDED'
  | 'TEMPORARY_ENTITLEMENT_GRANT'
  | 'CANCELLATION'
  | 'BILLING_ISSUE'
  | 'EXPIRATION'
  | 'SUBSCRIPTION_PAUSED'
  | 'TRANSFER'
  | 'TEST';

/** Map a RevenueCat webhook event to a plan update (or null when nothing changes). */
export function planFromRevenueCat(
  type: string,
  expirationAtMs: number | null | undefined,
  now: number,
): { tier: Tier; premiumUntil: number | null; willRenew?: boolean; billingIssue?: boolean } | null {
  switch (type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'PRODUCT_CHANGE':
    case 'UNCANCELLATION':
    case 'NON_RENEWING_PURCHASE':
    case 'SUBSCRIPTION_EXTENDED':
    case 'TEMPORARY_ENTITLEMENT_GRANT':
      return { tier: 'premium', premiumUntil: expirationAtMs ?? now + 31 * DAY_MS, willRenew: true, billingIssue: false };
    case 'CANCELLATION':
      // Access continues until the paid period ends.
      return { tier: 'premium', premiumUntil: expirationAtMs ?? now, willRenew: false };
    case 'BILLING_ISSUE':
      return { tier: 'premium', premiumUntil: expirationAtMs ?? now, billingIssue: true };
    case 'EXPIRATION':
    case 'SUBSCRIPTION_PAUSED':
      return { tier: 'free', premiumUntil: expirationAtMs ?? now, willRenew: false };
    default:
      return null;
  }
}
