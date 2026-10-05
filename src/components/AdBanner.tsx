import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AD_REQUEST, adsModule, bannerUnitId } from '@/services/ads';
import { usePlanInfo } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon, PressableScale, Text } from '@/ui';

/**
 * Free-tier banner. Renders nothing for trial and Premium users. Uses AdMob on native builds,
 * and a clearly-labelled placeholder in Expo Go / on the web.
 */
export function AdBanner() {
  const { limits } = usePlanInfo();
  const { colors, radius } = useTheme();
  if (!limits.ads) return null;

  const m = adsModule();
  const unitId = bannerUnitId();
  if (m && unitId) {
    const { BannerAd, BannerAdSize } = m;
    return (
      <View style={styles.native}>
        <BannerAd unitId={unitId} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} requestOptions={AD_REQUEST} />
        <RemoveAds />
      </View>
    );
  }

  return (
    <View
      style={[styles.placeholder, { borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken }]}
      accessibilityLabel="Advertisement">
      <View style={[styles.adTag, { borderColor: colors.borderStrong }]}>
        <Text variant="caption" tone="muted" style={{ fontSize: 10 }}>
          Ad
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="label">Sponsored</Text>
        <Text variant="caption" tone="muted">
          Ads keep the free plan free.
        </Text>
      </View>
      <RemoveAds />
    </View>
  );
}

function RemoveAds() {
  const { colors } = useTheme();
  return (
    <PressableScale onPress={() => router.push('/paywall')} accessibilityRole="button" hitSlop={8} style={styles.remove}>
      <Icon name="close-circle-outline" size={14} color={colors.primaryStrong} />
      <Text variant="caption" tone="primary">
        Remove ads
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  native: { alignItems: 'center', gap: 6, marginVertical: 8 },
  placeholder: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, marginVertical: 8 },
  adTag: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 4 },
  remove: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
