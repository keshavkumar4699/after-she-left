import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import * as functionsV1 from 'firebase-functions/v1';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { DAY_MS, TRIAL_DAYS } from './plans';

/** New account → 14-day trial, set on the server so it can't be extended from the device. */
export const onUserCreated = functionsV1.auth.user().onCreate(async (user) => {
  const now = Date.now();
  await getFirestore()
    .doc(`users/${user.uid}`)
    .set(
      {
        plan: { tier: 'trial', trialStartedAt: now, trialEndsAt: now + TRIAL_DAYS * DAY_MS, premiumUntil: null, source: 'server' },
        createdAt: now,
      },
      { merge: true },
    );
  logger.info('trial started', { uid: user.uid });
});

/** Permanently delete the user's cloud data and account. */
export const deleteAccount = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const db = getFirestore();
  await db.recursiveDelete(db.doc(`users/${uid}`));
  await getAuth().deleteUser(uid);
  logger.info('account deleted', { uid });
  return { ok: true };
});
