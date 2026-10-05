import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { difficultySuggestion, scaleNumbers } from '@/domain/coaching';
import { diffDays, formatDay } from '@/domain/dates';
import { dueLessons } from '@/domain/review';
import type { Circumstance, Goal, Habit, HabitLog, Mistake } from '@/domain/types';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/theme/ThemeProvider';
import { Badge, Button, Card, Chip, Icon, ProgressBar, SectionHeader, Text, toast } from '@/ui';

/** Goldilocks: suggest levelling a habit up or down so it stays between easy and hard. */
export function GoldilocksCard({ habits, logs, today }: { habits: Habit[]; logs: HabitLog[]; today: string }) {
  const { colors } = useTheme();
  const updateHabit = useStore((s) => s.updateHabit);
  const [dismissed, setDismissed] = useState<string[]>([]);
  let suggestion: { habit: Habit; s: ReturnType<typeof difficultySuggestion> } | null = null;
  for (const h of habits) {
    if (dismissed.includes(h.id)) continue;
    const s = difficultySuggestion(h, logs, today);
    if (s.kind !== 'keep') {
      suggestion = { habit: h, s };
      break;
    }
  }
  if (!suggestion) return null;
  const { habit, s } = suggestion;
  const up = s.kind === 'level-up';
  const nextFull = scaleNumbers(habit.full || habit.twoMinute, up ? 1.1 : 0.8);

  return (
    <Card variant="tonal" tone={up ? 'accent' : 'violet'}>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name={up ? 'trending-up' : 'feather'} size={20} color={up ? colors.accent : colors.violet} />
          <Text variant="overline" tone="muted">
            {up ? 'Level up' : 'Make it easier'} · Goldilocks rule
          </Text>
        </View>
        <Text variant="bodyStrong">{s.message}</Text>
        <Text variant="caption" tone="muted">
          {Math.round(s.completion * 100)}% done in the last 2 weeks · {Math.round((up ? s.easyShare : s.hardShare) * 100)}% felt{' '}
          {up ? 'too easy' : 'too hard'}
        </Text>
        {nextFull && nextFull !== (habit.full || habit.twoMinute) ? (
          <Text variant="body">
            Try: <Text variant="bodyStrong">{nextFull}</Text>
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            label={up ? `Level up to ${habit.level + 1}` : 'Make it smaller'}
            size="sm"
            variant={up ? 'accent' : 'tonal'}
            onPress={() => {
              updateHabit(habit.id, {
                level: Math.max(1, habit.level + (up ? 1 : -1)),
                full: habit.full ? scaleNumbers(habit.full, up ? 1.1 : 0.8) : habit.full,
              });
              setDismissed([...dismissed, habit.id]);
              toast(up ? `${habit.name} levelled up. Stay curious, stay competitive.` : `${habit.name} is lighter now. Consistency first.`, {
                icon: up ? 'trophy-outline' : 'feather',
              });
            }}
          />
          <Button label="Not now" size="sm" variant="ghost" onPress={() => setDismissed([...dismissed, habit.id])} />
        </View>
      </View>
    </Card>
  );
}

/** Lessons relevant today: circumstances on today's schedule and lessons due for review. */
export function LessonsToday({
  mistakes,
  circumstancesToday,
  today,
}: {
  mistakes: Mistake[];
  circumstancesToday: Circumstance[];
  today: string;
}) {
  const { colors } = useTheme();
  const due = dueLessons(mistakes, today);
  const lesson =
    mistakes.find((m) => m.status === 'active' && !m.paused && m.circumstanceIds.some((id) => circumstancesToday.some((c) => c.id === id))) ??
    mistakes.find((m) => m.status === 'active' && !m.paused);
  if (!lesson && due.length === 0) return null;
  return (
    <View>
      <SectionHeader title="Lessons for today" action="All lessons" onAction={() => router.push('/lessons')} />
      <Card>
        <View style={{ gap: 12 }}>
          {circumstancesToday.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {circumstancesToday.map((c) => (
                <Chip key={c.id} label={c.name} size="sm" dotColor={c.color} onPress={() => router.push(`/checkin?circumstance=${c.id}`)} />
              ))}
            </View>
          ) : null}
          {lesson ? (
            <View style={{ gap: 6 }}>
              <Text variant="overline" tone="muted">
                If – then
              </Text>
              <Text variant="bodyStrong">
                If {lesson.solution.ifThen.if}, then {lesson.solution.ifThen.then}.
              </Text>
              <Text variant="caption" tone="muted">
                From: {lesson.title}
              </Text>
            </View>
          ) : null}
          {due.length > 0 ? (
            <Button
              label={`Review ${due.length} lesson${due.length > 1 ? 's' : ''}`}
              icon="cards-outline"
              variant="tonal"
              size="sm"
              onPress={() => router.push('/review')}
            />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="check-circle-outline" size={16} color={colors.primary} />
              <Text variant="caption" tone="muted">
                No reviews due today
              </Text>
            </View>
          )}
        </View>
      </Card>
    </View>
  );
}

/** The goal written as if it already happened. */
export function GoalAffirmation({ goal, today }: { goal: Goal; today: string }) {
  const done = goal.milestones.filter((m) => m.done).length;
  const days = diffDays(today, goal.targetDate);
  return (
    <Card variant="hero" padding={20} onPress={() => router.push(`/goal/${goal.id}`)} accessibilityLabel={`Goal: ${goal.title}`}>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="overline" tone="muted">
            Already achieved
          </Text>
          <Badge label={days >= 0 ? `${formatDay(goal.targetDate, { withYear: true })} · ${days} days` : 'Target date passed'} tone="neutral" icon="calendar-star" />
        </View>
        <Text variant="serif" style={{ fontSize: 20, lineHeight: 29 }}>
          “{goal.affirmation || goal.title}”
        </Text>
        {goal.milestones.length > 0 ? (
          <View style={{ gap: 6 }}>
            <ProgressBar progress={done / goal.milestones.length} />
            <Text variant="caption" tone="muted">
              {done} of {goal.milestones.length} milestones
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
