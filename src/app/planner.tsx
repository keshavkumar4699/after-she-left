import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { addDays, diffDays, formatDay, relativeDayLabel, WEEKDAY_LONG, weekDays, weekdayOf } from '@/domain/dates';
import { orderHabits } from '@/domain/focus';
import { weeklyCoverage } from '@/domain/planner';
import { dayProgress } from '@/domain/progress';
import type { DayKey, Habit } from '@/domain/types';
import { maybeShowInterstitial } from '@/services/ads';
import { useActiveHabits, useHabitLogs, useToday } from '@/store/hooks';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/theme/ThemeProvider';
import { BottomSheet, Button, Card, Chip, EmptyState, Icon, IconButton, ListItem, PressableScale, ProgressRing, Screen, Text, toast } from '@/ui';

/**
 * Weekly planner: weekly targets spread across days. No fixed times: gym today, football
 * tomorrow, whenever the day allows. Following the habit is what matters.
 */
export default function PlannerScreen() {
  const { colors, radius } = useTheme();
  const today = useToday();
  const weekStartsOn = useStore((s) => s.settings.weekStartsOn);
  const autoPlanWeek = useStore((s) => s.autoPlanWeek);
  const planHabit = useStore((s) => s.planHabit);
  const unplanHabit = useStore((s) => s.unplanHabit);
  const moveHabit = useStore((s) => s.moveHabit);
  const toggleDone = useStore((s) => s.toggleDone);
  const habits = useActiveHabits();
  const logs = useHabitLogs();
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<{ habit: Habit; day: DayKey } | null>(null);
  const [addTo, setAddTo] = useState<DayKey | null>(null);

  const week = useMemo(() => weekDays(addDays(today, offset * 7), weekStartsOn), [today, offset, weekStartsOn]);
  const habitMap = useMemo(() => new Map(habits.map((h) => [h.id, h])), [habits]);
  const coverage = useMemo(() => weeklyCoverage(habits, week, logs), [habits, week, logs]);
  const ids = useMemo(() => new Set(habits.map((h) => h.id)), [habits]);
  const byDay = useMemo(() => {
    const map = new Map<DayKey, { habit: Habit; status: string }[]>();
    for (const l of logs) {
      const h = habitMap.get(l.habitId);
      if (!h || !week.includes(l.day)) continue;
      const list = map.get(l.day) ?? [];
      list.push({ habit: h, status: l.status });
      map.set(l.day, list);
    }
    for (const list of map.values()) list.sort((a, b) => orderHabits(a.habit, b.habit));
    return map;
  }, [logs, habitMap, week]);

  const title = offset === 0 ? 'This week' : offset === 1 ? 'Next week' : offset === -1 ? 'Last week' : `${formatDay(week[0])} – ${formatDay(week[6])}`;
  const remaining = coverage.reduce((s, c) => s + Math.max(0, c.target - c.planned), 0);

  const autoPlan = async () => {
    const n = autoPlanWeek(week);
    toast(n ? `Planned ${n} session${n > 1 ? 's' : ''}. Move any that don't fit.` : 'Every weekly target is already planned.', { icon: 'calendar-check' });
    if (n) await maybeShowInterstitial();
  };

  return (
    <Screen
      back
      title="Weekly planner"
      subtitle="Spread your habits across the week. Any time of day counts."
      footer={
        <Button
          label={remaining > 0 ? `Auto-plan ${remaining} remaining` : 'Week fully planned'}
          icon="auto-fix"
          fullWidth
          disabled={remaining === 0 || diffDays(today, week[6]) < 0}
          onPress={autoPlan}
        />
      }>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <IconButton icon="chevron-left" label="Previous week" variant="tonal" onPress={() => setOffset(offset - 1)} />
        <View style={{ alignItems: 'center' }}>
          <Text variant="h3">{title}</Text>
          <Text variant="caption" tone="muted">
            {formatDay(week[0])} – {formatDay(week[6], { withYear: true })}
          </Text>
        </View>
        <IconButton icon="chevron-right" label="Next week" variant="tonal" onPress={() => setOffset(offset + 1)} />
      </View>

      {habits.length === 0 ? (
        <Card>
          <EmptyState icon="calendar-week" title="No habits to plan" message="Create a habit with a weekly target first." action="New habit" onAction={() => router.push('/habit/new')} />
        </Card>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
            {coverage.map((c) => (
              <Chip
                key={c.habit.id}
                label={`${c.habit.emoji} ${c.planned}/${c.target}`}
                tone={c.planned >= c.target ? 'primary' : 'neutral'}
                icon={c.planned >= c.target ? 'check' : undefined}
              />
            ))}
          </ScrollView>

          <View style={{ gap: 10 }}>
            {week.map((day) => {
              const items = byDay.get(day) ?? [];
              const past = diffDays(today, day) < 0;
              const p = dayProgress(day, logs.filter((l) => l.day === day), today, ids);
              return (
                <Card key={day} padding={14} emphasized={day === today} style={past ? { opacity: 0.75 } : undefined}>
                  <View style={{ gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <ProgressRing progress={p.ratio} size={36} stroke={4} trackColor={p.isRest ? colors.rest : colors.track}>
                        <Text variant="caption" style={{ fontSize: 10 }}>
                          {p.isRest ? '–' : `${p.done}/${p.planned}`}
                        </Text>
                      </ProgressRing>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyStrong">{relativeDayLabel(day, today, false) === WEEKDAY_LONG[weekdayOf(day)] ? WEEKDAY_LONG[weekdayOf(day)] : `${relativeDayLabel(day, today, false)} · ${WEEKDAY_LONG[weekdayOf(day)]}`}</Text>
                        <Text variant="caption" tone="muted">
                          {formatDay(day)}
                          {items.length === 0 ? ' · rest day' : ''}
                        </Text>
                      </View>
                      {!past ? <IconButton icon="plus" label={`Add a habit on ${formatDay(day)}`} size={36} variant="tonal" onPress={() => setAddTo(day)} /> : null}
                    </View>
                    {items.length ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {items.map(({ habit, status }) => (
                          <PressableScale
                            key={habit.id}
                            onPress={() => setSelected({ habit, day })}
                            accessibilityRole="button"
                            accessibilityLabel={`${habit.name}, ${status}`}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              paddingHorizontal: 12,
                              height: 34,
                              borderRadius: radius.pill,
                              backgroundColor: status === 'done' ? colors.primarySoft : colors.surfaceSunken,
                              borderWidth: 1,
                              borderColor: status === 'done' ? 'transparent' : past && status === 'planned' ? colors.danger : colors.border,
                            }}>
                            <Text style={{ fontSize: 15 }}>{habit.emoji}</Text>
                            <Text variant="label">{habit.name}</Text>
                            {status === 'done' ? <Icon name="check" size={14} color={colors.primaryStrong} /> : null}
                            {past && status === 'planned' ? <Icon name="close" size={14} color={colors.danger} /> : null}
                          </PressableScale>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </Card>
              );
            })}
          </View>
        </>
      )}

      <BottomSheet visible={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.habit.emoji} ${selected.habit.name}` : ''} subtitle={selected ? formatDay(selected.day, { withWeekday: true }) : ''}>
        {selected ? (
          <>
            {diffDays(today, selected.day) <= 0 ? (
              <ListItem icon="check-circle-outline" title="Toggle done" onPress={() => { toggleDone(selected.habit.id, selected.day); setSelected(null); }} />
            ) : null}
            <Text variant="overline" tone="muted" style={{ marginTop: 8 }}>
              Move to
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {week
                .filter((d) => d !== selected.day && diffDays(today, d) >= 0)
                .map((d) => (
                  <Chip
                    key={d}
                    label={relativeDayLabel(d, today, false)}
                    onPress={() => {
                      moveHabit(selected.habit.id, selected.day, d);
                      setSelected(null);
                    }}
                  />
                ))}
            </View>
            <ListItem icon="calendar-remove-outline" title="Remove from this day" destructive onPress={() => { unplanHabit(selected.habit.id, selected.day); setSelected(null); }} />
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={!!addTo} onClose={() => setAddTo(null)} title="Add a habit" subtitle={addTo ? formatDay(addTo, { withWeekday: true }) : ''}>
        {habits
          .filter((h) => addTo && !(byDay.get(addTo) ?? []).some((i) => i.habit.id === h.id))
          .map((h) => (
            <ListItem
              key={h.id}
              leading={<Text style={{ fontSize: 22 }}>{h.emoji}</Text>}
              title={h.name}
              subtitle={`${coverage.find((c) => c.habit.id === h.id)?.planned ?? 0}/${h.weeklyTarget} planned this week`}
              onPress={() => {
                if (addTo) planHabit(h.id, addTo);
                setAddTo(null);
              }}
            />
          ))}
      </BottomSheet>
    </Screen>
  );
}
