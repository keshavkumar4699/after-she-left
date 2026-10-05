import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { PressableScale } from './PressableScale';

export type CardVariant = 'filled' | 'outlined' | 'tonal' | 'hero' | 'prayer' | 'sunken';
export type CardTone = 'primary' | 'accent' | 'violet' | 'danger';

export interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  tone?: CardTone;
  onPress?: () => void;
  padding?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Highlighted border, e.g. the "current" habit. */
  emphasized?: boolean;
}

export function Card({
  children,
  variant = 'filled',
  tone = 'primary',
  onPress,
  padding = 16,
  style,
  accessibilityLabel,
  emphasized,
}: CardProps) {
  const { colors, radius, scheme } = useTheme();
  const toneSoft: Record<CardTone, string> = {
    primary: colors.primarySoft,
    accent: colors.accentSoft,
    violet: colors.violetSoft,
    danger: colors.dangerSoft,
  };
  const toneStrong: Record<CardTone, string> = {
    primary: colors.primary,
    accent: colors.accent,
    violet: colors.violet,
    danger: colors.danger,
  };

  const base: ViewStyle = {
    borderRadius: radius.xl,
    padding,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: emphasized ? toneStrong[tone] : colors.border,
  };
  const background: ViewStyle =
    variant === 'outlined'
      ? { backgroundColor: 'transparent' }
      : variant === 'tonal'
        ? { backgroundColor: toneSoft[tone], borderColor: emphasized ? toneStrong[tone] : 'transparent' }
        : variant === 'sunken'
          ? { backgroundColor: colors.surfaceSunken, borderColor: 'transparent' }
          : { backgroundColor: colors.surface };
  const elevation: ViewStyle =
    scheme === 'light' && (variant === 'filled' || variant === 'hero' || variant === 'prayer')
      ? { shadowColor: colors.shadow, shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 }
      : {};

  const content =
    variant === 'hero' || variant === 'prayer' ? (
      <>
        <LinearGradient
          colors={variant === 'hero' ? colors.heroGradient : colors.prayerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </>
    ) : (
      children
    );

  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        activeScale={0.985}
        style={[base, background, elevation, style]}>
        {content}
      </PressableScale>
    );
  }
  return (
    <View accessibilityLabel={accessibilityLabel} style={[base, background, elevation, style]}>
      {content}
    </View>
  );
}
