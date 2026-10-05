import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { formatLongDay, isValidDayKey, relativeDayLabel } from '@/domain/dates';
import { dayPlan } from '@/domain/focus';
import { dayProgress } from '@/domain/progress';
import { HabitRow } from '@/features/habits/HabitRow';
import { useActiveHabits, useHabitLogs, useToday } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { Card, EmptyState, ProgressRing, Screen, Text } from '@/ui';

export default function DayScreen() {
  const { colors } = useTheme();
  const { date } = useLocalSearchParams<{ date: string }>();
  const today = useToday();
  const habits = useActiveHabits();
  const logs = useHabitLogs();
  const habitMap = useMemo(() => new Map(habits.map((h) => [h.id, h])), [habits]);
  const day = isValidDayKey(date) ? date : today;
  const plan = useMemo(() => dayPlan(day, habitMap, logs), [day, habitMap, logs]);
  const p = useMemo(() => dayProgress(day, logs.filter((l) => l.day === day), today, new Set(habitMap.keys())), [day, logs, today, habitMap]);
  const logsOfDay = useMemo(() => new Map(logs.filter((l) => l.day === day).map((l) => [l.habitId, l])), [logs, day]);

  return (
    <Screen back title={relativeDayLabel(day, today, false)} subtitle={formatLongDay(day)}>
      <Card variant="hero" padding={20} style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
          <ProgressRing progress={p.ratio} size={96} stroke={9} trackColor={p.isRest ? colors.rest : colors.track}>
            <Text variant="h2">{p.isRest ? '–' : `${Math.round(p.ratio * 100)}%`}</Text>
          </ProgressRing>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="h3">{p.isRest ? 'Rest day' : `${p.done} of ${p.planned} done`}</Text>
            <Text variant="body" tone="muted">
              {p.isRest ? 'Nothing was planned. Rest is part of the system.' : p.ratio === 1 ? 'Every habit kept. Beautiful.' : 'Each check is a vote for who you are becoming.'}
            </Text>
          </View>
        </View>
      </Card>
      {plan.length ? (
        <View style={{ gap: 10 }}>
          {plan.map((slot) => (
            <HabitRow key={slot.habit.id} habit={slot.habit} log={logsOfDay.get(slot.habit.id)!} />
          ))}
        </View>
      ) : (
        <Card>
          <EmptyState icon="calendar-blank-outline" title="Nothing planned" message="Use the weekly planner to spread habits across your week." action="Open planner" onAction={() => router.push('/planner')} />
        </Card>
      )}
    </Screen>
  );
}
