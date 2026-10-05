import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { AdBanner } from '@/components/AdBanner';
import { lessonStats, topTriggers, weeklyCompletion } from '@/domain/insights';
import { habitStats, logsForHabit, weekOverWeek } from '@/domain/progress';
import { useActiveHabits, useCheckins, useCircumstances, useHabitLogs, usePlanInfo, useToday } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { Avatar, Button, Card, ColumnChart, Icon, ProgressRing, Screen, SectionHeader, StatTile, StreakBadge, Text } from '@/ui';

export default function InsightsScreen() {
  const { colors } = useTheme();
  const today = useToday();
  const habits = useActiveHabits();
  const logs = useHabitLogs();
  const checkins = useCheckins();
  const circumstances = useCircumstances();
  const { limits } = usePlanInfo();

  const ids = useMemo(() => new Set(habits.map((h) => h.id)), [habits]);
  const wow = useMemo(() => weekOverWeek(logs, today, ids), [logs, today, ids]);
  const weeks = useMemo(() => weeklyCompletion(logs.filter((l) => ids.has(l.habitId)), today, 4), [logs, today, ids]);
  const lessons = useMemo(() => lessonStats(checkins, today), [checkins, today]);
  const triggers = useMemo(() => topTriggers(checkins, circumstances), [checkins, circumstances]);
  const board = useMemo(
    () =>
      habits
        .map((h) => ({ habit: h, stats: habitStats(logsForHabit(logs, h.id), today) }))
        .sort((a, b) => b.stats.ratio7 - a.stats.ratio7 || b.stats.streak - a.stats.streak),
    [habits, logs, today],
  );
  const best = board.reduce((m, b) => Math.max(m, b.stats.bestStreak), 0);

  return (
    <Screen back title="Insights" subtitle="Compete with who you were last week.">
      <View style={{ gap: 24 }}>
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatTile
              label="Last 7 days"
              value={`${Math.round(wow.current.ratio * 100)}%`}
              icon="chart-donut"
              delta={Math.round((wow.current.ratio - wow.previous.ratio) * 100)}
              deltaLabel="pts vs prev 7 days"
            />
            <StatTile style={{ flex: 1 }} label="Best streak" value={String(best)} icon="fire" iconColor={colors.accent} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatTile style={{ flex: 1 }} label="Avoided · 30d" value={String(lessons.avoided)} icon="shield-check-outline" />
            <StatTile
              label="Days since a slip"
              value={lessons.daysSinceRepeat === null ? '–' : String(lessons.daysSinceRepeat)}
              icon="calendar-heart"
            />
          </View>
        </View>

        <View>
          <SectionHeader title="Completion · last 4 weeks" />
          <Card>
            <ColumnChart data={weeks.map((w) => ({ label: w.label, value: w.ratio, detail: `${w.done} of ${w.planned} done` }))} />
            <View style={{ marginTop: 12, gap: 4 }}>
              {weeks.map((w) => (
                <View key={w.end} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="caption" tone="muted">
                    {w.label === 'This week' ? 'Last 7 days' : `Week of ${w.label}`}
                  </Text>
                  <Text variant="caption">{w.planned ? `${w.done}/${w.planned} · ${Math.round(w.ratio * 100)}%` : 'Nothing planned'}</Text>
                </View>
              ))}
            </View>
          </Card>
        </View>

        <View>
          <SectionHeader title="Your habits · last 7 days" />
          <Card padding={8}>
            {board.map(({ habit, stats }, i) => (
              <View key={habit.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }}>
                <Text variant="caption" tone="muted" style={{ width: 16 }}>
                  {i + 1}
                </Text>
                <Avatar emoji={habit.emoji} color={habit.color} size={36} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{habit.name}</Text>
                  <Text variant="caption" tone="muted">
                    best {stats.bestStreak} · level {habit.level}
                  </Text>
                </View>
                {stats.streak > 0 ? <StreakBadge count={stats.streak} /> : null}
                <ProgressRing progress={stats.ratio7} size={40} stroke={4} trackColor={stats.planned7 === 0 ? colors.rest : colors.track}>
                  <Text variant="caption" style={{ fontSize: 10 }}>
                    {stats.done7}/{stats.planned7}
                  </Text>
                </ProgressRing>
              </View>
            ))}
          </Card>
        </View>

        <View>
          <SectionHeader title="Your toughest moments" />
          {limits.fullInsights ? (
            <Card>
              {triggers.length ? (
                <View style={{ gap: 12 }}>
                  {triggers.map((t) => (
                    <View key={t.circumstance.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.circumstance.color }} />
                      <Text variant="body" style={{ flex: 1 }}>
                        {t.circumstance.name}
                      </Text>
                      <Text variant="caption" tone="muted">
                        {t.count} slip{t.count > 1 ? 's' : ''}
                      </Text>
                    </View>
                  ))}
                  <Text variant="caption" tone="muted">
                    Add a location or time reminder to these moments, and plan an if–then for each.
                  </Text>
                </View>
              ) : (
                <Text variant="body" tone="muted">
                  No slips linked to a circumstance yet. Keep checking in.
                </Text>
              )}
            </Card>
          ) : (
            <Card variant="tonal" tone="accent">
              <View style={{ gap: 10, alignItems: 'flex-start' }}>
                <Icon name="lock-outline" size={22} color={colors.accent} />
                <Text variant="bodyStrong">See which moments trip you up most</Text>
                <Text variant="caption" tone="muted">
                  Full insights are part of Premium.
                </Text>
                <Button label="See Premium" size="sm" variant="accent" onPress={() => router.push('/paywall')} />
              </View>
            </Card>
          )}
        </View>
        <AdBanner />
      </View>
    </Screen>
  );
}
