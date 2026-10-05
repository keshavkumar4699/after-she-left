import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import type { Quote } from '@/domain/quotes';
import type { DayKey, Difficulty, Habit } from '@/domain/types';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/theme/ThemeProvider';
import { BottomSheet, Button, Icon, PressableScale, Text } from '@/ui';

const DIFFICULTY: { value: Difficulty; label: string; icon: 'emoticon-cool-outline' | 'emoticon-happy-outline' | 'emoticon-confused-outline' }[] = [
  { value: 'easy', label: 'Too easy', icon: 'emoticon-cool-outline' },
  { value: 'right', label: 'Just right', icon: 'emoticon-happy-outline' },
  { value: 'hard', label: 'Too hard', icon: 'emoticon-confused-outline' },
];

/**
 * Make it satisfying: celebrate, show the reward, a fresh (never repetitive) quote, and ask how
 * hard it felt. That rating feeds the Goldilocks rule.
 */
export function CompletionSheet({
  visible,
  onClose,
  habit,
  day,
  quote,
}: {
  visible: boolean;
  onClose: () => void;
  habit: Habit;
  day: DayKey;
  quote: Quote | null;
}) {
  const { colors, radius } = useTheme();
  const setDifficulty = useStore((s) => s.setDifficulty);
  const [rating, setRating] = useState<Difficulty | null>(null);

  return (
    <BottomSheet visible={visible} onClose={onClose} footer={<Button label="Done" fullWidth onPress={onClose} />}>
      <View style={{ alignItems: 'center', gap: 10, paddingTop: 4 }}>
        <Animated.View entering={ZoomIn.springify().damping(10)} style={[styles.burst, { backgroundColor: colors.primarySoft }]}>
          <Text style={{ fontSize: 40, lineHeight: 50 }}>{habit.emoji}</Text>
        </Animated.View>
        <Text variant="h2" align="center">
          {habit.name}: done
        </Text>
        <Text variant="body" tone="muted" align="center">
          {habit.identity ? `${habit.identity}. You just proved it.` : 'Another vote for the person you are becoming.'}
        </Text>
      </View>

      {habit.reward ? (
        <View style={[styles.reward, { backgroundColor: colors.accentSoft, borderRadius: radius.lg }]}>
          <Icon name="gift-outline" size={22} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text variant="overline" tone="muted">
              Your reward
            </Text>
            <Text variant="bodyStrong">{habit.reward}</Text>
          </View>
        </View>
      ) : null}

      {quote ? (
        <View style={[styles.quote, { borderLeftColor: colors.violet }]}>
          <Text variant="serifItalic">“{quote.text}”</Text>
          <Text variant="caption" tone="muted">
            {quote.author}
          </Text>
        </View>
      ) : null}

      <Text variant="overline" tone="muted" style={{ marginTop: 6 }}>
        How did it feel?
      </Text>
      <View style={styles.ratings}>
        {DIFFICULTY.map((d) => {
          const on = rating === d.value;
          return (
            <PressableScale
              key={d.value}
              onPress={() => {
                setRating(d.value);
                setDifficulty(habit.id, day, d.value);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={d.label}
              style={[
                styles.rating,
                {
                  borderRadius: radius.lg,
                  backgroundColor: on ? colors.primarySoft : colors.surfaceSunken,
                  borderColor: on ? colors.primary : colors.border,
                },
              ]}>
              <Icon name={d.icon} size={26} color={on ? colors.primaryStrong : colors.textMuted} />
              <Text variant="caption">{d.label}</Text>
            </PressableScale>
          );
        })}
      </View>
      <Text variant="caption" tone="subtle" align="center">
        The best habits sit between easy and hard: challenging enough to stay exciting.
      </Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  burst: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginTop: 8 },
  quote: { borderLeftWidth: 3, paddingLeft: 12, gap: 4, marginVertical: 8 },
  ratings: { flexDirection: 'row', gap: 10 },
  rating: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, borderWidth: 1.5 },
});
