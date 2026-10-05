import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AdBanner } from '@/components/AdBanner';
import { formatLimit } from '@/domain/entitlements';
import { lessonStats } from '@/domain/insights';
import { dueLessons } from '@/domain/review';
import { MISTAKE_CATEGORIES, type MistakeCategory } from '@/domain/types';
import { CATEGORY_META, MistakeCard } from '@/features/lessons/MistakeCard';
import { useCheckins, useCircumstances, useMistakes, usePlanInfo, useToday } from '@/store/hooks';
import { Banner, Card, Chip, EmptyState, IconButton, Screen, StatTile, Text, TextField } from '@/ui';

type Filter = 'all' | 'active' | 'learned' | MistakeCategory;

export default function LessonsScreen() {
  const today = useToday();
  const mistakes = useMistakes();
  const circumstances = useCircumstances();
  const checkins = useCheckins();
  const { tier, limits } = usePlanInfo();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const due = useMemo(() => dueLessons(mistakes, today), [mistakes, today]);
  const stats = useMemo(() => lessonStats(checkins, today), [checkins, today]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mistakes
      .filter((m) => m.status !== 'archived')
      .filter((m) =>
        filter === 'all' ? true : filter === 'active' ? m.status === 'active' : filter === 'learned' ? m.status === 'learned' : m.category === filter,
      )
      .filter(
        (m) =>
          !q ||
          [m.title, m.story, m.why, m.solution.summary, m.solution.ifThen.if, m.solution.ifThen.then].some((t) => t.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [mistakes, query, filter]);

  const usedCategories = MISTAKE_CATEGORIES.filter((c) => mistakes.some((m) => m.category === c));

  return (
    <Screen
      tabBar
      title="Lessons"
      subtitle="Mistakes turned into rules you live by."
      right={
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <IconButton icon="map-marker-radius-outline" label="Circumstances and places" variant="tonal" onPress={() => router.push('/circumstances')} />
          <IconButton icon="plus" label="Record a mistake" variant="filled" onPress={() => router.push('/mistake/new')} />
        </View>
      }>
      <View style={{ gap: 16 }}>
        {due.length > 0 ? (
          <Banner
            tone="violet"
            icon="cards-outline"
            title={`${due.length} lesson${due.length > 1 ? 's' : ''} to review`}
            message="Spaced review keeps a lesson alive: 1, 3, 7, 14, 30, 60 and 120 days."
            action="Start review"
            onAction={() => router.push('/review')}
          />
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatTile style={{ flex: 1 }} label="Avoided · 30d" value={String(stats.avoided)} icon="shield-check-outline" />
          <StatTile style={{ flex: 1 }} label="Slips · 30d" value={String(stats.repeated)} icon="repeat" />
        </View>
        <StatTile
          label="Days since last slip"
          value={stats.daysSinceRepeat === null ? '–' : String(stats.daysSinceRepeat)}
          icon="calendar-heart"
          deltaLabel={stats.daysSinceRepeat === null ? 'No slips recorded. Keep going.' : 'Every day counts.'}
        />

        <TextField icon="magnify" placeholder="Search lessons" value={query} onChangeText={setQuery} returnKeyType="search" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(['all', 'active', 'learned'] as Filter[]).map((f) => (
            <Chip key={f} label={f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Learned'} selected={filter === f} onPress={() => setFilter(f)} />
          ))}
          {usedCategories.map((c) => (
            <Chip key={c} label={CATEGORY_META[c].label} icon={CATEGORY_META[c].icon} selected={filter === c} onPress={() => setFilter(filter === c ? 'all' : c)} />
          ))}
        </ScrollView>

        {tier === 'free' ? (
          <Text variant="caption" tone="muted">
            {mistakes.length} of {formatLimit(limits.mistakes)} lessons on the free plan
          </Text>
        ) : null}

        {mistakes.length === 0 ? (
          <Card>
            <EmptyState
              icon="lightbulb-on-outline"
              title="Every mistake holds a lesson"
              message="Write what happened, why, and what you'll do instead. We'll remind you at the moments that matter."
              action="Record a mistake"
              onAction={() => router.push('/mistake/new')}
            />
          </Card>
        ) : visible.length === 0 ? (
          <Text variant="body" tone="muted" align="center" style={{ paddingVertical: 24 }}>
            No lessons match “{query}”.
          </Text>
        ) : (
          <View style={{ gap: 12 }}>
            {visible.map((m) => (
              <MistakeCard key={m.id} mistake={m} circumstances={circumstances} />
            ))}
          </View>
        )}

        <AdBanner />
      </View>
    </Screen>
  );
}
