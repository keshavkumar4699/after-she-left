import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

import { env } from '@/config/env';
import { toDayKey } from '@/domain/dates';
import { effectiveTier, limitsFor } from '@/domain/entitlements';
import { useStore } from '@/store/useStore';

/**
 * Ads for the free tier only (AdMob). Native ads need a development or production build; in
 * Expo Go and on the web a placeholder is shown instead. Ads are never shown on the lock,
 * prayer, check-in or mistake screens, and sensitive categories are excluded.
 */

export type AdsModule = typeof import('react-native-google-mobile-ads');

export const nativeAdsAvailable = Platform.OS === 'android' && !isRunningInExpoGo();

let mod: AdsModule | null = null;
let initialised = false;

export function adsModule(): AdsModule | null {
  if (!nativeAdsAvailable) return null;
  if (!mod) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require('react-native-google-mobile-ads') as AdsModule;
    } catch {
      return null;
    }
  }
  return mod;
}

export function adsEnabledNow(): boolean {
  const s = useStore.getState();
  return limitsFor(effectiveTier(s.plan, Date.now())).ads;
}

export function bannerUnitId(): string | null {
  const m = adsModule();
  if (!m) return null;
  return __DEV__ || !env.admobBannerAndroid ? m.TestIds.ADAPTIVE_BANNER : env.admobBannerAndroid;
}

/** Shared request options: non-personalised by default, no sensitive keywords. */
export const AD_REQUEST = {
  requestNonPersonalizedAdsOnly: true,
  keywords: ['fitness', 'productivity', 'books', 'self improvement'],
};

/** Consent (UMP) + SDK init. Called once at startup, only for free-tier users. */
export async function initAds(): Promise<void> {
  const m = adsModule();
  if (!m || initialised || !adsEnabledNow()) return;
  initialised = true;
  try {
    await m.AdsConsent.requestInfoUpdate();
    await m.AdsConsent.loadAndShowConsentFormIfRequired();
  } catch (e) {
    console.warn('[ads] consent failed', e);
  }
  try {
    await m.default().setRequestConfiguration({
      maxAdContentRating: m.MaxAdContentRating.PG,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    await m.default().initialize();
  } catch (e) {
    console.warn('[ads] init failed', e);
  }
}

/** At most one interstitial per day, after saving the weekly plan. */
export async function maybeShowInterstitial(): Promise<void> {
  const m = adsModule();
  const s = useStore.getState();
  if (!m || !adsEnabledNow() || s.usage.lastInterstitialDay === toDayKey()) return;
  const unitId = __DEV__ || !env.admobInterstitialAndroid ? m.TestIds.INTERSTITIAL : env.admobInterstitialAndroid;
  const ad = m.InterstitialAd.createForAdRequest(unitId, AD_REQUEST);
  await new Promise<void>((resolve) => {
    const offLoaded = ad.addAdEventListener(m.AdEventType.LOADED, () => {
      ad.show().catch(() => {});
      s.markInterstitialShown();
    });
    const offClosed = ad.addAdEventListener(m.AdEventType.CLOSED, () => done());
    const offError = ad.addAdEventListener(m.AdEventType.ERROR, () => done());
    const timer = setTimeout(() => done(), 8000);
    function done() {
      clearTimeout(timer);
      offLoaded();
      offClosed();
      offError();
      resolve();
    }
    ad.load();
  });
}
