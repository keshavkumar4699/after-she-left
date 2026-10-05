import { router } from 'expo-router';
import { create } from 'zustand';

import { LIMIT_LABELS, formatLimit } from '@/domain/entitlements';
import type { ActionResult } from '@/store/types';
import { Dialog } from '@/ui';

/**
 * One dialog for every limit the app enforces: free-tier limits ("upgrade or pause one") and
 * beginner mode ("master these first").
 */

interface UpsellState {
  result: Exclude<ActionResult, { ok: true }> | null;
  show: (r: Exclude<ActionResult, { ok: true }>) => void;
  hide: () => void;
}

export const useUpsell = create<UpsellState>((set) => ({
  result: null,
  show: (result) => set({ result }),
  hide: () => set({ result: null }),
}));

/** Returns true when the action succeeded; otherwise explains the limit. */
export function handleResult(result: ActionResult): result is { ok: true; id: string } {
  if (result.ok) return true;
  useUpsell.getState().show(result);
  return false;
}

export function UpsellDialog() {
  const { result, hide } = useUpsell();
  if (!result) return null;
  if (result.reason === 'beginner') {
    return (
      <Dialog
        visible
        onClose={hide}
        icon="sprout"
        tone="primary"
        title="Master these first"
        message={`In beginner mode you build consistency with ${result.limit} small habits before adding more. Keep showing up: more habits unlock after 14 days at 80% or after 21 days.`}
        confirmLabel="Got it"
      />
    );
  }
  return (
    <Dialog
      visible
      onClose={hide}
      icon="crown-outline"
      tone="accent"
      title={`You've reached ${formatLimit(result.limit)} ${LIMIT_LABELS[result.key]}`}
      message="The free plan keeps things focused. Upgrade to Premium for unlimited habits, goals and lessons, AI prayers every day and no ads. Or pause something to make room."
      confirmLabel="See Premium"
      onConfirm={() => router.push('/paywall')}
      cancelLabel="Not now"
    />
  );
}
