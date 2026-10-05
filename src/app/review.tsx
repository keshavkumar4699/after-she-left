import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FlipInEasyX } from 'react-native-reanimated';

import { formatDay } from '@/domain/dates';
import { dueLessons } from '@/domain/review';
import { useMistakes, useToday } from '@/store/hooks';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Card, EmptyState, Icon, PressableScale, ProgressBar, Screen, Text } from '@/ui';

/** Spaced review flashcards: recall the rule, then reveal it. */
export default function ReviewScreen() {
  const { colors } = useTheme();
  const today = useToday();
  const mistakes = useMistakes();
  const reviewMistake = useStore((s) => s.reviewMistake);
  // Freeze the queue when the session starts, so answering doesn't reshuffle it.
  const [queue] = useState(() => dueLessons(mistakes, today).map((m) => m.id));
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [remembered, setRemembered] = useState(0);
  const byId = useMemo(() => new Map(mistakes.map((m) => [m.id, m])), [mistakes]);
  const current = byId.get(queue[index]);
  const finished = index >= queue.length;

  const answer = (result: 'remembered' | 'forgot') => {
    if (!current) return;
    reviewMistake(current.id, result);
    if (result === 'remembered') setRemembered((r) => r + 1);
    setRevealed(false);
    setIndex((i) => i + 1);
  };

  const nextUp = mistakes
    .filter((m) => !m.paused && m.status !== 'archived')
    .map((m) => m.review.nextReviewOn)
    .filter((d) => d > today)
    .sort()[0];

  return (
    <Screen back closeIcon headerCompact title="Review">
      {queue.length === 0 ? (
        <Card>
          <EmptyState
            icon="check-all"
            title="All caught up"
            message={nextUp ? `Next review on ${formatDay(nextUp, { withWeekday: true })}.` : 'Record a lesson to start spaced review.'}
          />
        </Card>
      ) : finished ? (
        <Animated.View entering={FadeIn} style={{ gap: 16 }}>
          <Card>
            <EmptyState
              icon="trophy-outline"
              tone="accent"
              title="Review complete"
              message={`You remembered ${remembered} of ${queue.length}. Remembered lessons come back later; the others come back sooner.`}
            />
          </Card>
          <Button label="Done" fullWidth onPress={() => router.back()} />
        </Animated.View>
      ) : current ? (
        <View style={{ gap: 18 }}>
          <View style={{ gap: 8 }}>
            <ProgressBar progress={index / queue.length} color={colors.violet} />
            <Text variant="caption" tone="muted">
              {index + 1} of {queue.length}
            </Text>
          </View>
          <PressableScale onPress={() => setRevealed(true)} disabled={revealed} accessibilityRole="button" accessibilityLabel={revealed ? 'Answer shown' : 'Reveal the answer'} activeScale={0.99}>
            <Card variant="prayer" padding={24} style={{ minHeight: 320 }}>
              <View style={{ gap: 16, flex: 1 }}>
                <Text variant="overline" tone="muted">
                  The mistake
                </Text>
                <Text variant="title">{current.title}</Text>
                {revealed ? (
                  <Animated.View entering={FlipInEasyX.duration(350)} style={{ gap: 12 }}>
                    <Text variant="overline" tone="primary">
                      Your rule
                    </Text>
                    <Text variant="serif">
                      If {current.solution.ifThen.if}, then {current.solution.ifThen.then}.
                    </Text>
                    {current.solution.dont ? (
                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <Icon name="cancel" size={18} color={colors.danger} />
                        <Text variant="bodyStrong">{current.solution.dont}</Text>
                      </View>
                    ) : null}
                  </Animated.View>
                ) : (
                  <View style={{ flex: 1, justifyContent: 'flex-end', gap: 8 }}>
                    <Text variant="body" tone="muted">
                      What do you do instead? Say it in your head, then tap to check.
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name="gesture-tap" size={18} color={colors.primary} />
                      <Text variant="label" tone="primary">
                        Tap to reveal
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </Card>
          </PressableScale>
          {revealed ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button label="Forgot" icon="refresh" variant="outline" onPress={() => answer('forgot')} style={{ flex: 1 }} fullWidth />
              <Button label="Remembered" icon="check" onPress={() => answer('remembered')} style={{ flex: 1 }} fullWidth />
            </View>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
