import { shuffle } from './random';

/**
 * Habit reminders come with a short quote that should never feel repetitive. Quotes are drawn
 * from a shuffle-bag: no quote repeats until the whole deck has been used, and after a reshuffle
 * none of the last `RECENT_WINDOW` quotes can come back early.
 */

export type QuoteTheme =
  | 'consistency'
  | 'identity'
  | 'start-small'
  | 'never-miss-twice'
  | 'discipline'
  | 'resilience'
  | 'purpose'
  | 'reward';

export interface Quote {
  id: string;
  text: string;
  author: string;
  theme: QuoteTheme;
}

export interface QuoteBag {
  /** Remaining quote ids in draw order. */
  bag: string[];
  /** Most recent draws, newest last. */
  recent: string[];
}

export const RECENT_WINDOW = 30;
/** How far into the bag we look for a quote matching the wanted theme. */
const THEME_LOOKAHEAD = 8;

export const emptyBag = (): QuoteBag => ({ bag: [], recent: [] });

function refill(quotes: Quote[], recent: string[], rand: () => number): string[] {
  const window = recent.slice(-Math.min(RECENT_WINDOW, Math.max(0, quotes.length - 1)));
  const blocked = new Set(window);
  const fresh = shuffle(
    quotes.filter((q) => !blocked.has(q.id)).map((q) => q.id),
    rand,
  );
  // Recently used quotes go to the back of the new deck, oldest first, so each one is at least
  // a full deck away from its previous appearance.
  const ids = new Set(quotes.map((q) => q.id));
  const later = window.filter((id) => ids.has(id));
  return [...fresh, ...later];
}

export function drawQuote(
  quotes: Quote[],
  state: QuoteBag,
  rand: () => number,
  theme?: QuoteTheme,
): { quote: Quote; state: QuoteBag } {
  if (quotes.length === 0) throw new Error('No quotes available');
  const byId = new Map(quotes.map((q) => [q.id, q]));
  let bag = state.bag.filter((id) => byId.has(id));
  if (bag.length === 0) bag = refill(quotes, state.recent, rand);

  // Only quotes outside the recent window are eligible (unless the library is too small).
  const recentSet = new Set(state.recent.slice(-Math.min(RECENT_WINDOW, Math.max(0, quotes.length - 1))));
  const eligible = (id: string) => !recentSet.has(id);
  let index = Math.max(0, bag.findIndex(eligible));
  if (theme) {
    const found = bag
      .slice(0, THEME_LOOKAHEAD)
      .findIndex((id) => byId.get(id)?.theme === theme && eligible(id));
    if (found >= 0) index = found;
  }
  const [id] = bag.splice(index, 1);
  const recent = [...state.recent.filter((r) => r !== id), id].slice(-RECENT_WINDOW);
  return { quote: byId.get(id)!, state: { bag, recent } };
}
