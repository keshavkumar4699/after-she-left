import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { View } from 'react-native';

import { env } from '@/config/env';
import { buildDemo } from '@/store/demo';
import { usePlanInfo } from '@/store/hooks';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeMode } from '@/theme/ThemeProvider';
import { Avatar, Badge, Button, Card, Dialog, Divider, ListItem, Screen, SectionHeader, SegmentedControl, Text, TextField, toast } from '@/ui';

export default function MeScreen() {
  const { colors } = useTheme();
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const loadDemo = useStore((s) => s.loadDemo);
  const resetAll = useStore((s) => s.resetAll);
  const { tier, trialDaysLeft } = usePlanInfo();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(settings.displayName);
  const [confirm, setConfirm] = useState<'demo' | 'reset' | null>(null);

  const planBadge =
    tier === 'premium' ? { label: 'Premium', tone: 'primary' as const } : tier === 'trial' ? { label: `Trial · ${trialDaysLeft} days left`, tone: 'accent' as const } : { label: 'Free plan', tone: 'neutral' as const };

  return (
    <Screen tabBar title="Me">
      <View style={{ gap: 24 }}>
        <Card padding={18}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Avatar label={settings.displayName || 'You'} size={56} color={colors.violet} />
            <View style={{ flex: 1, gap: 6 }}>
              {editingName ? (
                <TextField
                  value={name}
                  onChangeText={setName}
                  autoFocus
                  placeholder="Your name"
                  onSubmitEditing={() => {
                    updateSettings({ displayName: name.trim() });
                    setEditingName(false);
                  }}
                />
              ) : (
                <Text variant="h2" onPress={() => setEditingName(true)}>
                  {settings.displayName || 'Add your name'}
                </Text>
              )}
              <Badge label={planBadge.label} tone={planBadge.tone} icon="crown-outline" />
            </View>
            {editingName ? (
              <Button
                label="Save"
                size="sm"
                onPress={() => {
                  updateSettings({ displayName: name.trim() });
                  setEditingName(false);
                }}
              />
            ) : null}
          </View>
        </Card>

        {tier !== 'premium' ? (
          <Card variant="hero" padding={18} onPress={() => router.push('/paywall')} accessibilityLabel="See Premium">
            <View style={{ gap: 6 }}>
              <Text variant="overline" tone="muted">
                {tier === 'trial' ? `${trialDaysLeft} days of Premium left` : 'Free plan with ads'}
              </Text>
              <Text variant="h3">Unlimited habits, AI prayers, no ads</Text>
              <Text variant="caption" tone="muted">
                $20 / month · cancel anytime
              </Text>
            </View>
          </Card>
        ) : null}

        <View>
          <SectionHeader title="Your system" />
          <Card padding={6}>
            <ListItem icon="calendar-week" title="Weekly planner" subtitle="Spread habits across the week" onPress={() => router.push('/planner')} />
            <Divider inset={64} />
            <ListItem icon="map-marker-radius-outline" title="Circumstances & places" subtitle="When and where lessons remind you" onPress={() => router.push('/circumstances')} />
            <Divider inset={64} />
            <ListItem icon="cards-outline" title="Lesson review" subtitle="Spaced repetition" onPress={() => router.push('/review')} />
            <Divider inset={64} />
            <ListItem icon="chart-box-outline" title="Insights" subtitle="Compete with your last 7 days" onPress={() => router.push('/insights')} />
          </Card>
        </View>

        <View>
          <SectionHeader title="Settings" />
          <Card padding={6}>
            <ListItem icon="hands-pray" title="Daily prayer" subtitle="Style, time and AI" onPress={() => router.push('/settings/prayer')} />
            <Divider inset={64} />
            <ListItem icon="bell-outline" title="Reminders" subtitle="Notifications, quiet hours" onPress={() => router.push('/settings/notifications')} />
            <Divider inset={64} />
            <ListItem icon="shield-lock-outline" title="Privacy & security" subtitle="App lock, private notifications, export" onPress={() => router.push('/settings/privacy')} />
            <Divider inset={64} />
            <ListItem icon="cloud-sync-outline" title="Account & sync" subtitle="Back up and sync across devices" onPress={() => router.push('/settings/account')} />
            <Divider inset={64} />
            <ListItem icon="crown-outline" title="Plan" value={planBadge.label} onPress={() => router.push('/paywall')} />
          </Card>
        </View>

        <View>
          <SectionHeader title="Appearance" />
          <SegmentedControl<ThemeMode>
            options={[
              { value: 'system', label: 'System', icon: 'theme-light-dark' },
              { value: 'dark', label: 'Dark', icon: 'weather-night' },
              { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
            ]}
            value={settings.themeMode}
            onChange={(v) => updateSettings({ themeMode: v })}
          />
        </View>

        <View>
          <SectionHeader title="About" />
          <Card padding={6}>
            <ListItem icon="palette-outline" title="Design system" subtitle="Every UI element in one place" onPress={() => router.push('/ui-kit')} />
            <Divider inset={64} />
            <ListItem icon="file-document-outline" title="Privacy policy" onPress={() => WebBrowser.openBrowserAsync(env.privacyUrl)} />
            <Divider inset={64} />
            <ListItem icon="information-outline" title="Version" value={Constants.expoConfig?.version ?? '1.0.0'} chevron={false} />
          </Card>
        </View>

        <View>
          <SectionHeader title="Developer" />
          <Card padding={6}>
            <ListItem icon="database-import-outline" title="Load sample data" subtitle="Explore the app with realistic examples" onPress={() => setConfirm('demo')} />
            <Divider inset={64} />
            <ListItem icon="restore" title="Reset everything" subtitle="Delete all data on this device" destructive onPress={() => setConfirm('reset')} />
          </Card>
        </View>

        <Text variant="caption" tone="subtle" align="center">
          After She Left · turn what hurt into who you become
        </Text>
      </View>

      <Dialog
        visible={confirm === 'demo'}
        onClose={() => setConfirm(null)}
        icon="database-import-outline"
        title="Load sample data?"
        message="This replaces your current habits, lessons and goals with examples."
        confirmLabel="Load samples"
        cancelLabel="Cancel"
        onConfirm={() => {
          loadDemo(buildDemo(settings.displayName || 'Keshav'));
          toast('Sample data loaded', { icon: 'check' });
          router.replace('/');
        }}
      />
      <Dialog
        visible={confirm === 'reset'}
        onClose={() => setConfirm(null)}
        icon="alert-outline"
        tone="danger"
        title="Delete everything on this device?"
        message="All habits, lessons, goals and prayers on this device will be erased. Cloud data (if you're signed in) is not affected."
        confirmLabel="Delete everything"
        destructive
        cancelLabel="Cancel"
        onConfirm={() => {
          resetAll();
          router.replace('/onboarding');
        }}
      />
    </Screen>
  );
}
