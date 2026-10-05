import { toDayKey } from '@/domain/dates';
import { newTrialPlan } from '@/domain/entitlements';
import { emptyBag } from '@/domain/quotes';
import type { DataState, Settings } from './types';

export function defaultSettings(): Settings {
  return {
    displayName: '',
    themeMode: 'system',
    prayerStyle: 'secular',
    prayerAddressee: '',
    prayerTime: { hour: 6, minute: 30 },
    aiPrayer: true,
    reviewTime: { hour: 21, minute: 0 },
    quietHours: { start: { hour: 22, minute: 30 }, end: { hour: 7, minute: 0 } },
    activeHours: { start: { hour: 9, minute: 0 }, end: { hour: 20, minute: 0 } },
    weekStartsOn: 1,
    beginnerMode: true,
    beginnerStartedOn: toDayKey(),
    notificationPrivacy: true,
    reminders: {
      circumstances: true,
      prayer: true,
      nudges: true,
      review: true,
      planning: true,
      neverMissTwice: true,
      geofences: true,
    },
    appLock: false,
    lockAfterSec: 30,
    secureScreen: false,
    onboarded: false,
    installSeed: Math.floor(Math.random() * 2 ** 31),
  };
}

export function initialData(): DataState {
  const now = Date.now();
  return {
    settings: defaultSettings(),
    plan: newTrialPlan(now),
    usage: { aiWeek: '', aiPrayersThisWeek: 0, regenDay: '', regenerationsToday: 0, lastInterstitialDay: null },
    mistakes: {},
    circumstances: {},
    checkins: {},
    goals: {},
    habits: {},
    habitLogs: {},
    prayers: {},
    quoteBag: emptyBag(),
    todayMood: null,
    sync: { uid: null, lastPulledAt: 0, lastPushedAt: 0 },
  };
}

export const HABIT_EMOJIS = ['💪', '⚽', '📖', '🧘', '🏃', '💧', '🥗', '😴', '✍️', '🎸', '💰', '🧠', '🚶', '🙏', '📵', '🌅'];

export const CIRCUMSTANCE_ICONS = [
  'weather-night',
  'cellphone-message',
  'glass-cocktail',
  'cash-multiple',
  'account-group',
  'home-heart',
  'briefcase-outline',
  'emoticon-sad-outline',
  'map-marker-radius',
  'calendar-weekend',
] as const;

export const EMOTIONS = ['lonely', 'angry', 'anxious', 'sad', 'bored', 'tired', 'ashamed', 'jealous', 'stressed', 'hopeless'];
