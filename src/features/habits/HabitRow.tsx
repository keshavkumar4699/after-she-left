import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { addDays, diffDays, relativeDayLabel, weekDays } from '@/domain/dates';
import type { Quote } from '@/domain/quotes';
import type { Habit, HabitLog, TimeWindow } from '@/domain/types';
import { useBeginner, useToday } from '@/store/hooks';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/theme/ThemeProvider';
import { Avatar, BottomSheet, Checkbox, Chip, Icon, IconButton, ListItem, PressableScale, Text, toast } from '@/ui';
import { CompletionSheet } from './CompletionSheet';

export const WINDOW_LABEL: Record<TimeWindow, string> = {
  anytime: 'Anytime',
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};
export const WINDOW_ICON = {
  anytime: 'infinity',
  morning: 'weather-sunset-up',
  afternoon: 'white-balance-sunny',
  evening: 'weather-night',
} as const;

/** One planned habit on a day: check it off, move it, or skip it. */
export function HabitRow({ habit, log }: { habit: Habit; log: HabitLog }) {
  const { colors, radius } = useTheme();
  const today = useToday();
  const beginner = useBeginner();
  const toggleDone = useStore((s) => s.toggleDone);
  const moveHabit = useStore((s) => s.moveHabit);
  const skipHabit = useStore((s) => s.skipHabit);
  const weekStartsOn = useStore((s) => s.settings.weekStartsOn);
  const [menu, setMenu] = useState(false);
  const nextQuote = useStore((s) => s.nextQuote);
  // A fresh, non-repeating quote for each completion; null = sheet closed.
  const [celebrate, setCelebrate] = useState<Quote | null>(null);
  const done = log.status === 'done';
  const skipped = log.status === 'skipped';
  const subtitle = beginner.active || !habit.full ? habit.twoMinute || habit.full : habit.full;

  const moveTargets = [...new Set([...weekDays(today, weekStartsOn), addDays(today, 1), addDays(today, 2)])].filter(
    (d) => d !== log.day && diffDays(today, d) >= 0,
  );

  return (
    <>
      <View
        style={[
          styles.row,
          { backgroundColor: colors.surface, borderColor: done ? 'transparent' : colors.border, borderRadius: radius.lg },
          done && { backgroundColor: colors.primarySoft },
        ]}>
        <Checkbox
          checked={done}
          label={`${habit.name}${done ? ', done' : ''}`}
          onChange={() => {
            const nowDone = toggleDone(habit.id, log.day);
            if (nowDone) setCelebrate(nextQuote('reward'));
          }}
        />
        <PressableScale
          style={styles.body}
          onPress={() => router.push(`/habit/${habit.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${habit.name}`}
          activeScale={0.99}>
          <Avatar emoji={habit.emoji} color={habit.color} size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              variant="bodyStrong"
              numberOfLines={1}
              style={done || skipped ? { textDecorationLine: 'line-through', color: colors.textMuted } : undefined}>
              {habit.name}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {skipped ? 'Skipped today' : subtitle}
            </Text>
          </View>
        </PressableScale>
        {habit.timeWindow !== 'anytime' ? (
          <Icon name={WINDOW_ICON[habit.timeWindow]} size={18} color={colors.textSubtle} />
        ) : null}
        <IconButton icon="dots-vertical" label={`More for ${habit.name}`} size={36} onPress={() => setMenu(true)} />
      </View>

      <BottomSheet visible={menu} onClose={() => setMenu(false)} title={habit.name} subtitle="Timing is flexible. Following the habit is what matters.">
        <Text variant="overline" tone="muted">
          Move to another day
        </Text>
        <View style={styles.chips}>
          {moveTargets.map((d) => (
            <Chip
              key={d}
              label={relativeDayLabel(d, today, false)}
              onPress={() => {
                moveHabit(habit.id, log.day, d);
                setMenu(false);
                toast(`${habit.name} moved to ${relativeDayLabel(d, today, false).toLowerCase()}`, { icon: 'calendar-arrow-right' });
              }}
            />
          ))}
        </View>
        <ListItem
          icon="skip-next-circle-outline"
          title="Skip today"
          subtitle="Rest on purpose. Skips don't break your streak, but try not to skip twice."
          onPress={() => {
            skipHabit(habit.id, log.day);
            setMenu(false);
          }}
        />
        <ListItem icon="pencil-outline" title="Edit habit" onPress={() => { setMenu(false); router.push(`/habit/${habit.id}`); }} />
      </BottomSheet>

      {celebrate ? (
        <CompletionSheet visible onClose={() => setCelebrate(null)} habit={habit} day={log.day} quote={celebrate} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 14, paddingRight: 6, borderWidth: 1 },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
});
