import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { selectFocus } from '@/domain/focus';
import { habitStats, logsForHabit } from '@/domain/progress';
import type { ID } from '@/domain/types';
import { FocusHabitCard } from '@/features/habits/FocusHabitCard';
import { useActiveHabits, useBeginner, useHabitLogs, useHabits, useToday } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import {
  Avatar,
  Banner,
  BottomSheet,
  Card,
  EmptyState,
  Icon,
  IconButton,
  PressableScale,
  ProgressRing,
  Screen,
  SegmentedControl,
  StreakBadge,
  Text,
} from '@/ui';

/**
 * The habit viewer: only Previous, Current and Next are on screen. Everything else is one tap
 * away behind "All habits", so attention stays on what matters now.
 */
export default function HabitsScreen() {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const today = useToday();
  const habits = useActiveHabits();
  const allHabits = useHabits();
  const logs = useHabitLogs();
  const beginner = useBeginner();
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ current: true });
  const [viewing, setViewing] = useState<ID | null>(null);
  const [sheet, setSheet] = useState(false);

  const focus = useMemo(() => selectFocus(habits, logs, today), [habits, logs, today]);
  const paused = allHabits.filter((h) => h.status === 'paused');
  // Everything that isn't Previous / Current / Next lives behind one button.
  const others = focus.others;
  const viewingHabit = viewing ? others.find((h) => h.id === viewing) : null;
  const toggle = (key: string) => setExpanded((e) => ({ ...e, [key]: !e[key] }));
  const otherCount = others.length;

  return (
    <Screen
      tabBar
      title="Habits"
      subtitle="Previous, now and next. Stay with what matters."
      right={
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <IconButton icon="calendar-week" label="Weekly planner" variant="tonal" onPress={() => router.push('/planner')} />
          <IconButton icon="plus" label="New habit" variant="filled" onPress={() => router.push('/habit/new')} />
        </View>
      }
      contentStyle={{ paddingBottom: 72 }}
      overlay={
        otherCount > 0 ? (
          <View style={[styles.allWrap, { bottom: 76 + Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
            <PressableScale
              onPress={() => setSheet(true)}
              accessibilityRole="button"
              accessibilityLabel={`Other habits, ${otherCount}`}
              style={[styles.allButton, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong, borderRadius: radius.pill }]}>
              <Icon name="view-grid-outline" size={18} color={colors.text} />
              <Text variant="label">Other habits ({otherCount})</Text>
              <Icon name="chevron-up" size={18} color={colors.textMuted} />
            </PressableScale>
          </View>
        ) : null
      }>
      {habits.length === 0 ? (
        <Card>
          <EmptyState
            icon="sprout"
            title="No habits yet"
            message="Start tiny. A habit you can do in two minutes on your worst day is the one that lasts."
            action="Create your first habit"
            onAction={() => router.push('/habit/new')}
          />
        </Card>
      ) : (
        <View style={{ gap: 14 }}>
          <SegmentedControl
            options={[
              { value: 'week', label: 'Week', icon: 'view-week-outline' },
              { value: 'month', label: 'Month', icon: 'calendar-month-outline' },
            ]}
            value={mode}
            onChange={setMode}
          />

          {beginner.active ? (
            <Banner
              tone="primary"
              icon="sprout"
              title={`Beginner mode · day ${beginner.dayNumber} of 21`}
              message={`Keep it tiny and consistent. ${Math.round(beginner.consistency * 100)}% consistency over 14 days. Reach 80% to unlock more habits early.`}
            />
          ) : null}

          {focus.allDoneToday ? (
            <Banner tone="accent" icon="party-popper" title="Everything done today" message="Rest well. Here is what comes next." />
          ) : null}

          {viewingHabit ? (
            <Animated.View entering={FadeInDown.duration(220)}>
              <FocusHabitCard
                role="viewing"
                habit={viewingHabit}
                mode={mode}
                expanded
                onToggle={() => setViewing(null)}
                onClose={() => setViewing(null)}
              />
            </Animated.View>
          ) : null}

          {focus.previous ? (
            <FocusHabitCard
              role="previous"
              slot={focus.previous}
              habit={focus.previous.habit}
              mode={mode}
              expanded={!!expanded.previous}
              onToggle={() => toggle('previous')}
            />
          ) : null}
          {focus.current ? (
            <FocusHabitCard
              role="current"
              slot={focus.current}
              habit={focus.current.habit}
              mode={mode}
              expanded={!!expanded.current}
              onToggle={() => toggle('current')}
            />
          ) : null}
          {focus.next ? (
            <FocusHabitCard
              role="next"
              slot={focus.next}
              habit={focus.next.habit}
              mode={mode}
              expanded={!!expanded.next}
              onToggle={() => toggle('next')}
            />
          ) : null}

          {paused.length > 0 ? (
            <Text variant="caption" tone="subtle" align="center">
              {paused.length} habit{paused.length > 1 ? 's are' : ' is'} paused on the free plan.{' '}
              <Text variant="caption" tone="primary" onPress={() => router.push('/paywall')}>
                Resume with Premium
              </Text>
            </Text>
          ) : null}
        </View>
      )}

      <BottomSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Other habits"
        subtitle="Choose a habit to see its progress">
        {others.map((h) => {
          const stats = habitStats(logsForHabit(logs, h.id), today);
          return (
            <PressableScale
              key={h.id}
              onPress={() => {
                setSheet(false);
                setViewing(h.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${h.name}: ${stats.done7} of ${stats.planned7} in the last 7 days`}
              style={[styles.sheetRow, { borderRadius: radius.lg, backgroundColor: viewing === h.id ? colors.primarySoft : colors.surfaceSunken }]}>
              <Avatar emoji={h.emoji} color={h.color} size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{h.name}</Text>
                <Text variant="caption" tone="muted">
                  {h.weeklyTarget}× a week{viewing === h.id ? ' · viewing' : ''}
                </Text>
              </View>
              {stats.streak > 0 ? <StreakBadge count={stats.streak} /> : null}
              <ProgressRing progress={stats.ratio7} size={38} stroke={4} trackColor={stats.planned7 === 0 ? colors.rest : colors.track}>
                <Text variant="caption" style={{ fontSize: 10 }}>
                  {stats.done7}/{stats.planned7}
                </Text>
              </ProgressRing>
            </PressableScale>
          );
        })}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  allWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  allButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    height: 46,
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
});
