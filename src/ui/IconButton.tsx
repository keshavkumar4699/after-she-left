import { useTheme } from '@/theme/ThemeProvider';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

export interface IconButtonProps {
  icon: IconName;
  onPress?: () => void;
  /** Required: icon-only controls must be named for screen readers. */
  label: string;
  variant?: 'plain' | 'tonal' | 'filled' | 'outline';
  size?: number;
  color?: string;
  disabled?: boolean;
}

export function IconButton({ icon, onPress, label, variant = 'plain', size = 44, color, disabled }: IconButtonProps) {
  const { colors } = useTheme();
  const bg =
    variant === 'filled' ? colors.primaryStrong : variant === 'tonal' ? colors.surfaceRaised : 'transparent';
  const fg = color ?? (variant === 'filled' ? colors.onPrimary : colors.text);
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      activeScale={0.92}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        borderWidth: variant === 'outline' ? 1 : 0,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon name={icon} size={Math.round(size * 0.5)} color={fg} />
    </PressableScale>
  );
}
