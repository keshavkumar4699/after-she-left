import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { QUOTES } from '@/content/quotes';
import { toDayKey } from '@/domain/dates';
import { limitsFor, effectiveTier } from '@/domain/entitlements';
import { planNotifications, type DesiredNotification } from '@/domain/reminders';
import { liveValues, useStore } from '@/store/useStore';

/**
 * Local notifications. The domain planner decides *what* should be scheduled; this module
 * reconciles the OS schedule to that plan (cancel + reschedule), so it is idempotent.
 */

const supported = Platform.OS !== 'web';

export const CHANNELS = {
  reminders: { name: 'Lesson reminders', importance: Notifications.AndroidImportance.HIGH },
  prayer: { name: 'Morning prayer', importance: Notifications.AndroidImportance.DEFAULT },
  nudges: { name: 'Habit nudges', importance: Notifications.AndroidImportance.DEFAULT },
  review: { name: 'Lesson review', importance: Notifications.AndroidImportance.DEFAULT },
} as const;

let configured = false;

export async function setupNotifications(): Promise<void> {
  if (!supported || configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    for (const [id, channel] of Object.entries(CHANNELS)) {
      await Notifications.setNotificationChannelAsync(id, {
        name: channel.name,
        importance: channel.importance,
        lightColor: '#2DD4BF',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      });
    }
  }
  await Notifications.setNotificationCategoryAsync('habit', [
    { identifier: 'done', buttonTitle: 'Done ✓', options: { opensAppToForeground: false } },
    { identifier: 'snooze', buttonTitle: 'Snooze 1h', options: { opensAppToForeground: false } },
  ]);
  await Notifications.setNotificationCategoryAsync('lesson', [
    { identifier: 'avoided', buttonTitle: 'Avoided ✓', options: { opensAppToForeground: false } },
    { identifier: 'open', buttonTitle: 'Open lesson', options: { opensAppToForeground: true } },
  ]);
}

export async function notificationPermission(): Promise<'granted' | 'denied' | 'undetermined' | 'unsupported'> {
  if (!supported) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!supported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

function toTrigger(n: DesiredNotification): Notifications.NotificationTriggerInput {
  const channelId = n.channel;
  switch (n.trigger.type) {
    case 'daily':
      return { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: n.trigger.hour, minute: n.trigger.minute, channelId };
    case 'weekly':
      return {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: n.trigger.weekday,
        hour: n.trigger.hour,
        minute: n.trigger.minute,
        channelId,
      };
    case 'date':
      return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.trigger.at, channelId };
  }
}

/** Compute today's desired schedule from the store. Pure apart from reading the store. */
export function desiredNotifications(now = new Date()): DesiredNotification[] {
  const s = useStore.getState();
  const tier = effectiveTier(s.plan, now.getTime());
  return planNotifications({
    settings: {
      prayerTime: s.settings.prayerTime,
      reviewTime: s.settings.reviewTime,
      quietHours: s.settings.quietHours,
      activeHours: s.settings.activeHours,
      privacy: s.settings.notificationPrivacy,
      enabled: s.settings.reminders,
    },
    circumstances: liveValues(s.circumstances),
    mistakes: liveValues(s.mistakes),
    habits: liveValues(s.habits),
    logs: liveValues(s.habitLogs),
    quotes: QUOTES,
    seed: s.settings.installSeed,
    scheduledCircumstanceLimit: limitsFor(tier).scheduledCircumstances,
    now,
  });
}

let syncing: Promise<number> | null = null;

/** Reconcile the OS schedule with the plan. Safe to call often. */
export async function syncReminders(): Promise<number> {
  if (!supported) return 0;
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      const { granted } = await Notifications.getPermissionsAsync();
      if (!granted) return 0;
      await setupNotifications();
      const plan = desiredNotifications();
      await Notifications.cancelAllScheduledNotificationsAsync();
      for (const n of plan) {
        await Notifications.scheduleNotificationAsync({
          identifier: n.id,
          content: {
            title: n.title,
            body: n.body,
            data: n.data,
            categoryIdentifier: n.category,
          },
          trigger: toTrigger(n),
        });
      }
      return plan.length;
    } catch (e) {
      console.warn('[notifications] sync failed', e);
      return 0;
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

export async function sendTestNotification(): Promise<boolean> {
  if (!supported) return false;
  if (!(await requestNotificationPermission())) return false;
  await setupNotifications();
  await Notifications.scheduleNotificationAsync({
    content: { title: 'After She Left', body: 'Reminders are working. Small steps, every day.', data: { route: '/' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: 'reminders' },
  });
  return true;
}

/** Handle taps and action buttons on notifications. Mount once at the root. */
export function useNotificationResponses() {
  useEffect(() => {
    if (!supported) return;
    const handle = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as { route?: string; kind?: string; refId?: string };
      const action = response.actionIdentifier;
      const store = useStore.getState();
      const day = toDayKey();
      if (action === 'done' && data.refId) {
        const log = store.habitLogs[`${data.refId}_${day}`];
        if (!log || log.status !== 'done') store.toggleDone(data.refId, day);
        return;
      }
      if (action === 'avoided' && data.refId) {
        const mistakeIds = liveValues(store.mistakes)
          .filter((m) => m.circumstanceIds.includes(data.refId!))
          .map((m) => m.id);
        store.addCheckin({ circumstanceId: data.refId, mistakeIds, outcome: 'avoided' });
        return;
      }
      if (action === 'snooze') {
        const content = response.notification.request.content;
        Notifications.scheduleNotificationAsync({
          content: { title: content.title, body: content.body, data: content.data, categoryIdentifier: content.categoryIdentifier ?? undefined },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3600, channelId: 'nudges' },
        }).catch(() => {});
        return;
      }
      if (data.route) router.push(data.route as never);
    };
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    Notifications.getLastNotificationResponseAsync().then((r) => r && handle(r)).catch(() => {});
    return () => sub.remove();
  }, []);
}

/** Re-sync reminders whenever relevant data changes (debounced). Mount once at the root. */
export function useReminderSync(enabled: boolean) {
  useEffect(() => {
    if (!supported || !enabled) return;
    syncReminders();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = useStore.subscribe((s, prev) => {
      if (
        s.settings === prev.settings &&
        s.habits === prev.habits &&
        s.habitLogs === prev.habitLogs &&
        s.mistakes === prev.mistakes &&
        s.circumstances === prev.circumstances &&
        s.plan === prev.plan
      )
        return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => syncReminders(), 2000);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [enabled]);
}
