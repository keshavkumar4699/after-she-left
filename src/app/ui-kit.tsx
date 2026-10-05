import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { addDays, lastNDays, toDayKey } from '@/domain/dates';
import type { DayProgress, HabitDayCell } from '@/domain/progress';
import { useTheme } from '@/theme/ThemeProvider';
import { SWATCHES } from '@/theme/tokens';
import {
  Accordion,
  Avatar,
  Badge,
  Banner,
  BottomSheet,
  Button,
  Card,
  Checkbox,
  Chip,
  ColumnChart,
  Counter,
  DateField,
  Dialog,
  Divider,
  EmojiPicker,
  EmptyState,
  Icon,
  IconButton,
  Last7DaysRings,
  ListItem,
  MonthCalendar,
  ProgressBar,
  ProgressRing,
  RadioGroup,
  RatingPills,
  Screen,
  SectionHeader,
  SegmentedControl,
  Select,
  Skeleton,
  StatTile,
  Stepper,
  StreakBadge,
  SwatchPicker,
  Switch,
  Text,
  TextField,
  TimeField,
  WeekdayPicker,
  WeekStrip,
  toast,
  type CalendarMark,
} from '@/ui';

/** Living style guide: every component in the design system, in both themes. */
export default function UiKit() {
  const { colors, scheme } = useTheme();
  const today = toDayKey();
  const [seg, setSeg] = useState<'week' | 'month'>('week');
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(false);
  const [radio, setRadio] = useState<'a' | 'b'>('a');
  const [rating, setRating] = useState(3);
  const [count, setCount] = useState(3);
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [swatch, setSwatch] = useState<string>(SWATCHES[0]);
  const [emoji, setEmoji] = useState('💪');
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<{ hour: number; minute: number } | null>({ hour: 6, minute: 30 });
  const [select, setSelect] = useState<'one' | 'two' | null>(null);
  const [text, setText] = useState('');
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [acc, setAcc] = useState(true);

  const rings: DayProgress[] = useMemo(
    () =>
      lastNDays(today, 7).map((d, i) => {
        const planned = [5, 6, 0, 4, 6, 5, 5][i];
        const done = [5, 3, 0, 4, 2, 1, 2][i];
        return { day: d, label: i === 6 ? 'Today' : i === 5 ? 'Yest.' : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i] ?? 'Day', done, planned, ratio: planned ? done / planned : 0, isToday: i === 6, isRest: planned === 0 };
      }),
    [today],
  );
  const cells: HabitDayCell[] = useMemo(
    () =>
      lastNDays(today, 7).map((d, i) => ({
        day: d,
        label: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i],
        state: (['done', 'rest', 'missed', 'done', 'skipped', 'done', 'pending'] as const)[i],
      })),
    [today],
  );
  const marks = useMemo(() => {
    const m = new Map<string, CalendarMark>();
    for (let i = 1; i < 28; i++) m.set(addDays(today, -i), i % 5 === 0 ? 'missed' : i % 3 === 0 ? 'planned' : 'done');
    m.set(addDays(today, 2), 'planned');
    return m;
  }, [today]);

  return (
    <Screen back title="Design system" subtitle={`Calm night · ${scheme} theme`}>
      <View style={{ gap: 28 }}>
        <Section title="Brand & colour">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <BrandMark size={64} />
            <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[
                ['bg', colors.bg],
                ['surface', colors.surface],
                ['primary', colors.primary],
                ['accent', colors.accent],
                ['violet', colors.violet],
                ['danger', colors.danger],
              ].map(([n, c]) => (
                <View key={n} style={{ alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c, borderWidth: 1, borderColor: colors.border }} />
                  <Text variant="caption" tone="muted" style={{ fontSize: 10 }}>
                    {n}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Section>

        <Section title="Typography">
          <Text variant="display">Display · Fraunces</Text>
          <Text variant="title">Title · Fraunces</Text>
          <Text variant="h2">Heading 2 · Inter</Text>
          <Text variant="h3">Heading 3</Text>
          <Text variant="body">Body text for reading comfortably on a phone.</Text>
          <Text variant="label">Label</Text>
          <Text variant="caption" tone="muted">
            Caption · muted
          </Text>
          <Text variant="overline" tone="muted">
            Overline
          </Text>
          <Text variant="serif">“Serif for prayers and affirmations.”</Text>
        </Section>

        <Section title="Buttons">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button label="Filled" />
            <Button label="Tonal" variant="tonal" />
            <Button label="Outline" variant="outline" />
            <Button label="Ghost" variant="ghost" />
            <Button label="Danger" variant="danger" icon="delete-outline" />
            <Button label="Accent" variant="accent" icon="crown" />
            <Button label="Loading" loading />
            <Button label="Disabled" disabled />
            <Button label="Small" size="sm" icon="plus" />
          </View>
          <Button label="Large full width" size="lg" fullWidth iconRight="arrow-right" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton icon="heart-outline" label="Plain" />
            <IconButton icon="pencil-outline" label="Tonal" variant="tonal" />
            <IconButton icon="plus" label="Filled" variant="filled" />
            <IconButton icon="share-variant-outline" label="Outline" variant="outline" />
          </View>
        </Section>

        <Section title="Chips & badges">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label="Filter" />
            <Chip label="Selected" selected />
            <Chip label="With icon" icon="map-marker-outline" />
            <Chip label="Input chip" onRemove={() => toast('Removed')} />
            <Chip label="Danger" tone="danger" icon="cancel" size="sm" />
            <Chip label="Identity" dotColor={colors.violet} size="sm" />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Badge label="Primary" />
            <Badge label="Accent" tone="accent" icon="crown-outline" />
            <Badge label="Violet" tone="violet" />
            <Badge label="Danger" tone="danger" icon="repeat" />
            <Badge label="Neutral" tone="neutral" />
            <StreakBadge count={12} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Avatar label="Keshav Kumar" />
            <Avatar emoji="📖" color={colors.violet} />
            <Avatar emoji="💪" color={colors.primary} size={56} />
          </View>
        </Section>

        <Section title="Inputs">
          <TextField label="Text field" placeholder="Type here" value={text} onChangeText={setText} helper="Helper text" maxLength={40} showCounter />
          <TextField label="With icon & error" icon="email-outline" placeholder="email@example.com" error="That email looks wrong." />
          <TextField label="Multiline" placeholder="Write a few lines" multiline />
          <Select
            label="Select"
            value={select}
            onChange={setSelect}
            options={[
              { value: 'one', label: 'Option one', icon: 'numeric-1-circle-outline' },
              { value: 'two', label: 'Option two', icon: 'numeric-2-circle-outline', description: 'With a description' },
            ]}
          />
          <DateField label="Date (real dates only)" value={date} onChange={setDate} />
          <TimeField label="Time" value={time} onChange={setTime} />
        </Section>

        <Section title="Selection controls">
          <SegmentedControl
            options={[
              { value: 'week', label: 'Week', icon: 'view-week-outline' },
              { value: 'month', label: 'Month', icon: 'calendar-month-outline' },
            ]}
            value={seg}
            onChange={setSeg}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Switch value={on} onChange={setOn} label="Switch" />
            <Checkbox checked={checked} onChange={setChecked} label="Checkbox" />
            <Counter value={count} onChange={setCount} suffix="×" />
          </View>
          <RadioGroup
            value={radio}
            onChange={setRadio}
            options={[
              { value: 'a', label: 'Radio option A', description: 'With a description', icon: 'meditation' },
              { value: 'b', label: 'Radio option B', icon: 'hands-pray' },
            ]}
          />
          <RatingPills value={rating} onChange={setRating} labels={['Minor', 'Serious']} />
          <WeekdayPicker value={days} onChange={setDays} />
          <SwatchPicker colors={SWATCHES} value={swatch} onChange={setSwatch} />
          <EmojiPicker options={['💪', '⚽', '📖', '🧘', '🏃', '💧']} value={emoji} onChange={setEmoji} />
          <Stepper steps={['One', 'Two', 'Three', 'Four']} current={1} />
        </Section>

        <Section title="Progress & data">
          <Last7DaysRings days={rings} onPressDay={() => toast('Opens that day')} />
          <WeekStrip cells={cells} />
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            <ProgressRing progress={0.66} size={72} stroke={7}>
              <Text variant="bodyStrong">4/6</Text>
            </ProgressRing>
            <View style={{ flex: 1, gap: 10 }}>
              <ProgressBar progress={0.4} />
              <ProgressBar progress={0.8} color={colors.violet} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatTile style={{ flex: 1 }} label="Last 7 days" value="72%" icon="chart-donut" delta={8} deltaLabel="pts vs prev" />
            <StatTile style={{ flex: 1 }} label="Slips" value="1" icon="repeat" delta={-2} deltaLabel="vs prev" upIsGood={false} />
          </View>
          <Card>
            <ColumnChart
              data={[
                { label: '14 Sep', value: 0.55 },
                { label: '21 Sep', value: 0.62 },
                { label: '28 Sep', value: 0.71 },
                { label: 'This week', value: 0.78 },
              ]}
            />
          </Card>
          <Card>
            <MonthCalendar marks={marks} today={today} />
          </Card>
        </Section>

        <Section title="Containers">
          <Card>
            <Text variant="bodyStrong">Filled card</Text>
          </Card>
          <Card variant="outlined">
            <Text variant="bodyStrong">Outlined card</Text>
          </Card>
          <Card variant="tonal" tone="violet">
            <Text variant="bodyStrong">Tonal card (violet)</Text>
          </Card>
          <Card variant="hero">
            <Text variant="bodyStrong">Hero gradient card</Text>
          </Card>
          <Card variant="prayer" emphasized tone="violet">
            <Text variant="serif">Prayer gradient card</Text>
          </Card>
          <Card>
            <Accordion
              expanded={acc}
              onToggle={() => setAcc(!acc)}
              label="Accordion"
              header={<Text variant="bodyStrong">Accordion with chevron</Text>}>
              <Text variant="body" tone="muted">
                Expanded content animates in.
              </Text>
            </Accordion>
          </Card>
          <Card padding={6}>
            <ListItem icon="bell-outline" title="List item" subtitle="With subtitle and chevron" onPress={() => {}} />
            <Divider inset={64} />
            <ListItem icon="fingerprint" title="With switch" chevron={false} trailing={<Switch value={on} onChange={setOn} label="Switch" />} />
            <Divider inset={64} />
            <ListItem icon="delete-outline" title="Destructive" destructive onPress={() => {}} />
          </Card>
        </Section>

        <Section title="Feedback">
          <Banner tone="primary" icon="sprout" title="Info banner" message="With a message and an action" action="Do it" onAction={() => toast('Action')} />
          <Banner tone="accent" icon="link-variant" title="Warning banner" onClose={() => {}} />
          <Banner tone="danger" icon="alert-circle-outline" title="Error banner" message="Something needs attention." />
          <View style={{ gap: 8 }}>
            <Skeleton width="60%" height={20} />
            <Skeleton height={14} />
          </View>
          <Card>
            <EmptyState icon="lightbulb-on-outline" title="Empty state" message="Explains what goes here and how to start." action="Primary action" onAction={() => {}} />
          </Card>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button label="Snackbar" variant="tonal" icon="message-outline" onPress={() => toast('Saved. This is a snackbar.', { icon: 'check', actionLabel: 'Undo', onAction: () => {} })} />
            <Button label="Bottom sheet" variant="tonal" icon="arrow-collapse-up" onPress={() => setSheet(true)} />
            <Button label="Dialog" variant="tonal" icon="card-outline" onPress={() => setDialog(true)} />
          </View>
        </Section>

        <Section title="Icons">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {(['white-balance-sunny', 'calendar-check', 'lightbulb-on', 'flag', 'account-circle', 'hands-pray', 'fire', 'shield-check-outline', 'map-marker-radius-outline', 'bell-ring-outline', 'crown-outline', 'fingerprint'] as const).map((n) => (
              <Icon key={n} name={n} size={24} color={colors.textMuted} />
            ))}
          </View>
        </Section>
      </View>

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="Bottom sheet" subtitle="Slides up with a spring" footer={<Button label="Close" fullWidth onPress={() => setSheet(false)} />}>
        <ListItem icon="calendar-arrow-right" title="An action" onPress={() => setSheet(false)} />
        <ListItem icon="skip-next-circle-outline" title="Another action" onPress={() => setSheet(false)} />
      </BottomSheet>
      <Dialog
        visible={dialog}
        onClose={() => setDialog(false)}
        icon="crown-outline"
        tone="accent"
        title="A dialog"
        message="Dialogs confirm important decisions."
        confirmLabel="Confirm"
        cancelLabel="Cancel"
      />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <SectionHeader title={title} style={{ marginBottom: 0 }} />
      {children}
    </View>
  );
}
