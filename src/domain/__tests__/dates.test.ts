import {
  addDays,
  diffDays,
  isLeapYear,
  isValidDate,
  isValidDayKey,
  isoWeekKey,
  isWithinWindow,
  lastNDays,
  monthMatrix,
  relativeDayLabel,
  startOfWeek,
  weekdayOf,
} from '../dates';

describe('dates', () => {
  it('validates real calendar dates (29 Feb only in leap years)', () => {
    expect(isLeapYear(2027)).toBe(false);
    expect(isLeapYear(2028)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(isValidDate(2027, 2, 29)).toBe(false);
    expect(isValidDate(2028, 2, 29)).toBe(true);
    expect(isValidDayKey('2027-02-28')).toBe(true);
    expect(isValidDayKey('2027-02-29')).toBe(false);
    expect(isValidDayKey('2027-13-01')).toBe(false);
  });

  it('does day arithmetic across month, year and DST boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30'); // EU DST change
    expect(diffDays('2026-10-05', '2027-02-28')).toBe(146);
  });

  it('returns the last 7 days ending today, oldest first', () => {
    expect(lastNDays('2026-10-05', 7)).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
    ]);
  });

  it('knows weekdays and week starts', () => {
    expect(weekdayOf('2026-10-05')).toBe(1); // Monday
    expect(startOfWeek('2026-10-08', 1)).toBe('2026-10-05');
    expect(startOfWeek('2026-10-08', 0)).toBe('2026-10-04');
    expect(isoWeekKey('2026-10-05')).toBe('2026-W41');
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53');
  });

  it('labels days relative to today', () => {
    expect(relativeDayLabel('2026-10-05', '2026-10-05')).toBe('Today');
    expect(relativeDayLabel('2026-10-04', '2026-10-05')).toBe('Yest.');
    expect(relativeDayLabel('2026-10-03', '2026-10-05')).toBe('Sat');
  });

  it('builds a month matrix with padding', () => {
    const feb2027 = monthMatrix(2027, 2, 1);
    expect(feb2027.flat().filter(Boolean)).toHaveLength(28);
    expect(feb2027[0][0]).toBe('2027-02-01'); // 1 Feb 2027 is a Monday
    expect(feb2027.every((row) => row.length === 7)).toBe(true);
  });

  it('handles time windows that wrap midnight', () => {
    const start = { hour: 22, minute: 0 };
    const end = { hour: 7, minute: 0 };
    expect(isWithinWindow({ hour: 23, minute: 30 }, start, end)).toBe(true);
    expect(isWithinWindow({ hour: 6, minute: 59 }, start, end)).toBe(true);
    expect(isWithinWindow({ hour: 7, minute: 0 }, start, end)).toBe(false);
    expect(isWithinWindow({ hour: 12, minute: 0 }, start, end)).toBe(false);
  });
});
