import type { GoalCategory } from '@/domain/types';
import type { IconName } from '@/ui';

export const GOAL_META: Record<GoalCategory, { label: string; icon: IconName }> = {
  money: { label: 'Money', icon: 'cash-multiple' },
  health: { label: 'Health', icon: 'heart-pulse' },
  career: { label: 'Career', icon: 'briefcase-outline' },
  relationships: { label: 'Relationships', icon: 'account-heart-outline' },
  mind: { label: 'Mind', icon: 'brain' },
  other: { label: 'Other', icon: 'star-outline' },
};
