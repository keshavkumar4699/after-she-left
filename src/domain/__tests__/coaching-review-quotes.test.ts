import { addDays, lastNDays } from '../dates';
import { beginnerStatus, difficultySuggestion, scaleNumbers } from '../coaching';
import { drawQuote, emptyBag, type Quote } from '../quotes';
import { mulberry32 } from '../random';
import { applyRelapse, applyReview, initialReview, isDue } from '../review';
import { habit, log } from './fixtures';

const TODAY = '2026-10-05';

describe('beginner mode', () => {
  it('is active for the first days and limits habits to 3', () => {
    const s = beginnerStatus(true, '2026-10-01', [], TODAY);
    expect(s).toMatchObject({ active: true, dayNumber: 5, daysLeft: 17, maxHabits: 3 });
  });

  it('graduates after 21 days, or after 14 days at ≥80% consistency', () => {
    expect(beginnerStatus(true, '2026-09-10', [], TODAY)).toMatchObject({ active: false, graduatedBy: 'time' });
    const consistent = lastNDays(addDays(TODAY, -1), 14).map((d) => log('g', d, 'done'));
    expect(beginnerStatus(true, '2026-09-20', consistent, TODAY)).toMatchObject({
      active: false,
      graduatedBy: 'consistency',
    });
    expect(beginnerStatus(false, TODAY, [], TODAY).active).toBe(false);
  });
});

describe('Goldilocks rule', () => {
  const gym = habit({ id: 'gym', name: 'Gym' });
  const days = lastNDays(addDays(TODAY, -1), 6);

  it('suggests a level-up when the habit is done and feels too easy', () => {
    const logs = days.map((d) => log('gym', d, 'done', { difficulty: 'easy' }));
    expect(difficultySuggestion(gym, logs, TODAY).kind).toBe('level-up');
  });

  it('suggests scaling down when mostly missed or too hard', () => {
    const missed = days.map((d, i) => log('gym', d, i < 2 ? 'done' : 'planned'));
    expect(difficultySuggestion(gym, missed, TODAY).kind).toBe('scale-down');
    const hard = days.map((d) => log('gym', d, 'done', { difficulty: 'hard' }));
    expect(difficultySuggestion(gym, hard, TODAY).kind).toBe('scale-down');
  });

  it('keeps the habit when it is in the sweet spot or there is too little data', () => {
    const right = days.map((d) => log('gym', d, 'done', { difficulty: 'right' }));
    expect(difficultySuggestion(gym, right, TODAY).kind).toBe('keep');
    expect(difficultySuggestion(gym, right.slice(0, 2), TODAY).kind).toBe('keep');
  });

  it('scales numbers in the description by at least one', () => {
    expect(scaleNumbers('Do 20 pushups', 1.1)).toBe('Do 22 pushups');
    expect(scaleNumbers('Read 2 pages', 1.1)).toBe('Read 3 pages');
    expect(scaleNumbers('Run 5 km in 30 min', 0.8)).toBe('Run 4 km in 24 min');
    expect(scaleNumbers('Meditate', 1.1)).toBe('Meditate');
  });
});

describe('spaced review', () => {
  it('advances on remembered, steps back on forgot, resets on relapse', () => {
    let s = initialReview(TODAY);
    expect(s.nextReviewOn).toBe('2026-10-06');
    s = applyReview(s, 'remembered', '2026-10-06');
    expect(s).toMatchObject({ stage: 1, nextReviewOn: '2026-10-09' });
    s = applyReview(s, 'remembered', '2026-10-09');
    expect(s).toMatchObject({ stage: 2, nextReviewOn: '2026-10-16' });
    s = applyReview(s, 'forgot', '2026-10-16');
    expect(s).toMatchObject({ stage: 1, lapses: 1 });
    s = applyRelapse(s, '2026-10-20');
    expect(s).toMatchObject({ stage: 0, nextReviewOn: '2026-10-21', lapses: 2 });
    expect(isDue(s, '2026-10-21')).toBe(true);
    expect(isDue(s, '2026-10-20')).toBe(false);
  });
});

describe('quote shuffle-bag', () => {
  const quotes: Quote[] = Array.from({ length: 50 }, (_, i) => ({
    id: `q${i}`,
    text: `Quote ${i}`,
    author: 'Test',
    theme: i % 5 === 0 ? 'never-miss-twice' : 'consistency',
  }));

  it('never repeats until the deck is exhausted', () => {
    const rand = mulberry32(42);
    let state = emptyBag();
    const seen = new Set<string>();
    for (let i = 0; i < quotes.length; i++) {
      const r = drawQuote(quotes, state, rand);
      expect(seen.has(r.quote.id)).toBe(false);
      seen.add(r.quote.id);
      state = r.state;
    }
    expect(seen.size).toBe(50);
  });

  it('keeps the last 30 quotes out of the next deck’s first draws', () => {
    const rand = mulberry32(7);
    let state = emptyBag();
    const history: string[] = [];
    for (let i = 0; i < 200; i++) {
      const r = drawQuote(quotes, state, rand);
      const lastWindow = history.slice(-30);
      expect(lastWindow).not.toContain(r.quote.id);
      history.push(r.quote.id);
      state = r.state;
    }
  });

  it('prefers a quote matching the wanted theme', () => {
    const r = drawQuote(quotes, emptyBag(), mulberry32(1), 'never-miss-twice');
    expect(r.quote.theme).toBe('never-miss-twice');
  });
});
