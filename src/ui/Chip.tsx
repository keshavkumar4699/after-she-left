import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type ChipTone = 'neutral' | 'primary' | 'accent' | 'violet' | 'danger';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  /** Shows a close affordance (input chip). */
  onRemove?: () => void;
  tone?: ChipTone;
  size?: 'sm' | 'md';
  /** Leading color dot (identity), paired with the label text. */
  dotColor?: string;
}

export function Chip({ label, selected, onPress, icon, onRemove, tone = 'neutral', size = 'md', dotColor }: ChipProps) {
  const { colors, radius } = useTheme();
  const tones: Record<ChipTone, { bg: string; fg: string; border: string }> = {
    neutral: { bg: colors.surfaceRaised, fg: colors.text, border: colors.border },
    primary: { bg: colors.primarySoft, fg: colors.primaryStrong, border: 'transparent' },
    accent: { bg: colors.accentSoft, fg: colors.text, border: 'transparent' },
    violet: { bg: colors.violetSoft, fg: colors.text, border: 'transparent' },
    danger: { bg: colors.dangerSoft, fg: colors.text, border: 'transparent' },
  };
  const t = selected
    ? { bg: colors.primaryStrong, fg: colors.onPrimary, border: colors.primaryStrong }
    : tones[tone];
  const height = size === 'sm' ? 28 : 36;

  const body = (
    <View
      style={[
        styles.chip,
        { height, paddingHorizontal: size === 'sm' ? 10 : 14, backgroundColor: t.bg, borderColor: t.border, borderRadius: radius.pill },
      ]}>
      {selected && !icon ? <Icon name="check" size={16} color={t.fg} /> : null}
      {icon ? <Icon name={icon} size={size === 'sm' ? 14 : 16} color={t.fg} /> : null}
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <Text variant={size === 'sm' ? 'caption' : 'label'} color={t.fg} numberOfLines={1}>
        {label}
      </Text>
      {onRemove ? (
        <PressableScale onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove ${label}`} hitSlop={8}>
          <Icon name="close-circle" size={16} color={t.fg} />
        </PressableScale>
      ) : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      activeScale={0.95}>
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
