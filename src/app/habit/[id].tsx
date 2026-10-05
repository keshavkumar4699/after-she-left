import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { handleResult } from '@/components/Upsell';
import { difficultySuggestion } from '@/domain/coaching';
import { habitStats, logsForHabit } from '@/domain/progress';
import type { Habit, TimeWindow } from '@/domain/types';
import { HABIT_TEMPLATES, type HabitTemplate } from '@/features/habits/templates';
import { WINDOW_ICON, WINDOW_LABEL } from '@/features/habits/HabitRow';
import { HABIT_EMOJIS } from '@/store/defaults';
import { useActiveHabits, useBeginner, useGoals, useHabitLogs, useToday } from '@/store/hooks';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/theme/ThemeProvider';
import { SWATCHES } from '@/theme/tokens';
import {
  Avatar,
  Banner,
  Button,
  Card,
  Chip,
  Counter,
  Dialog,
  EmojiPicker,
  FormSection,
  ListItem,
  ProgressRing,
  Screen,
  SegmentedControl,
  Select,
  StreakBadge,
  SwatchPicker,
  Switch,
  Text,
  TextField,
  WeekdayPicker,
  toast,
} from '@/ui';

type Draft = Omit<Habit, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

function emptyDraft(order: number): Draft {
  return {
    name: '',
    emoji: '💪',
    color: SWATCHES[0],
    identity: '',
    twoMinute: '',
    full: '',
    level: 1,
    weeklyTarget: 3,
    preferredDays: [],
    timeWindow: 'anytime',
    intention: { behavior: '', when: '', where: '' },
    stackAfter: '',
    reward: '',
    bundle: '',
    hard: false,
    status: 'active',
    goalId: null,
    order,
  };
}

