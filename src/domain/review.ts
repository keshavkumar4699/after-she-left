import { addDays, diffDays } from './dates';
import type { DayKey, Mistake, ReviewState } from './types';

/**
 * Spaced review: lessons resurface at growing intervals so they stick.
 * Remembered → next stage; forgot → step back one stage; repeated the mistake → start over.
 */
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60, 120] as const;

export function initialReview(today: DayKey): ReviewState {
  return { stage: 0, nextReviewOn: addDays(today, REVIEW_INTERVALS[0]), lastReviewedOn: null, lapses: 0 };
}

export function applyReview(state: ReviewState, result: 'remembered' | 'forgot', today: DayKey): ReviewState {
  const stage =
    result === 'remembered'
      ? Math.min(state.stage + 1, REVIEW_INTERVALS.length - 1)
      : Math.max(state.stage - 1, 0);
  return {
    stage,
    nextReviewOn: addDays(today, REVIEW_INTERVALS[stage]),
    lastReviewedOn: today,
    lapses: state.lapses + (result === 'forgot' ? 1 : 0),
  };
}

/** The mistake happened again: reset the schedule and review tomorrow. */
export function applyRelapse(state: ReviewState, today: DayKey): ReviewState {
  return { stage: 0, nextReviewOn: addDays(today, 1), lastReviewedOn: state.lastReviewedOn, lapses: state.lapses + 1 };
}

export function isDue(state: ReviewState, today: DayKey): boolean {
  return diffDays(state.nextReviewOn, today) >= 0;
}

export function dueLessons(mistakes: Mistake[], today: DayKey): Mistake[] {
  return mistakes
    .filter((m) => !m.deletedAt && !m.paused && m.status !== 'archived' && isDue(m.review, today))
    .sort((a, b) => (a.review.nextReviewOn < b.review.nextReviewOn ? -1 : 1));
}
