import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Platform, Share, View } from 'react-native';

import { authenticate, lockAvailability } from '@/services/lock';
import { useStore } from '@/store/useStore';
import { COLLECTIONS } from '@/store/types';
import { Banner, Button, Card, Divider, FormSection, ListItem, Screen, SegmentedControl, Switch, Text, toast } from '@/ui';

export default function PrivacySettings() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const [lockInfo, setLockInfo] = useState<{ available: boolean; reason?: string }>({ available: false });

  useEffect(() => {
    lockAvailability().then(setLockInfo);
  }, []);

  const exportData = async () => {
    const s = useStore.getState();
    const data = Object.fromEntries(COLLECTIONS.map((c) => [c, Object.values(s[c])]));
    const json = JSON.stringify({ exportedAt: new Date().toISOString(), app: 'after-she-left', settings: s.settings, ...data }, null, 2);
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(json);
      toast('Your data was copied to the clipboard as JSON', { icon: 'content-copy' });
    } else {
      await Share.share({ message: json, title: 'After She Left export' }).catch(() => {});
    }
  };

  return (
    <Screen back title="Privacy & security" subtitle="Your lessons are personal. Keep them that way.">
      <FormSection title="App lock">
        {!lockInfo.available && lockInfo.reason ? (
          <Banner tone="violet" icon="information-outline" title="App lock unavailable" message={lockInfo.reason} />
        ) : null}
        <Card padding={6}>
          <ListItem
            icon="fingerprint"
            title="Lock with fingerprint or PIN"
            subtitle="Ask every time the app opens"
            chevron={false}
            trailing={
              <Switch
                value={settings.appLock}
                disabled={!lockInfo.available}
                label="App lock"
                onChange={async (v) => {
                  // Confirm the user can unlock before turning the lock on.
                  if (v && !(await authenticate())) return;
                  updateSettings({ appLock: v });
                  toast(v ? 'App lock on' : 'App lock off', { icon: v ? 'lock-outline' : 'lock-open-outline' });
                }}
              />
            }
          />
          <Divider inset={64} />
          <ListItem
            icon="cellphone-lock"
            title="Hide in recent apps & screenshots"
            subtitle="Blocks screenshots and blurs the app switcher"
            chevron={false}
            trailing={<Switch value={settings.secureScreen} onChange={(v) => updateSettings({ secureScreen: v })} label="Secure screen" />}
          />
        </Card>
        {settings.appLock ? (
          <View style={{ gap: 8 }}>
            <Text variant="label" tone="muted">
              Lock again after leaving the app for
            </Text>
            <SegmentedControl
              size="sm"
              options={[
                { value: '0', label: 'Instantly' },
                { value: '30', label: '30 s' },
                { value: '60', label: '1 min' },
                { value: '300', label: '5 min' },
              ]}
              value={String(settings.lockAfterSec)}
              onChange={(v) => updateSettings({ lockAfterSec: Number(v) })}
            />
          </View>
        ) : null}
      </FormSection>

      <FormSection title="Notifications">
        <ListItem
          icon="eye-off-outline"
          title="Private notification text"
          subtitle="Lock-screen reminders never show your lessons"
          chevron={false}
          trailing={<Switch value={settings.notificationPrivacy} onChange={(v) => updateSettings({ notificationPrivacy: v })} label="Private notification text" />}
        />
      </FormSection>

      <FormSection
        title="AI daily prayer"
        description="Premium only. On phones with Gemini Nano the prayer is written on the phone and nothing is sent. On other phones (when you are signed in) a short summary is sent to write it: your if–then rules, “not today” lines, goal affirmations and today’s habit names. Stories, reasons and feelings stay on your phone. Free prayers are always composed on your phone.">
        <ListItem
          icon="star-four-points-outline"
          title="Use AI for my prayer"
          subtitle="Off: prayers are composed on your phone"
          chevron={false}
          trailing={<Switch value={settings.aiPrayer} onChange={(v) => updateSettings({ aiPrayer: v })} label="Use AI for my prayer" />}
        />
      </FormSection>

      <FormSection title="Your data" description="Export is always free. Your data belongs to you.">
        <Button label="Export my data (JSON)" icon="export-variant" variant="tonal" fullWidth onPress={exportData} />
      </FormSection>
    </Screen>
  );
}
