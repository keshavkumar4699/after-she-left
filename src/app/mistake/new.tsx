import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

import { handleResult } from '@/components/Upsell';
import { formatTime, toDayKey, WEEKDAY_SHORT } from '@/domain/dates';
import { REVIEW_INTERVALS } from '@/domain/review';
import { MISTAKE_CATEGORIES, type MistakeCategory, type Severity, type TimeOfDay } from '@/domain/types';
import { CATEGORY_META } from '@/features/lessons/MistakeCard';
import { EMOTIONS } from '@/store/defaults';
import { useCircumstances } from '@/store/hooks';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/theme/ThemeProvider';
import {
  Button,
  Card,
  Chip,
  DateField,
  FormSection,
  Icon,
  IconButton,
  RatingPills,
  Screen,
  Stepper,
  Text,
  TextField,
  TimeField,
  WeekdayPicker,
  toast,
} from '@/ui';

const STEPS = ['What happened', 'Why', 'Solution', 'Circumstances', 'Review'];

export default function MistakeWizard() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useStore((s) => (id ? s.mistakes[id] : undefined));
  const addMistake = useStore((s) => s.addMistake);
  const updateMistake = useStore((s) => s.updateMistake);
  const addCircumstance = useStore((s) => s.addCircumstance);
  const circumstances = useCircumstances();

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [story, setStory] = useState(existing?.story ?? '');
  const [occurredOn, setOccurredOn] = useState(existing?.occurredOn ?? toDayKey());
  const [category, setCategory] = useState<MistakeCategory>(existing?.category ?? 'relationships');
  const [severity, setSeverity] = useState<number>(existing?.severity ?? 3);
  const [emotions, setEmotions] = useState<string[]>(existing?.emotions ?? []);
  const [why, setWhy] = useState(existing?.why ?? '');
  const [summary, setSummary] = useState(existing?.solution.summary ?? '');
  const [steps, setSteps] = useState<string[]>(existing?.solution.steps.length ? existing.solution.steps : ['']);
  const [ifCue, setIfCue] = useState(existing?.solution.ifThen.if ?? '');
  const [thenDo, setThenDo] = useState(existing?.solution.ifThen.then ?? '');
  const [dont, setDont] = useState(existing?.solution.dont ?? '');
  const [circIds, setCircIds] = useState<string[]>(existing?.circumstanceIds ?? []);
  const [newCirc, setNewCirc] = useState<{ name: string; days: number[]; time: TimeOfDay | null } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 0 && title.trim().length < 3) e.title = 'Give it a short, honest title.';
    if (s === 2) {
      if (!ifCue.trim()) e.ifCue = 'Describe the moment it tends to happen.';
      if (!thenDo.trim()) e.thenDo = 'What will you do instead?';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validate(step)) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const save = () => {
    if (!validate(0) || !validate(2)) return;
    const solution = {
      summary: summary.trim(),
      steps: steps.map((x) => x.trim()).filter(Boolean),
      ifThen: { if: ifCue.trim().replace(/[.]+$/, ''), then: thenDo.trim().replace(/[.]+$/, '') },
      dont: dont.trim() || `Don't ${title.trim().charAt(0).toLowerCase()}${title.trim().slice(1)}`,
    };
    const data = {
      title: title.trim(),
      story: story.trim(),
      why: why.trim(),
      occurredOn,
      category,
      severity: severity as Severity,
      emotions,
      solution,
      circumstanceIds: circIds,
    };
    if (existing) {
      updateMistake(existing.id, data);
      toast('Lesson updated', { icon: 'check' });
      router.back();
      return;
    }
    const result = addMistake(data);
    if (!handleResult(result)) return;
    toast('Lesson saved. We’ll remind you when it matters.', { icon: 'lightbulb-on-outline' });
    router.replace(`/mistake/${result.id}`);
  };

  const createCircumstance = () => {
    if (!newCirc?.name.trim()) return;
    const result = addCircumstance({
      name: newCirc.name.trim(),
      icon: 'alert-circle-outline',
      color: '#8B7CF6',
      schedule: newCirc.time ? { weekdays: newCirc.days, time: newCirc.time } : null,
      location: null,
      cooldownMin: 120,
    });
    if (!handleResult(result)) return;
    setCircIds((ids) => [...ids, result.id]);
    setNewCirc(null);
  };

  const footer = (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {step > 0 ? <Button label="Back" variant="outline" onPress={() => setStep(step - 1)} style={{ flex: 1 }} fullWidth /> : null}
      {step < STEPS.length - 1 ? (
        <Button label="Next" iconRight="arrow-right" onPress={next} style={{ flex: 2 }} fullWidth />
      ) : (
        <Button label={existing ? 'Save changes' : 'Save lesson'} icon="check" onPress={save} style={{ flex: 2 }} fullWidth />
      )}
    </View>
  );

  return (
    <Screen back closeIcon title={existing ? 'Edit lesson' : 'New lesson'} headerCompact footer={footer}>
      <View style={{ marginBottom: 24 }}>
        <Stepper steps={STEPS} current={step} />
      </View>

      <Animated.View key={step} entering={FadeInRight.duration(220)}>
        {step === 0 ? (
          <>
            <FormSection title="What happened?" description="Be honest and kind. This is for you only.">
              <TextField
                label="Short title"
                placeholder="e.g. Texted her at 2 AM"
                value={title}
                onChangeText={setTitle}
                error={errors.title}
                maxLength={80}
                showCounter
              />
              <TextField label="The story (optional)" placeholder="What happened, in a few lines" value={story} onChangeText={setStory} multiline />
              <DateField label="When" value={occurredOn} onChange={setOccurredOn} maxDate={toDayKey()} />
            </FormSection>
            <FormSection title="Area of life">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {MISTAKE_CATEGORIES.map((c) => (
                  <Chip key={c} label={CATEGORY_META[c].label} icon={CATEGORY_META[c].icon} selected={category === c} onPress={() => setCategory(c)} />
                ))}
              </View>
            </FormSection>
            <FormSection title="How much did it cost you?">
              <RatingPills value={severity} onChange={setSeverity} labels={['Minor', 'Serious']} />
            </FormSection>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <FormSection title="Why did it happen?" description="Name the trigger, not just the action. Triggers can be planned for.">
              <TextField
                label="What led to it"
                placeholder="e.g. Lonely, tired, phone in bed, saw her photos"
                value={why}
                onChangeText={setWhy}
                multiline
              />
            </FormSection>
            <FormSection title="What were you feeling?">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {EMOTIONS.map((e) => (
                  <Chip
                    key={e}
                    label={e}
                    selected={emotions.includes(e)}
                    onPress={() => setEmotions(emotions.includes(e) ? emotions.filter((x) => x !== e) : [...emotions, e])}
                  />
                ))}
              </View>
            </FormSection>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <FormSection
              title="Your if–then rule"
              description="Implementation intentions work: decide now what you'll do when the moment comes.">
              <Card variant="tonal" tone="primary" padding={14}>
                <View style={{ gap: 12 }}>
                  <TextField label="If…" placeholder="I feel lonely late at night" value={ifCue} onChangeText={setIfCue} error={errors.ifCue} />
                  <TextField
                    label="…then I will"
                    placeholder="write in my journal and call a friend tomorrow"
                    value={thenDo}
                    onChangeText={setThenDo}
                    error={errors.thenDo}
                  />
                </View>
              </Card>
            </FormSection>
            <FormSection title="The solution">
              <TextField label="In one line" placeholder="Protect my nights: phone out of the bedroom" value={summary} onChangeText={setSummary} />
              <Text variant="label" tone="muted">
                Steps
              </Text>
              {steps.map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <TextField placeholder={`Step ${i + 1}`} value={s} onChangeText={(v) => setSteps(steps.map((x, j) => (j === i ? v : x)))} />
                  </View>
                  {steps.length > 1 ? (
                    <IconButton icon="close" label={`Remove step ${i + 1}`} size={36} onPress={() => setSteps(steps.filter((_, j) => j !== i))} />
                  ) : null}
                </View>
              ))}
              <Button label="Add step" icon="plus" variant="ghost" size="sm" onPress={() => setSteps([...steps, ''])} />
            </FormSection>
            <FormSection title="Never again" description="One line for your daily prayer's “not today” list.">
              <TextField placeholder="Don't text her when I'm lonely at night" value={dont} onChangeText={setDont} />
            </FormSection>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <FormSection
              title="When does it tend to happen?"
              description="Link circumstances. Each one can remind you at a time or when you reach a place.">
              {circumstances.length === 0 ? (
                <Text variant="body" tone="muted">
                  No circumstances yet. Create one below, or skip this step.
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {circumstances.map((c) => (
                    <Chip
                      key={c.id}
                      label={c.name}
                      dotColor={c.color}
                      selected={circIds.includes(c.id)}
                      onPress={() => setCircIds(circIds.includes(c.id) ? circIds.filter((x) => x !== c.id) : [...circIds, c.id])}
                    />
                  ))}
                </View>
              )}
            </FormSection>
            {newCirc ? (
              <Card variant="outlined">
                <View style={{ gap: 12 }}>
                  <TextField label="Name" placeholder="e.g. Late night alone" value={newCirc.name} onChangeText={(name) => setNewCirc({ ...newCirc, name })} />
                  <Text variant="label" tone="muted">
                    Remind me on (optional)
                  </Text>
                  <WeekdayPicker value={newCirc.days} onChange={(days) => setNewCirc({ ...newCirc, days })} />
                  <TimeField label="At" value={newCirc.time} onChange={(time) => setNewCirc({ ...newCirc, time })} placeholder="No scheduled reminder" />
                  {newCirc.time ? (
                    <Text variant="caption" tone="muted">
                      {newCirc.days.length ? newCirc.days.map((d) => WEEKDAY_SHORT[d]).join(', ') : 'Every day'} at {formatTime(newCirc.time)}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button label="Add" icon="check" size="sm" onPress={createCircumstance} />
                    <Button label="Cancel" variant="ghost" size="sm" onPress={() => setNewCirc(null)} />
                  </View>
                  <Text variant="caption" tone="subtle">
                    Location reminders can be added later in Circumstances.
                  </Text>
                </View>
              </Card>
            ) : (
              <Button label="New circumstance" icon="plus" variant="tonal" onPress={() => setNewCirc({ name: '', days: [], time: null })} />
            )}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <FormSection title="Ready to remember">
              <Card>
                <View style={{ gap: 10 }}>
                  <Text variant="h3">{title || 'Untitled'}</Text>
                  <Text variant="body">
                    If {ifCue || '…'}, then {thenDo || '…'}.
                  </Text>
                  {dont ? (
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <Icon name="cancel" size={16} color={colors.danger} />
                      <Text variant="body">{dont}</Text>
                    </View>
                  ) : null}
                  {circIds.length ? (
                    <Text variant="caption" tone="muted">
                      Linked to {circumstances.filter((c) => circIds.includes(c.id)).map((c) => c.name).join(', ')}
                    </Text>
                  ) : null}
                </View>
              </Card>
            </FormSection>
            <FormSection title="How we'll help you remember">
              <View style={{ gap: 10 }}>
                <Line icon="cards-outline" text={`Spaced review on days ${REVIEW_INTERVALS.join(', ')}. Lessons that stick come back less often.`} />
                <Line icon="bell-ring-outline" text="Reminders when a linked circumstance comes up (time or place)." />
                <Line icon="hands-pray" text="It shapes your daily prayer and its “not today” list." />
                <Line icon="restart" text="If it happens again, the review schedule restarts. No shame, just practice." />
              </View>
            </FormSection>
          </>
        ) : null}
      </Animated.View>
    </Screen>
  );
}

function Line({ icon, text }: { icon: 'cards-outline' | 'bell-ring-outline' | 'hands-pray' | 'restart'; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <Icon name={icon} size={20} color={colors.primary} />
      <Text variant="body" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}
