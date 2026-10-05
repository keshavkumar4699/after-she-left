import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { BreathingCircle } from '@/features/lessons/BreathingCircle';
import type { Quote } from '@/domain/quotes';
import { useCircumstances, useMistakes } from '@/store/hooks';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Card, EmptyState, Icon, PressableScale, Screen, Text, type IconName } from '@/ui';

type Stage = 'choose' | 'lessons' | 'breathe' | 'avoided' | 'repeated';

/** "I'm in this situation right now": show the lessons that matter for this moment. */
export default function CheckinScreen() {
  const { colors, radius } = useTheme();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ circumstance?: string }>();
  const circumstances = useCircumstances();
  const mistakes = useMistakes();
  const addCheckin = useStore((s) => s.addCheckin);
  const nextQuote = useStore((s) => s.nextQuote);
  const [circId, setCircId] = useState<string | null>(params.circumstance ?? null);
  const [stage, setStage] = useState<Stage>(params.circumstance ? 'lessons' : 'choose');
  const [quote, setQuote] = useState<Quote | null>(null);

  const active = mistakes.filter((m) => !m.paused && m.status !== 'archived');
  const lessons = useMemo(() => {
    const list = circId ? active.filter((m) => m.circumstanceIds.includes(circId)) : active;
    return [...(list.length ? list : active)].sort((a, b) => b.severity - a.severity);
  }, [active, circId]);
  const circ = circumstances.find((c) => c.id === circId);
  const cardWidth = Math.min(width, 640) - 40;

  const record = (outcome: 'avoided' | 'repeated') => {
    addCheckin({ circumstanceId: circId, mistakeIds: lessons.map((m) => m.id), outcome });
    setQuote(nextQuote(outcome === 'avoided' ? 'identity' : 'resilience'));
    setStage(outcome);
  };

  return (
    <Screen back closeIcon headerCompact title="Check in">
      {stage === 'choose' ? (
        <Animated.View entering={FadeIn} style={{ gap: 16 }}>
          <Text variant="title">What&apos;s happening right now?</Text>
          <Text variant="body" tone="muted">
            Name the moment. Naming it already gives you a little distance from it.
          </Text>
          <View style={styles.grid}>
            {circumstances.map((c) => (
              <PressableScale
                key={c.id}
                onPress={() => {
                  setCircId(c.id);
                  setStage('lessons');
                }}
                accessibilityRole="button"
                accessibilityLabel={c.name}
                style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
                <View style={[styles.tileIcon, { backgroundColor: `${c.color}26` }]}>
                  <Icon name={c.icon as IconName} size={24} color={c.color} />
                </View>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {c.name}
                </Text>
              </PressableScale>
            ))}
            <PressableScale
              onPress={() => {
                setCircId(null);
                setStage('lessons');
              }}
              accessibilityRole="button"
              accessibilityLabel="Something else"
              style={[styles.tile, { backgroundColor: colors.surfaceSunken, borderColor: colors.border, borderRadius: radius.lg }]}>
              <View style={[styles.tileIcon, { backgroundColor: colors.violetSoft }]}>
                <Icon name="dots-horizontal" size={24} color={colors.violet} />
              </View>
              <Text variant="bodyStrong">Something else</Text>
            </PressableScale>
          </View>
          <Button label="Just help me breathe" icon="weather-windy" variant="tonal" onPress={() => setStage('breathe')} />
        </Animated.View>
      ) : null}

      {stage === 'lessons' ? (
        <Animated.View entering={FadeIn} style={{ gap: 16 }}>
          <Text variant="overline" tone="muted">
            {circ ? circ.name : 'Your lessons'}
          </Text>
          <Text variant="title">Remember what you learned</Text>
          {lessons.length === 0 ? (
            <Card>
              <EmptyState icon="lightbulb-outline" title="No lessons yet" message="Record a mistake and its solution, and it will show up here when you need it." action="Record a mistake" onAction={() => router.replace('/mistake/new')} />
            </Card>
          ) : (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + 12} decelerationRate="fast" contentContainerStyle={{ gap: 12 }}>
              {lessons.map((m) => (
                <Card key={m.id} variant="prayer" padding={20} style={{ width: cardWidth }}>
                  <View style={{ gap: 12 }}>
                    <Text variant="overline" tone="muted">
                      {m.title}
                    </Text>
                    <Text variant="serif" style={{ fontSize: 22, lineHeight: 32 }}>
                      If {m.solution.ifThen.if}, then {m.solution.ifThen.then}.
                    </Text>
                    {m.solution.steps.slice(0, 3).map((s, i) => (
                      <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                        <Icon name="check" size={18} color={colors.primary} />
                        <Text variant="body" style={{ flex: 1 }}>
                          {s}
                        </Text>
                      </View>
                    ))}
                    {m.solution.dont ? (
                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <Icon name="cancel" size={18} color={colors.danger} />
                        <Text variant="bodyStrong" style={{ flex: 1 }}>
                          {m.solution.dont}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Card>
              ))}
            </ScrollView>
          )}
          {lessons.length > 1 ? (
            <Text variant="caption" tone="muted" align="center">
              Swipe for {lessons.length - 1} more
            </Text>
          ) : null}
          <View style={{ gap: 10, marginTop: 8 }}>
            <Button label="I'll avoid it" icon="shield-check-outline" size="lg" fullWidth onPress={() => record('avoided')} />
            <Button label="Breathe for 60 seconds first" icon="weather-windy" variant="tonal" fullWidth onPress={() => setStage('breathe')} />
            <Button label="I already slipped" variant="ghost" fullWidth onPress={() => record('repeated')} />
          </View>
        </Animated.View>
      ) : null}

      {stage === 'breathe' ? (
        <Animated.View entering={FadeIn} style={{ gap: 16 }}>
          <Text variant="title" align="center">
            Ride the wave
          </Text>
          <BreathingCircle />
          <Button label="I'm okay now" icon="shield-check-outline" fullWidth onPress={() => (lessons.length ? record('avoided') : router.back())} />
          <Button label="Back to lessons" variant="ghost" fullWidth onPress={() => setStage('lessons')} />
        </Animated.View>
      ) : null}

      {stage === 'avoided' || stage === 'repeated' ? (
        <Animated.View entering={FadeInDown.duration(300)} style={{ gap: 16, alignItems: 'center', paddingTop: 24 }}>
          <View style={[styles.result, { backgroundColor: stage === 'avoided' ? colors.primarySoft : colors.violetSoft }]}>
            <Icon name={stage === 'avoided' ? 'shield-check' : 'heart-outline'} size={44} color={stage === 'avoided' ? colors.primary : colors.violet} />
          </View>
          <Text variant="title" align="center">
            {stage === 'avoided' ? 'Proud of you' : 'Slips happen'}
          </Text>
          <Text variant="body" tone="muted" align="center" style={{ maxWidth: 320 }}>
            {stage === 'avoided'
              ? 'You chose who you are becoming over an old habit. That counts more than you think.'
              : 'You were honest, and that is where change starts. Your review restarts tomorrow, and your prayer will focus on strength.'}
          </Text>
          {quote ? (
            <Card variant="sunken" style={{ alignSelf: 'stretch' }}>
              <Text variant="serifItalic">“{quote.text}”</Text>
              <Text variant="caption" tone="muted" style={{ marginTop: 6 }}>
                {quote.author}
              </Text>
            </Card>
          ) : null}
          <Button label="Done" fullWidth onPress={() => router.back()} />
        </Animated.View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: '47%', padding: 14, gap: 10, borderWidth: 1, minHeight: 112 },
  tileIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  result: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
});
