import type { PrayerStyle } from '@/domain/types';

export const STYLE_OPTIONS: { value: PrayerStyle; label: string; description: string; icon: 'meditation' | 'weather-sunset-up' | 'hands-pray' }[] = [
  { value: 'secular', label: 'Secular affirmation', description: 'First-person purpose and pledge. No religious words.', icon: 'meditation' },
  { value: 'spiritual', label: 'Spiritual', description: 'Speaks to God or the Universe, without a specific religion.', icon: 'weather-sunset-up' },
  { value: 'faith', label: 'My faith', description: 'Addressed to whom you pray to, in your words.', icon: 'hands-pray' },
];
