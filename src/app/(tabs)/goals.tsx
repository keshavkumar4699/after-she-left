import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AdBanner } from '@/components/AdBanner';
import { diffDays, formatDay } from '@/domain/dates';
import { formatLimit } from '@/domain/entitlements';
import type { Goal, GoalStatus } from '@/domain/types';
import { useActiveHabits, useGoals, usePlanInfo, useToday } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { GOAL_META } from '@/features/goals/meta';
import { Avatar, Badge, Card, EmptyState, Icon, IconButton, ProgressBar, Screen, SegmentedControl, Text, type IconName } from '@/ui';


export default function GoalsScreen() {
  const today = useToday();
  const goals = useGoals();
  const habits = useActiveHabits();
  const { tier, limits } = usePlanInfo();
  const [status, setStatus] = useState<GoalStatus>('active');
  const visible = useMemo(
    () => goals.filter((g) => g.status === status).sort((a, b) => (a.targetDate < b.targetDate ? -1 : 1)),
    [goals, status],
  );
  const activeCount = goals.filter((g) => g.status === 'active').length;

  return (
    <Screen
      tabBar
      title="Goals"
      subtitle="Write it as if it already happened. Then live like it."
      right={<IconButton icon="plus" label="New goal" variant="filled" onPress={() => router.push('/goal/new')} />}>
      <View style={{ gap: 16 }}>
        <SegmentedControl
          options={[
            { value: 'active', label: 'Active' },
            { value: 'achieved', label: 'Achieved' },
            { value: 'paused', label: 'Paused' },
          ]}
          value={status}
          onChange={setStatus}
        />
        {tier === 'free' ? (
          <Text variant="caption" tone="muted">
            {activeCount} of {formatLimit(limits.goals)} active goals on the free plan
          </Text>
        ) : null}
        {visible.length === 0 ? (
          <Card>
            <EmptyState
              icon={status === 'achieved' ? 'trophy-outline' : 'flag-checkered'}
              tone={status === 'achieved' ? 'accent' : 'primary'}
              title={status === 'active' ? 'Set a specific goal' : status === 'achieved' ? 'Achievements land here' : 'Nothing paused'}
              message={
                status === 'active'
                  ? 'Not “be rich” but “28 Feb 2027, at my desk: my investments pay my monthly expenses”. Specific date, place and measure.'
                  : status === 'achieved'
                    ? 'When you reach a goal, mark it achieved and it will live here.'
                    : 'Goals paused on the free plan appear here.'
              }
              action={status === 'active' ? 'Create a goal' : undefined}
              onAction={() => router.push('/goal/new')}
            />
          </Card>
        ) : (
          visible.map((g) => <GoalCard key={g.id} goal={g} today={today} habitEmojis={habits.filter((h) => g.habitIds.includes(h.id)).map((h) => h.emoji)} />)
        )}
        <AdBanner />
      </View>
    </Screen>
  );
}

function GoalCard({ goal, today, habitEmojis }: { goal: Goal; today: string; habitEmojis: string[] }) {
  const { colors } = useTheme();
  const meta = GOAL_META[goal.category];
  const done = goal.milestones.filter((m) => m.done).length;
  const days = diffDays(today, goal.targetDate);
  return (
    <Card onPress={() => router.push(`/goal/${goal.id}`)} accessibilityLabel={`Goal: ${goal.title}`} padding={18}>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name={meta.icon} size={18} color={colors.textMuted} />
          <Text variant="caption" tone="muted" style={{ flex: 1 }}>
            {meta.label}
          </Text>
          <Badge
            label={goal.status === 'achieved' ? 'Achieved' : days >= 0 ? `${days} days` : 'Date passed'}
            tone={goal.status === 'achieved' ? 'primary' : days >= 0 ? 'neutral' : 'danger'}
            icon={goal.status === 'achieved' ? 'trophy-outline' : 'calendar-star'}
          />
        </View>
        <Text variant="h3">{goal.title}</Text>
        {goal.affirmation ? (
          <Text variant="serifItalic" tone="muted" numberOfLines={3}>
            “{goal.affirmation}”
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
          <Meta icon="calendar-month-outline" text={formatDay(goal.targetDate, { withYear: true, withWeekday: true })} />
          {goal.place ? <Meta icon="map-marker-outline" text={goal.place} /> : null}
        </View>
        {goal.milestones.length ? (
          <View style={{ gap: 6 }}>
            <ProgressBar progress={done / goal.milestones.length} />
            <Text variant="caption" tone="muted">
              {done} of {goal.milestones.length} milestones
            </Text>
          </View>
        ) : null}
        {habitEmojis.length ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {habitEmojis.map((e, i) => (
              <Avatar key={i} emoji={e} size={28} />
            ))}
            <Text variant="caption" tone="muted">
              building it daily
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function Meta({ icon, text }: { icon: IconName; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', maxWidth: '100%' }}>
      <Icon name={icon} size={15} color={colors.textMuted} />
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}
