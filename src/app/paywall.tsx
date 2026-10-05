import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { env } from '@/config/env';
import { formatDay, toDayKey } from '@/domain/dates';
import { LIMITS, PLAN_FEATURES, TRIAL_DAYS } from '@/domain/entitlements';
import { getOffering, MANAGE_SUBSCRIPTION_URL, purchasePremium, restorePurchases, type Offering } from '@/services/billing';
import { useActiveHabits, useGoals, usePlanInfo } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { Badge, Button, Card, Icon, Screen, Text, toast, type IconName } from '@/ui';

const PERKS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'infinity', title: 'Unlimited habits, goals and lessons', text: 'Build your whole system, not just part of it.' },
  { icon: 'hands-pray', title: 'AI prayer every day', text: 'Written for the day you are actually having, with 2 rewrites a day.' },
  { icon: 'map-marker-radius-outline', title: 'Reminders at every place and time', text: 'Up to 95 places and unlimited scheduled moments.' },
  { icon: 'chart-box-outline', title: 'Full insights and history', text: 'See your toughest moments and your whole journey.' },
  { icon: 'cancel', title: 'No ads, ever', text: 'Nothing between you and your focus.' },
];

export default function PaywallScreen() {
  const { colors, radius } = useTheme();
  const { tier, plan, trialDaysLeft } = usePlanInfo();
  const habits = useActiveHabits();
  const goals = useGoals();
  const [offering, setOffering] = useState<Offering | null>(null);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);

  useEffect(() => {
    getOffering().then(setOffering);
  }, []);

  const price = offering?.priceString ?? '$20';
  const overLimit =
    habits.length > LIMITS.free.habits || goals.filter((g) => g.status === 'active').length > LIMITS.free.goals;

  const buy = async () => {
    setBusy('buy');
    const res = await purchasePremium();
    setBusy(null);
    if (res.ok) {
      toast('Welcome to Premium. Everything is unlocked.', { icon: 'crown' });
      router.back();
    } else if (!res.cancelled) toast(res.error ?? 'Purchase failed', { icon: 'alert-circle-outline' });
  };

  const restore = async () => {
    setBusy('restore');
    const res = await restorePurchases();
    setBusy(null);
    toast(res.active ? 'Premium restored' : res.error ?? 'No active subscription found', { icon: res.active ? 'crown' : 'information-outline' });
    if (res.active) router.back();
  };

  const status =
    tier === 'premium'
      ? { label: plan.premiumUntil ? `Premium · renews ${formatDay(toDayKey(new Date(plan.premiumUntil)), { withYear: true })}` : 'Premium', tone: 'primary' as const }
      : tier === 'trial'
        ? { label: `Free trial · ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left`, tone: 'accent' as const }
        : { label: 'Your trial has ended', tone: 'neutral' as const };

  return (
    <Screen
      back
      closeIcon
      headerCompact
      footer={
        tier === 'premium' ? (
          <Button label="Manage subscription" icon="open-in-new" variant="outline" fullWidth onPress={() => WebBrowser.openBrowserAsync(MANAGE_SUBSCRIPTION_URL)} />
        ) : (
          <View style={{ gap: 8 }}>
            <Button label={`Start Premium · ${price}/month`} icon="crown" size="lg" fullWidth loading={busy === 'buy'} onPress={buy} />
            <Button
              label="Continue free with ads"
              variant="ghost"
              fullWidth
              onPress={() => (tier === 'free' && overLimit ? router.replace('/settings/downgrade') : router.back())}
            />
          </View>
        )
      }>
      <View style={{ alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <BrandMark size={88} />
        <Badge label={status.label} tone={status.tone} icon={tier === 'premium' ? 'crown' : 'clock-outline'} />
        <Text variant="display" align="center">
          Keep your momentum
        </Text>
        <Text variant="body" tone="muted" align="center" style={{ maxWidth: 340 }}>
          You get {TRIAL_DAYS} days of everything free. After that, Premium keeps your whole system running, or you can continue on the free plan with ads.
        </Text>
      </View>

      <Card variant="hero" padding={20} emphasized tone="primary" style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
          <Text variant="hero">{price}</Text>
          <Text variant="body" tone="muted" style={{ marginBottom: 8 }}>
            / month
          </Text>
        </View>
        <Text variant="caption" tone="muted">
          Billed monthly through Google Play. Cancel anytime.
        </Text>
        <View style={{ gap: 14, marginTop: 18 }}>
          {PERKS.map((p) => (
            <View key={p.title} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[styles.perkIcon, { backgroundColor: colors.primarySoft, borderRadius: radius.md }]}>
                <Icon name={p.icon} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{p.title}</Text>
                <Text variant="caption" tone="muted">
                  {p.text}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      <Text variant="overline" tone="muted" style={{ marginBottom: 10 }}>
        Free vs Premium
      </Text>
      <Card padding={0} style={{ marginBottom: 20 }}>
        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <Text variant="label" tone="muted" style={styles.feature}>
            Feature
          </Text>
          <Text variant="label" tone="muted" style={styles.cell}>
            Free
          </Text>
          <Text variant="label" tone="primary" style={styles.cell}>
            Premium
          </Text>
        </View>
        {PLAN_FEATURES.map((f, i) => (
          <View key={f.label} style={[styles.row, i < PLAN_FEATURES.length - 1 && { borderBottomColor: colors.border }]}>
            <Text variant="caption" style={styles.feature}>
              {f.label}
            </Text>
            <Text variant="caption" tone="muted" style={styles.cell}>
              {f.free}
            </Text>
            <Text variant="caption" style={[styles.cell, { fontFamily: 'Inter_600SemiBold' }]}>
              {f.premium}
            </Text>
          </View>
        ))}
      </Card>

      {tier !== 'premium' ? (
        <Button label="Restore purchases" variant="outline" fullWidth loading={busy === 'restore'} onPress={restore} style={{ marginBottom: 16 }} />
      ) : null}

      <Text variant="caption" tone="subtle" align="center">
        Subscription renews automatically each month until cancelled in Google Play at least 24 hours before renewal. App lock, export and
        cloud sync are always free.
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 10 }}>
        <Text variant="caption" tone="primary" onPress={() => WebBrowser.openBrowserAsync(env.termsUrl)}>
          Terms
        </Text>
        <Text variant="caption" tone="primary" onPress={() => WebBrowser.openBrowserAsync(env.privacyUrl)}>
          Privacy
        </Text>
      </View>
      {offering?.provider === 'test' && __DEV__ ? (
        <Text variant="caption" tone="subtle" align="center" style={{ marginTop: 10 }}>
          Development build: purchases use a test provider until a RevenueCat key is configured.
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  perkIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'transparent' },
  feature: { flex: 1.4 },
  cell: { flex: 1, textAlign: 'center' },
});
