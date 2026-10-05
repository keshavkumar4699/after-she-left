import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { PrayerEngineStatus } from '@/features/prayer/EngineStatus';
import { STYLE_OPTIONS } from '@/features/prayer/styles';
import { ensureTodayPrayer } from '@/services/prayer';
import { usePlanInfo, useToday } from '@/store/hooks';
import { useStore } from '@/store/useStore';
import { Button, Card, FormSection, ListItem, RadioGroup, Screen, Switch, Text, TextField, TimeField, toast } from '@/ui';


export default function PrayerSettings() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const today = useToday();
  const prayer = useStore((s) => s.prayers[today]);
  const { isPremium } = usePlanInfo();
  const [busy, setBusy] = useState(false);

  return (
    <Screen back title="Daily prayer" subtitle="A short prayer each morning: your purpose, and what not to do today.">
      <FormSection title="Style">
        <RadioGroup options={STYLE_OPTIONS} value={settings.prayerStyle} onChange={(v) => updateSettings({ prayerStyle: v })} />
        {settings.prayerStyle === 'faith' ? (
          <TextField
            label="Whom do you pray to?"
            placeholder="e.g. God, Bhagwan, Lord, Allah, Waheguru"
            value={settings.prayerAddressee}
            onChangeText={(v) => updateSettings({ prayerAddressee: v })}
          />
        ) : null}
      </FormSection>

      <FormSection title="When">
        <TimeField label="Morning reminder" value={settings.prayerTime} onChange={(t) => updateSettings({ prayerTime: t })} />
      </FormSection>

      {isPremium ? (
        <FormSection
          title="Written by AI"
          description="Every day, plus 2 rewrites a day. On supported phones Gemini Nano writes it on the phone; otherwise it is written in the cloud.">
          <ListItem
            icon="star-four-points-outline"
            title="Use AI"
            subtitle="Off: prayers are composed from your lessons"
            chevron={false}
            trailing={<Switch value={settings.aiPrayer} onChange={(v) => updateSettings({ aiPrayer: v })} label="Use AI" />}
          />
          {settings.aiPrayer ? <PrayerEngineStatus /> : null}
        </FormSection>
      ) : (
        <FormSection
          title="Written by AI"
          description="On the free plan your prayer is composed on your phone from your lessons, goals and habits. Premium writes it with AI every day.">
          <ListItem
            icon="star-four-points-outline"
            title="AI-written prayers"
            subtitle="Premium: on your phone where supported"
            onPress={() => router.push('/paywall')}
          />
        </FormSection>
      )}

      {prayer ? (
        <Card variant="prayer" padding={18} onPress={() => router.push('/prayer')} accessibilityLabel="Open today's prayer">
          <View style={{ gap: 6 }}>
            <Text variant="overline" tone="muted">
              Today
            </Text>
            <Text variant="h3">{prayer.title}</Text>
            <Text variant="serifItalic" tone="muted" numberOfLines={2}>
              {prayer.text.split('\n')[0]}
            </Text>
          </View>
        </Card>
      ) : null}
      <Button
        label="Apply style to today's prayer"
        icon="refresh"
        variant="tonal"
        fullWidth
        loading={busy}
        style={{ marginTop: 16 }}
        onPress={async () => {
          setBusy(true);
          // Re-writes today's prayer in the new style (falls back to the on-phone composer when out of AI quota).
          await ensureTodayPrayer({ regenerate: true });
          setBusy(false);
          toast('Today’s prayer updated', { icon: 'check' });
        }}
      />
    </Screen>
  );
}
