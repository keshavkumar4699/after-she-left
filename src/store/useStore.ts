import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { beginnerStatus } from '@/domain/coaching';
import { addDays, isoWeekKey, toDayKey } from '@/domain/dates';
import { checkLimit, downgradeSelection, effectiveTier, limitsFor, newTrialPlan, type LimitKey } from '@/domain/entitlements';
import { distributeWeek, logId } from '@/domain/planner';
import { drawQuote, type Quote, type QuoteTheme } from '@/domain/quotes';
import { mulberry32, newId } from '@/domain/random';
import { applyRelapse, applyReview, initialReview } from '@/domain/review';
import type {
  Checkin,
  CheckinOutcome,
  Circumstance,
  DayKey,
  Difficulty,
  Goal,
  Habit,
  HabitLog,
  ID,
  Mistake,
  Mood,
  PlanState,
  Prayer,
} from '@/domain/types';
import { QUOTES } from '@/content/quotes';
import { defaultSettings, initialData } from './defaults';
import type { ActionResult, CollectionName, DataState, Settings } from './types';

type Input<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export interface Actions {
  // settings & plan
  updateSettings: (patch: Partial<Settings>) => void;
  completeOnboarding: (input: Partial<Settings>) => void;
  setPlan: (plan: Partial<PlanState>) => void;
  // habits
  addHabit: (input: Input<Habit>) => ActionResult;
  updateHabit: (id: ID, patch: Partial<Habit>) => void;
  archiveHabit: (id: ID) => void;
  deleteHabit: (id: ID) => void;
  // habit logs
  planHabit: (habitId: ID, day: DayKey) => void;
  unplanHabit: (habitId: ID, day: DayKey) => void;
  toggleDone: (habitId: ID, day: DayKey) => boolean;
  setDifficulty: (habitId: ID, day: DayKey, difficulty: Difficulty) => void;
  skipHabit: (habitId: ID, day: DayKey) => void;
  moveHabit: (habitId: ID, from: DayKey, to: DayKey) => void;
  autoPlanWeek: (week: DayKey[]) => number;
  // lessons
  addMistake: (input: Omit<Input<Mistake>, 'review' | 'repeatCount' | 'status'>) => ActionResult;
  updateMistake: (id: ID, patch: Partial<Mistake>) => void;
  deleteMistake: (id: ID) => void;
  reviewMistake: (id: ID, result: 'remembered' | 'forgot') => void;
  addCircumstance: (input: Input<Circumstance>) => ActionResult;
  updateCircumstance: (id: ID, patch: Partial<Circumstance>) => ActionResult;
  deleteCircumstance: (id: ID) => void;
  addCheckin: (input: { circumstanceId?: ID | null; mistakeIds: ID[]; outcome: CheckinOutcome; note?: string }) => void;
  // goals
  addGoal: (input: Input<Goal>) => ActionResult;
  updateGoal: (id: ID, patch: Partial<Goal>) => void;
  deleteGoal: (id: ID) => void;
  toggleMilestone: (goalId: ID, milestoneId: ID) => void;
  // prayer
  savePrayer: (prayer: Prayer) => void;
  updatePrayer: (day: DayKey, patch: Partial<Prayer>) => void;
  setMood: (mood: Mood) => void;
  nextQuote: (theme?: QuoteTheme) => Quote;
  recordAiUse: (regenerate: boolean) => void;
  aiAllowance: (regenerate: boolean) => { ok: boolean; remaining: number };
  // pricing
  applyDowngrade: (keep: { habitIds: ID[]; goalIds: ID[] }) => void;
  resumePaused: () => void;
  markInterstitialShown: () => void;
  // sync & dev
  mergeRemote: (collection: CollectionName, docs: { id: string; updatedAt: number }[]) => void;
  setSyncMeta: (patch: Partial<DataState['sync']>) => void;
  loadDemo: (demo: Partial<DataState>) => void;
  resetAll: () => void;
}

export type AppState = DataState & Actions & { hydrated: boolean };

const now = () => Date.now();
const today = () => toDayKey();
const alive = <T extends { deletedAt?: number | null }>(x: T | undefined): x is T => !!x && !x.deletedAt;

function tierOf(plan: PlanState) {
  return effectiveTier(plan, now());
}

