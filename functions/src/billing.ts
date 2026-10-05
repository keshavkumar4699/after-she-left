import { timingSafeEqual } from 'node:crypto';

import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';

import { planFromRevenueCat } from './plans';

/** The Authorization header value configured for this webhook in the RevenueCat dashboard. */
export const REVENUECAT_WEBHOOK_AUTH = defineSecret('REVENUECAT_WEBHOOK_AUTH');

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * RevenueCat → Firestore. The app calls `Purchases.logIn(firebaseUid)`, so `app_user_id` is the
 * Firebase uid. Writes `users/{uid}.plan`, which only the server may write (see firestore.rules).
 */
export const revenuecatWebhook = onRequest({ secrets: [REVENUECAT_WEBHOOK_AUTH] }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }
  const expected = REVENUECAT_WEBHOOK_AUTH.value();
  const header = req.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : header;
  if (!expected || !sameSecret(provided, expected)) {
    res.status(401).send('Unauthorized');
    return;
  }

  const event = req.body?.event as
    | { type?: string; app_user_id?: string; expiration_at_ms?: number | null; product_id?: string; environment?: string }
    | undefined;
  if (!event?.type || !event.app_user_id) {
    res.status(400).send('Missing event');
    return;
  }
  if (event.app_user_id.startsWith('$RCAnonymousID')) {
    res.status(200).send('Ignored anonymous user');
    return;
  }

  const update = planFromRevenueCat(event.type, event.expiration_at_ms, Date.now());
  if (update) {
    await getFirestore()
      .doc(`users/${event.app_user_id}`)
      .set(
        {
          plan: {
            ...update,
            source: 'server',
            productId: event.product_id ?? null,
            store: 'play',
            sandbox: event.environment === 'SANDBOX',
            updatedAt: Date.now(),
          },
        },
        { merge: true },
      );
    logger.info('plan updated', { uid: event.app_user_id, type: event.type, tier: update.tier });
  }
  res.status(200).send('ok');
});
