import type { QuoteBag } from '@/domain/quotes';
import type {
  Checkin,
  Circumstance,
  DayKey,
  Goal,
  Habit,
  HabitLog,
  ID,
  Mistake,
  Mood,
  PlanState,
  Prayer,
  PrayerStyle,
  TimeOfDay,
} from '@/domain/types';
import type { LimitKey } from '@/domain/entitlements';
import type { ThemeMode } from '@/theme/ThemeProvider';

export interface ReminderToggles {
  circumstances: boolean;
  prayer: boolean;
  nudges: boolean;
  review: boolean;
  planning: boolean;
  neverMissTwice: boolean;
  geofences: boolean;
}

export interface Settings {
  displayName: string;
  themeMode: ThemeMode;
  prayerStyle: PrayerStyle;
  prayerAddressee: string;
  prayerTime: TimeOfDay;
  /** Premium: let AI write the prayer (Gemini Nano on the phone, else the cloud function). */
  aiPrayer: boolean;
  reviewTime: TimeOfDay;
  quietHours: { start: TimeOfDay; end: TimeOfDay };
  activeHours: { start: TimeOfDay; end: TimeOfDay };
  weekStartsOn: 0 | 1;
  beginnerMode: boolean;
  beginnerStartedOn: DayKey;
  notificationPrivacy: boolean;
  reminders: ReminderToggles;
  appLock: boolean;
  lockAfterSec: number;
  secureScreen: boolean;
  onboarded: boolean;
  /** Per-install seed for deterministic quote cycles and nudge times. */
  installSeed: number;
}

export interface Usage {
  /** ISO week of the counter below. */
  aiWeek: string;
  aiPrayersThisWeek: number;
  regenDay: DayKey;
  regenerationsToday: number;
  lastInterstitialDay: DayKey | null;
}

export interface SyncMeta {
  uid: string | null;
  lastPulledAt: number;
  lastPushedAt: number;
}

export interface DataState {
  settings: Settings;
  plan: PlanState;
  usage: Usage;
  mistakes: Record<ID, Mistake>;
  circumstances: Record<ID, Circumstance>;
  checkins: Record<ID, Checkin>;
  goals: Record<ID, Goal>;
  habits: Record<ID, Habit>;
  habitLogs: Record<string, HabitLog>;
  prayers: Record<DayKey, Prayer>;
  quoteBag: QuoteBag;
  todayMood: { day: DayKey; mood: Mood } | null;
  sync: SyncMeta;
}

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'limit'; key: LimitKey; limit: number }
  | { ok: false; reason: 'beginner'; limit: number };

export type CollectionName = 'mistakes' | 'circumstances' | 'checkins' | 'goals' | 'habits' | 'habitLogs' | 'prayers';

export const COLLECTIONS: CollectionName[] = ['mistakes', 'circumstances', 'checkins', 'goals', 'habits', 'habitLogs', 'prayers'];
