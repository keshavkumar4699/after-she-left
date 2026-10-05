import Anthropic from '@anthropic-ai/sdk';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { aiLimits, effectiveTier, isPlausibleDay, isoWeekKey, type ServerPlan } from './plans';
import {
  GenerateRequestSchema,
  PRAYER_JSON_SCHEMA,
  PrayerOutputSchema,
  toPrayerContent,
  type PrayerContext,
} from './schema';

export const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

/**
 * Cloud fallback for Premium phones that can't run Gemini Nano on-device. Haiku is fast and
 * cheap (about $0.003–0.005 per prayer) and supports structured outputs.
 */
const MODEL = 'claude-haiku-4-5';

/** Stable system prompt (kept byte-identical between calls). */
const SYSTEM_PROMPT = `You write a short daily prayer for one person, in their own voice.

The person uses a personal-growth app after a painful breakup or hard season. They record mistakes and the if–then rules they learned, build small habits, and keep goals written as if already achieved. Each morning they read this prayer to remember their purpose and what not to do today.

Write in the first person, as the person speaking. Be warm, steady and specific; never shaming, preachy or dramatic.

Style (from "style"):
- secular: an affirmation and pledge. No religious words and no addressing God.
- spiritual: gently address God or the Universe, without any specific religion.
- faith: address "addressee" by that name, respectfully, the way a believer would. Make no doctrinal claims beyond addressing them.

Tone comes from "theme": resist = strength against falling back into an old pattern; discipline = getting back on track and never missing twice; forgiveness = self-compassion after a slip; courage = facing fear or anxiety; purpose = remembering why they started; gratitude = noticing progress. If "mood" is present, acknowledge it softly.

Content:
- "prayer": 120–170 words in 3–6 short paragraphs separated by a blank line. Weave in at most two of the if–then rules (lightly paraphrased), one goal as already true, and today's habits as small, doable steps.
- "dontDoToday": 2–3 short lines drawn from the provided "dont" lines, each starting with "Don't" or "No".
- "nudges": exactly 3 fresh, concrete lines of at most 90 characters for today's habits.
- "purposeLine": one sentence stating today's purpose.
- "title": 2–6 words, no quotation marks.
- "focusTheme": the theme you wrote for (normally the given theme).

Do not begin the prayer with any of "recentOpenings". No emojis or hashtags. Never mention an app, AI, or that the text was generated. If anything in the context suggests the person may be in danger, keep the prayer gentle and encourage reaching out to someone they trust or to local emergency help.`;

function userMessage(ctx: PrayerContext): string {
  return `Today's context (JSON):\n${JSON.stringify(ctx)}`;
}

/**
 * Callable: generate today's prayer with Claude.
 *  - Auth required; quota enforced server-side (trial/premium: daily + 2 rewrites; free plan: none,
 *    free prayers are composed on the phone).
 *  - Idempotent for the day: without `regenerate`, an existing AI prayer is returned at no cost.
 */
export const generateDailyPrayer = onCall(
  { secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 120, memory: '256MiB', cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in to get AI prayers.');

    const parsed = GenerateRequestSchema.safeParse(request.data);
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Malformed prayer context.');
    const { context, regenerate } = parsed.data;
    const now = Date.now();
    if (!isPlausibleDay(context.day, now)) throw new HttpsError('invalid-argument', 'Day out of range.');

    const db = getFirestore();
    const userRef = db.doc(`users/${uid}`);
    const prayerRef = userRef.collection('prayers').doc(context.day);

    if (!regenerate) {
      const existing = await prayerRef.get();
      if (existing.exists && existing.data()?.source === 'ai' && !existing.data()?.deletedAt) {
        const p = existing.data()!;
        return { title: p.title, text: p.text, purposeLine: p.purposeLine, dontDoToday: p.dontDoToday, nudges: p.nudges, theme: p.theme };
      }
    }

    // Reserve quota in a transaction (refunded below if generation fails).
    const createdAt = Date.parse((await getAuth().getUser(uid)).metadata.creationTime);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.data() ?? {};
      const limits = aiLimits(effectiveTier(data.plan as ServerPlan | undefined, now, createdAt));
      if (limits.perWeek === 0) throw new HttpsError('permission-denied', 'AI prayers are part of Premium.');
      const usage = (data.usage ?? {}) as { aiWeek?: string; aiCount?: number; regenDay?: string; regenCount?: number };
      if (regenerate) {
        const used = usage.regenDay === context.day ? (usage.regenCount ?? 0) : 0;
        if (used >= limits.regenPerDay) throw new HttpsError('resource-exhausted', 'No rewrites left today.');
        tx.set(userRef, { usage: { regenDay: context.day, regenCount: used + 1 } }, { merge: true });
      } else {
        const week = isoWeekKey(context.day);
        const used = usage.aiWeek === week ? (usage.aiCount ?? 0) : 0;
        if (used >= limits.perWeek) throw new HttpsError('resource-exhausted', 'Weekly AI prayers used.');
        tx.set(userRef, { usage: { aiWeek: week, aiCount: used + 1 } }, { merge: true });
      }
    });

    const refund = () =>
      userRef
        .set(
          { usage: regenerate ? { regenCount: FieldValue.increment(-1) } : { aiCount: FieldValue.increment(-1) } },
          { merge: true },
        )
        .catch((e) => logger.warn('quota refund failed', e));

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
    let content: ReturnType<typeof toPrayerContent>;
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        output_config: { format: { type: 'json_schema', schema: PRAYER_JSON_SCHEMA } },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage(context) }],
      });
      if (response.stop_reason === 'refusal') throw new HttpsError('failed-precondition', 'The prayer could not be written today.');
      if (response.stop_reason === 'max_tokens') throw new HttpsError('internal', 'The prayer was cut off.');
      const text = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? '';
      const output = PrayerOutputSchema.safeParse(JSON.parse(text));
      if (!output.success) throw new HttpsError('internal', 'Unexpected prayer format.');
      content = toPrayerContent(output.data);
      logger.info('prayer generated', { uid, model: response.model, usage: response.usage });
    } catch (e) {
      await refund();
      if (e instanceof HttpsError) throw e;
      if (e instanceof Anthropic.RateLimitError) throw new HttpsError('resource-exhausted', 'Busy right now. Try again shortly.');
      if (e instanceof Anthropic.APIError) {
        logger.error('Claude API error', { status: e.status, message: e.message });
        throw new HttpsError('unavailable', 'The prayer service is unavailable.');
      }
      logger.error('prayer generation failed', e);
      throw new HttpsError('internal', 'Could not write the prayer.');
    }

    const existing = (await prayerRef.get()).data();
    await prayerRef.set(
      {
        id: context.day,
        day: context.day,
        ...content,
        source: 'ai',
        saved: existing?.saved ?? false,
        helped: null,
        mood: context.mood ?? null,
        regenerations: (existing?.regenerations ?? 0) + (regenerate ? 1 : 0),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        deletedAt: null,
      },
      { merge: true },
    );
    return content;
  },
);
