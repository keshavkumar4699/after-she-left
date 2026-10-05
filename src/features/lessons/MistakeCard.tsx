import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { formatDay } from '@/domain/dates';
import type { Circumstance, Mistake, MistakeCategory } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';
import { Badge, Card, Icon, Text, type IconName } from '@/ui';

export const CATEGORY_META: Record<MistakeCategory, { label: string; icon: IconName }> = {
  relationships: { label: 'Relationships', icon: 'heart-outline' },
  money: { label: 'Money', icon: 'cash-multiple' },
  health: { label: 'Health', icon: 'heart-pulse' },
  work: { label: 'Work', icon: 'briefcase-outline' },
  habits: { label: 'Habits', icon: 'repeat' },
  communication: { label: 'Communication', icon: 'message-text-outline' },
  self: { label: 'Self', icon: 'account-heart-outline' },
  other: { label: 'Other', icon: 'dots-horizontal-circle-outline' },
};

/** Severity as five small bars plus the number, so it never relies on colour alone. */
export function SeverityMeter({ value }: { value: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.severity} accessibilityLabel={`Severity ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <View key={n} style={[styles.bar, { height: 4 + n * 2, backgroundColor: n <= value ? colors.danger : colors.border }]} />
      ))}
      <Text variant="caption" tone="muted" style={{ marginLeft: 4 }}>
        {value}/5
      </Text>
    </View>
  );
}

export function MistakeCard({ mistake, circumstances }: { mistake: Mistake; circumstances: Circumstance[] }) {
  const { colors } = useTheme();
  const meta = CATEGORY_META[mistake.category];
  const linked = circumstances.filter((c) => mistake.circumstanceIds.includes(c.id));
  return (
    <Card onPress={() => router.push(`/mistake/${mistake.id}`)} accessibilityLabel={`Lesson: ${mistake.title}`} style={mistake.paused ? { opacity: 0.6 } : undefined}>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name={meta.icon} size={16} color={colors.textMuted} />
          <Text variant="caption" tone="muted" style={{ flex: 1 }}>
            {meta.label} · {formatDay(mistake.occurredOn, { withYear: true })}
          </Text>
          {mistake.status === 'learned' ? <Badge label="Learned" tone="primary" icon="check" /> : null}
          {mistake.paused ? <Badge label="Paused" tone="neutral" icon="pause" /> : null}
          {mistake.repeatCount > 0 ? <Badge label={`Repeated ${mistake.repeatCount}×`} tone="danger" icon="repeat" /> : null}
        </View>
        <Text variant="h3">{mistake.title}</Text>
        <View style={[styles.rule, { backgroundColor: colors.primarySoft }]}>
          <Text variant="caption" tone="primary" style={{ fontFamily: 'Inter_700Bold' }}>
            IF – THEN
          </Text>
          <Text variant="body" numberOfLines={3}>
            If {mistake.solution.ifThen.if}, then {mistake.solution.ifThen.then}.
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SeverityMeter value={mistake.severity} />
          <View style={{ flex: 1 }} />
          {linked.slice(0, 2).map((c) => (
            <View key={c.id} style={styles.circ}>
              <View style={[styles.dot, { backgroundColor: c.color }]} />
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {c.name}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  severity: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: { width: 4, borderRadius: 2 },
  rule: { borderRadius: 12, padding: 12, gap: 4 },
  circ: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 160 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
