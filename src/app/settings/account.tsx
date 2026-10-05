import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { User } from 'firebase/auth';

import { isFirebaseConfigured } from '@/config/env';
import { authErrorMessage, callFunction, onUserChanged, signIn, signOut, signUp } from '@/services/firebase';
import { pullAll, pushChanges } from '@/services/sync';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/theme/ThemeProvider';
import { Banner, Button, Card, Dialog, FormSection, Icon, ListItem, Screen, SegmentedControl, Text, TextField, toast } from '@/ui';

export default function AccountSettings() {
  const { colors } = useTheme();
  const displayName = useStore((s) => s.settings.displayName);
  const sync = useStore((s) => s.sync);
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [name, setName] = useState(displayName);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => onUserChanged(setUser), []);

  if (!isFirebaseConfigured()) {
    return (
      <Screen back title="Account & sync">
        <View style={{ gap: 16 }}>
          <Banner
            tone="violet"
            icon="cellphone-check"
            title="Everything is saved on this phone"
            message="Cloud sync is not configured in this build. Your data is stored on this device and works fully offline."
          />
          <Card variant="outlined">
            <View style={{ gap: 8 }}>
              <Text variant="bodyStrong">To enable sign-in and cloud backup</Text>
              <Text variant="caption" tone="muted">
                Add the EXPO_PUBLIC_FIREBASE_* values from your Firebase project to .env.local, deploy the Cloud Functions and rules in /functions, then rebuild. See the README for step-by-step instructions.
              </Text>
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      if (mode === 'signup') await signUp(email, password, name);
      else await signIn(email, password);
      toast('Signed in. Syncing your data…', { icon: 'cloud-check-outline' });
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <Screen back title="Account & sync">
        <View style={{ gap: 20 }}>
          <Card>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Icon name="cloud-check-outline" size={28} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{user.email}</Text>
                <Text variant="caption" tone="muted">
                  {sync.lastPushedAt ? `Last synced ${new Date(sync.lastPushedAt).toLocaleString()}` : 'Syncing…'}
                </Text>
              </View>
            </View>
          </Card>
          <Button
            label="Sync now"
            icon="sync"
            variant="tonal"
            fullWidth
            loading={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await pullAll(user.uid);
                const n = await pushChanges(user.uid);
                toast(n ? `Synced ${n} change${n > 1 ? 's' : ''}` : 'Everything is up to date', { icon: 'cloud-check-outline' });
              } catch (e) {
                toast(authErrorMessage(e), { icon: 'cloud-alert' });
              } finally {
                setBusy(false);
              }
            }}
          />
          <Card padding={6}>
            <ListItem icon="logout" title="Sign out" subtitle="Your data stays on this phone" onPress={() => signOut()} />
            <ListItem icon="account-remove-outline" title="Delete account" subtitle="Erase your cloud data permanently" destructive onPress={() => setConfirmDelete(true)} />
          </Card>
        </View>
        <Dialog
          visible={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          icon="account-remove-outline"
          tone="danger"
          title="Delete your account?"
          message="Your cloud data and account are permanently deleted. Data on this phone stays until you reset the app."
          confirmLabel="Delete account"
          destructive
          cancelLabel="Cancel"
          onConfirm={async () => {
            try {
              await callFunction('deleteAccount', {});
              await signOut();
              toast('Account deleted', { icon: 'check' });
              router.back();
            } catch (e) {
              toast(authErrorMessage(e), { icon: 'alert-circle-outline' });
            }
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen back title="Account & sync" subtitle="Back up your lessons and sync across devices.">
      <SegmentedControl
        options={[
          { value: 'signup', label: 'Create account' },
          { value: 'signin', label: 'Sign in' },
        ]}
        value={mode}
        onChange={setMode}
      />
      <View style={{ height: 20 }} />
      <FormSection title={mode === 'signup' ? 'Create your account' : 'Welcome back'}>
        {mode === 'signup' ? <TextField label="Name" icon="account-outline" value={name} onChangeText={setName} autoComplete="name" /> : null}
        <TextField label="Email" icon="email-outline" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <TextField
          label="Password"
          icon="lock-outline"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          helper={mode === 'signup' ? 'At least 6 characters' : undefined}
          error={error}
        />
        <Button label={mode === 'signup' ? 'Create account' : 'Sign in'} fullWidth loading={busy} onPress={submit} disabled={!email || password.length < 6} />
      </FormSection>
      <Text variant="caption" tone="subtle" align="center">
        Your data is encrypted in transit and only you can read it. Your 14-day trial starts with your account.
      </Text>
    </Screen>
  );
}
