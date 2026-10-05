import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/**
 * Gemini Nano on the phone (Android AICore, via the ML Kit GenAI Prompt API).
 *
 * The native module only exists in Android development/production builds. On the web, iOS and
 * Expo Go every call reports "unavailable", so callers never need their own platform checks.
 */

export type NanoStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable';

export interface NanoGenerateOptions {
  temperature: number;
  topK: number;
  maxOutputTokens: number;
}

interface GeminiNanoNative {
  checkStatus(): Promise<string>;
  download(): Promise<string>;
  generate(prompt: string, temperature: number, topK: number, maxOutputTokens: number): Promise<string | null>;
}

const native: GeminiNanoNative | null =
  Platform.OS === 'android' ? requireOptionalNativeModule<GeminiNanoNative>('GeminiNano') : null;

const STATUSES: NanoStatus[] = ['available', 'downloadable', 'downloading', 'unavailable'];

function toStatus(value: unknown): NanoStatus {
  return STATUSES.includes(value as NanoStatus) ? (value as NanoStatus) : 'unavailable';
}

export function isNanoModuleLinked(): boolean {
  return native != null;
}

export async function checkNanoStatus(): Promise<NanoStatus> {
  if (!native) return 'unavailable';
  try {
    return toStatus(await native.checkStatus());
  } catch {
    return 'unavailable';
  }
}

/** Starts (or joins) the model download. Resolves with the status once it finishes. */
export async function downloadNano(): Promise<NanoStatus> {
  if (!native) return 'unavailable';
  return toStatus(await native.download());
}

/** Generates text on the device. Rejects when the model is missing, busy or fails. */
export async function generateWithNano(prompt: string, options: NanoGenerateOptions): Promise<string> {
  if (!native) throw new Error('Gemini Nano is not available on this device');
  const text = await native.generate(
    prompt,
    options.temperature,
    Math.round(options.topK),
    Math.round(options.maxOutputTokens),
  );
  if (typeof text !== 'string' || !text.trim()) throw new Error('Gemini Nano returned no text');
  return text;
}
