import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { handleResult } from '@/components/Upsell';
import { addDays, diffDays, formatDay, formatTime, isValidDayKey, MONTH_LONG, parseDayKey, toDayKey } from '@/domain/dates';
import { newId } from '@/domain/random';
import { GOAL_CATEGORIES, type GoalCategory, type GoalStatus, type Milestone, type TimeOfDay } from '@/domain/types';
import { useActiveHabits } from '@/store/hooks';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/theme/ThemeProvider';
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  Chip,
  DateField,
  Dialog,
  FormSection,
  Icon,
  IconButton,
  ProgressBar,
  Screen,
  SegmentedControl,
  Text,
  TextField,
  TimeField,
  toast,
} from '@/ui';
import { GOAL_META } from '@/features/goals/meta';

function longDate(day: string) {
  const { year, month, day: d } = parseDayKey(day);
  return `${d} ${MONTH_LONG[month - 1]} ${year}`;
}

export default function GoalEditor() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const existing = useStore((s) => (isNew ? undefined : s.goals[id]));
  const addGoal = useStore((s) => s.addGoal);
  const updateGoal = useStore((s) => s.updateGoal);
  const deleteGoal = useStore((s) => s.deleteGoal);
  const habits = useActiveHabits();
  const today = toDayKey();

  const [title, setTitle] = useState(existing?.title ?? '');
  const [category, setCategory] = useState<GoalCategory>(existing?.category ?? 'money');
  const [measure, setMeasure] = useState(existing?.measure ?? '');
  const [targetDate, setTargetDate] = useState<string | null>(existing?.targetDate ?? null);
  const [targetTime, setTargetTime] = useState<TimeOfDay | null>(existing?.targetTime ?? null);
  const [place, setPlace] = useState(existing?.place ?? '');
  const [why, setWhy] = useState(existing?.why ?? '');
  const [affirmation, setAffirmation] = useState(existing?.affirmation ?? '');
  const [milestones, setMilestones] = useState<Milestone[]>(existing?.milestones ?? []);
  const [newMilestone, setNewMilestone] = useState('');
  const [habitIds, setHabitIds] = useState<string[]>(existing?.habitIds ?? []);
  const [status, setStatus] = useState<GoalStatus>(existing?.status ?? 'active');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const checks = [
    { ok: measure.trim().length > 3, label: 'A clear measure (how you will know)' },
    { ok: !!targetDate && isValidDayKey(targetDate), label: 'A real date on the calendar' },
    { ok: place.trim().length > 1, label: 'A place where it happens' },
    { ok: why.trim().length > 3, label: 'A reason that moves you' },
    { ok: /\b(I am|I have|I'm|I've|I did|I own|I earn|I live|I crossed|I finished)\b/i.test(affirmation), label: 'Written as if it already happened' },
  ];
  const score = checks.filter((c) => c.ok).length;

  const suggest = () => {
    if (!title.trim() || !targetDate) {
      toast('Add a title and a date first', { icon: 'information-outline' });
      return;
    }
    const time = targetTime ? `, ${formatTime(targetTime)}` : '';
    const where = place.trim() ? ` I am ${place.trim().charAt(0).toLowerCase()}${place.trim().slice(1)}.` : '';
    const measured = measure.trim() ? ` ${measure.trim().replace(/\.$/, '')}.` : '';
    setAffirmation(`It is ${longDate(targetDate)}${time}.${where} I have achieved it: ${title.trim().charAt(0).toLowerCase()}${title.trim().slice(1)}.${measured} I feel proud and free.`);
  };

  const save = () => {
    const e: Record<string, string> = {};
    if (title.trim().length < 3) e.title = 'Name your goal.';
    if (!targetDate) e.date = 'Pick a target date.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const data = {
      title: title.trim(),
      category,
      measure: measure.trim(),
      targetDate: targetDate!,
      targetTime,
      place: place.trim(),
      why: why.trim(),
      affirmation: affirmation.trim(),
      milestones,
      habitIds,
      status,
    };
    if (isNew) {
      if (!handleResult(addGoal(data))) return;
      toast('Goal set. Read it every morning as if it’s already true.', { icon: 'flag-checkered' });
    } else {
      updateGoal(id, data);
      toast(status === 'achieved' && existing?.status !== 'achieved' ? 'Goal achieved! You did it.' : 'Goal saved', {
        icon: status === 'achieved' ? 'trophy-outline' : 'check',
      });
    }
    router.back();
  };

  const daysLeft = targetDate ? diffDays(today, targetDate) : null;

  return (
    <Screen
      back
      headerCompact
      title={isNew ? 'New goal' : 'Goal'}
      right={!isNew ? <IconButton icon="delete-outline" label="Delete goal" variant="tonal" size={40} onPress={() => setConfirmDelete(true)} /> : undefined}
      footer={<Button label={isNew ? 'Set goal' : 'Save'} icon="check" fullWidth onPress={save} />}>
      {affirmation ? (
        <Card variant="hero" padding={20} style={{ marginBottom: 24 }}>
          <View style={{ gap: 8 }}>
            <Text variant="overline" tone="muted">
              Already achieved{daysLeft !== null && daysLeft >= 0 ? ` · ${daysLeft} days to go` : ''}
            </Text>
            <Text variant="serif" style={{ fontSize: 20, lineHeight: 30 }}>
              “{affirmation}”
            </Text>
          </View>
        </Card>
      ) : null}

      <FormSection title="Your goal">
        <TextField label="Goal" placeholder="e.g. Financial freedom" value={title} onChangeText={setTitle} error={errors.title} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {GOAL_CATEGORIES.map((c) => (
            <Chip key={c} label={GOAL_META[c].label} icon={GOAL_META[c].icon} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>
      </FormSection>

      <FormSection title="Make it specific" description="Vague goals stay dreams. Date, time, place and a measure make them plans.">
        <TextField label="How will you know it's done?" placeholder="Passive income ≥ ₹60,000 per month" value={measure} onChangeText={setMeasure} />
        <DateField
          label="Target date"
          value={targetDate}
          onChange={setTargetDate}
          minDate={addDays(today, 1)}
          helper={errors.date ?? 'Only real dates can be picked: 29 February exists only in leap years (2028, 2032…).'}
        />
        <TimeField label="Time (optional)" value={targetTime} onChange={setTargetTime} placeholder="Any time that day" />
        <TextField label="Where will you be?" placeholder="At my desk at home, checking my portfolio" value={place} onChangeText={setPlace} />
        <TextField label="Why it matters" placeholder="Freedom to choose my work and help my parents" value={why} onChangeText={setWhy} multiline />
      </FormSection>

      <FormSection title="Feel it already" description="Write it in the present or past tense, as if the day has come. Read it every morning.">
        <TextField
          placeholder="It is 28 February 2027. I am financially free…"
          value={affirmation}
          onChangeText={setAffirmation}
          multiline
          maxLength={280}
          showCounter
        />
        <Button label="Write it for me" icon="auto-fix" variant="tonal" size="sm" onPress={suggest} />
      </FormSection>

      <FormSection title={`How specific is it? ${score}/5`}>
        <ProgressBar progress={score / 5} color={score === 5 ? colors.primary : colors.accent} />
        {checks.map((c) => (
          <View key={c.label} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name={c.ok ? 'check-circle' : 'circle-outline'} size={20} color={c.ok ? colors.primary : colors.textSubtle} />
            <Text variant="body" tone={c.ok ? 'default' : 'muted'}>
              {c.label}
            </Text>
          </View>
        ))}
      </FormSection>

      <FormSection title="Milestones" description="Small wins on the way. Each one is proof.">
        {milestones.map((m) => (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Checkbox checked={m.done} size={26} label={m.title} onChange={() => setMilestones(milestones.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)))} />
            <View style={{ flex: 1 }}>
              <Text variant="body" style={m.done ? { textDecorationLine: 'line-through', color: colors.textMuted } : undefined}>
                {m.title}
              </Text>
              {m.dueOn ? (
                <Text variant="caption" tone="muted">
                  by {formatDay(m.dueOn, { withYear: true })}
                </Text>
              ) : null}
            </View>
            <IconButton icon="close" label={`Remove ${m.title}`} size={34} onPress={() => setMilestones(milestones.filter((x) => x.id !== m.id))} />
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <TextField placeholder="Add a milestone" value={newMilestone} onChangeText={setNewMilestone} onSubmitEditing={() => {}} />
          </View>
          <IconButton
            icon="plus"
            label="Add milestone"
            variant="filled"
            onPress={() => {
              if (!newMilestone.trim()) return;
              setMilestones([...milestones, { id: newId('ms_'), title: newMilestone.trim(), dueOn: null, done: false }]);
              setNewMilestone('');
            }}
          />
        </View>
      </FormSection>

      <FormSection title="Habits that build it" description="Goals set the direction; habits do the work.">
        {habits.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {habits.map((h) => (
              <Chip
                key={h.id}
                label={`${h.emoji} ${h.name}`}
                selected={habitIds.includes(h.id)}
                onPress={() => setHabitIds(habitIds.includes(h.id) ? habitIds.filter((x) => x !== h.id) : [...habitIds, h.id])}
              />
            ))}
          </View>
        ) : (
          <Text variant="body" tone="muted">
            Create a habit first, then link it here.
          </Text>
        )}
        {habitIds.length ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {habits.filter((h) => habitIds.includes(h.id)).map((h) => (
              <Avatar key={h.id} emoji={h.emoji} color={h.color} size={30} />
            ))}
          </View>
        ) : null}
      </FormSection>

      {!isNew ? (
        <FormSection title="Status">
          <SegmentedControl
            options={[
              { value: 'active', label: 'Active' },
              { value: 'achieved', label: 'Achieved', icon: 'trophy-outline' },
              { value: 'paused', label: 'Paused' },
            ]}
            value={status}
            onChange={setStatus}
          />
        </FormSection>
      ) : null}

      <Dialog
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        icon="delete-outline"
        tone="danger"
        title="Delete this goal?"
        message="This can't be undone."
        confirmLabel="Delete"
        destructive
        cancelLabel="Cancel"
        onConfirm={() => {
          deleteGoal(id);
          router.back();
        }}
      />
    </Screen>
  );
}
