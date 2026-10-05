import { useEffect, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  LinearTransition,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { haptics } from '@/services/haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

/* ---------------------------------------------------------------------------------------------
 * BottomSheet
 * -------------------------------------------------------------------------------------------*/

export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxHeightRatio = 0.85,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxHeightRatio?: number;
}) {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {visible ? (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
          </Animated.View>
          <Animated.View
            entering={SlideInDown.springify().damping(20).stiffness(180)}
            exiting={SlideOutDown.duration(200)}
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                borderTopLeftRadius: radius.xl + 4,
                borderTopRightRadius: radius.xl + 4,
                borderColor: colors.border,
                maxHeight: height * maxHeightRatio,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}>
            <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
            {title ? (
              <View style={styles.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text variant="h3" accessibilityRole="header">
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text variant="caption" tone="muted">
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                <PressableScale onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
                  <Icon name="close" size={22} color={colors.textMuted} />
                </PressableScale>
              </View>
            ) : null}
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8, gap: 8 }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
            {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>{footer}</View> : null}
          </Animated.View>
        </View>
      ) : null}
    </Modal>
  );
}

/* ---------------------------------------------------------------------------------------------
 * Dialog
 * -------------------------------------------------------------------------------------------*/

export function Dialog({
  visible,
  onClose,
  icon,
  tone = 'primary',
  title,
  message,
  confirmLabel = 'OK',
  onConfirm,
  cancelLabel,
  destructive,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  icon?: IconName;
  tone?: 'primary' | 'accent' | 'violet' | 'danger';
  title: string;
  message?: string;
  confirmLabel?: string;
  onConfirm?: () => void;
  cancelLabel?: string;
  destructive?: boolean;
  children?: ReactNode;
}) {
  const { colors, radius } = useTheme();
  const soft = { primary: colors.primarySoft, accent: colors.accentSoft, violet: colors.violetSoft, danger: colors.dangerSoft }[tone];
  const strong = { primary: colors.primary, accent: colors.accent, violet: colors.violet, danger: colors.danger }[tone];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.dialogBackdrop, { backgroundColor: colors.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <Animated.View
          entering={FadeInDown.duration(220)}
          accessibilityViewIsModal
          style={[styles.dialog, { backgroundColor: colors.surface, borderRadius: radius.xl, borderColor: colors.border }]}>
          {icon ? (
            <View style={[styles.dialogIcon, { backgroundColor: soft }]}>
              <Icon name={icon} size={26} color={strong} />
            </View>
          ) : null}
          <Text variant="h3" align="center" accessibilityRole="header">
            {title}
          </Text>
          {message ? (
            <Text variant="body" tone="muted" align="center">
              {message}
            </Text>
          ) : null}
          {children}
          <View style={{ gap: 8, alignSelf: 'stretch', marginTop: 8 }}>
            <Button
              label={confirmLabel}
              fullWidth
              variant={destructive ? 'danger' : 'filled'}
              onPress={() => {
                onConfirm?.();
                onClose();
              }}
            />
            {cancelLabel ? <Button label={cancelLabel} fullWidth variant="ghost" onPress={onClose} /> : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ---------------------------------------------------------------------------------------------
 * Snackbar
 * -------------------------------------------------------------------------------------------*/

interface SnackState {
  message: string | null;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
  key: number;
  show: (message: string, opts?: { icon?: IconName; actionLabel?: string; onAction?: () => void }) => void;
  hide: () => void;
}

export const useSnackbar = create<SnackState>((set) => ({
  message: null,
  key: 0,
  show: (message, opts) => set((s) => ({ message, ...opts, key: s.key + 1 })),
  hide: () => set({ message: null, actionLabel: undefined, onAction: undefined, icon: undefined }),
}));

export const toast = (message: string, opts?: { icon?: IconName; actionLabel?: string; onAction?: () => void }) =>
  useSnackbar.getState().show(message, opts);

export function SnackbarHost({ bottomOffset = 96 }: { bottomOffset?: number }) {
  const { colors, radius } = useTheme();
  const { message, icon, actionLabel, onAction, key, hide } = useSnackbar();
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, 3600);
    return () => clearTimeout(t);
  }, [message, key, hide]);
  if (!message) return null;
  return (
    <Animated.View
      key={key}
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(180)}
      pointerEvents="box-none"
      style={[styles.snackWrap, { bottom: bottomOffset }]}>
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[styles.snack, { backgroundColor: colors.text, borderRadius: radius.lg }]}>
        {icon ? <Icon name={icon} size={20} color={colors.bg} /> : null}
        <Text variant="body" color={colors.bg} style={{ flex: 1 }}>
          {message}
        </Text>
        {actionLabel ? (
          <PressableScale
            onPress={() => {
              onAction?.();
              hide();
            }}
            accessibilityRole="button"
            hitSlop={8}>
            <Text variant="label" color={colors.bg} style={{ textDecorationLine: 'underline' }}>
              {actionLabel}
            </Text>
          </PressableScale>
        ) : null}
      </View>
    </Animated.View>
  );
}

/* ---------------------------------------------------------------------------------------------
 * Accordion (expand / collapse with a rotating chevron)
 * -------------------------------------------------------------------------------------------*/

export function Accordion({
  header,
  children,
  expanded,
  onToggle,
  label,
}: {
  header: ReactNode;
  children: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  label: string;
}) {
  const { colors } = useTheme();
  const rotation = useSharedValue(expanded ? 180 : 0);
  useEffect(() => {
    rotation.set(withTiming(expanded ? 180 : 0, { duration: 220 }));
  }, [expanded, rotation]);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  return (
    <Animated.View layout={LinearTransition.duration(220)}>
      <PressableScale
        onPress={() => {
          haptics.tap();
          onToggle();
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded }}
        activeScale={0.99}
        style={styles.accHeader}>
        <View style={{ flex: 1 }}>{header}</View>
        <Animated.View style={[styles.chevron, { backgroundColor: colors.surfaceRaised }, chevron]}>
          <Icon name="chevron-down" size={22} color={colors.text} />
        </Animated.View>
      </PressableScale>
      {expanded ? (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)} style={{ paddingTop: 14 }}>
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/* ---------------------------------------------------------------------------------------------
 * FAB
 * -------------------------------------------------------------------------------------------*/

export function FAB({ icon, label, onPress, bottom = 100 }: { icon: IconName; label?: string; onPress: () => void; bottom?: number }) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(200)} style={[styles.fabWrap, { bottom }]} pointerEvents="box-none">
      <PressableScale
        onPress={() => {
          haptics.impact();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={label ?? 'Action'}
        style={[
          styles.fab,
          {
            backgroundColor: colors.violet,
            paddingHorizontal: label ? 20 : 0,
            width: label ? undefined : 58,
            shadowColor: colors.violet,
          },
        ]}>
        <Icon name={icon} size={24} color="#0B0E1A" />
        {label ? (
          <Text variant="bodyStrong" color="#0B0E1A">
            {label}
          </Text>
        ) : null}
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderWidth: 1, paddingTop: 8 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  dialogBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 380, padding: 24, alignItems: 'center', gap: 10, borderWidth: 1 },
  dialogIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  snackWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  snack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    maxWidth: 520,
    width: '100%',
    ...Platform.select({ default: { elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } } }),
  },
  accHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chevron: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  fabWrap: { position: 'absolute', right: 20 },
  fab: {
    height: 58,
    borderRadius: 29,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    elevation: 6,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
});
