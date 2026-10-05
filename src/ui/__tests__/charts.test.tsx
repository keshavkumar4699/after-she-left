import { render, screen } from '@testing-library/react-native';

import { lastNDays } from '@/domain/dates';
import type { DayProgress } from '@/domain/progress';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { Last7DaysRings, StatTile } from '../Charts';

const days: DayProgress[] = lastNDays('2026-10-05', 7).map((day, i) => {
  const planned = [5, 6, 0, 4, 6, 5, 5][i];
  const done = [5, 3, 0, 4, 3, 1, 2][i];
  return {
    day,
    label: i === 6 ? 'Today' : i === 5 ? 'Yest.' : `D${i}`,
    done,
    planned,
    ratio: planned ? done / planned : 0,
    isToday: i === 6,
    isRest: planned === 0,
  };
});

describe('Last7DaysRings', () => {
  it('shows done/planned for each of the last 7 days, with rest days labelled', async () => {
    await render(
      <ThemeProvider mode="dark">
        <Last7DaysRings days={days} />
      </ThemeProvider>,
    );
    expect(screen.getByLabelText('Today: 2 of 5 habits done')).toBeTruthy();
    expect(screen.getByLabelText('Yest.: 1 of 5 habits done')).toBeTruthy();
    expect(screen.getByLabelText('D2: rest day, nothing planned')).toBeTruthy();
    expect(screen.getByText('2/5')).toBeTruthy();
    expect(screen.getAllByText('3/6')).toHaveLength(2);
    expect(screen.getAllByText('Rest')).toHaveLength(1);
  });
});

describe('StatTile', () => {
  it('renders the label, value and a signed delta', async () => {
    await render(
      <ThemeProvider mode="light">
        <StatTile label="Last 7 days" value="72%" delta={8} deltaLabel="pts vs prev 7 days" />
      </ThemeProvider>,
    );
    expect(screen.getByText('Last 7 days')).toBeTruthy();
    expect(screen.getByText('72%')).toBeTruthy();
    expect(screen.getByText('+8 pts vs prev 7 days')).toBeTruthy();
  });
});
