import { formatTime, WEEKDAY_SHORT } from '@/domain/dates';
import type { Circumstance } from '@/domain/types';

export function scheduleSummary(c: Circumstance): string | null {
  if (!c.schedule) return null;
  const days = c.schedule.weekdays.length === 0 || c.schedule.weekdays.length === 7 ? 'Every day' : c.schedule.weekdays.map((d) => WEEKDAY_SHORT[d]).join(', ');
  return `${days} · ${formatTime(c.schedule.time)}`;
}

export function locationSummary(c: Circumstance): string | null {
  if (!c.location) return null;
  const when = [c.location.notifyOnEnter ? 'arriving' : null, c.location.notifyOnExit ? 'leaving' : null].filter(Boolean).join(' & ');
  return `Within ${c.location.radiusM} m of ${c.location.label || 'a place'} · when ${when || 'nearby'}`;
}
