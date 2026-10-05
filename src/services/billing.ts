import { Platform } from 'react-native';

import { env } from '@/config/env';
import { DAY_MS, PRICE_USD_MONTHLY } from '@/domain/entitlements';
import { useStore } from '@/store/useStore';

/**
 * Subscription billing: $20/month Premium through Google Play Billing, via RevenueCat.
 * RevenueCat needs a native build and an API key; without them a clearly-labelled test
 * provider is used in development so the full upgrade flow can still be exercised.
 */

export interface Offering {
  priceString: string;
  period: string;
  provider: 'revenuecat' | 'test';
}

export interface PurchaseResult {
  ok: boolean;
  cancelled?: boolean;
  error?: string;
}

type PurchasesModule = typeof import('react-native-purchases').default;

// RevenueCat runs in "Preview API mode" inside Expo Go, so it is safe to load whenever a key exists.
const canUseRevenueCat = Platform.OS === 'android' && !!env.revenueCatAndroidKey;

let purchases: PurchasesModule | null = null;
let configuredFor: string | null | undefined;

function rc(): PurchasesModule | null {
  if (!canUseRevenueCat) return null;
  if (!purchases) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    purchases = (require('react-native-purchases') as { default: PurchasesModule }).default;
  }
  return purchases;
}

export function billingProvider(): Offering['provider'] {
  return canUseRevenueCat ? 'revenuecat' : 'test';
}

export async function initBilling(uid: string | null): Promise<void> {
  const p = rc();
  if (!p || configuredFor === uid) return;
  try {
    if (configuredFor === undefined) {
      p.configure({ apiKey: env.revenueCatAndroidKey, appUserID: uid ?? undefined });
    } else if (uid) {
      await p.logIn(uid);
    }
    configuredFor = uid;
    await refreshEntitlement();
  } catch (e) {
    console.warn('[billing] init failed', e);
  }
}

async function applyCustomerInfo(info: { entitlements: { active: Record<string, { expirationDate: string | null }> } }) {
  const ent = info.entitlements.active[env.revenueCatEntitlement];
  const store = useStore.getState();
  if (ent) {
    const until = ent.expirationDate ? Date.parse(ent.expirationDate) : Date.now() + 31 * DAY_MS;
    store.setPlan({ tier: 'premium', premiumUntil: until });
    store.resumePaused();
  } else if (store.plan.tier === 'premium' && store.plan.source === 'local') {
    store.setPlan({ tier: 'free', premiumUntil: null });
  }
}

export async function refreshEntitlement(): Promise<void> {
  const p = rc();
  if (!p) return;
  const info = await p.getCustomerInfo();
  await applyCustomerInfo(info);
}

export async function getOffering(): Promise<Offering> {
  const p = rc();
  if (p) {
    try {
      const offerings = await p.getOfferings();
      const pkg = offerings.current?.monthly ?? offerings.current?.availablePackages[0];
      if (pkg) return { priceString: pkg.product.priceString, period: 'month', provider: 'revenuecat' };
    } catch (e) {
      console.warn('[billing] offerings failed', e);
    }
  }
  return { priceString: `$${PRICE_USD_MONTHLY}`, period: 'month', provider: 'test' };
}

export async function purchasePremium(): Promise<PurchaseResult> {
  const p = rc();
  if (p) {
    try {
      const offerings = await p.getOfferings();
      const pkg = offerings.current?.monthly ?? offerings.current?.availablePackages[0];
      if (!pkg) return { ok: false, error: 'The subscription is not available right now.' };
      const { customerInfo } = await p.purchasePackage(pkg);
      await applyCustomerInfo(customerInfo);
      return { ok: !!customerInfo.entitlements.active[env.revenueCatEntitlement] };
    } catch (e) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (err.userCancelled) return { ok: false, cancelled: true };
      return { ok: false, error: err.message ?? 'Purchase failed.' };
    }
  }
  if (__DEV__) {
    // Test provider: simulates a successful monthly subscription for this device only.
    const store = useStore.getState();
    store.setPlan({ tier: 'premium', premiumUntil: Date.now() + 30 * DAY_MS });
    store.resumePaused();
    return { ok: true };
  }
  return { ok: false, error: 'Purchases are not available in this build.' };
}

export async function restorePurchases(): Promise<{ ok: boolean; active: boolean; error?: string }> {
  const p = rc();
  if (!p) {
    const plan = useStore.getState().plan;
    return { ok: true, active: !!plan.premiumUntil && plan.premiumUntil > Date.now() };
  }
  try {
    const info = await p.restorePurchases();
    await applyCustomerInfo(info);
    return { ok: true, active: !!info.entitlements.active[env.revenueCatEntitlement] };
  } catch (e) {
    return { ok: false, active: false, error: (e as Error).message };
  }
}

export const MANAGE_SUBSCRIPTION_URL = 'https://play.google.com/store/account/subscriptions?package=com.aftersheleft.app';
