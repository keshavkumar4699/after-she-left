/**
 * Firebase Cloud Functions for After She Left.
 *
 *  generateDailyPrayer  callable   AI prayer via the Claude API (quota enforced server-side)
 *  onUserCreated        auth       starts the 14-day trial on the server
 *  deleteAccount        callable   erases the user's cloud data and account
 *  revenuecatWebhook    https      subscription events → users/{uid}.plan
 *
 * Secrets: ANTHROPIC_API_KEY, REVENUECAT_WEBHOOK_AUTH (`firebase functions:secrets:set …`).
 */
import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';

initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

export { deleteAccount, onUserCreated } from './account';
export { revenuecatWebhook } from './billing';
export { generateDailyPrayer } from './prayer';
