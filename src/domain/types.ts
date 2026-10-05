/**
 * Core domain model. Everything in `src/domain` is pure TypeScript (no React Native imports)
 * so it can be unit-tested and shared with the Cloud Functions.
 */

export type ID = string;
/** Local calendar day, `YYYY-MM-DD`. */
export type DayKey = string;
/** Epoch milliseconds. */
export type Timestamp = number;

export interface Entity {
  id: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Soft delete (tombstone) so deletions can sync across devices. */
  deletedAt?: Timestamp | null;
}

export interface TimeOfDay {
  hour: number;
  minute: number;
}

/* ----------------------------------------------------------------------------------------------
 * Lessons: mistakes, solutions, circumstances, check-ins
 * --------------------------------------------------------------------------------------------*/

export type Severity = 1 | 2 | 3 | 4 | 5;

export const MISTAKE_CATEGORIES = [
  'relationships',
  'money',
  'health',
  'work',
  'habits',
  'communication',
  'self',
  'other',
] as const;
export type MistakeCategory = (typeof MISTAKE_CATEGORIES)[number];

export type MistakeStatus = 'active' | 'learned' | 'archived';

export interface IfThenRule {
  if: string;
  then: string;
}

export interface Solution {
  summary: string;
  steps: string[];
  ifThen: IfThenRule;
  /** One line: what I will not do again. Feeds the prayer's "not today" list. */
  dont: string;
}

export interface ReviewState {
  /** Index into the spaced-review interval table. */
  stage: number;
  nextReviewOn: DayKey;
  lastReviewedOn?: DayKey | null;
  lapses: number;
}

export interface Mistake extends Entity {
  title: string;
  story: string;
  why: string;
  occurredOn: DayKey;
  category: MistakeCategory;
  severity: Severity;
  emotions: string[];
  solution: Solution;
  circumstanceIds: ID[];
  status: MistakeStatus;
  repeatCount: number;
  lastRepeatedOn?: DayKey | null;
  review: ReviewState;
  /** Paused by a free-tier downgrade: kept, read-only, not reminded. */
  paused?: boolean;
}

export interface CircumstanceSchedule {
  /** 0 = Sunday … 6 = Saturday. Empty = every day. */
  weekdays: number[];
  time: TimeOfDay;
}

export interface CircumstanceLocation {
  latitude: number;
  longitude: number;
  radiusM: number;
  label: string;
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
}

export interface Circumstance extends Entity {
  name: string;
  icon: string;
  color: string;
  schedule?: CircumstanceSchedule | null;
  location?: CircumstanceLocation | null;
  /** Minimum minutes between two location reminders. */
  cooldownMin: number;
  paused?: boolean;
}

export type CheckinOutcome = 'avoided' | 'repeated';

export interface Checkin extends Entity {
  circumstanceId?: ID | null;
  mistakeIds: ID[];
  outcome: CheckinOutcome;
  note?: string;
  on: DayKey;
}

/* ----------------------------------------------------------------------------------------------
 * Goals
 * --------------------------------------------------------------------------------------------*/

export const GOAL_CATEGORIES = ['money', 'health', 'career', 'relationships', 'mind', 'other'] as const;
export type GoalCategory = (typeof GOAL_CATEGORIES)[number];
export type GoalStatus = 'active' | 'achieved' | 'paused';

export interface Milestone {
  id: ID;
  title: string;
  dueOn?: DayKey | null;
  done: boolean;
}

export interface Goal extends Entity {
  title: string;
  /** Written as if it already happened: "It is 28 Feb 2027. I am financially free…" */
  affirmation: string;
  /** How I will know it is done (measurable). */
  measure: string;
  targetDate: DayKey;
  targetTime?: TimeOfDay | null;
  place: string;
  why: string;
  category: GoalCategory;
  milestones: Milestone[];
  habitIds: ID[];
  status: GoalStatus;
}

/* ----------------------------------------------------------------------------------------------
 * Habits (Atomic Habits)
 * --------------------------------------------------------------------------------------------*/

export type TimeWindow = 'anytime' | 'morning' | 'afternoon' | 'evening';
export type Difficulty = 'easy' | 'right' | 'hard';
export type HabitStatus = 'active' | 'paused' | 'archived';

export interface Habit extends Entity {
  name: string;
  emoji: string;
  color: string;
  /** Identity-based habit: "I am someone who…" */
  identity: string;
  /** Two-minute version (Make it easy). */
  twoMinute: string;
  /** Full version for when the habit is established. */
  full: string;
  level: number;
  /** Times per week. Timing is flexible; following the habit matters more. */
  weeklyTarget: number;
  /** Preferred weekdays (0 = Sunday). Empty = no preference. */
  preferredDays: number[];
  timeWindow: TimeWindow;
  /** Implementation intention: I will [behavior] at [when] in [where]. */
  intention: { behavior: string; when: string; where: string };
  /** Habit stacking: "After I [anchor], I will …" */
  stackAfter: string;
  /** Make it satisfying. */
  reward: string;
  /** Temptation bundling (Make it attractive). */
  bundle: string;
  /** Hard habits are spread out by the planner (no back-to-back days). */
  hard: boolean;
  status: HabitStatus;
  goalId?: ID | null;
  order: number;
}

export type HabitLogStatus = 'planned' | 'done' | 'skipped';

export interface HabitLog {
  /** `${habitId}_${day}`: deterministic for idempotent writes. */
  id: string;
  habitId: ID;
  day: DayKey;
  status: HabitLogStatus;
  completedAt?: Timestamp | null;
  difficulty?: Difficulty | null;
  note?: string;
  updatedAt: Timestamp;
  deletedAt?: Timestamp | null;
}

/* ----------------------------------------------------------------------------------------------
 * Daily prayer
 * --------------------------------------------------------------------------------------------*/

export type PrayerStyle = 'secular' | 'spiritual' | 'faith';
export type FocusTheme = 'resist' | 'discipline' | 'forgiveness' | 'courage' | 'purpose' | 'gratitude';
export type Mood = 'calm' | 'low' | 'anxious' | 'lonely' | 'angry' | 'motivated';

export interface PrayerContent {
  title: string;
  text: string;
  purposeLine: string;
  dontDoToday: string[];
  nudges: string[];
  theme: FocusTheme;
}

export interface Prayer extends PrayerContent {
  id: DayKey;
  day: DayKey;
  source: 'ai' | 'template';
  saved: boolean;
  helped?: boolean | null;
  mood?: Mood | null;
  regenerations: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp | null;
}

/* ----------------------------------------------------------------------------------------------
 * Plan / pricing
 * --------------------------------------------------------------------------------------------*/

export type PlanTier = 'trial' | 'premium' | 'free';

export interface PlanState {
  tier: PlanTier;
  trialStartedAt: Timestamp;
  trialEndsAt: Timestamp;
  premiumUntil?: Timestamp | null;
  /** Where the plan came from: local device clock or the server (webhook / auth trigger). */
  source: 'local' | 'server';
}
