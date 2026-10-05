import { create } from 'zustand';

import type { PrayerContext } from '@/domain/needs';
import { buildNanoPrompt, parseNanoOutput, type NanoPrayer, type NanoStatus } from '@/domain/prayerEngine';
import { checkNanoStatus, downloadNano, generateWithNano, isNanoModuleLinked } from '../../modules/gemini-nano';

/**
 * Gemini Nano on the phone (Premium on supported Android devices). Status lives in a small store
 * so Settings can show it; generation is never attempted unless the status is "available".
 */

export interface OnDeviceAiState {
  status: NanoStatus | 'unknown';
  /** Last download error, shown in Settings. */
  error: string | null;
}

export const useOnDeviceAi = create<OnDeviceAiState>(() => ({ status: 'unknown', error: null }));

const STATUS_TIMEOUT_MS = 3_000;
const GENERATE_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

let statusCheck: Promise<NanoStatus> | null = null;
let download: Promise<NanoStatus> | null = null;

/**
 * Asks AICore for the current status (shared between concurrent callers). Always settles within
 * a few seconds; a timeout reads as "unavailable" for this call but is not remembered.
 */
export function refreshNanoStatus(): Promise<NanoStatus> {
  if (!statusCheck) {
    statusCheck = withTimeout(checkNanoStatus(), STATUS_TIMEOUT_MS, 'Gemini Nano status')
      .then((status) => {
        // Keep showing "downloading" while our own download is still running.
        if (!(download && status !== 'available')) useOnDeviceAi.setState({ status });
        return status;
      })
      .catch((): NanoStatus => 'unavailable')
      .finally(() => {
        statusCheck = null;
      });
  }
  return statusCheck;
}

/** The status to route today's prayer with. Never waits more than a few seconds. */
export async function getNanoStatus(): Promise<NanoStatus> {
  const known = useOnDeviceAi.getState().status;
  if (known === 'available' || known === 'unavailable') return known;
  return refreshNanoStatus();
}

/** Starts the model download through AICore (or joins the running one). */
export function startNanoDownload(): Promise<NanoStatus> {
  if (!download) {
    useOnDeviceAi.setState({ status: 'downloading', error: null });
    download = downloadNano()
      .then((status) => {
        useOnDeviceAi.setState({ status });
        return status;
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        console.warn('[on-device-ai] download failed', message);
        useOnDeviceAi.setState({ status: 'downloadable', error: message });
        return 'downloadable' as const;
      })
      .finally(() => {
        download = null;
      });
  }
  return download;
}

/**
 * Called at startup for trial and Premium users: checks whether this phone can run Gemini Nano
 * and starts the download in the background when it can. Free users never trigger a download.
 */
export async function prepareOnDeviceAi(): Promise<void> {
  if (!isNanoModuleLinked()) {
    useOnDeviceAi.setState({ status: 'unavailable' });
    return;
  }
  const status = await refreshNanoStatus();
  if (status === 'downloadable' || status === 'downloading') startNanoDownload().catch(() => {});
}

/** Writes the prayer's title and text with Gemini Nano. Rejects on any failure or unusable output. */
export async function generateOnDevice(ctx: PrayerContext): Promise<NanoPrayer> {
  const raw = await withTimeout(
    generateWithNano(buildNanoPrompt(ctx), { temperature: 0.7, topK: 16, maxOutputTokens: 400 }),
    GENERATE_TIMEOUT_MS,
    'Gemini Nano',
  );
  const prayer = parseNanoOutput(raw);
  if (!prayer) throw new Error('Gemini Nano output was not usable');
  return prayer;
}
