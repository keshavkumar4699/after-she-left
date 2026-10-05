import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { LIMITS } from '@/domain/entitlements';
import { useActiveHabits, useGoals } from '@/store/hooks';
import { useStore } from '@/store/useStore';
import { Avatar, Button, Card, Checkbox, Screen, SectionHeader, Text, toast } from '@/ui';

/** Moving to the free plan: choose what stays active. Nothing is deleted; the rest is paused. */
export default function DowngradeScreen() {
  const habits = useActiveHabits();
  const goals = useGoals().filter((g) => g.status === 'active');
  const applyDowngrade = useStore((s) => s.applyDowngrade);
  const [habitIds, setHabitIds] = useState<string[]>(habits.slice(0, LIMITS.free.habits).map((h) => h.id));
  const [goalIds, setGoalIds] = useState<string[]>(goals.slice(0, LIMITS.free.goals).map((g) => g.id));

  const toggle = (list: string[], set: (v: string[]) => void, id: string, max: number) => {
    if (list.includes(id)) set(list.filter((x) => x !== id));
    else if (list.length < max) set([...list, id]);
    else toast(`You can keep ${max} active on the free plan`, { icon: 'information-outline' });
  };

  return (
    <Screen
      back
      title="Choose what stays active"
      subtitle="The free plan keeps 5 habits and 10 goals active. Nothing is deleted: the rest is paused until you upgrade."
      footer={
        <Button
          label="Continue on the free plan"
          fullWidth
          onPress={() => {
            applyDowngrade({ habitIds, goalIds });
            toast('Done. Focus on what matters most.', { icon: 'check' });
            router.replace('/');
          }}
        />
      }>
      {habits.length > LIMITS.free.habits ? (
        <View style={{ marginBottom: 24 }}>
          <SectionHeader title={`Habits · ${habitIds.length}/${LIMITS.free.habits}`} />
          <Card padding={8}>
            {habits.map((h) => (
              <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }}>
                <Checkbox checked={habitIds.includes(h.id)} label={h.name} size={26} onChange={() => toggle(habitIds, setHabitIds, h.id, LIMITS.free.habits)} />
                <Avatar emoji={h.emoji} color={h.color} size={34} />
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {h.name}
                </Text>
              </View>
            ))}
          </Card>
        </View>
      ) : null}
      {goals.length > LIMITS.free.goals ? (
        <View>
          <SectionHeader title={`Goals · ${goalIds.length}/${LIMITS.free.goals}`} />
          <Card padding={8}>
            {goals.map((g) => (
              <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }}>
                <Checkbox checked={goalIds.includes(g.id)} label={g.title} size={26} onChange={() => toggle(goalIds, setGoalIds, g.id, LIMITS.free.goals)} />
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {g.title}
                </Text>
              </View>
            ))}
          </Card>
        </View>
      ) : null}
      {habits.length <= LIMITS.free.habits && goals.length <= LIMITS.free.goals ? (
        <Text variant="body" tone="muted">
          Everything fits in the free plan. Nothing will be paused.
        </Text>
      ) : null}
    </Screen>
  );
}
