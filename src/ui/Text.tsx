import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { TypeVariant } from '@/theme/tokens';

export type TextTone = 'default' | 'muted' | 'subtle' | 'primary' | 'accent' | 'violet' | 'danger' | 'inverse' | 'onPrimary';

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  tone?: TextTone;
  align?: TextStyle['textAlign'];
  color?: string;
}

export function Text({ variant = 'body', tone = 'default', align, color, style, ...rest }: AppTextProps) {
  const { colors, type } = useTheme();
  const toneColor: Record<TextTone, string> = {
    default: colors.text,
    muted: colors.textMuted,
    subtle: colors.textSubtle,
    primary: colors.primaryStrong,
    accent: colors.accent,
    violet: colors.violet,
    danger: colors.danger,
    inverse: colors.bg,
    onPrimary: colors.onPrimary,
  };
  return (
    <RNText
      {...rest}
      style={[type[variant], { color: color ?? toneColor[tone] }, align ? { textAlign: align } : null, style]}
    />
  );
}
