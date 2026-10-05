import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type ButtonVariant = 'filled' | 'tonal' | 'outline' | 'ghost' | 'danger' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

const HEIGHT: Record<ButtonSize, number> = { sm: 36, md: 48, lg: 56 };
const PAD: Record<ButtonSize, number> = { sm: 14, md: 20, lg: 24 };

export function Button({
  label,
  onPress,
  variant = 'filled',
  size = 'md',
  icon,
  iconRight,
  loading,
  disabled,
  fullWidth,
  style,
  accessibilityHint,
}: ButtonProps) {
  const { colors, radius } = useTheme();
  const look: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    filled: { bg: colors.primaryStrong, fg: colors.onPrimary },
    tonal: { bg: colors.primarySoft, fg: colors.primaryStrong },
    outline: { bg: 'transparent', fg: colors.text, border: colors.borderStrong },
    ghost: { bg: 'transparent', fg: colors.primaryStrong },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    accent: { bg: colors.accent, fg: '#241603' },
  };
  const { bg, fg, border } = look[variant];
  const iconSize = size === 'sm' ? 16 : 20;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={[
        styles.base,
        {
          height: HEIGHT[size],
          paddingHorizontal: PAD[size],
          backgroundColor: bg,
          borderRadius: radius.pill,
          borderWidth: border ? 1 : 0,
          borderColor: border,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={iconSize} color={fg} /> : null}
          <Text variant={size === 'sm' ? 'label' : 'bodyStrong'} color={fg} numberOfLines={1}>
            {label}
          </Text>
          {iconRight ? <Icon name={iconRight} size={iconSize} color={fg} /> : null}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
