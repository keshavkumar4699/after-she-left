import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { formatLongDay, greetingFor, weekDays, weekdayOf } from '@/domain/dates';
import { dayPlan } from '@/domain/focus';
import { last7DaysProgress, missedYesterday, weekOverWeek } from '@/domain/progress';
import { GoldilocksCard, GoalAffirmation, LessonsToday } from '@/features/today/sections';
import { HabitRow } from '@/features/habits/HabitRow';
import { PrayerCard } from '@/features/today/PrayerCard';
import {
  useActiveHabits,
  useBeginner,
  useCircumstances,
  useGoals,
  useHabitLogs,
  useMistakes,
  usePlanInfo,
  useToday,
} from '@/store/hooks';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/theme/ThemeProvider';
import {
  Avatar,
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  FAB,
  Icon,
  Last7DaysRings,
  PressableScale,
  Screen,
  SectionHeader,
  Text,
  toast,
} from '@/ui';

export default function TodayScreen() {
  const { colors } = useTheme();
  const today = useToday();
  const name = useStore((s) => s.settings.displayName);
  const weekStartsOn = useStore((s) => s.settings.weekStartsOn);
  const autoPlanWeek = useStore((s) => s.autoPlanWeek);
  const habits = useActiveHabits();
  const logs = useHabitLogs();
  const mistakes = useMistakes();
  const circumstances = useCircumstances();
  const goals = useGoals();
  const beginner = useBeginner();
  const { tier, trialDaysLeft } = usePlanInfo();

  const activeIds = useMemo(() => new Set(habits.map((h) => h.id)), [habits]);
  const rings = useMemo(() => last7DaysProgress(logs, today, activeIds), [logs, today, activeIds]);
  const wow = useMemo(() => weekOverWeek(logs, today, activeIds), [logs, today, activeIds]);
  const habitMap = useMemo(() => new Map(habits.map((h) => [h.id, h])), [habits]);
  const plan = useMemo(() => dayPlan(today, habitMap, logs), [today, habitMap, logs]);
  const logsToday = useMemo(() => new Map(logs.filter((l) => l.day === today).map((l) => [l.habitId, l])), [logs, today]);
  const missed = useMemo(
    () => missedYesterday(habits, logs, today).filter((h) => logsToday.get(h.id)?.status !== 'done'),
    [habits, logs, today, logsToday],
  );
  const circumstancesToday = useMemo(
    () =>
      circumstances.filter(
        (c) => !c.paused && c.schedule && (c.schedule.weekdays.length === 0 || c.schedule.weekdays.includes(weekdayOf(today))),
      ),
    [circumstances, today],
  );
  const activeGoals = goals.filter((g) => g.status === 'active');
  const doneToday = plan.filter((p) => p.status === 'done').length;
  const firstName = name.split(' ')[0];

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="overline" tone="muted">
          {formatLongDay(today)}
        </Text>
        <Text variant="title" accessibilityRole="header">
          {greetingFor()}
          {firstName ? `, ${firstName}` : ''}
        </Text>
      </View>
      {tier === 'trial' ? (
        <Chip label={`Trial · ${trialDaysLeft}d`} size="sm" tone="accent" icon="crown-outline" onPress={() => router.push('/paywall')} />
      ) : tier === 'free' ? (
        <Chip label="Go Premium" size="sm" tone="accent" icon="crown-outline" onPress={() => router.push('/paywall')} />
      ) : null}
      <PressableScale onPress={() => router.push('/me')} accessibilityRole="button" accessibilityLabel="Profile">
        <Avatar label={name || 'You'} size={40} />
      </PressableScale>
    </View>
  );

  return (
    <Screen tabBar overlay={<FAB icon="hand-back-left-outline" label="Check in" onPress={() => router.push('/checkin')} />}>
      {header}
      <View style={{ gap: 24 }}>
        <PrayerCard />

        <View>
          <SectionHeader title="Last 7 days" action="Plan week" onAction={() => router.push('/planner')} />
          <Card>
            <View style={{ gap: 16 }}>
              <Last7DaysRings days={rings} onPressDay={(d) => router.push(`/day/${d}`)} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="body">
                  <Text variant="bodyStrong">{wow.current.done}</Text>
                  <Text tone="muted">{` of ${wow.current.planned} done · ${Math.round(wow.current.ratio * 100)}%`}</Text>
                </Text>
                {wow.deltaDone !== 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityLabel={`${wow.deltaDone > 0 ? 'Up' : 'Down'} ${Math.abs(wow.deltaDone)} versus the previous 7 days`}>
                    <Icon name={wow.deltaDone > 0 ? 'arrow-up' : 'arrow-down'} size={14} color={wow.deltaDone > 0 ? colors.primary : colors.danger} />
                    <Text variant="caption" tone="muted">
                      {`${wow.deltaDone > 0 ? '+' : ''}${wow.deltaDone} vs previous 7 days`}
                    </Text>
                  </View>
                ) : (
                  <Text variant="caption" tone="muted">
                    Same as previous 7 days
                  </Text>
                )}
              </View>
            </View>
          </Card>
        </View>

        {missed.length > 0 ? (
          <Banner
            tone="accent"
            icon="link-variant"
            title="Never miss twice"
            message={`${missed.map((h) => h.name).join(', ')} slipped yesterday. A two-minute version today keeps the chain alive.`}
            action={logsToday.has(missed[0].id) ? `Do ${missed[0].twoMinute ? 'the two-minute version' : missed[0].name} now` : 'Add it to today'}
            onAction={() => {
              const h = missed[0];
              if (!logsToday.has(h.id)) {
                useStore.getState().planHabit(h.id, today);
                toast(`${h.name} added to today`, { icon: 'calendar-plus' });
              } else router.push(`/habit/${h.id}`);
            }}
          />
        ) : null}

        <View>
          <SectionHeader
            title={plan.length ? `Today · ${doneToday} of ${plan.length} done` : 'Today'}
            action={habits.length ? 'Add habit' : undefined}
            onAction={() => router.push('/habit/new')}
          />
          {beginner.active && habits.length > 0 ? (
            <Text variant="caption" tone="muted" style={{ marginBottom: 10 }}>
              Beginner mode · day {beginner.dayNumber} of 21 · two-minute versions only. Consistency beats intensity.
            </Text>
          ) : null}
          {habits.length === 0 ? (
            <Card>
              <EmptyState
                icon="sprout"
                title="Start with one tiny habit"
                message="Pick something so small you can't say no: put on your shoes, read one page. Showing up is the habit."
                action="Create a habit"
                onAction={() => router.push('/habit/new')}
              />
            </Card>
          ) : plan.length === 0 ? (
            <Card>
              <EmptyState
                icon="calendar-blank-outline"
                title="Nothing planned for today"
                message="Spread your weekly targets across the week. Timing is flexible; following the habit is what matters."
                action="Auto-plan my week"
                onAction={() => {
                  const n = autoPlanWeek(weekDays(today, weekStartsOn));
                  toast(n ? `Planned ${n} sessions this week` : 'Your week is already fully planned', { icon: 'calendar-check' });
                }}
              />
            </Card>
          ) : (
            <View style={{ gap: 10 }}>
              {plan.map((slot) => (
                <HabitRow key={slot.habit.id} habit={slot.habit} log={logsToday.get(slot.habit.id)!} />
              ))}
            </View>
          )}
        </View>

        <GoldilocksCard habits={habits} logs={logs} today={today} />

        <LessonsToday mistakes={mistakes} circumstancesToday={circumstancesToday} today={today} />

        {activeGoals.length > 0 ? (
          <View>
            <SectionHeader title="Your purpose" action="All goals" onAction={() => router.push('/goals')} />
            <GoalAffirmation goal={activeGoals[0]} today={today} />
          </View>
        ) : (
          <Card variant="outlined">
            <View style={{ gap: 10 }}>
              <Text variant="bodyStrong">Write a goal as if it already happened</Text>
              <Text variant="caption" tone="muted">
                Specific date, time, place and a clear measure. Feeling it as real today pulls you toward it.
              </Text>
              <Button label="Add a goal" icon="flag-plus-outline" variant="tonal" size="sm" onPress={() => router.push('/goal/new')} />
            </View>
          </Card>
        )}

      </View>
    </Screen>
  );
}
