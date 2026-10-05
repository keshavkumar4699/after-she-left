import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { authenticate, useLock } from '@/services/lock';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Text } from '@/ui';
import { BrandMark } from './BrandMark';

/** Full-screen lock rendered above the whole app until the user authenticates. */
export function LockOverlay() {
  const { colors } = useTheme();
  const locked = useLock((s) => s.locked);
  const setLocked = useLock((s) => s.setLocked);
  const [busy, setBusy] = useState(false);

  const unlock = async () => {
    setBusy(true);
    try {
      if (await authenticate()) setLocked(false);
    } finally {
      setBusy(false);
    }
  };

  // Prompt for biometrics as soon as the lock appears.
  useEffect(() => {
    if (!locked) return;
    authenticate()
      .then((ok) => ok && setLocked(false))
      .catch(() => {});
  }, [locked, setLocked]);

  if (!locked) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(200)}
      style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: colors.bg }]}
      accessibilityViewIsModal>
      <View style={{ alignItems: 'center', gap: 16 }}>
        <BrandMark size={96} />
        <Text variant="title" align="center">
          Locked
        </Text>
        <Text variant="body" tone="muted" align="center" style={{ maxWidth: 280 }}>
          Your lessons stay private. Unlock with your fingerprint, face or phone PIN.
        </Text>
      </View>
      <Button label="Unlock" icon="fingerprint" size="lg" onPress={unlock} loading={busy} style={{ alignSelf: 'center' }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 1000, alignItems: 'center', justifyContent: 'center', gap: 40, padding: 32 },
});
