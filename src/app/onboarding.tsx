import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight } from 'react-native-reanimated';

import { BrandMark } from '@/components/BrandMark';
import { toDayKey, weekDays } from '@/domain/dates';
import { BEGINNER_MAX_HABITS } from '@/domain/coaching';
import { TRIAL_DAYS } from '@/domain/entitlements';
import { HABIT_TEMPLATES } from '@/features/habits/templates';
import { STYLE_OPTIONS } from '@/features/prayer/styles';
import { lockAvailability, authenticate } from '@/services/lock';
import { requestNotificationPermission } from '@/services/notifications';
import { buildDemo } from '@/store/demo';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/theme/ThemeProvider';
import { Avatar, Button, Card, Icon, ListItem, PressableScale, RadioGroup, Screen, Stepper, Switch, Text, TextField, toast, type IconName } from '@/ui';

const VALUES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'lightbulb-on-outline', title: 'Turn mistakes into rules', text: 'Write what happened and what you’ll do instead. It finds you at the right moment.' },
  { icon: 'calendar-check-outline', title: 'Build habits that last', text: 'Tiny steps, spread across your week, with rewards and rings that keep you going.' },
  { icon: 'hands-pray', title: 'Start each day with purpose', text: 'A short prayer written from your own lessons and goals.' },
];

