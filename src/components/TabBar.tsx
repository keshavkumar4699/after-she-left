import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '@/services/haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon, PressableScale, Text, type IconName } from '@/ui';

const TABS: Record<string, { label: string; icon: IconName; activeIcon: IconName }> = {
  index: { label: 'Today', icon: 'white-balance-sunny', activeIcon: 'white-balance-sunny' },
  habits: { label: 'Habits', icon: 'calendar-check-outline', activeIcon: 'calendar-check' },
  lessons: { label: 'Lessons', icon: 'lightbulb-outline', activeIcon: 'lightbulb-on' },
  goals: { label: 'Goals', icon: 'flag-outline', activeIcon: 'flag' },
  me: { label: 'Me', icon: 'account-circle-outline', activeIcon: 'account-circle' },
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: colors.tabBar, borderTopColor: colors.border },
      ]}
      accessibilityRole="tablist">
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            haptics.tap();
            navigation.navigate(route.name, route.params);
          }
        };
        return (
          <PressableScale
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            activeScale={0.92}
            style={styles.tab}>
            <View style={[styles.pill, { borderRadius: radius.pill, backgroundColor: focused ? colors.primarySoft : 'transparent' }]}>
              <Icon name={focused ? tab.activeIcon : tab.icon} size={22} color={focused ? colors.primaryStrong : colors.textMuted} />
            </View>
            <Text variant="caption" tone={focused ? 'default' : 'muted'} style={{ fontSize: 11 }}>
              {tab.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    paddingTop: 8,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  pill: { width: 56, height: 32, alignItems: 'center', justifyContent: 'center' },
});
