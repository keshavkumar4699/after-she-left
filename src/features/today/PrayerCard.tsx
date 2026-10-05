import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { THEME_LABELS } from '@/domain/needs';
import { isAiWritten } from '@/features/prayer/source';
import { ensureTodayPrayer } from '@/services/prayer';
import { useToday } from '@/store/hooks';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/theme/ThemeProvider';
import { Card, Chip, Icon, Skeleton, Text } from '@/ui';

/** Today's prayer, front and centre on the dashboard. */
export function PrayerCard() {
  const { colors } = useTheme();
  const today = useToday();
  const prayer = useStore((s) => s.prayers[today]);
  useEffect(() => {
    if (!prayer) ensureTodayPrayer().catch(() => {});
  }, [prayer, today]);

  if (!prayer) {
    return (
      <Card variant="prayer" padding={20}>
        <View style={{ gap: 12 }}>
          <Text variant="overline" tone="muted">
            Today&apos;s prayer
          </Text>
          <Skeleton width="70%" height={24} />
          <Skeleton height={14} />
          <Skeleton width="85%" height={14} />
          <Text variant="caption" tone="muted">
            Writing today&apos;s prayer from your lessons and goals…
          </Text>
        </View>
      </Card>
    );
  }

  const preview = prayer.text.split('\n').filter(Boolean).slice(1, 3).join(' ');
  return (
    <Card variant="prayer" padding={20} onPress={() => router.push('/prayer')} accessibilityLabel={`Today's prayer: ${prayer.title}. Read it`}>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="hands-pray" size={16} color={colors.violet} />
          <Text variant="overline" tone="muted" style={{ flex: 1 }}>
            Today&apos;s prayer · {THEME_LABELS[prayer.theme]}
          </Text>
          {isAiWritten(prayer.source) ? <Icon name="star-four-points" size={14} color={colors.violet} /> : null}
        </View>
        <Text variant="title" style={{ fontSize: 24, lineHeight: 30 }}>
          {prayer.title}
        </Text>
        <Text variant="serifItalic" tone="muted" numberOfLines={3}>
          {preview}
        </Text>
        {prayer.dontDoToday.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {prayer.dontDoToday.slice(0, 2).map((d) => (
              <Chip key={d} label={d} size="sm" tone="danger" icon="cancel" />
            ))}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Text variant="label" tone="primary">
            Read today&apos;s prayer
          </Text>
          <Icon name="arrow-right" size={16} color={colors.primaryStrong} />
        </View>
      </View>
    </Card>
  );
}
