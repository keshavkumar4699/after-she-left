import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { IconButton } from './IconButton';
import { Text } from './Text';

export const TAB_BAR_SPACE = 96;
export const MAX_CONTENT_WIDTH = 640;

export interface ScreenProps {
  title?: string;
  subtitle?: string;
  /** Overline above the title (e.g. a date). */
  eyebrow?: string;
  /** Right side header actions. */
  right?: ReactNode;
  /** Shows a back button (stack screens). */
  back?: boolean;
  /** Use a close (✕) instead of a back arrow, for modal-like screens. */
  closeIcon?: boolean;
  children: ReactNode;
  /** Sticky content at the bottom (primary actions). */
  footer?: ReactNode;
  scroll?: boolean;
  /** Extra bottom space when the screen sits above the tab bar. */
  tabBar?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Overlays rendered above the scroll view (FAB, sticky buttons). */
  overlay?: ReactNode;
  headerCompact?: boolean;
}

export function Screen({
  title,
  subtitle,
  eyebrow,
  right,
  back,
  closeIcon,
  children,
  footer,
  scroll = true,
  tabBar,
  contentStyle,
  overlay,
  headerCompact,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const header =
    title || back || right ? (
      <View style={{ gap: 4, marginBottom: headerCompact ? 8 : 20 }}>
        {back || (right && headerCompact) ? (
          <View style={styles.topBar}>
            {back ? (
              <IconButton icon={closeIcon ? 'close' : 'arrow-left'} label={closeIcon ? 'Close' : 'Back'} variant="tonal" size={40} onPress={goBack} />
            ) : (
              <View />
            )}
            {headerCompact && title ? (
              <Text variant="h3" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
                {title}
              </Text>
            ) : null}
            <View style={styles.actions}>{right}</View>
          </View>
        ) : null}
        {!headerCompact && (title || eyebrow) ? (
          <View style={styles.titleRow}>
            <View style={{ flex: 1, gap: 4 }}>
              {eyebrow ? (
                <Text variant="overline" tone="muted">
                  {eyebrow}
                </Text>
              ) : null}
              {title ? (
                <Text variant="title" accessibilityRole="header">
                  {title}
                </Text>
              ) : null}
              {subtitle ? (
                <Text variant="body" tone="muted">
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {!back && right ? <View style={styles.actions}>{right}</View> : null}
          </View>
        ) : null}
      </View>
    ) : null;

  const padding: ViewStyle = {
    paddingTop: insets.top + 12,
    paddingHorizontal: 20,
    paddingBottom: (tabBar ? TAB_BAR_SPACE : 24) + (footer ? 0 : insets.bottom),
  };

  const body = (
    <View style={[{ width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' }, contentStyle]}>
      {header}
      {children}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={padding}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding]}>{body}</View>
      )}
      {footer ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.bg, borderTopColor: colors.border },
          ]}>
          <View style={{ width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' }}>{footer}</View>
        </View>
      ) : null}
      {overlay}
    </KeyboardAvoidingView>
  );
}

/** A labelled group of form fields. */
export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 12, marginBottom: 28 }}>
      <View style={{ gap: 2 }}>
        <Text variant="h3" accessibilityRole="header">
          {title}
        </Text>
        {description ? (
          <Text variant="caption" tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
