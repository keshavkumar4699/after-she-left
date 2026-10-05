import { useEffect, useMemo } from 'react';
import { AppState as RNAppState } from 'react-native';
import { create } from 'zustand';

import { beginnerStatus } from '@/domain/coaching';
import { toDayKey } from '@/domain/dates';
import { effectiveTier, limitsFor, trialDaysLeft } from '@/domain/entitlements';
import type { Habit } from '@/domain/types';
import { useStore } from './useStore';

/* ------------------------------------------------------------------------------------------ */
/* Clock: one source of "now" so every screen rolls over at midnight together.                */
/* ------------------------------------------------------------------------------------------ */

export const useClock = create<{ now: number; tick: () => void }>((set) => ({
  now: Date.now(),
  tick: () => set({ now: Date.now() }),
}));

/** Mount once at the root: ticks every minute and when the app returns to the foreground. */
export function useClockDriver() {
  const tick = useClock((s) => s.tick);
  useEffect(() => {
    const id = setInterval(tick, 60_000);
    const sub = RNAppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [tick]);
}

export function useToday() {
  const now = useClock((s) => s.now);
  return toDayKey(new Date(now));
}

/* ------------------------------------------------------------------------------------------ */
/* Plan & limits                                                                              */
/* ------------------------------------------------------------------------------------------ */

export function usePlanInfo() {
  const plan = useStore((s) => s.plan);
  const now = useClock((s) => s.now);
  return useMemo(() => {
    const tier = effectiveTier(plan, now);
    return { plan, tier, limits: limitsFor(tier), trialDaysLeft: trialDaysLeft(plan, now), isPremium: tier !== 'free' };
  }, [plan, now]);
}

/* ------------------------------------------------------------------------------------------ */
/* Collections (memoised arrays without deleted rows)                                         */
/* ------------------------------------------------------------------------------------------ */

function useLive<K extends 'habits' | 'mistakes' | 'circumstances' | 'checkins' | 'goals' | 'habitLogs' | 'prayers'>(key: K) {
  const record = useStore((s) => s[key]);
  return useMemo(
    () => Object.values(record as Record<string, { deletedAt?: number | null }>).filter((x) => !x.deletedAt),
    [record],
  ) as (typeof record)[string][];
}

export const useHabits = () => useLive('habits');
export const useHabitLogs = () => useLive('habitLogs');
export const useMistakes = () => useLive('mistakes');
export const useCircumstances = () => useLive('circumstances');
export const useCheckins = () => useLive('checkins');
export const useGoals = () => useLive('goals');
export const usePrayers = () => useLive('prayers');

export function useActiveHabits(): Habit[] {
  const habits = useHabits();
  return useMemo(() => habits.filter((h) => h.status === 'active').sort((a, b) => a.order - b.order), [habits]);
}

export function useBeginner() {
  const settings = useStore((s) => s.settings);
  const logs = useHabitLogs();
  const today = useToday();
  return useMemo(
    () => beginnerStatus(settings.beginnerMode, settings.beginnerStartedOn, logs, today),
    [settings.beginnerMode, settings.beginnerStartedOn, logs, today],
  );
}
