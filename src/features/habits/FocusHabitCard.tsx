import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { addMonths, diffDays, parseDayKey, relativeDayLabel } from '@/domain/dates';
import type { FocusSlot } from '@/domain/focus';
import { habitStats, logsForHabit } from '@/domain/progress';
import type { DayKey, Habit, HabitLog } from '@/domain/types';
import { usePlanInfo, useToday } from '@/store/hooks';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/theme/ThemeProvider';
import {
  Accordion,
  Avatar,
  Button,
  Card,
  Icon,
  IconButton,
  MonthCalendar,
  ProgressRing,
  StreakBadge,
  Text,
  WeekStrip,
  type CalendarMark,
} from '@/ui';

export type FocusRole = 'previous' | 'current' | 'next' | 'viewing';

const ROLE_LABEL: Record<FocusRole, string> = {
  previous: 'Previous',
  current: 'Now',
  next: 'Next',
  viewing: 'Viewing',
};

const lowerFirst = (t: string) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);

export function calendarMarks(habitLogs: Map<DayKey, HabitLog>, today: DayKey): Map<DayKey, CalendarMark> {
  const marks = new Map<DayKey, CalendarMark>();
  for (const [day, log] of habitLogs) {
    if (log.status === 'done') marks.set(day, 'done');
    else if (log.status === 'skipped') marks.set(day, 'skipped');
    else marks.set(day, diffDays(today, day) < 0 ? 'missed' : 'planned');
  }
  return marks;
}

export function FocusHabitCard({
  role,
  slot,
  habit,
  mode,
  expanded,
  onToggle,
  onClose,
}: {
  role: FocusRole;
  slot?: FocusSlot | null;
  habit: Habit;
  mode: 'week' | 'month';
  expanded: boolean;
  onToggle: () => void;
  onClose?: () => void;
}) {
  const { colors, radius } = useTheme();
  const today = useToday();
  const allLogs = useStore((s) => s.habitLogs);
  const toggleDone = useStore((s) => s.toggleDone);
  const { limits } = usePlanInfo();
  const habitLogs = useMemo(() => logsForHabit(Object.values(allLogs), habit.id), [allLogs, habit.id]);
  const stats = useMemo(() => habitStats(habitLogs, today), [habitLogs, today]);
  const marks = useMemo(() => calendarMarks(habitLogs, today), [habitLogs, today]);
  const t = parseDayKey(today);
  const minMonth = Number.isFinite(limits.monthHistoryMonths) ? addMonths(t.year, t.month, -(limits.monthHistoryMonths - 1)) : undefined;

  const emphasized = role === 'current';
  const dayLabel = slot ? relativeDayLabel(slot.day, today, false) : null;
  const statusText =
    slot?.status === 'done' ? 'Done' : slot?.status === 'planned' ? 'Planned' : slot?.status === 'unplanned' ? 'Not planned yet' : null;
  const todayLog = habitLogs.get(today);

  const header = (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={[
            styles.role,
            { borderRadius: radius.pill, backgroundColor: emphasized ? colors.primaryStrong : colors.surfaceRaised },
          ]}>
          <Text variant="overline" color={emphasized ? colors.onPrimary : colors.textMuted} style={{ fontSize: 10 }}>
            {ROLE_LABEL[role]}
          </Text>
        </View>
        {dayLabel ? (
          <Text variant="caption" tone="muted">
            {dayLabel}
            {statusText ? ` · ${statusText}` : ''}
          </Text>
        ) : null}
        <View style={{ flex: 1 }} />
        {stats.streak > 0 ? <StreakBadge count={stats.streak} /> : null}
        {onClose ? <IconButton icon="close" label="Close" size={30} onPress={onClose} /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar emoji={habit.emoji} color={habit.color} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="h3" numberOfLines={1}>
            {habit.name}
          </Text>
          {habit.identity ? (
            <Text variant="serifItalic" tone="muted" numberOfLines={2} style={{ fontSize: 14, lineHeight: 20 }}>
              {habit.identity}
            </Text>
          ) : (
            <Text variant="caption" tone="muted">
              {habit.weeklyTarget}× a week
            </Text>
          )}
        </View>
        <ProgressRing
          progress={stats.ratio7}
          size={56}
          stroke={6}
          trackColor={stats.planned7 === 0 ? colors.rest : colors.track}
          accessibilityLabel={`Last 7 days: ${stats.done7} of ${stats.planned7} planned days done`}>
          <Text variant="label" style={{ fontSize: 12 }}>
            {stats.done7}/{stats.planned7}
          </Text>
        </ProgressRing>
      </View>
    </View>
  );

  return (
    <Card emphasized={emphasized} tone="primary" padding={16}>
      <Accordion header={header} expanded={expanded} onToggle={onToggle} label={`${habit.name} details`}>
        {mode === 'week' ? (
          <View style={{ gap: 16 }}>
            <View style={{ gap: 8 }}>
              <Text variant="overline" tone="muted">
                Last 7 days
              </Text>
              <WeekStrip cells={stats.cells} />
            </View>
            <View style={styles.stats}>
              <Stat label="Streak" value={String(stats.streak)} />
              <Stat label="Best" value={String(stats.bestStreak)} />
              <Stat label="7-day" value={`${Math.round(stats.ratio7 * 100)}%`} />
              <Stat label="Level" value={String(habit.level)} />
            </View>
          </View>
        ) : (
          <MonthCalendar marks={marks} today={today} minMonth={minMonth} />
        )}

        <View style={{ gap: 8, marginTop: 16 }}>
          {habit.stackAfter ? <Line icon="link-variant" text={`After ${habit.stackAfter}, I will ${lowerFirst(habit.twoMinute || habit.name)}.`} /> : null}
          {habit.intention.behavior ? (
            <Line icon="map-marker-outline" text={`I will ${habit.intention.behavior}${habit.intention.when ? ` ${habit.intention.when}` : ''}${habit.intention.where ? ` at ${habit.intention.where}` : ''}.`} />
          ) : null}
          {habit.reward ? <Line icon="gift-outline" text={`Reward: ${habit.reward}`} /> : null}
          {habit.bundle ? <Line icon="headphones" text={`Only with this habit: ${habit.bundle}`} /> : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {todayLog && todayLog.status !== 'done' ? (
            <Button label="Mark done today" icon="check" size="sm" onPress={() => toggleDone(habit.id, today)} />
          ) : null}
          <Button label="Open habit" icon="pencil-outline" size="sm" variant="outline" onPress={() => router.push(`/habit/${habit.id}`)} />
        </View>
      </Accordion>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors, radius } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surfaceSunken, borderRadius: radius.md }]}>
      <Text variant="h3">{value}</Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

function Line({ icon, text }: { icon: 'link-variant' | 'map-marker-outline' | 'gift-outline' | 'headphones'; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Icon name={icon} size={18} color={colors.textMuted} />
      <Text variant="body" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  role: { paddingHorizontal: 10, paddingVertical: 4 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 2 },
});
