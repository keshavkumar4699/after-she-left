/**
 * Build-time configuration. Expo inlines `process.env.EXPO_PUBLIC_*` statically, so every
 * variable must be referenced by its full name. Everything is optional: missing values switch
 * the related feature to its local fallback.
 */
export const env = {
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
  },
  functionsRegion: process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION || 'us-central1',
  revenueCatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
  revenueCatEntitlement: process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT || 'premium',
  admobBannerAndroid: process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID ?? '',
  admobInterstitialAndroid: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID ?? '',
  privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL || 'https://example.com/privacy',
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL || 'https://example.com/terms',
};

export const isFirebaseConfigured = () => !!(env.firebase.apiKey && env.firebase.projectId && env.firebase.appId);
