import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { analyzeNeeds, THEME_LABELS } from '@/domain/needs';
import type { Mood } from '@/domain/types';
import { isAiWritten, SOURCE_LABELS } from '@/features/prayer/source';
import { ensureTodayPrayer } from '@/services/prayer';
import { useCheckins, useCircumstances, useGoals, useHabitLogs, useHabits, useMistakes, usePlanInfo, useToday } from '@/store/hooks';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/theme/ThemeProvider';
import { Accordion, Button, Card, Chip, Icon, IconButton, Screen, Skeleton, Text, toast } from '@/ui';

const MOODS: { value: Mood; label: string; emoji: string }[] = [
  { value: 'calm', label: 'Calm', emoji: '😌' },
  { value: 'motivated', label: 'Motivated', emoji: '🔥' },
  { value: 'low', label: 'Low', emoji: '😔' },
  { value: 'anxious', label: 'Anxious', emoji: '😟' },
  { value: 'lonely', label: 'Lonely', emoji: '🫥' },
  { value: 'angry', label: 'Angry', emoji: '😤' },
];

/** The daily prayer, built from your lessons, goals and habits. */
export default function PrayerScreen() {
  const { colors } = useTheme();
  const today = useToday();
  const prayer = useStore((s) => s.prayers[today]);
  const updatePrayer = useStore((s) => s.updatePrayer);
  const setMood = useStore((s) => s.setMood);
  const todayMood = useStore((s) => (s.todayMood?.day === today ? s.todayMood.mood : null));
  const { tier } = usePlanInfo();
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState(false);
  const mistakes = useMistakes();
  const checkins = useCheckins();
  const circumstances = useCircumstances();
  const habits = useHabits();
  const logs = useHabitLogs();
  const goals = useGoals();

  // Opened from the morning notification before the dashboard ran: prepare it now.
  useEffect(() => {
    if (!prayer) ensureTodayPrayer();
  }, [prayer]);

  const needs = useMemo(
    () => analyzeNeeds({ mistakes, checkins, circumstances, habits, logs, goals, mood: todayMood, today }),
    [mistakes, checkins, circumstances, habits, logs, goals, todayMood, today],
  );

  /** A new mood re-writes the prayer on every plan; "Rewrite" on its own is a Premium feature. */
  const regenerate = async (mood?: Mood) => {
    if (!mood && tier === 'free') {
      router.push('/paywall');
      return;
    }
    setBusy(true);
    try {
      const res = await ensureTodayPrayer({ regenerate: true, mood: mood ?? todayMood });
      toast(isAiWritten(res.prayer.source) ? 'A new prayer, written for today' : 'Rewritten from your lessons and goals', { icon: 'auto-fix' });
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!prayer) return;
    await Share.share({ message: `${prayer.title}\n\n${prayer.text}\n\n— After She Left` }).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient colors={colors.prayerGradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
      <Screen
        back
        closeIcon
        headerCompact
        right={
          prayer ? (
            <>
              <IconButton icon="share-variant-outline" label="Share" variant="tonal" size={40} onPress={share} />
              <IconButton
                icon={prayer.saved ? 'heart' : 'heart-outline'}
                label={prayer.saved ? 'Saved' : 'Save'}
                variant="tonal"
                size={40}
                color={prayer.saved ? colors.danger : undefined}
                onPress={() => updatePrayer(today, { saved: !prayer.saved })}
              />
            </>
          ) : undefined
        }
        contentStyle={{ backgroundColor: 'transparent' }}>
        {!prayer ? (
          <View style={{ gap: 14 }}>
            <Skeleton width="60%" height={30} />
            <Skeleton height={16} />
            <Skeleton height={16} />
            <Skeleton width="80%" height={16} />
            <Button
              label="Write today's prayer"
              icon="auto-fix"
              loading={busy}
              onPress={async () => {
                setBusy(true);
                await ensureTodayPrayer().finally(() => setBusy(false));
              }}
            />
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(400)} style={{ gap: 24 }}>
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="hands-pray" size={18} color={colors.violet} />
                <Text variant="overline" tone="muted">
                  {THEME_LABELS[prayer.theme]} · {SOURCE_LABELS[prayer.source]}
                </Text>
              </View>
              <Text variant="display">{prayer.title}</Text>
            </View>

            <View style={{ gap: 18 }}>
              {prayer.text
                .split('\n')
                .filter(Boolean)
                .map((p, i) => (
                  <Animated.View key={`${prayer.updatedAt}-${i}`} entering={FadeInDown.delay(120 * i).duration(400)}>
                    <Text variant="serif">{p}</Text>
                  </Animated.View>
                ))}
            </View>

            <Card variant="tonal" tone="violet" padding={18}>
              <Text variant="overline" tone="muted">
                My purpose today
              </Text>
              <Text variant="serif" style={{ marginTop: 6 }}>
                {prayer.purposeLine}
              </Text>
            </Card>

            {prayer.dontDoToday.length ? (
              <View style={{ gap: 10 }}>
                <Text variant="overline" tone="muted">
                  Not today
                </Text>
                {prayer.dontDoToday.map((d) => (
                  <View key={d} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <Icon name="cancel" size={20} color={colors.danger} />
                    <Text variant="bodyStrong" style={{ flex: 1 }}>
                      {d}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {prayer.nudges.length ? (
              <View style={{ gap: 10 }}>
                <Text variant="overline" tone="muted">
                  Small steps today
                </Text>
                {prayer.nudges.map((n) => (
                  <View key={n} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                    <Icon name="shoe-print" size={18} color={colors.primary} />
                    <Text variant="body" style={{ flex: 1 }}>
                      {n}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={{ gap: 10 }}>
              <Text variant="overline" tone="muted">
                How do you feel this morning?
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {MOODS.map((m) => (
                  <Chip
                    key={m.value}
                    label={`${m.emoji} ${m.label}`}
                    selected={todayMood === m.value}
                    onPress={() => {
                      setMood(m.value);
                      regenerate(m.value);
                    }}
                  />
                ))}
              </View>
              <Text variant="caption" tone="muted">
                Your mood shapes today&apos;s prayer.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                label={prayer.helped ? 'It helped' : 'This helped'}
                icon={prayer.helped ? 'thumb-up' : 'thumb-up-outline'}
                variant={prayer.helped ? 'tonal' : 'outline'}
                onPress={() => updatePrayer(today, { helped: !prayer.helped })}
                style={{ flex: 1 }}
                fullWidth
              />
              <Button
                label={tier === 'free' ? 'Rewrite (Premium)' : 'Rewrite'}
                icon={tier === 'free' ? 'lock-outline' : 'refresh'}
                variant="tonal"
                loading={busy}
                onPress={() => regenerate()}
                style={{ flex: 1 }}
                fullWidth
              />
            </View>

            <Card variant="outlined">
              <Accordion
                expanded={why}
                onToggle={() => setWhy(!why)}
                label="Why this prayer"
                header={
                  <View>
                    <Text variant="bodyStrong">Why this prayer?</Text>
                    <Text variant="caption" tone="muted">
                      What your records say you need today
                    </Text>
                  </View>
                }>
                <View style={{ gap: 8 }}>
                  {needs.signals.slice(0, 5).map((s, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                      <Icon name="circle-small" size={20} color={colors.textMuted} />
                      <Text variant="body" style={{ flex: 1 }}>
                        {s.reason}
                      </Text>
                      <Text variant="caption" tone="muted">
                        {THEME_LABELS[s.theme]}
                      </Text>
                    </View>
                  ))}
                </View>
              </Accordion>
            </Card>
          </Animated.View>
        )}
      </Screen>
    </View>
  );
}
