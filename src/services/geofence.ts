import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { isWithinWindow } from '@/domain/dates';
import { effectiveTier, limitsFor } from '@/domain/entitlements';
import { liveValues, useStore } from '@/store/useStore';

/**
 * Location reminders: a lesson appears when you arrive at (or leave) a place you chose.
 * Uses OS geofencing (Android allows 100 regions per app; we cap at 95).
 */

export const GEOFENCE_TASK = 'after-she-left.geofence';
const supported = Platform.OS !== 'web';

interface GeofenceEvent {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
}

if (supported && !TaskManager.isTaskDefined(GEOFENCE_TASK)) {
  TaskManager.defineTask<GeofenceEvent>(GEOFENCE_TASK, async ({ data, error }) => {
    if (error || !data?.region?.identifier) return;
    // In a headless task the store may not be hydrated yet.
    if (!useStore.persist.hasHydrated()) await useStore.persist.rehydrate();
    const s = useStore.getState();
    const c = s.circumstances[data.region.identifier];
    if (!c || c.deletedAt || c.paused || !c.location || !s.settings.reminders.geofences) return;

    const entering = data.eventType === Location.GeofencingEventType.Enter;
    if ((entering && !c.location.notifyOnEnter) || (!entering && !c.location.notifyOnExit)) return;

    const now = new Date();
    if (isWithinWindow({ hour: now.getHours(), minute: now.getMinutes() }, s.settings.quietHours.start, s.settings.quietHours.end)) return;

    const key = `geofence:last:${c.id}`;
    const last = Number((await AsyncStorage.getItem(key)) ?? 0);
    if (Date.now() - last < c.cooldownMin * 60_000) return;
    await AsyncStorage.setItem(key, String(Date.now()));

    const lesson = liveValues(s.mistakes)
      .filter((m) => !m.paused && m.status !== 'archived' && m.circumstanceIds.includes(c.id))
      .sort((a, b) => b.severity - a.severity)[0];
    const privacy = s.settings.notificationPrivacy;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: privacy ? 'A gentle reminder' : `${entering ? 'Arriving at' : 'Leaving'} ${c.location.label || c.name}`,
        body: privacy
          ? 'Tap to see your lesson for this place.'
          : lesson
            ? `If ${lesson.solution.ifThen.if}, then ${lesson.solution.ifThen.then}.`
            : 'Pause. Remember what you learned.',
        data: { route: `/checkin?circumstance=${c.id}`, kind: 'geofence', refId: c.id },
        categoryIdentifier: 'lesson',
      },
      trigger: null,
    });
  });
}

export async function requestLocationPermissions(): Promise<{ foreground: boolean; background: boolean }> {
  if (!supported) return { foreground: false, background: false };
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return { foreground: false, background: false };
  const bg = await Location.requestBackgroundPermissionsAsync();
  return { foreground: true, background: bg.granted };
}

export async function currentPosition(): Promise<{ latitude: number; longitude: number } | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        () => resolve(null),
        { timeout: 8000 },
      );
    });
  }
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return null;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
}

/** Register the geofences that should exist right now (or stop geofencing when none). */
export async function syncGeofences(): Promise<number> {
  if (!supported) return 0;
  try {
    const s = useStore.getState();
    const limit = limitsFor(effectiveTier(s.plan, Date.now())).locationCircumstances;
    const regions: Location.LocationRegion[] = liveValues(s.circumstances)
      .filter((c) => c.location && !c.paused)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, limit)
      .map((c) => ({
        identifier: c.id,
        latitude: c.location!.latitude,
        longitude: c.location!.longitude,
        radius: Math.max(100, c.location!.radiusM),
        notifyOnEnter: c.location!.notifyOnEnter,
        notifyOnExit: c.location!.notifyOnExit,
      }));
    const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK).catch(() => false);
    if (!s.settings.reminders.geofences || regions.length === 0) {
      if (started) await Location.stopGeofencingAsync(GEOFENCE_TASK);
      return 0;
    }
    const bg = await Location.getBackgroundPermissionsAsync();
    if (!bg.granted) return 0;
    await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
    return regions.length;
  } catch (e) {
    console.warn('[geofence] sync failed', e);
    return 0;
  }
}
