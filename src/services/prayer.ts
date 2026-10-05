import { toDayKey } from '@/domain/dates';
import { effectiveTier } from '@/domain/entitlements';
import { analyzeNeeds, buildPrayerContext, type PrayerContext } from '@/domain/needs';
import { composeTemplatePrayer, openingOf } from '@/domain/prayer';
import { prayerEngineOrder, templateReason, type EngineInput, type TemplateReason } from '@/domain/prayerEngine';
import type { DayKey, FocusTheme, Mood, Prayer, PrayerContent } from '@/domain/types';
import { liveValues, useStore } from '@/store/useStore';
import { callFunction, currentUser } from './firebase';
import { generateOnDevice, getNanoStatus } from './onDeviceAi';

export interface PrayerResult {
  prayer: Prayer;
  /** Why no AI wrote it, when the template was used. */
  fallbackReason?: TemplateReason | 'error';
}

interface PrayerOptions {
  regenerate?: boolean;
  mood?: Mood | null;
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

let inflight: { day: DayKey; promise: Promise<PrayerResult> } | null = null;

/**
 * Today's prayer. Engines are tried cheapest and most private first (see `prayerEngineOrder`):
 * Gemini Nano on the phone, then the cloud function, then the template composer, which always
 * works. Concurrent first-time calls (dashboard + prayer screen) share one generation.
 */
export function ensureTodayPrayer(opts: PrayerOptions = {}): Promise<PrayerResult> {
  const day = toDayKey();
  if (!opts.regenerate) {
    const existing = useStore.getState().prayers[day];
    if (existing) return Promise.resolve({ prayer: existing });
    if (inflight?.day === day) return inflight.promise;
  }
  const promise = writePrayer(day, opts).finally(() => {
    if (inflight?.promise === promise) inflight = null;
  });
  inflight = { day, promise };
  return promise;
}

async function writePrayer(day: DayKey, opts: PrayerOptions): Promise<PrayerResult> {
  const state = useStore.getState();
  const existing = state.prayers[day];
  const regenerate = !!opts.regenerate;
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

  const regenerations = (existing?.regenerations ?? 0) + (regenerate ? 1 : 0);
  const t = Date.now();
  const save = (content: PrayerContent, source: Prayer['source']): Prayer => {
    const prayer: Prayer = {
      id: day,
      day,
      ...content,
      source,
      saved: existing?.saved ?? false,
      helped: null,
      mood,
      regenerations,
      createdAt: existing?.createdAt ?? t,
      updatedAt: Date.now(),
    };
    useStore.getState().savePrayer(prayer);
    return prayer;
  };

  // Always composed: it is the final fallback, and it supplies the purpose line, "not today"
  // lines and nudges for on-device prayers (deterministic, so they stay reliable).
  const template = composeTemplatePrayer(
    needs,
    { day, style: state.settings.prayerStyle, addressee: state.settings.prayerAddressee },
    regenerations,
  );

  const tier = effectiveTier(state.plan, t);
  const aiEnabled = state.settings.aiPrayer;
  const input: EngineInput = {
    tier,
    aiEnabled,
    // Only paying/trial users ever touch the model, so free users never trigger AICore.
    nanoStatus: tier !== 'free' && aiEnabled ? await getNanoStatus() : 'unknown',
    signedIn: !!currentUser(),
    cloudAllowanceOk: state.aiAllowance(regenerate).ok,
  };
  const context = (): PrayerContext =>
    buildPrayerContext(needs, {
      day,
      style: state.settings.prayerStyle,
      addressee: state.settings.prayerAddressee,
      name: state.settings.displayName,
      mood,
      recentOpenings,
    });

  let failed = false;
  for (const engine of prayerEngineOrder(input)) {
    if (engine === 'on-device-ai') {
      try {
        const nano = await generateOnDevice(context());
        return { prayer: save({ ...template, title: nano.title ?? template.title, text: nano.text }, 'on-device') };
      } catch (e) {
        console.warn('[prayer] on-device generation failed', e);
        failed = true;
      }
    } else if (engine === 'cloud') {
      try {
        const content = await callFunction<{ context: PrayerContext; regenerate: boolean }, PrayerContent>('generateDailyPrayer', {
          context: context(),
          regenerate,
        });
        if (!isPrayerContent(content)) throw new Error('Malformed prayer');
        useStore.getState().recordAiUse(regenerate);
        return { prayer: save(content, 'ai') };
      } catch (e) {
        console.warn('[prayer] cloud generation failed', e);
        failed = true;
      }
    }
  }

  return { prayer: save(template, 'template'), fallbackReason: failed ? 'error' : (templateReason(input) ?? undefined) };
}
