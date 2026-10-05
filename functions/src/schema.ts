import { z } from 'zod';

/** Compact, privacy-minimal context the app sends (built by `buildPrayerContext` in the app). */
export const PrayerContextSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  theme: z.enum(['resist', 'discipline', 'forgiveness', 'courage', 'purpose', 'gratitude']),
  style: z.enum(['secular', 'spiritual', 'faith']),
  addressee: z.string().max(40).optional(),
  name: z.string().max(40).optional(),
  mood: z.enum(['calm', 'low', 'anxious', 'lonely', 'angry', 'motivated']).nullable().optional(),
  lessons: z.array(z.object({ ifThen: z.string().max(240), dont: z.string().max(160) })).max(3),
  goals: z.array(z.string().max(220)).max(3),
  habitsToday: z.array(z.string().max(60)).max(6),
  recentOpenings: z.array(z.string().max(140)).max(7),
});
export type PrayerContext = z.infer<typeof PrayerContextSchema>;

export const GenerateRequestSchema = z.object({
  context: PrayerContextSchema,
  regenerate: z.boolean().default(false),
});

export const THEMES = ['resist', 'discipline', 'forgiveness', 'courage', 'purpose', 'gratitude'] as const;

/** What Claude must return. Enforced with structured outputs, then validated again here. */
export const PrayerOutputSchema = z.object({
  title: z.string().min(1),
  prayer: z.string().min(40),
  purposeLine: z.string().min(1),
  dontDoToday: z.array(z.string()),
  nudges: z.array(z.string()),
  focusTheme: z.enum(THEMES),
});
export type PrayerOutput = z.infer<typeof PrayerOutputSchema>;

/** JSON schema for `output_config.format` (kept to the structured-outputs subset). */
export const PRAYER_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'prayer', 'purposeLine', 'dontDoToday', 'nudges', 'focusTheme'],
  properties: {
    title: { type: 'string', description: '2 to 6 words, no quotation marks' },
    prayer: { type: 'string', description: '120-170 words in 3-6 short paragraphs separated by blank lines' },
    purposeLine: { type: 'string', description: "One sentence: today's purpose" },
    dontDoToday: { type: 'array', items: { type: 'string' }, description: '2-3 short lines' },
    nudges: { type: 'array', items: { type: 'string' }, description: 'Exactly 3 short lines for today’s habits' },
    focusTheme: { type: 'string', enum: [...THEMES] },
  },
} as const;

/** Shape returned to the app (matches `PrayerContent` in the app's domain types). */
export function toPrayerContent(out: PrayerOutput) {
  const clean = (s: string, max: number) => s.trim().replace(/\s+\n/g, '\n').slice(0, max);
  return {
    title: clean(out.title, 80).replace(/^["“]|["”]$/g, ''),
    text: out.prayer.trim().replace(/\n{3,}/g, '\n\n').slice(0, 1600),
    purposeLine: clean(out.purposeLine, 240),
    dontDoToday: out.dontDoToday.map((s) => clean(s, 120)).filter(Boolean).slice(0, 3),
    nudges: out.nudges.map((s) => clean(s, 120)).filter(Boolean).slice(0, 3),
    theme: out.focusTheme,
  };
}
