import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { formatTime } from '@/domain/dates';
import { notificationPermission, requestNotificationPermission, sendTestNotification, syncReminders } from '@/services/notifications';
import type { ReminderToggles } from '@/store/types';
import { useStore } from '@/store/useStore';
import { Banner, Button, Card, Divider, FormSection, ListItem, Screen, Switch, Text, TimeField, toast, type IconName } from '@/ui';

const ROWS: { key: keyof ReminderToggles; icon: IconName; title: string; subtitle: string }[] = [
  { key: 'prayer', icon: 'hands-pray', title: 'Morning prayer', subtitle: 'A gentle reminder to read today’s prayer' },
  { key: 'circumstances', icon: 'clock-alert-outline', title: 'Circumstance reminders', subtitle: 'At the times you chose for each trigger' },
  { key: 'geofences', icon: 'map-marker-radius-outline', title: 'Place reminders', subtitle: 'When you arrive at or leave a chosen place' },
  { key: 'nudges', icon: 'format-quote-open', title: 'Habit nudges', subtitle: 'About 4 a week, with a quote that never repeats' },
  { key: 'neverMissTwice', icon: 'link-variant', title: 'Never miss twice', subtitle: 'An evening nudge after a missed day' },
  { key: 'review', icon: 'cards-outline', title: 'Lesson review', subtitle: 'On days when lessons are due' },
  { key: 'planning', icon: 'calendar-week', title: 'Plan your week', subtitle: 'Sunday evening' },
];

export default function NotificationSettings() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const [permission, setPermission] = useState<string>('undetermined');

  useEffect(() => {
    notificationPermission().then(setPermission);
  }, []);

  const toggle = (key: keyof ReminderToggles, value: boolean) => updateSettings({ reminders: { ...settings.reminders, [key]: value } });

  return (
    <Screen back title="Reminders" subtitle="Reminders that respect your attention.">
      {permission === 'unsupported' ? (
        <View style={{ marginBottom: 20 }}>
          <Banner tone="violet" icon="cellphone" title="Reminders run on your phone" message="Notifications are scheduled on Android. In this web preview they are planned but not delivered." />
        </View>
      ) : permission !== 'granted' ? (
        <View style={{ marginBottom: 20 }}>
          <Banner
            tone="accent"
            icon="bell-off-outline"
            title="Notifications are off"
            message="Allow notifications so lessons and habits reach you at the right moment."
            action="Allow notifications"
            onAction={async () => {
              const ok = await requestNotificationPermission();
              setPermission(ok ? 'granted' : 'denied');
              if (ok) syncReminders();
            }}
          />
        </View>
      ) : null}

      <FormSection title="What to remind me about">
        <Card padding={6}>
          {ROWS.map((r, i) => (
            <View key={r.key}>
              <ListItem
                icon={r.icon}
                title={r.title}
                subtitle={r.subtitle}
                chevron={false}
                trailing={<Switch value={settings.reminders[r.key]} onChange={(v) => toggle(r.key, v)} label={r.title} />}
              />
              {i < ROWS.length - 1 ? <Divider inset={64} /> : null}
            </View>
          ))}
        </Card>
      </FormSection>

      <FormSection title="Times">
        <TimeField label="Morning prayer" value={settings.prayerTime} onChange={(t) => updateSettings({ prayerTime: t })} />
        <TimeField label="Lesson review" value={settings.reviewTime} onChange={(t) => updateSettings({ reviewTime: t })} />
      </FormSection>

      <FormSection title="Quiet hours" description="No nudges or place reminders during these hours.">
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <TimeField label="From" value={settings.quietHours.start} onChange={(t) => updateSettings({ quietHours: { ...settings.quietHours, start: t } })} />
          </View>
          <View style={{ flex: 1 }}>
            <TimeField label="To" value={settings.quietHours.end} onChange={(t) => updateSettings({ quietHours: { ...settings.quietHours, end: t } })} />
          </View>
        </View>
      </FormSection>

      <FormSection title="Active hours for nudges" description={`Quote nudges arrive at a random time between ${formatTime(settings.activeHours.start)} and ${formatTime(settings.activeHours.end)}.`}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <TimeField label="From" value={settings.activeHours.start} onChange={(t) => updateSettings({ activeHours: { ...settings.activeHours, start: t } })} />
          </View>
          <View style={{ flex: 1 }}>
            <TimeField label="To" value={settings.activeHours.end} onChange={(t) => updateSettings({ activeHours: { ...settings.activeHours, end: t } })} />
          </View>
        </View>
      </FormSection>

      <FormSection title="Privacy">
        <ListItem
          icon="eye-off-outline"
          title="Private notification text"
          subtitle="Show “A gentle reminder” instead of the lesson on the lock screen"
          chevron={false}
          trailing={<Switch value={settings.notificationPrivacy} onChange={(v) => updateSettings({ notificationPrivacy: v })} label="Private notification text" />}
        />
      </FormSection>

      {Platform.OS !== 'web' ? (
        <Button
          label="Send a test notification"
          icon="bell-ring-outline"
          variant="tonal"
          fullWidth
          onPress={async () => toast((await sendTestNotification()) ? 'Test sent. It arrives in a few seconds.' : 'Notifications are not allowed', { icon: 'bell-outline' })}
        />
      ) : (
        <Text variant="caption" tone="subtle" align="center">
          Test notifications are available on the Android app.
        </Text>
      )}
    </Screen>
  );
}
