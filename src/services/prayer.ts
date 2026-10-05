import { toDayKey } from '@/domain/dates';
import { analyzeNeeds, buildPrayerContext, type PrayerContext } from '@/domain/needs';
import { composeTemplatePrayer, openingOf } from '@/domain/prayer';
import type { FocusTheme, Mood, Prayer, PrayerContent } from '@/domain/types';
import { liveValues, useStore } from '@/store/useStore';
import { callFunction, currentUser } from './firebase';

export interface PrayerResult {
  prayer: Prayer;
  /** Why the AI wasn't used, when it wasn't. */
  fallbackReason?: 'offline' | 'not-signed-in' | 'disabled' | 'quota' | 'error';
}

const THEMES: FocusTheme[] = ['resist', 'discipline', 'forgiveness', 'courage', 'purpose', 'gratitude'];

function isPrayerContent(x: unknown): x is PrayerContent {
  const p = x as PrayerContent;
  return (
    !!p &&
    typeof p.title === 'string' &&
    typeof p.text === 'string' &&
    typeof p.purposeLine === 'string' &&
    Array.isArray(p.dontDoToday) &&
    Array.isArray(p.nudges) &&
    THEMES.includes(p.theme)
  );
}

/**
 * Today's prayer. Uses the AI Cloud Function when the user is signed in, has opted in and has
 * quota left; otherwise composes a personal template prayer on the device.
 */
export async function ensureTodayPrayer(opts: { regenerate?: boolean; mood?: Mood | null } = {}): Promise<PrayerResult> {
  const state = useStore.getState();
  const day = toDayKey();
  const existing = state.prayers[day];
  if (existing && !opts.regenerate) return { prayer: existing };

  const mood = opts.mood ?? (state.todayMood?.day === day ? state.todayMood.mood : null);
  const needs = analyzeNeeds({
    mistakes: liveValues(state.mistakes),
    checkins: liveValues(state.checkins),
    circumstances: liveValues(state.circumstances),
    habits: liveValues(state.habits),
    logs: liveValues(state.habitLogs),
    goals: liveValues(state.goals),
    mood,
    today: day,
  });
  const recentOpenings = liveValues(state.prayers)
    .filter((p) => p.day !== day)
    .sort((a, b) => (a.day < b.day ? 1 : -1))
    .slice(0, 7)
    .map((p) => openingOf(p.text));

  const regenerations = (existing?.regenerations ?? 0) + (opts.regenerate ? 1 : 0);
  const t = Date.now();
  const base = {
    id: day,
    day,
    saved: existing?.saved ?? false,
    helped: null,
    mood,
    regenerations,
    createdAt: existing?.createdAt ?? t,
    updatedAt: t,
  };

  let fallbackReason: PrayerResult['fallbackReason'];
  const allowance = state.aiAllowance(!!opts.regenerate);
  if (!state.settings.aiPrayer) fallbackReason = 'disabled';
  else if (!currentUser()) fallbackReason = 'not-signed-in';
  else if (!allowance.ok) fallbackReason = 'quota';
  else {
    try {
      const context: PrayerContext = buildPrayerContext(needs, {
        day,
        style: state.settings.prayerStyle,
        addressee: state.settings.prayerAddressee,
        name: state.settings.displayName,
        mood,
        recentOpenings,
      });
      const content = await callFunction<{ context: PrayerContext; regenerate: boolean }, PrayerContent>('generateDailyPrayer', {
        context,
        regenerate: !!opts.regenerate,
      });
      if (!isPrayerContent(content)) throw new Error('Malformed prayer');
      state.recordAiUse(!!opts.regenerate);
      const prayer: Prayer = { ...base, ...content, source: 'ai' };
      state.savePrayer(prayer);
      return { prayer };
    } catch (e) {
      console.warn('[prayer] AI generation failed, using template', e);
      fallbackReason = 'error';
    }
  }

  const content = composeTemplatePrayer(
    needs,
    { day, style: state.settings.prayerStyle, addressee: state.settings.prayerAddressee },
    regenerations,
  );
  const prayer: Prayer = { ...base, ...content, source: 'template' };
  state.savePrayer(prayer);
  return { prayer, fallbackReason };
}
