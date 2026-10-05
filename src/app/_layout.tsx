import { Fraunces_400Regular, Fraunces_400Regular_Italic, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LockOverlay } from '@/components/LockOverlay';
import { UpsellDialog } from '@/components/Upsell';
import { initAds } from '@/services/ads';
// Importing these modules also defines their background tasks (geofence, refresh) at startup.
import { registerBackgroundRefresh } from '@/services/background';
import { initBilling } from '@/services/billing';
import { onUserChanged } from '@/services/firebase';
import { syncGeofences } from '@/services/geofence';
import { useAppLockDriver, useSecureScreen } from '@/services/lock';
import { setupNotifications, useNotificationResponses, useReminderSync } from '@/services/notifications';
import { prepareOnDeviceAi } from '@/services/onDeviceAi';
import { startSync } from '@/services/sync';
import { useClockDriver, usePlanInfo } from '@/store/hooks';
import { useStore } from '@/store/useStore';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { SnackbarHost } from '@/ui';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_600SemiBold,
  });
  const hydrated = useStore((s) => s.hydrated);
  const themeMode = useStore((s) => s.settings.themeMode);
  useClockDriver();

  useEffect(() => {
    if (fontsLoaded && hydrated) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, hydrated]);

  if (!fontsLoaded || !hydrated) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider mode={themeMode}>
        <AppShell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppShell() {
  const { colors, scheme } = useTheme();
  const onboarded = useStore((s) => s.settings.onboarded);
  const secureScreen = useStore((s) => s.settings.secureScreen);
  const circumstances = useStore((s) => s.circumstances);
  const geofencesOn = useStore((s) => s.settings.reminders.geofences);
  const aiPrayer = useStore((s) => s.settings.aiPrayer);
  const { isPremium } = usePlanInfo();

  useAppLockDriver(true);
  useSecureScreen(secureScreen);
  useNotificationResponses();
  useReminderSync(onboarded);

  useEffect(() => {
    setupNotifications().catch(() => {});
    registerBackgroundRefresh();
    initAds();
  }, []);

  useEffect(() => {
    if (onboarded) syncGeofences();
  }, [onboarded, circumstances, geofencesOn]);

  // Trial/Premium: get Gemini Nano ready on supported phones so prayers are written on-device.
  useEffect(() => {
    if (isPremium && aiPrayer) prepareOnDeviceAi().catch(() => {});
  }, [isPremium, aiPrayer]);

  // Cloud: when a user signs in, start sync and link purchases to their account.
  useEffect(() => {
    let stop: (() => void) | null = null;
    const unsubscribe = onUserChanged((user) => {
      stop?.();
      stop = user ? startSync(user.uid) : null;
      initBilling(user?.uid ?? null);
    });
    return () => {
      stop?.();
      unsubscribe();
    };
  }, []);

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: colors.bg, card: colors.surface, text: colors.text, border: colors.border, primary: colors.primary },
  };

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="checkin" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="prayer" options={{ animation: 'fade_from_bottom' }} />
      </Stack>
      <SnackbarHost />
      <UpsellDialog />
      <LockOverlay />
    </NavThemeProvider>
  );
}
