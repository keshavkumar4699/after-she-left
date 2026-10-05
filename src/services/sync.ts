import { collection, doc, getDocs, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';

import type { PlanState } from '@/domain/types';
import { useStore } from '@/store/useStore';
import { COLLECTIONS, type CollectionName } from '@/store/types';
import { db } from './firebase';

/**
 * Local-first sync with Firestore (`users/{uid}/{collection}/{id}`).
 *  - Pull: merge remote docs, last-write-wins by `updatedAt` (deletes are tombstones).
 *  - Push: debounced batch of every doc changed since the last push.
 *  - The plan (trial / premium) lives on `users/{uid}` and is written only by Cloud Functions.
 */

/** Firestore rejects `undefined`; a JSON round-trip drops those keys. */
const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export async function pullAll(uid: string): Promise<void> {
  const firestore = db();
  if (!firestore) return;
  const { mergeRemote, setSyncMeta } = useStore.getState();
  for (const name of COLLECTIONS) {
    const snap = await getDocs(collection(firestore, 'users', uid, name));
    mergeRemote(
      name,
      snap.docs.map((d) => d.data() as { id: string; updatedAt: number }),
    );
  }
  setSyncMeta({ uid, lastPulledAt: Date.now() });
}

export async function pushChanges(uid: string): Promise<number> {
  const firestore = db();
  if (!firestore) return 0;
  const state = useStore.getState();
  const since = state.sync.uid === uid ? state.sync.lastPushedAt : 0;
  const changed: { name: CollectionName; id: string; data: unknown }[] = [];
  for (const name of COLLECTIONS) {
    for (const item of Object.values(state[name] as Record<string, { id: string; updatedAt: number }>)) {
      if ((item.updatedAt ?? 0) > since) changed.push({ name, id: item.id, data: item });
    }
  }
  const startedAt = Date.now();
  for (let i = 0; i < changed.length; i += 400) {
    const batch = writeBatch(firestore);
    for (const c of changed.slice(i, i + 400)) batch.set(doc(firestore, 'users', uid, c.name, c.id), clean(c.data));
    await batch.commit();
  }
  // Non-privileged profile fields; `plan` and `usage` are server-owned (see firestore.rules).
  const { settings } = state;
  await setDoc(
    doc(firestore, 'users', uid),
    clean({ profile: { displayName: settings.displayName, prayerStyle: settings.prayerStyle, updatedAt: Date.now() } }),
    { merge: true },
  );
  useStore.getState().setSyncMeta({ uid, lastPushedAt: startedAt });
  return changed.length;
}

/** Start syncing for a signed-in user. Returns a stop function. */
export function startSync(uid: string): () => void {
  const firestore = db();
  if (!firestore) return () => {};
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  pullAll(uid)
    .then(() => pushChanges(uid))
    .catch((e) => console.warn('[sync] initial sync failed', e));

  const unsubscribeStore = useStore.subscribe((state, prev) => {
    const dataChanged = COLLECTIONS.some((name) => state[name] !== prev[name]) || state.settings !== prev.settings;
    if (!dataChanged || stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      pushChanges(uid).catch((e) => console.warn('[sync] push failed', e));
    }, 1500);
  });

  // Server-owned plan: trial end (auth trigger) and premium (RevenueCat webhook).
  const unsubscribePlan = onSnapshot(doc(firestore, 'users', uid), (snap) => {
    const plan = snap.data()?.plan as Partial<PlanState> | undefined;
    if (plan?.trialEndsAt) useStore.getState().setPlan({ ...plan, source: 'server' });
  });

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    unsubscribeStore();
    unsubscribePlan();
  };
}
