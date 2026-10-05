import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { diffDays, formatDay } from '@/domain/dates';
import { REVIEW_INTERVALS, isDue } from '@/domain/review';
import { CATEGORY_META, SeverityMeter } from '@/features/lessons/MistakeCard';
import { useCheckins, useCircumstances, useToday } from '@/store/hooks';
import { useStore } from '@/store/useStore';
import { useTheme } from '@/theme/ThemeProvider';
import { Badge, Button, Card, Chip, Dialog, EmptyState, Icon, IconButton, Screen, SectionHeader, Text, toast } from '@/ui';

export default function MistakeDetail() {
  const { colors, radius } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const today = useToday();
  const mistake = useStore((s) => s.mistakes[id]);
  const updateMistake = useStore((s) => s.updateMistake);
  const deleteMistake = useStore((s) => s.deleteMistake);
  const addCheckin = useStore((s) => s.addCheckin);
  const circumstances = useCircumstances();
  const checkins = useCheckins();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSlip, setConfirmSlip] = useState(false);

  const history = useMemo(
    () => checkins.filter((c) => c.mistakeIds.includes(id)).sort((a, b) => (a.on < b.on ? 1 : -1)),
    [checkins, id],
  );

  if (!mistake || mistake.deletedAt) {
    return (
      <Screen back>
        <EmptyState icon="file-question-outline" title="Lesson not found" message="It may have been deleted." />
      </Screen>
    );
  }

  const meta = CATEGORY_META[mistake.category];
  const linked = circumstances.filter((c) => mistake.circumstanceIds.includes(c.id));
  const due = isDue(mistake.review, today);
  const nextIn = diffDays(today, mistake.review.nextReviewOn);

  return (
    <Screen
      back
      headerCompact
      right={
        <>
          <IconButton icon="pencil-outline" label="Edit" variant="tonal" size={40} onPress={() => router.push(`/mistake/new?id=${id}`)} />
          <IconButton icon="delete-outline" label="Delete" variant="tonal" size={40} onPress={() => setConfirmDelete(true)} />
        </>
      }
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="I slipped again" icon="repeat" variant="danger" onPress={() => setConfirmSlip(true)} style={{ flex: 1 }} fullWidth />
          {mistake.status === 'learned' ? (
            <Button label="Mark active" variant="outline" onPress={() => updateMistake(id, { status: 'active' })} style={{ flex: 1 }} fullWidth />
          ) : (
            <Button
              label="Learned it"
              icon="check-decagram-outline"
              onPress={() => {
                updateMistake(id, { status: 'learned' });
                toast('Marked as learned. Reviews will continue, just less often.', { icon: 'check-decagram-outline' });
              }}
              style={{ flex: 1 }}
              fullWidth
            />
          )}
        </View>
      }>
      <View style={{ gap: 20 }}>
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge label={meta.label} icon={meta.icon} tone="neutral" />
            <Badge label={formatDay(mistake.occurredOn, { withYear: true })} icon="calendar" tone="neutral" />
            {mistake.status === 'learned' ? <Badge label="Learned" tone="primary" icon="check" /> : null}
            {mistake.repeatCount > 0 ? <Badge label={`Repeated ${mistake.repeatCount}×`} tone="danger" icon="repeat" /> : null}
          </View>
          <Text variant="title">{mistake.title}</Text>
          <SeverityMeter value={mistake.severity} />
        </View>

        <Card variant="tonal" tone="primary" padding={18}>
          <View style={{ gap: 12 }}>
            <Text variant="overline" tone="primary">
              Your rule
            </Text>
            <Text variant="serif">
              If {mistake.solution.ifThen.if}, then {mistake.solution.ifThen.then}.
            </Text>
            {mistake.solution.summary ? (
              <Text variant="bodyStrong" tone="muted">
                {mistake.solution.summary}
              </Text>
            ) : null}
            {mistake.solution.steps.length ? (
              <View style={{ gap: 8 }}>
                {mistake.solution.steps.map((s, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primaryStrong, alignItems: 'center', justifyContent: 'center' }}>
                      <Text variant="caption" color={colors.onPrimary}>
                        {i + 1}
                      </Text>
                    </View>
                    <Text variant="body" style={{ flex: 1 }}>
                      {s}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {mistake.solution.dont ? (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: 10 }}>
                <Icon name="cancel" size={18} color={colors.danger} />
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {mistake.solution.dont}
                </Text>
              </View>
            ) : null}
          </View>
        </Card>

        {mistake.story || mistake.why ? (
          <Card>
            <View style={{ gap: 12 }}>
              {mistake.story ? (
                <View style={{ gap: 4 }}>
                  <Text variant="overline" tone="muted">
                    What happened
                  </Text>
                  <Text variant="body">{mistake.story}</Text>
                </View>
              ) : null}
              {mistake.why ? (
                <View style={{ gap: 4 }}>
                  <Text variant="overline" tone="muted">
                    Why
                  </Text>
                  <Text variant="body">{mistake.why}</Text>
                </View>
              ) : null}
              {mistake.emotions.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {mistake.emotions.map((e) => (
                    <Chip key={e} label={e} size="sm" tone="violet" />
                  ))}
                </View>
              ) : null}
            </View>
          </Card>
        ) : null}

        <View>
          <SectionHeader title="Circumstances" action="Manage" onAction={() => router.push('/circumstances')} />
          {linked.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {linked.map((c) => (
                <Chip key={c.id} label={c.name} dotColor={c.color} icon={c.location ? 'map-marker-outline' : c.schedule ? 'clock-outline' : undefined} onPress={() => router.push(`/circumstance/${c.id}`)} />
              ))}
            </View>
          ) : (
            <Text variant="body" tone="muted">
              Not linked yet. Link a time or place so the reminder arrives at the right moment.
            </Text>
          )}
        </View>

        <View>
          <SectionHeader title="Spaced review" />
          <Card>
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Review stage ${mistake.review.stage + 1} of ${REVIEW_INTERVALS.length}`}>
                {REVIEW_INTERVALS.map((d, i) => (
                  <View key={d} style={{ flex: 1, gap: 4, alignItems: 'center' }}>
                    <View style={{ height: 6, alignSelf: 'stretch', borderRadius: 3, backgroundColor: i <= mistake.review.stage ? colors.violet : colors.border }} />
                    <Text variant="caption" tone="subtle" style={{ fontSize: 10 }}>
                      {d}d
                    </Text>
                  </View>
                ))}
              </View>
              <Text variant="body">
                {due ? 'Due for review today.' : `Next review ${nextIn === 1 ? 'tomorrow' : `in ${nextIn} days`} (${formatDay(mistake.review.nextReviewOn)}).`}
              </Text>
              {due ? <Button label="Review now" icon="cards-outline" size="sm" variant="tonal" onPress={() => router.push('/review')} /> : null}
            </View>
          </Card>
        </View>

        <View>
          <SectionHeader title="History" />
          {history.length ? (
            <Card padding={8}>
              {history.map((c) => (
                <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }}>
                  <Icon name={c.outcome === 'avoided' ? 'shield-check-outline' : 'repeat'} size={20} color={c.outcome === 'avoided' ? colors.primary : colors.danger} />
                  <Text variant="body" style={{ flex: 1 }}>
                    {c.outcome === 'avoided' ? 'Avoided it' : 'Slipped'}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {formatDay(c.on, { withWeekday: true })}
                  </Text>
                </View>
              ))}
            </Card>
          ) : (
            <Text variant="body" tone="muted">
              No check-ins yet. When the moment comes, tap Check in on the Today screen.
            </Text>
          )}
        </View>
      </View>

      <Dialog
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        icon="delete-outline"
        tone="danger"
        title="Delete this lesson?"
        message="Its reminders and review schedule will stop. This can't be undone."
        confirmLabel="Delete"
        destructive
        cancelLabel="Keep it"
        onConfirm={() => {
          deleteMistake(id);
          router.back();
        }}
      />
      <Dialog
        visible={confirmSlip}
        onClose={() => setConfirmSlip(false)}
        icon="heart-outline"
        tone="violet"
        title="It happened again. That's okay."
        message="Recording it honestly is how you change it. Your review restarts tomorrow and today's prayer will focus on strength."
        confirmLabel="Record the slip"
        cancelLabel="Cancel"
        onConfirm={() => {
          addCheckin({ circumstanceId: null, mistakeIds: [id], outcome: 'repeated' });
          toast('Recorded. Tomorrow is a new chance.', { icon: 'heart-outline' });
        }}
      />
    </Screen>
  );
}