function limitFail(key: LimitKey, used: number, plan: PlanState): ActionResult | null {
  const check = checkLimit(key, used, tierOf(plan));
  return check.ok ? null : { ok: false, reason: 'limit', key, limit: check.limit };
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialData(),
      hydrated: false,

      /* ------------------------------------------------------------------ settings & plan */
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      completeOnboarding: (input) =>
        set((s) => ({
          settings: { ...s.settings, ...input, onboarded: true, beginnerStartedOn: today() },
          // The trial starts when the user starts using the app. A server plan (if signed in) overrides it.
          plan: s.plan.source === 'server' ? s.plan : newTrialPlan(now()),
        })),
      setPlan: (plan) => set((s) => ({ plan: { ...s.plan, ...plan } })),

      /* ------------------------------------------------------------------ habits */
      addHabit: (input) => {
        const s = get();
        const active = Object.values(s.habits).filter((h) => alive(h) && h.status === 'active');
        const beginner = beginnerStatus(s.settings.beginnerMode, s.settings.beginnerStartedOn, Object.values(s.habitLogs), today());
        if (beginner.active && active.length >= beginner.maxHabits) {
          return { ok: false, reason: 'beginner', limit: beginner.maxHabits };
        }
        const fail = limitFail('habits', active.length, s.plan);
        if (fail) return fail;
        const id = newId('h_');
        const t = now();
        set((st) => ({ habits: { ...st.habits, [id]: { ...input, id, createdAt: t, updatedAt: t } } }));
        return { ok: true, id };
      },
      updateHabit: (id, patch) =>
        set((s) => (s.habits[id] ? { habits: { ...s.habits, [id]: { ...s.habits[id], ...patch, updatedAt: now() } } } : s)),
      archiveHabit: (id) => get().updateHabit(id, { status: 'archived' }),
      deleteHabit: (id) => {
        const t = now();
        set((s) => {
          const habitLogs = { ...s.habitLogs };
          for (const [key, log] of Object.entries(habitLogs)) {
            if (log.habitId === id && !log.deletedAt) habitLogs[key] = { ...log, deletedAt: t, updatedAt: t };
          }
          return { habits: { ...s.habits, [id]: { ...s.habits[id], deletedAt: t, updatedAt: t } }, habitLogs };
        });
      },

      /* ------------------------------------------------------------------ habit logs */
      planHabit: (habitId, day) => {
        const id = logId(habitId, day);
        set((s) => {
          const existing = s.habitLogs[id];
          if (alive(existing)) return s;
          const log: HabitLog = { id, habitId, day, status: 'planned', completedAt: null, difficulty: null, updatedAt: now(), deletedAt: null };
          return { habitLogs: { ...s.habitLogs, [id]: log } };
        });
      },
      unplanHabit: (habitId, day) => {
        const id = logId(habitId, day);
        set((s) => (s.habitLogs[id] ? { habitLogs: { ...s.habitLogs, [id]: { ...s.habitLogs[id], deletedAt: now(), updatedAt: now() } } } : s));
      },
      toggleDone: (habitId, day) => {
        const id = logId(habitId, day);
        const existing = get().habitLogs[id];
        const nowDone = !(alive(existing) && existing.status === 'done');
        const t = now();
        const log: HabitLog = {
          id,
          habitId,
          day,
          status: nowDone ? 'done' : 'planned',
          completedAt: nowDone ? t : null,
          difficulty: nowDone ? (existing?.difficulty ?? null) : null,
          updatedAt: t,
          deletedAt: null,
        };
        set((s) => ({ habitLogs: { ...s.habitLogs, [id]: log } }));
        return nowDone;
      },
      setDifficulty: (habitId, day, difficulty) => {
        const id = logId(habitId, day);
        set((s) => (s.habitLogs[id] ? { habitLogs: { ...s.habitLogs, [id]: { ...s.habitLogs[id], difficulty, updatedAt: now() } } } : s));
      },
      skipHabit: (habitId, day) => {
        const id = logId(habitId, day);
        set((s) => (s.habitLogs[id] ? { habitLogs: { ...s.habitLogs, [id]: { ...s.habitLogs[id], status: 'skipped', updatedAt: now() } } } : s));
      },
      moveHabit: (habitId, from, to) => {
        if (from === to) return;
        get().unplanHabit(habitId, from);
        get().planHabit(habitId, to);
      },
      autoPlanWeek: (week) => {
        const s = get();
        const slots = distributeWeek(
          Object.values(s.habits).filter(alive),
          week,
          Object.values(s.habitLogs).filter(alive),
          today(),
        );
        for (const slot of slots) get().planHabit(slot.habitId, slot.day);
        return slots.length;
      },

      /* ------------------------------------------------------------------ lessons */
      addMistake: (input) => {
        const s = get();
        const used = Object.values(s.mistakes).filter(alive).length;
        const fail = limitFail('mistakes', used, s.plan);
        if (fail) return fail;
        const id = newId('m_');
        const t = now();
        const mistake: Mistake = {
          ...input,
          id,
          createdAt: t,
          updatedAt: t,
          status: 'active',
          repeatCount: 0,
          lastRepeatedOn: null,
          review: initialReview(today()),
        };
        set((st) => ({ mistakes: { ...st.mistakes, [id]: mistake } }));
        return { ok: true, id };
      },
      updateMistake: (id, patch) =>
        set((s) => (s.mistakes[id] ? { mistakes: { ...s.mistakes, [id]: { ...s.mistakes[id], ...patch, updatedAt: now() } } } : s)),
      deleteMistake: (id) => get().updateMistake(id, { deletedAt: now() }),
      reviewMistake: (id, result) => {
        const m = get().mistakes[id];
        if (m) get().updateMistake(id, { review: applyReview(m.review, result, today()) });
      },
      addCircumstance: (input) => {
        const s = get();
        const list = Object.values(s.circumstances).filter(alive);
        if (input.location) {
          const fail = limitFail('locationCircumstances', list.filter((c) => c.location).length, s.plan);
          if (fail) return fail;
        }
        if (input.schedule) {
          const fail = limitFail('scheduledCircumstances', list.filter((c) => c.schedule).length, s.plan);
          if (fail) return fail;
        }
        const id = newId('c_');
        const t = now();
        set((st) => ({ circumstances: { ...st.circumstances, [id]: { ...input, id, createdAt: t, updatedAt: t } } }));
        return { ok: true, id };
      },
      updateCircumstance: (id, patch) => {
        const s = get();
        const current = s.circumstances[id];
        if (!current) return { ok: true, id };
        const others = Object.values(s.circumstances).filter((c) => alive(c) && c.id !== id);
        if (patch.location && !current.location) {
          const fail = limitFail('locationCircumstances', others.filter((c) => c.location).length, s.plan);
          if (fail) return fail;
        }
        if (patch.schedule && !current.schedule) {
          const fail = limitFail('scheduledCircumstances', others.filter((c) => c.schedule).length, s.plan);
          if (fail) return fail;
        }
        set((st) => ({ circumstances: { ...st.circumstances, [id]: { ...current, ...patch, updatedAt: now() } } }));
        return { ok: true, id };
      },
      deleteCircumstance: (id) => {
        const t = now();
        set((s) => {
          const mistakes = { ...s.mistakes };
          for (const m of Object.values(mistakes)) {
            if (m.circumstanceIds.includes(id)) {
              mistakes[m.id] = { ...m, circumstanceIds: m.circumstanceIds.filter((c) => c !== id), updatedAt: t };
            }
          }
          return { circumstances: { ...s.circumstances, [id]: { ...s.circumstances[id], deletedAt: t, updatedAt: t } }, mistakes };
        });
      },
      addCheckin: ({ circumstanceId, mistakeIds, outcome, note }) => {
        const id = newId('k_');
        const t = now();
        const day = today();
        const checkin: Checkin = { id, createdAt: t, updatedAt: t, circumstanceId: circumstanceId ?? null, mistakeIds, outcome, note, on: day };
        set((s) => {
          const mistakes = { ...s.mistakes };
          if (outcome === 'repeated') {
            for (const mid of mistakeIds) {
              const m = mistakes[mid];
              if (!m) continue;
              mistakes[mid] = {
                ...m,
                status: 'active',
                repeatCount: m.repeatCount + 1,
                lastRepeatedOn: day,
                review: applyRelapse(m.review, day),
                updatedAt: t,
              };
            }
          }
          return { checkins: { ...s.checkins, [id]: checkin }, mistakes };
        });
      },

      /* ------------------------------------------------------------------ goals */
      addGoal: (input) => {
        const s = get();
        const used = Object.values(s.goals).filter((g) => alive(g) && g.status === 'active').length;
        const fail = limitFail('goals', used, s.plan);
        if (fail) return fail;
        const id = newId('g_');
        const t = now();
        set((st) => ({ goals: { ...st.goals, [id]: { ...input, id, createdAt: t, updatedAt: t } } }));
        return { ok: true, id };
      },
      updateGoal: (id, patch) =>
        set((s) => (s.goals[id] ? { goals: { ...s.goals, [id]: { ...s.goals[id], ...patch, updatedAt: now() } } } : s)),
      deleteGoal: (id) => get().updateGoal(id, { deletedAt: now() }),
      toggleMilestone: (goalId, milestoneId) => {
        const g = get().goals[goalId];
        if (!g) return;
        get().updateGoal(goalId, {
          milestones: g.milestones.map((m) => (m.id === milestoneId ? { ...m, done: !m.done } : m)),
        });
      },

      /* ------------------------------------------------------------------ prayer & quotes */
      savePrayer: (prayer) => set((s) => ({ prayers: { ...s.prayers, [prayer.day]: prayer } })),
      updatePrayer: (day, patch) =>
        set((s) => (s.prayers[day] ? { prayers: { ...s.prayers, [day]: { ...s.prayers[day], ...patch, updatedAt: now() } } } : s)),
      setMood: (mood) => set({ todayMood: { day: today(), mood } }),
      nextQuote: (theme) => {
        const s = get();
        const rand = mulberry32((s.settings.installSeed ^ now()) >>> 0);
        const { quote, state } = drawQuote(QUOTES, s.quoteBag, rand, theme);
        set({ quoteBag: state });
        return quote;
      },
      aiAllowance: (regenerate) => {
        const s = get();
        const limits = limitsFor(tierOf(s.plan));
        const day = today();
        if (regenerate) {
          const used = s.usage.regenDay === day ? s.usage.regenerationsToday : 0;
          return { ok: used < limits.regenerationsPerDay, remaining: Math.max(0, limits.regenerationsPerDay - used) };
        }
        const used = s.usage.aiWeek === isoWeekKey(day) ? s.usage.aiPrayersThisWeek : 0;
        return { ok: used < limits.aiPrayersPerWeek, remaining: Math.max(0, limits.aiPrayersPerWeek - used) };
      },
      recordAiUse: (regenerate) =>
        set((s) => {
          const day = today();
          const week = isoWeekKey(day);
          return regenerate
            ? { usage: { ...s.usage, regenDay: day, regenerationsToday: (s.usage.regenDay === day ? s.usage.regenerationsToday : 0) + 1 } }
            : { usage: { ...s.usage, aiWeek: week, aiPrayersThisWeek: (s.usage.aiWeek === week ? s.usage.aiPrayersThisWeek : 0) + 1 } };
        }),

      /* ------------------------------------------------------------------ pricing */
      applyDowngrade: ({ habitIds, goalIds }) => {
        const s = get();
        const free = limitsFor('free');
        const habits = Object.values(s.habits).filter((h) => alive(h) && h.status === 'active');
        const goals = Object.values(s.goals).filter((g) => alive(g) && g.status === 'active');
        const h = downgradeSelection(habits, free.habits, habitIds);
        const g = downgradeSelection(goals, free.goals, goalIds);
        for (const id of h.paused) get().updateHabit(id, { status: 'paused' });
        for (const id of g.paused) get().updateGoal(id, { status: 'paused' });
        const mistakes = Object.values(s.mistakes).filter(alive);
        const m = downgradeSelection(mistakes, free.mistakes);
        for (const id of m.paused) get().updateMistake(id, { paused: true });
      },
      resumePaused: () => {
        const s = get();
        for (const h of Object.values(s.habits)) if (alive(h) && h.status === 'paused') get().updateHabit(h.id, { status: 'active' });
        for (const g of Object.values(s.goals)) if (alive(g) && g.status === 'paused') get().updateGoal(g.id, { status: 'active' });
        for (const m of Object.values(s.mistakes)) if (alive(m) && m.paused) get().updateMistake(m.id, { paused: false });
        for (const c of Object.values(s.circumstances)) if (alive(c) && c.paused) get().updateCircumstance(c.id, { paused: false });
      },
      markInterstitialShown: () => set((s) => ({ usage: { ...s.usage, lastInterstitialDay: today() } })),

      /* ------------------------------------------------------------------ sync & dev */
      mergeRemote: (collection, docs) =>
        set((s) => {
          const current = { ...(s[collection] as Record<string, { updatedAt: number }>) };
          let changed = false;
          for (const doc of docs) {
            const local = current[doc.id];
            if (!local || (doc.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
              current[doc.id] = doc;
              changed = true;
            }
          }
          return changed ? ({ [collection]: current } as Partial<AppState>) : s;
        }),
      setSyncMeta: (patch) => set((s) => ({ sync: { ...s.sync, ...patch } })),
      loadDemo: (demo) => set((s) => ({ ...s, ...demo, settings: { ...s.settings, ...(demo.settings ?? {}), onboarded: true } })),
      resetAll: () => set({ ...initialData(), settings: { ...defaultSettings(), onboarded: false } }),
    }),
    {
      name: 'after-she-left/v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => {
        const { hydrated: _hydrated, ...rest } = s;
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as Partial<AppState>;
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<DataState>;
        return {
          ...current,
          ...p,
          // New settings keys added in later versions get their defaults.
          settings: { ...current.settings, ...(p.settings ?? {}), reminders: { ...current.settings.reminders, ...(p.settings?.reminders ?? {}) } },
        };
      },
      onRehydrateStorage: () => () => {
        useStore.setState({ hydrated: true });
      },
    },
  ),
);

/* ------------------------------------------------------------------------------------------ */
/* Non-hook helpers                                                                            */
/* ------------------------------------------------------------------------------------------ */

export const liveValues = <T extends { deletedAt?: number | null }>(record: Record<string, T>): T[] =>
  Object.values(record).filter((x) => !x.deletedAt);

export const yesterday = () => addDays(today(), -1);
