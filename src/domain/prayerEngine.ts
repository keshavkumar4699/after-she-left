import type { PrayerContext } from './needs';
import type { FocusTheme, PlanTier, PrayerStyle } from './types';

/**
 * Prayer engine routing. Cheapest and most private first:
 *
 *  1. Free plan             → the template composer on the phone ($0, nothing leaves the phone).
 *  2. Trial / Premium with Gemini Nano on the phone → on-device AI ($0, nothing leaves the phone).
 *  3. Trial / Premium on other phones → the cloud function (Claude Haiku 4.5, server-side quota).
 *
 * Every step falls through to the next on failure, and the template always works.
 */

export type NanoStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable';
export type PrayerEngine = 'on-device-ai' | 'cloud' | 'template';

export interface EngineInput {
  tier: PlanTier;
  /** The user's "Use AI for my prayer" setting. */
  aiEnabled: boolean;
  nanoStatus: NanoStatus | 'unknown';
  signedIn: boolean;
  /** Local view of the cloud quota (the server enforces it again). */
  cloudAllowanceOk: boolean;
}

/** Why the template was used, when it was the only option. */
export type TemplateReason = 'plan' | 'disabled' | 'not-signed-in' | 'quota';

/** The engines to try, in order. Always ends with `template`. */
export function prayerEngineOrder(input: EngineInput): PrayerEngine[] {
  if (input.tier === 'free' || !input.aiEnabled) return ['template'];
  const order: PrayerEngine[] = [];
  if (input.nanoStatus === 'available') order.push('on-device-ai');
  if (input.signedIn && input.cloudAllowanceOk) order.push('cloud');
  order.push('template');
  return order;
}

export function choosePrayerEngine(input: EngineInput): PrayerEngine {
  return prayerEngineOrder(input)[0];
}

/** Why no AI engine was available (for the UI); null when one was. */
export function templateReason(input: EngineInput): TemplateReason | null {
  if (input.tier === 'free') return 'plan';
  if (!input.aiEnabled) return 'disabled';
  if (input.nanoStatus === 'available') return null;
  if (!input.signedIn) return 'not-signed-in';
  if (!input.cloudAllowanceOk) return 'quota';
  return null;
}

/* ---------------------------------------------------------------------------------------------
 * Gemini Nano prompt + output parsing
 * -------------------------------------------------------------------------------------------*/

const THEME_GUIDANCE: Record<FocusTheme, string> = {
  resist: 'strength to resist falling back into an old pattern',
  discipline: 'getting back on track, and never missing twice',
  forgiveness: 'self-compassion after a slip',
  courage: 'facing fear or anxiety',
  purpose: 'remembering why they started',
  gratitude: 'noticing the progress they have made',
};

function styleGuidance(style: PrayerStyle, addressee?: string): string {
  switch (style) {
    case 'secular':
      return 'A secular affirmation and pledge. No religious words, and do not address God.';
    case 'spiritual':
      return 'Gently address God or the Universe, without naming any religion.';
    case 'faith': {
      const name = clean(addressee ?? '', 40) || 'God';
      return `Address ${name} by name, respectfully, the way a believer would.`;
    }
  }
}

