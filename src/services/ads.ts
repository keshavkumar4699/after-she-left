/**
 * Web / default build of the ads service. AdMob is native-only, so on the web the app shows a
 * labelled placeholder (see AdBanner) and these functions are no-ops. The Android implementation
 * lives in `ads.native.ts` and exports the same API.
 */
export type AdsModule = typeof import('react-native-google-mobile-ads');

export const nativeAdsAvailable = false;

export function adsModule(): AdsModule | null {
  return null;
}

export function adsEnabledNow(): boolean {
  return false;
}

export function bannerUnitId(): string | null {
  return null;
}

export const AD_REQUEST = {
  requestNonPersonalizedAdsOnly: true,
  keywords: ['fitness', 'productivity', 'books', 'self improvement'],
};

export async function initAds(): Promise<void> {}

export async function maybeShowInterstitial(): Promise<void> {}
