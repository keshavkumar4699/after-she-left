import type { Prayer } from '@/domain/types';

/** How each prayer source is labelled on the prayer screen. */
export const SOURCE_LABELS: Record<Prayer['source'], string> = {
  'on-device': 'Written on your phone',
  ai: 'Written for you',
  template: 'From your lessons',
};

export const isAiWritten = (source: Prayer['source']) => source !== 'template';