/** Single line, no quotes or control characters, capped length. */
function clean(s: string, max: number): string {
  return s
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/["“”]/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, max);
}

function bullets(items: string[], max: number, len: number): string {
  return items
    .map((s) => clean(s, len))
    .filter(Boolean)
    .slice(0, max)
    .map((s) => `- ${s}`)
    .join('\n');
}

/**
 * A short, explicit instruction for the small on-device model. The output format (title line,
 * blank line, paragraphs) is parsed by `parseNanoOutput`.
 */
export function buildNanoPrompt(ctx: PrayerContext): string {
  const parts: string[] = [
    'Write a short morning prayer in the first person ("I"), for someone rebuilding their life after a breakup or a hard season.',
    '',
    `Style: ${styleGuidance(ctx.style, ctx.addressee)}`,
    `Focus today: ${THEME_GUIDANCE[ctx.theme]}.`,
  ];
  if (ctx.mood) parts.push(`This morning they feel ${ctx.mood}. Acknowledge it gently.`);

  const rules = bullets(ctx.lessons.map((l) => l.ifThen), 2, 160);
  if (rules) parts.push('', 'Rules they learned (weave in at most two, in your own words):', rules);
  const goals = bullets(ctx.goals, 2, 160);
  if (goals) parts.push('', 'Their goals (mention one as already true):', goals);
  const habits = bullets(ctx.habitsToday, 4, 50);
  if (habits) parts.push('', 'Small habits planned for today:', habits);
  const avoid = ctx.recentOpenings.map((s) => clean(s, 60)).filter(Boolean).slice(0, 3);
  if (avoid.length) parts.push('', `Do not begin with: ${avoid.map((s) => `"${s}"`).join('; ')}`);

  parts.push(
    '',
    'Format:',
    'Line 1: a title of 2 to 6 words.',
    'Then a blank line.',
    'Then 3 to 5 short paragraphs, 100 to 160 words in total, separated by blank lines.',
    'Warm, steady and specific. Never shaming, preachy or dramatic. No emojis, hashtags, lists or markdown. Do not mention AI or an app.',
  );
  return parts.join('\n');
}

export interface NanoPrayer {
  /** null when the model did not give a usable title (the caller supplies one). */
  title: string | null;
  text: string;
}

const META = /\b(as an ai|language model|i('m| am) (sorry|unable)|i can(not|'t|’t) (help|write|assist|provide))\b/i;
const TERMINAL = /[.!?…'"’”)]$/;

function stripMarkdown(line: string): string {
  return line
    .replace(/^\s*#{1,6}\s*/, '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|[^\w*])\*(?!\s)([^*]+?)\*(?!\w)/g, '$1$2')
    .trim();
}

function stripQuotes(s: string): string {
  return s.replace(/^["“”'‘’]+|["“”'‘’]+$/g, '').trim();
}

function cleanTitle(line: string): string | null {
  const t = stripQuotes(stripMarkdown(line).replace(/^(title|prayer)\s*:\s*/i, ''))
    .replace(/[.:;,]+$/, '')
    .trim();
  const words = t.split(/\s+/).filter(Boolean).length;
  return t.length >= 3 && t.length <= 60 && words >= 1 && words <= 8 ? t : null;
}

/** Splits one long paragraph into paragraphs of two sentences. */
function splitSentences(paragraph: string): string[] {
  const sentences = paragraph.match(/[^.!?…]+[.!?…]+["'’”]?\s*/g)?.map((s) => s.trim()) ?? [paragraph];
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) out.push(sentences.slice(i, i + 2).join(' '));
  return out;
}

/** Drops a trailing sentence cut off by the token limit. */
function dropCutOff(paragraphs: string[]): string[] {
  const out = [...paragraphs];
  const last = out[out.length - 1];
  if (last && !TERMINAL.test(last)) {
    // Greedy: everything up to the last sentence end that is followed by more (cut-off) text.
    const complete = /^([\s\S]*[.!?…]["'’”]?)\s/.exec(last);
    if (complete) out[out.length - 1] = complete[1].trim();
    else out.pop();
  }
  return out;
}

/**
 * Turns raw Gemini Nano text into a prayer, or null when it is unusable (empty, meta text,
 * too short or too long). Tolerates markdown, quotes, a "Title:" label and a cut-off ending.
 */
export function parseNanoOutput(raw: string): NanoPrayer | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.replace(/\r\n?/g, '\n').replace(/```[a-z]*\n?/gi, '').trim();
  if (!normalized || META.test(normalized)) return null;

  const lines = normalized.split('\n');
  const firstIdx = lines.findIndex((l) => l.trim() !== '');
  let title: string | null = null;
  let bodyLines = lines;
  const candidate = cleanTitle(lines[firstIdx] ?? '');
  if (candidate && lines.slice(firstIdx + 1).some((l) => l.trim() !== '')) {
    title = candidate;
    bodyLines = lines.slice(firstIdx + 1);
  }

  // Paragraphs: blank-line separated; if the model used single newlines, each line is one.
  const body = bodyLines.map((l) => stripMarkdown(l)).join('\n').trim();
  let paragraphs = (/\n\s*\n/.test(body) ? body.split(/\n\s*\n/) : body.split('\n'))
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter((p) => p && !/^(prayer|amen\.?)$/i.test(p) && !/^title\s*:/i.test(p));
  // The whole prayer wrapped in quotes.
  const end = paragraphs.length - 1;
  if (end >= 0 && /^["“]/.test(paragraphs[0]) && /["”]$/.test(paragraphs[end])) {
    paragraphs[0] = paragraphs[0].replace(/^["“]+/, '');
    paragraphs[end] = paragraphs[end].replace(/["”]+$/, '');
  }
  paragraphs = dropCutOff(paragraphs.filter(Boolean));
  if (paragraphs.length === 1) paragraphs = splitSentences(paragraphs[0]);

  const text = paragraphs.join('\n\n');
  if (paragraphs.length < 2 || text.length < 60 || text.length > 1500) return null;
  return { title, text };
}
