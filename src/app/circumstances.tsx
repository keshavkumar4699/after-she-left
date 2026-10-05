import { router } from 'expo-router';
import { View } from 'react-native';

import { formatLimit } from '@/domain/entitlements';
import { locationSummary, scheduleSummary } from '@/features/lessons/circumstanceText';
import { useCircumstances, useMistakes, usePlanInfo } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { Badge, Button, Card, EmptyState, Icon, Screen, Text, type IconName } from '@/ui';

export default function CircumstancesScreen() {
  const { colors, radius } = useTheme();
  const circumstances = useCircumstances();
  const mistakes = useMistakes();
  const { tier, limits } = usePlanInfo();
  const usedLocation = circumstances.filter((c) => c.location).length;
  const usedSchedule = circumstances.filter((c) => c.schedule).length;

  return (
    <Screen
      back
      title="Circumstances"
      subtitle="The moments and places where old mistakes come back. Each one can remind you."
      footer={<Button label="New circumstance" icon="plus" fullWidth onPress={() => router.push('/circumstance/new')} />}>
      <View style={{ gap: 12 }}>
        {tier === 'free' ? (
          <Text variant="caption" tone="muted">
            Free plan: {usedSchedule}/{formatLimit(limits.scheduledCircumstances)} scheduled · {usedLocation}/{formatLimit(limits.locationCircumstances)} location reminders
          </Text>
        ) : null}
        {circumstances.length === 0 ? (
          <Card>
            <EmptyState
              icon="map-marker-radius-outline"
              title="Name your triggers"
              message="“Late night alone”, “Payday weekend”, “Near the mall”. Give each a time or a place and the right lesson will find you."
            />
          </Card>
        ) : null}
        {circumstances.map((c) => {
          const lessons = mistakes.filter((m) => m.circumstanceIds.includes(c.id)).length;
          const sched = scheduleSummary(c);
          const loc = locationSummary(c);
          return (
            <Card key={c.id} onPress={() => router.push(`/circumstance/${c.id}`)} accessibilityLabel={c.name} style={c.paused ? { opacity: 0.6 } : undefined}>
              <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
                <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: `${c.color}26`, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={c.icon as IconName} size={22} color={c.color} />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text variant="h3" style={{ flex: 1 }} numberOfLines={1}>
                      {c.name}
                    </Text>
                    {c.paused ? <Badge label="Paused" tone="neutral" /> : null}
                  </View>
                  {sched ? <Meta icon="clock-outline" text={sched} /> : null}
                  {loc ? <Meta icon="map-marker-radius-outline" text={loc} /> : null}
                  {!sched && !loc ? <Meta icon="bell-off-outline" text="No reminder. Used for check-ins only." /> : null}
                  <Text variant="caption" tone="muted">
                    {lessons} linked lesson{lessons === 1 ? '' : 's'}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.textSubtle} />
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

function Meta({ icon, text }: { icon: IconName; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      <Icon name={icon} size={15} color={colors.textMuted} />
      <Text variant="caption" tone="muted" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}
