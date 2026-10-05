import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';

import { useTheme } from '@/theme/ThemeProvider';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

/* ---------------------------------------------------------------------------------------------
 * Small display components: Badge, Avatar, Divider, SectionHeader, ListItem, EmptyState,
 * Skeleton, Banner, StreakBadge.
 * -------------------------------------------------------------------------------------------*/

export function Badge({
  label,
  tone = 'primary',
  icon,
}: {
  label: string;
  tone?: 'primary' | 'accent' | 'violet' | 'danger' | 'neutral';
  icon?: IconName;
}) {
  const { colors, radius } = useTheme();
  const map = {
    primary: [colors.primarySoft, colors.primaryStrong],
    accent: [colors.accentSoft, colors.accent],
    violet: [colors.violetSoft, colors.violet],
    danger: [colors.dangerSoft, colors.danger],
    neutral: [colors.surfaceRaised, colors.textMuted],
  } as const;
  const [bg, iconColor] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderRadius: radius.pill }]}>
      {icon ? <Icon name={icon} size={13} color={iconColor} /> : null}
      <Text variant="caption" tone={tone === 'primary' ? 'primary' : 'default'}>
        {label}
      </Text>
    </View>
  );
}

export function Avatar({ label, emoji, color, size = 44 }: { label?: string; emoji?: string; color?: string; size?: number }) {
  const { colors } = useTheme();
  const initials = (label ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color ? `${color}26` : colors.surfaceRaised,
        borderWidth: 1,
        borderColor: color ? `${color}55` : colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {emoji ? (
        <Text style={{ fontSize: size * 0.48, lineHeight: size * 0.62 }}>{emoji}</Text>
      ) : (
        <Text variant="bodyStrong">{initials || '•'}</Text>
      )}
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: inset }} />;
}

export function SectionHeader({
  title,
  action,
  onAction,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, style]}>
      <Text variant="overline" tone="muted" accessibilityRole="header">
        {title}
      </Text>
      {action ? (
        <PressableScale onPress={onAction} accessibilityRole="button" hitSlop={10}>
          <Text variant="label" tone="primary">
            {action}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

export interface ListItemProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconColor?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  chevron?: boolean;
}

export function ListItem({
  title,
  subtitle,
  icon,
  iconColor,
  leading,
  trailing,
  value,
  onPress,
  destructive,
  chevron = !!onPress,
}: ListItemProps) {
  const { colors, radius } = useTheme();
  const content = (
    <View style={styles.listItem}>
      {leading ??
        (icon ? (
          <View style={[styles.listIcon, { backgroundColor: destructive ? colors.dangerSoft : colors.surfaceRaised, borderRadius: radius.md }]}>
            <Icon name={icon} size={20} color={destructive ? colors.danger : (iconColor ?? colors.text)} />
          </View>
        ) : null)}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" tone={destructive ? 'danger' : 'default'} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="label" tone="muted">
          {value}
        </Text>
      ) : null}
      {trailing}
      {chevron ? <Icon name="chevron-right" size={20} color={colors.textSubtle} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={title} activeScale={0.985}>
      {content}
    </PressableScale>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  onAction,
  tone = 'primary',
}: {
  icon: IconName;
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
  tone?: 'primary' | 'violet' | 'accent';
}) {
  const { colors } = useTheme();
  const soft = tone === 'violet' ? colors.violetSoft : tone === 'accent' ? colors.accentSoft : colors.primarySoft;
  const strong = tone === 'violet' ? colors.violet : tone === 'accent' ? colors.accent : colors.primary;
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: soft }]}>
        <Icon name={icon} size={30} color={strong} />
      </View>
      <Text variant="h3" align="center">
        {title}
      </Text>
      <Text variant="body" tone="muted" align="center" style={{ maxWidth: 300 }}>
        {message}
      </Text>
      {action ? <Button label={action} onPress={onAction} variant="tonal" icon="plus" style={{ alignSelf: 'center', marginTop: 4 }} /> : null}
    </View>
  );
}

export function Skeleton({ width = '100%', height = 16, radius = 8 }: { width?: number | `${number}%`; height?: number; radius?: number }) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.set(withRepeat(withTiming(1, { duration: 800 }), -1, true));
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.surfaceRaised }, style]} />;
}

export function Banner({
  tone = 'primary',
  icon,
  title,
  message,
  action,
  onAction,
  onClose,
}: {
  tone?: 'primary' | 'accent' | 'violet' | 'danger';
  icon: IconName;
  title: string;
  message?: string;
  action?: string;
  onAction?: () => void;
  onClose?: () => void;
}) {
  const { colors, radius } = useTheme();
  const soft = { primary: colors.primarySoft, accent: colors.accentSoft, violet: colors.violetSoft, danger: colors.dangerSoft }[tone];
  const strong = { primary: colors.primary, accent: colors.accent, violet: colors.violet, danger: colors.danger }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: soft, borderRadius: radius.lg }]} accessibilityRole="alert">
      <Icon name={icon} size={22} color={strong} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{title}</Text>
        {message ? (
          <Text variant="caption" tone="muted">
            {message}
          </Text>
        ) : null}
        {action ? (
          <PressableScale onPress={onAction} accessibilityRole="button" style={{ marginTop: 6, alignSelf: 'flex-start' }} hitSlop={8}>
            <Text variant="label" tone="primary">
              {action}
            </Text>
          </PressableScale>
        ) : null}
      </View>
      {onClose ? (
        <PressableScale onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={10}>
          <Icon name="close" size={18} color={colors.textMuted} />
        </PressableScale>
      ) : null}
    </View>
  );
}

/** Streak: amber flame icon carries identity; the number stays in text ink. */
export function StreakBadge({ count, label = 'streak' }: { count: number; label?: string }) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={[styles.badge, { backgroundColor: colors.accentSoft, borderRadius: radius.pill }]}
      accessibilityLabel={`${count} ${label}`}>
      <Icon name="fire" size={14} color={colors.accent} />
      <Text variant="caption">{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, minHeight: 56 },
  listIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 28, paddingHorizontal: 16 },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  banner: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'flex-start' },
});