export default function HabitEditor() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const existing = useStore((s) => (isNew ? undefined : s.habits[id]));
  const addHabit = useStore((s) => s.addHabit);
  const updateHabit = useStore((s) => s.updateHabit);
  const archiveHabit = useStore((s) => s.archiveHabit);
  const deleteHabit = useStore((s) => s.deleteHabit);
  const planHabit = useStore((s) => s.planHabit);
  const habits = useActiveHabits();
  const goals = useGoals();
  const logs = useHabitLogs();
  const beginner = useBeginner();
  const today = useToday();

  const [draft, setDraft] = useState<Draft>(() => (existing ? { ...existing } : emptyDraft(habits.length)));
  const [error, setError] = useState<string | undefined>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const stats = useMemo(() => (existing ? habitStats(logsForHabit(logs, existing.id), today) : null), [existing, logs, today]);
  const suggestion = useMemo(() => (existing ? difficultySuggestion(existing, logs, today) : null), [existing, logs, today]);

  const applyTemplate = (t: HabitTemplate) => setDraft((d) => ({ ...d, ...t, preferredDays: [] }));

  const save = () => {
    if (draft.name.trim().length < 2) {
      setError('Give your habit a name.');
      return;
    }
    const data: Draft = { ...draft, name: draft.name.trim(), twoMinute: draft.twoMinute.trim(), full: draft.full.trim() };
    if (existing) {
      updateHabit(existing.id, data);
      toast('Habit saved', { icon: 'check' });
      router.back();
      return;
    }
    const result = addHabit(data);
    if (!handleResult(result)) return;
    planHabit(result.id, today);
    toast(`${data.emoji} ${data.name} added to today. Start small.`, { icon: 'sprout' });
    router.back();
  };

  return (
    <Screen
      back
      headerCompact
      title={isNew ? 'New habit' : 'Habit'}
      footer={<Button label={isNew ? 'Create habit' : 'Save'} icon="check" fullWidth onPress={save} />}>
      {existing && stats ? (
        <Card variant="hero" padding={18} style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <ProgressRing progress={stats.ratio7} size={72} stroke={7} accessibilityLabel={`Last 7 days ${stats.done7} of ${stats.planned7}`}>
              <Text variant="bodyStrong">
                {stats.done7}/{stats.planned7}
              </Text>
            </ProgressRing>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="h3">
                {existing.emoji} {existing.name}
              </Text>
              <Text variant="caption" tone="muted">
                Last 7 days · level {existing.level} · {stats.totalDone} done in total
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <StreakBadge count={stats.streak} />
                <Text variant="caption" tone="muted">
                  best {stats.bestStreak}
                </Text>
              </View>
            </View>
          </View>
        </Card>
      ) : null}

      {suggestion && suggestion.kind !== 'keep' ? (
        <View style={{ marginBottom: 20 }}>
          <Banner tone={suggestion.kind === 'level-up' ? 'accent' : 'violet'} icon={suggestion.kind === 'level-up' ? 'trending-up' : 'feather'} title={suggestion.kind === 'level-up' ? 'Ready for a little more' : 'Make it smaller'} message={suggestion.message} />
        </View>
      ) : null}

      {isNew ? (
        <FormSection title="Quick start" description="Pick one to prefill. Every template has a two-minute version.">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {HABIT_TEMPLATES.map((t) => (
              <Chip key={t.name} label={`${t.emoji} ${t.name}`} selected={draft.name === t.name} onPress={() => applyTemplate(t)} />
            ))}
          </ScrollView>
        </FormSection>
      ) : null}

      <FormSection title="The habit">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar emoji={draft.emoji} color={draft.color} size={56} />
          <View style={{ flex: 1 }}>
            <TextField label="Name" placeholder="e.g. Gym" value={draft.name} onChangeText={(v) => set('name', v)} error={error} />
          </View>
        </View>
        <EmojiPicker options={HABIT_EMOJIS} value={draft.emoji} onChange={(v) => set('emoji', v)} />
        <SwatchPicker colors={SWATCHES} value={draft.color} onChange={(v) => set('color', v)} />
      </FormSection>

      <FormSection title="Who you are becoming" description="Identity first: every repetition is a vote for this person.">
        <TextField placeholder="I am someone who takes care of my body" value={draft.identity} onChangeText={(v) => set('identity', v)} />
      </FormSection>

      <FormSection title="Make it easy" description="Aim between easy and hard: hard enough to excite you, easy enough to repeat.">
        <TextField label="Two-minute version" placeholder="Put on my gym clothes" value={draft.twoMinute} onChangeText={(v) => set('twoMinute', v)} helper={beginner.active ? 'Beginner mode: you’ll do this version for now. Consistency first.' : undefined} />
        <TextField label="Full version" placeholder="Train for 45 minutes" value={draft.full} onChangeText={(v) => set('full', v)} />
      </FormSection>

      <FormSection title="Weekly rhythm" description="No fixed times. Spread it across the week and follow it whenever suits the day.">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="bodyStrong">Times per week</Text>
          <Counter value={draft.weeklyTarget} onChange={(v) => set('weeklyTarget', v)} min={1} max={7} suffix="×" />
        </View>
        <Text variant="label" tone="muted">
          Preferred days (optional)
        </Text>
        <WeekdayPicker value={draft.preferredDays} onChange={(v) => set('preferredDays', v)} />
        <Text variant="label" tone="muted">
          Usually in the
        </Text>
        <SegmentedControl<TimeWindow>
          size="sm"
          options={(['anytime', 'morning', 'afternoon', 'evening'] as TimeWindow[]).map((w) => ({ value: w, label: WINDOW_LABEL[w], icon: WINDOW_ICON[w] }))}
          value={draft.timeWindow}
          onChange={(v) => set('timeWindow', v)}
        />
        <ListItem
          icon="arm-flex-outline"
          title="This is a hard habit"
          subtitle="The planner keeps hard days apart, so you recover in between."
          chevron={false}
          trailing={<Switch value={draft.hard} onChange={(v) => set('hard', v)} label="Hard habit" />}
        />
      </FormSection>

      <FormSection title="Make it obvious" description="Implementation intention: decide when and where, and you are 2–3× more likely to follow through.">
        <Card variant="sunken" padding={14}>
          <View style={{ gap: 10 }}>
            <TextField label="I will…" placeholder="train" value={draft.intention.behavior} onChangeText={(v) => set('intention', { ...draft.intention, behavior: v })} />
            <TextField label="When" placeholder="before work" value={draft.intention.when} onChangeText={(v) => set('intention', { ...draft.intention, when: v })} />
            <TextField label="Where" placeholder="the gym near home" value={draft.intention.where} onChangeText={(v) => set('intention', { ...draft.intention, where: v })} />
          </View>
        </Card>
        <TextField
          label="Habit stacking: after I…"
          placeholder="drink my morning water"
          value={draft.stackAfter}
          onChangeText={(v) => set('stackAfter', v)}
          helper={draft.stackAfter ? `After I ${draft.stackAfter}, I will ${(draft.twoMinute || draft.name || 'do this').replace(/^./, (c) => c.toLowerCase())}.` : 'Anchor it to something you already do every day.'}
        />
      </FormSection>

      <FormSection title="Make it attractive & satisfying">
        <TextField label="Temptation bundle" placeholder="My favourite podcast, only at the gym" value={draft.bundle} onChangeText={(v) => set('bundle', v)} />
        <TextField label="Reward after doing it" placeholder="A protein smoothie" value={draft.reward} onChangeText={(v) => set('reward', v)} />
      </FormSection>

      {goals.length ? (
        <FormSection title="Builds toward">
          <Select
            label="Goal"
            value={draft.goalId ?? null}
            onChange={(v) => set('goalId', v)}
            placeholder="No goal linked"
            icon="flag-outline"
            options={goals.filter((g) => g.status === 'active').map((g) => ({ value: g.id, label: g.title, icon: 'flag-outline' as const }))}
          />
        </FormSection>
      ) : null}

      {existing ? (
        <FormSection title="Manage">
          <ListItem icon="archive-outline" title="Archive habit" subtitle="Hide it but keep its history." onPress={() => { archiveHabit(existing.id); router.back(); }} />
          <ListItem icon="delete-outline" title="Delete habit" destructive onPress={() => setConfirmDelete(true)} />
        </FormSection>
      ) : null}

      <Dialog
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        icon="delete-outline"
        tone="danger"
        title="Delete this habit?"
        message="Its history and plans are removed. Archive it instead to keep the record."
        confirmLabel="Delete"
        destructive
        cancelLabel="Cancel"
        onConfirm={() => {
          if (existing) deleteHabit(existing.id);
          router.back();
        }}
      />
      <Text variant="caption" tone="subtle" align="center" style={{ marginTop: 4, color: colors.textSubtle }}>
        Small habits, repeated, become who you are.
      </Text>
    </Screen>
  );
}
