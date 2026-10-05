import * as LocalAuthentication from 'expo-local-authentication';
import * as ScreenCapture from 'expo-screen-capture';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

import { useStore } from '@/store/useStore';

/**
 * App lock (biometrics or the device PIN) and screen privacy (FLAG_SECURE on Android).
 * The lock is a full-screen overlay rendered above the navigator, so nothing underneath can be
 * read or tapped until the user authenticates.
 */

const supported = Platform.OS !== 'web';

export const useLock = create<{ locked: boolean; setLocked: (v: boolean) => void }>((set) => ({
  locked: false,
  setLocked: (locked) => set({ locked }),
}));

export async function lockAvailability(): Promise<{ available: boolean; reason?: string }> {
  if (!supported) return { available: false, reason: 'App lock works on your phone, not on the web preview.' };
  // Biometrics or a device PIN/pattern both work (the PIN is the fallback).
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE) {
    return { available: false, reason: 'Set a screen lock (PIN, pattern or fingerprint) on your phone first.' };
  }
  return { available: true };
}

export async function authenticate(): Promise<boolean> {
  if (!supported) return true;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock After She Left',
    fallbackLabel: 'Use PIN',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  return result.success;
}

/** Locks on launch and after `lockAfterSec` in the background. Mount once at the root. */
export function useAppLockDriver(hydrated: boolean) {
  const appLock = useStore((s) => s.settings.appLock);
  const lockAfterSec = useStore((s) => s.settings.lockAfterSec);
  const setLocked = useLock((s) => s.setLocked);
  const backgroundAt = useRef<number | null>(null);
  const initialised = useRef(false);

  useEffect(() => {
    if (!hydrated || initialised.current) return;
    initialised.current = true;
    if (appLock && supported) setLocked(true);
  }, [hydrated, appLock, setLocked]);

  useEffect(() => {
    if (!supported) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundAt.current = Date.now();
      if (state === 'active' && appLock && backgroundAt.current) {
        if (Date.now() - backgroundAt.current >= lockAfterSec * 1000) setLocked(true);
        backgroundAt.current = null;
      }
    });
    return () => sub.remove();
  }, [appLock, lockAfterSec, setLocked]);
}

/** Hide the app content from screenshots and the recent-apps switcher. */
export function useSecureScreen(enabled: boolean) {
  useEffect(() => {
    if (!supported) return;
    if (enabled) ScreenCapture.preventScreenCaptureAsync('privacy').catch(() => {});
    else ScreenCapture.allowScreenCaptureAsync('privacy').catch(() => {});
  }, [enabled]);
}