export default function Onboarding() {
  const { colors, radius } = useTheme();
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const loadDemo = useStore((s) => s.loadDemo);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [style, setStyle] = useState<'secular' | 'spiritual' | 'faith'>('secular');
  const [addressee, setAddressee] = useState('');
  const [picked, setPicked] = useState<string[]>(['Gym']);
  const [notify, setNotify] = useState(false);
  const [lock, setLock] = useState(false);

  const finish = () => {
    completeOnboarding({ displayName: name.trim(), prayerStyle: style, prayerAddressee: addressee.trim(), appLock: lock });
    const s = useStore.getState();
    picked.forEach((n, i) => {
      const t = HABIT_TEMPLATES.find((x) => x.name === n);
      if (!t) return;
      s.addHabit({
        ...t,
        level: 1,
        preferredDays: [],
        intention: { behavior: '', when: '', where: '' },
        bundle: '',
        status: 'active',
        goalId: null,
        order: i,
      });
    });
    const today = toDayKey();
    useStore.getState().autoPlanWeek(weekDays(today, useStore.getState().settings.weekStartsOn));
    router.replace('/');
  };

  const explore = () => {
    loadDemo(buildDemo(name.trim() || 'Keshav'));
    toast('Sample data loaded. Explore freely; reset any time in Me.', { icon: 'database-check-outline' });
    router.replace('/');
  };

  if (step === 0) {
    return (
      <Screen>
        <Animated.View entering={FadeIn.duration(500)} style={{ alignItems: 'center', gap: 16, paddingTop: 24 }}>
          <BrandMark size={120} />
          <Text variant="display" align="center">
            After She Left
          </Text>
          <Text variant="serifItalic" tone="muted" align="center" style={{ maxWidth: 300 }}>
            Turn what hurt into who you become.
          </Text>
        </Animated.View>
        <View style={{ gap: 14, marginTop: 36 }}>
          {VALUES.map((v, i) => (
            <Animated.View key={v.title} entering={FadeInDown.delay(200 + i * 120)}>
              <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
                <View style={[styles.valueIcon, { backgroundColor: colors.primarySoft, borderRadius: radius.md }]}>
                  <Icon name={v.icon} size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong">{v.title}</Text>
                  <Text variant="caption" tone="muted">
                    {v.text}
                  </Text>
                </View>
              </View>
            </Animated.View>
          ))}
        </View>
        <View style={{ gap: 10, marginTop: 40 }}>
          <Button label="Get started" size="lg" iconRight="arrow-right" fullWidth onPress={() => setStep(1)} />
          <Button label="Explore with sample data" variant="ghost" fullWidth onPress={explore} />
        </View>
      </Screen>
    );
  }

  const footer = (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Button label="Back" variant="outline" onPress={() => setStep(step - 1)} style={{ flex: 1 }} fullWidth />
      {step < 3 ? (
        <Button label="Continue" iconRight="arrow-right" onPress={() => setStep(step + 1)} style={{ flex: 2 }} fullWidth disabled={step === 2 && picked.length === 0} />
      ) : (
        <Button label="Begin" icon="check" onPress={finish} style={{ flex: 2 }} fullWidth />
      )}
    </View>
  );

  return (
    <Screen footer={footer}>
      <View style={{ marginBottom: 24 }}>
        <Stepper steps={['About you', 'First habits', 'Reminders']} current={step - 1} />
      </View>
      <Animated.View key={step} entering={FadeInRight.duration(250)} style={{ gap: 20 }}>
        {step === 1 ? (
          <>
            <Text variant="title">What should we call you?</Text>
            <TextField placeholder="Your first name" value={name} onChangeText={setName} autoFocus icon="account-outline" />
            <Text variant="title" style={{ marginTop: 8 }}>
              How should your daily prayer sound?
            </Text>
            <RadioGroup options={STYLE_OPTIONS} value={style} onChange={setStyle} />
            {style === 'faith' ? (
              <TextField label="Whom do you pray to?" placeholder="e.g. God, Bhagwan, Lord, Allah, Waheguru" value={addressee} onChangeText={setAddressee} />
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text variant="title">Start tiny</Text>
            <Text variant="body" tone="muted">
              Pick up to {BEGINNER_MAX_HABITS}. For the first weeks you only do the two-minute version: showing up is the habit. We’ll raise the bar when you’re ready.
            </Text>
            <View style={{ gap: 10 }}>
              {HABIT_TEMPLATES.map((t) => {
                const on = picked.includes(t.name);
                return (
                  <PressableScale
                    key={t.name}
                    onPress={() => {
                      if (on) setPicked(picked.filter((p) => p !== t.name));
                      else if (picked.length < BEGINNER_MAX_HABITS) setPicked([...picked, t.name]);
                      else toast(`Start with ${BEGINNER_MAX_HABITS} at most. Fewer habits, kept, beat many abandoned.`, { icon: 'sprout' });
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${t.name}: ${t.twoMinute}`}
                    style={[
                      styles.template,
                      { borderRadius: radius.lg, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primarySoft : colors.surface },
                    ]}>
                    <Avatar emoji={t.emoji} color={t.color} size={44} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="bodyStrong">
                        {t.name} · {t.weeklyTarget}× a week
                      </Text>
                      <Text variant="caption" tone="muted">
                        Two minutes: {t.twoMinute}
                      </Text>
                    </View>
                    <Icon name={on ? 'check-circle' : 'circle-outline'} size={24} color={on ? colors.primary : colors.textSubtle} />
                  </PressableScale>
                );
              })}
            </View>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text variant="title">Reminders & privacy</Text>
            <Card padding={6}>
              <ListItem
                icon="bell-ring-outline"
                title="Allow reminders"
                subtitle="Lessons at the right moment, a morning prayer, gentle habit nudges"
                chevron={false}
                trailing={
                  <Switch
                    value={notify}
                    label="Allow reminders"
                    onChange={async (v) => {
                      if (!v) return setNotify(false);
                      if (Platform.OS === 'web') {
                        toast('Reminders are delivered on the Android app', { icon: 'cellphone' });
                        return setNotify(true);
                      }
                      setNotify(await requestNotificationPermission());
                    }}
                  />
                }
              />
              <ListItem
                icon="fingerprint"
                title="Lock the app"
                subtitle="Fingerprint, face or phone PIN"
                chevron={false}
                trailing={
                  <Switch
                    value={lock}
                    label="Lock the app"
                    onChange={async (v) => {
                      if (!v) return setLock(false);
                      const info = await lockAvailability();
                      if (!info.available) {
                        toast(info.reason ?? 'App lock is not available', { icon: 'information-outline' });
                        return;
                      }
                      setLock(await authenticate());
                    }}
                  />
                }
              />
            </Card>
            <Card variant="tonal" tone="accent">
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Icon name="crown-outline" size={22} color={colors.accent} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text variant="bodyStrong">Everything is free for {TRIAL_DAYS} days</Text>
                  <Text variant="caption" tone="muted">
                    Then choose Premium at $20/month, or keep going free with ads and a focused set of limits. No card needed now.
                  </Text>
                </View>
              </View>
            </Card>
          </>
        ) : null}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  valueIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  template: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1.5 },
});
