import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { useStore } from '@/store/useStore';
import { syncGeofences } from './geofence';
import { syncReminders } from './notifications';

/**
 * Twice-daily background refresh: re-plans the rolling 7-day notification window (new quotes,
 * changes synced from other devices) and re-registers geofences.
 */
export const REFRESH_TASK = 'after-she-left.refresh';
const supported = Platform.OS !== 'web';

if (supported && !TaskManager.isTaskDefined(REFRESH_TASK)) {
  TaskManager.defineTask(REFRESH_TASK, async () => {
    try {
      if (!useStore.persist.hasHydrated()) await useStore.persist.rehydrate();
      await syncReminders();
      await syncGeofences();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerBackgroundRefresh(): Promise<void> {
  if (!supported) return;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (!(await TaskManager.isTaskRegisteredAsync(REFRESH_TASK))) {
      await BackgroundTask.registerTaskAsync(REFRESH_TASK, { minimumInterval: 12 * 60 });
    }
  } catch (e) {
    console.warn('[background] register failed', e);
  }
}
