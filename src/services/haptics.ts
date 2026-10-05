import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Haptics are a native nicety; on web they are silently skipped. */
const enabled = Platform.OS !== 'web';

export const haptics = {
  tap() {
    if (enabled) Haptics.selectionAsync().catch(() => {});
  },
  success() {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  warning() {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
  impact() {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
};
