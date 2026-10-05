import { useEffect, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

import { addMonths, diffDays, formatDay, MONTH_LONG, monthMatrix, parseDayKey, WEEKDAY_LETTER, WEEKDAY_LONG, weekdayOf } from '@/domain/dates';
import type { CellState, DayProgress, HabitDayCell } from '@/domain/progress';
import type { DayKey } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

/*
 * Data-viz components. Rules (dataviz method):
 *  - Rings and bars are meters: the fill carries the value, the track is a quiet step of the
 *    same teal ramp; "rest" days use a neutral track and say "Rest" in text.
 *  - Numbers and labels always use text tokens, never the mark color.
 *  - State is never color-only: done = check icon, missed = ✕ icon, legend with labels.
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const isWeb = Platform.OS === 'web';

export function ProgressRing({
  progress,
  size = 56,
  stroke = 6,
  color,
  trackColor,
  children,
  accessibilityLabel,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  children?: ReactNode;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const p = useSharedValue(isWeb ? clamped : 0);
  useEffect(() => {
    p.set(withTiming(clamped, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [clamped, p]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));
  const fill = color ?? colors.primary;

  return (
    <View style={{ width: size, height: size }} accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor ?? colors.track} strokeWidth={stroke} fill="none" />
          {clamped > 0 ? (
            isWeb ? (
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={fill}
                strokeWidth={stroke}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${c} ${c}`}
                strokeDashoffset={c * (1 - clamped)}
              />
            ) : (
              <AnimatedCircle
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={fill}
                strokeWidth={stroke}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${c} ${c}`}
                animatedProps={animatedProps}
              />
            )
          ) : null}
        </G>
      </Svg>
      {children ? <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View> : null}
    </View>
  );
}

/** The dashboard's rolling last-7-days rings (6 days ago … today). */
export function Last7DaysRings({
  days,
  onPressDay,
  size = 42,
}: {
  days: DayProgress[];
  onPressDay?: (day: DayKey) => void;
  size?: number;
}) {
  const { colors, radius } = useTheme();
  return (
    <View style={styles.ringsRow}>
      {days.map((d) => {
        const label = d.isRest
          ? `${d.label}: rest day, nothing planned`
          : `${d.label}: ${d.done} of ${d.planned} habits done`;
        return (
          <PressableScale
            key={d.day}
            onPress={onPressDay ? () => onPressDay(d.day) : undefined}
            disabled={!onPressDay}
            accessibilityRole="button"
            accessibilityLabel={label}
            activeScale={0.92}
            style={styles.ringCol}>
            <ProgressRing
              progress={d.ratio}
              size={size}
              stroke={d.isToday ? 5 : 4}
              trackColor={d.isRest ? colors.rest : colors.track}>
              {d.isRest ? (
                <Text variant="caption" tone="subtle" style={{ fontSize: 10 }}>
                  Rest
                </Text>
              ) : (
                <Text variant="caption" style={{ fontSize: 11, letterSpacing: -0.2 }}>
                  {d.done}/{d.planned}
                </Text>
              )}
            </ProgressRing>
            <View
              style={[
                styles.dayLabel,
                d.isToday ? { backgroundColor: colors.primarySoft, borderRadius: radius.pill } : null,
              ]}>
              <Text variant="caption" tone={d.isToday ? 'primary' : 'muted'} style={{ fontSize: 11 }} numberOfLines={1}>
                {d.label}
              </Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

const CELL_ICON: Record<CellState, IconName | null> = {
  done: 'check-bold',
  missed: 'close',
  pending: null,
  skipped: 'minus',
  rest: null,
};

/** One habit's last 7 days as cells. */
export function WeekStrip({ cells, color }: { cells: HabitDayCell[]; color?: string }) {
  const { colors } = useTheme();
  const fill = color ?? colors.primary;
  return (
    <View style={styles.ringsRow}>
      {cells.map((cell) => {
        const look: Record<CellState, { bg: string; border: string; icon: string }> = {
          done: { bg: fill, border: fill, icon: '#0B0E1A' },
          missed: { bg: 'transparent', border: colors.danger, icon: colors.danger },
          pending: { bg: 'transparent', border: fill, icon: fill },
          skipped: { bg: colors.surfaceRaised, border: colors.border, icon: colors.textMuted },
          rest: { bg: 'transparent', border: 'transparent', icon: colors.textSubtle },
        };
        const l = look[cell.state];
        const stateText = { done: 'done', missed: 'missed', pending: 'planned', skipped: 'skipped', rest: 'not planned' }[cell.state];
        const icon = CELL_ICON[cell.state];
        return (
          <View key={cell.day} style={styles.ringCol} accessibilityLabel={`${cell.label}: ${stateText}`}>
            <View style={[styles.cell, { backgroundColor: l.bg, borderColor: l.border }]}>
              {icon ? <Icon name={icon} size={15} color={l.icon} /> : cell.state === 'rest' ? <View style={[styles.restDot, { backgroundColor: colors.rest }]} /> : null}
            </View>
            <Text variant="caption" tone="muted" style={{ fontSize: 11 }}>
              {cell.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export type CalendarMark = 'done' | 'missed' | 'planned' | 'skipped';

/** Month calendar of completed days (habit viewer, date picker style). */
export function MonthCalendar({
  marks,
  today,
  weekStartsOn = 1,
  minMonth,
  color,
  initial,
}: {
  marks: Map<DayKey, CalendarMark>;
  today: DayKey;
  weekStartsOn?: 0 | 1;
  /** Earliest month viewable (free tier history limit). */
  minMonth?: { year: number; month: number };
  color?: string;
  initial?: { year: number; month: number };
}) {
  const { colors } = useTheme();
  const t = parseDayKey(today);
  const [cursor, setCursor] = useState(initial ?? { year: t.year, month: t.month });
  const rows = monthMatrix(cursor.year, cursor.month, weekStartsOn);
  const fill = color ?? colors.primary;
  const atMin = !!minMonth && cursor.year * 12 + cursor.month <= minMonth.year * 12 + minMonth.month;
  const atMax = cursor.year * 12 + cursor.month >= t.year * 12 + t.month + 1;
  const letters = weekStartsOn === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  const doneCount = [...marks.entries()].filter(([d, m]) => m === 'done' && d.startsWith(`${cursor.year}-${String(cursor.month).padStart(2, '0')}`)).length;

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.calHeader}>
        <IconButton icon="chevron-left" label="Previous month" size={36} disabled={atMin} onPress={() => setCursor(addMonths(cursor.year, cursor.month, -1))} />
        <View style={{ alignItems: 'center' }}>
          <Text variant="bodyStrong">
            {MONTH_LONG[cursor.month - 1]} {cursor.year}
          </Text>
          <Text variant="caption" tone="muted">
            {doneCount} day{doneCount === 1 ? '' : 's'} completed
          </Text>
        </View>
        <IconButton icon="chevron-right" label="Next month" size={36} disabled={atMax} onPress={() => setCursor(addMonths(cursor.year, cursor.month, 1))} />
      </View>
      <View style={styles.calRow}>
        {letters.map((d, i) => (
          <View key={i} style={styles.calCell}>
            <Text variant="caption" tone="subtle">
              {WEEKDAY_LETTER[d]}
            </Text>
          </View>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.calRow}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={styles.calCell} />;
            const mark = marks.get(day);
            const isToday = day === today;
            const future = diffDays(today, day) > 0;
            const n = parseDayKey(day).day;
            const stateText = mark ?? (future ? 'nothing planned' : 'not planned');
            return (
              <View key={ci} style={styles.calCell} accessibilityLabel={`${WEEKDAY_LONG[weekdayOf(day)]} ${formatDay(day)}: ${stateText}`}>
                <View
                  style={[
                    styles.calDay,
                    mark === 'done' && { backgroundColor: fill },
                    mark === 'planned' && { borderWidth: 1.5, borderColor: fill },
                    isToday && mark !== 'done' && { borderWidth: 1.5, borderColor: colors.text },
                  ]}>
                  <Text
                    variant="caption"
                    color={mark === 'done' ? '#0B0E1A' : future ? colors.textSubtle : colors.text}
                    style={{ fontSize: 12 }}>
                    {n}
                  </Text>
                </View>
                {mark === 'missed' ? <Icon name="close" size={10} color={colors.danger} /> : <View style={{ height: 10 }} />}
              </View>
            );
          })}
        </View>
      ))}
      <View style={styles.legend}>
        <LegendItem swatch={<View style={[styles.legendDot, { backgroundColor: fill }]} />} label="Done" />
        <LegendItem swatch={<View style={[styles.legendDot, { borderWidth: 1.5, borderColor: fill }]} />} label="Planned" />
        <LegendItem swatch={<Icon name="close" size={12} color={colors.danger} />} label="Missed" />
      </View>
    </View>
  );
}

function LegendItem({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {swatch}
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

export function ProgressBar({ progress, color, height = 8 }: { progress: number; color?: string; height?: number }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const w = useSharedValue(0);
  const clamped = Math.max(0, Math.min(1, progress));
  useEffect(() => {
    w.set(withTiming(clamped * width, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, [clamped, width, w]);
  const style = useAnimatedStyle(() => ({ width: w.value }));
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ height, borderRadius: height / 2, backgroundColor: colors.track, overflow: 'hidden' }}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color ?? colors.primary }, style]} />
    </View>
  );
}

/** Stat tile: label · value (sans, proportional digits) · optional delta vs a named period. */
export function StatTile({
  label,
  value,
  icon,
  iconColor,
  delta,
  deltaLabel,
  upIsGood = true,
  style,
}: {
  style?: StyleProp<ViewStyle>;
  label: string;
  value: string;
  icon?: IconName;
  iconColor?: string;
  delta?: number;
  deltaLabel?: string;
  upIsGood?: boolean;
}) {
  const { colors, radius } = useTheme();
  const hasDelta = typeof delta === 'number' && delta !== 0;
  const good = hasDelta && (delta! > 0) === upIsGood;
  return (
    <View style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon ? <Icon name={icon} size={16} color={iconColor ?? colors.textMuted} /> : null}
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text variant="number">{value}</Text>
      {hasDelta ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name={delta! > 0 ? 'arrow-up' : 'arrow-down'} size={14} color={good ? colors.primary : colors.danger} />
          <Text variant="caption" tone="muted">
            {`${delta! > 0 ? '+' : ''}${delta}${deltaLabel ? ` ${deltaLabel}` : ''}`}
          </Text>
        </View>
      ) : deltaLabel ? (
        <Text variant="caption" tone="subtle">
          {deltaLabel}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Single-series column chart (e.g. 4 weeks of completion %). Columns ≤24px, 4px rounded tops,
 * square at the baseline, hairline solid gridlines, the latest value labelled on its cap;
 * every value is also listed beneath the chart (the table twin).
 */
export function ColumnChart({
  data,
  height = 140,
  format = (v) => `${Math.round(v * 100)}%`,
}: {
  data: { label: string; value: number; detail?: string }[];
  height?: number;
  format?: (v: number) => string;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const top = 22;
  const plotH = height - top;
  const band = width / Math.max(1, data.length);
  const barW = Math.min(24, band * 0.5);
  const r = 4;

  return (
    <View style={{ gap: 8 }}>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {[0, 0.5, 1].map((g) => (
              <Line key={g} x1={0} x2={width} y1={top + plotH * (1 - g)} y2={top + plotH * (1 - g)} stroke={colors.border} strokeWidth={1} />
            ))}
            {data.map((d, i) => {
              const h = Math.max(0, Math.min(1, d.value)) * plotH;
              const x = band * i + (band - barW) / 2;
              const y = top + plotH - h;
              const rr = Math.min(r, h);
              const path =
                h <= 0
                  ? ''
                  : `M${x},${top + plotH} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + barW - rr},${y} Q${x + barW},${y} ${x + barW},${y + rr} L${x + barW},${top + plotH} Z`;
              const isLast = i === data.length - 1;
              return <Path key={i} d={path} fill={isLast || selected === i ? colors.primary : colors.track} />;
            })}
          </Svg>
        ) : null}
        {width > 0
          ? data.map((d, i) => {
              const h = Math.max(0, Math.min(1, d.value)) * plotH;
              const showLabel = i === data.length - 1 || selected === i;
              return (
                <PressableScale
                  key={i}
                  onPress={() => setSelected(selected === i ? null : i)}
                  accessibilityRole="button"
                  accessibilityLabel={`${d.label}: ${format(d.value)}${d.detail ? `, ${d.detail}` : ''}`}
                  style={{ position: 'absolute', left: band * i, width: band, top: 0, height }}>
                  {showLabel ? (
                    <View style={{ position: 'absolute', top: top + plotH - h - 20, width: band, alignItems: 'center' }}>
                      <Text variant="caption">{format(d.value)}</Text>
                    </View>
                  ) : null}
                </PressableScale>
              );
            })
          : null}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {data.map((d, i) => (
          <Text key={i} variant="caption" tone="muted" align="center" style={{ flex: 1 }} numberOfLines={1}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  ringsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  ringCol: { alignItems: 'center', gap: 6, minWidth: 40 },
  dayLabel: { paddingHorizontal: 6, paddingVertical: 1 },
  cell: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  restDot: { width: 6, height: 6, borderRadius: 3 },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calRow: { flexDirection: 'row' },
  calCell: { flex: 1, alignItems: 'center', gap: 1 },
  calDay: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 2 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  tile: { padding: 14, gap: 4, borderWidth: 1 },
});
