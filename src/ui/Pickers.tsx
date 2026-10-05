import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  addMonths,
  daysInMonth,
  diffDays,
  formatDay,
  formatTime,
  isValidDate,
  makeDayKey,
  MONTH_LONG,
  monthMatrix,
  parseDayKey,
  toDayKey,
  WEEKDAY_LETTER,
} from '@/domain/dates';
import type { DayKey, TimeOfDay } from '@/domain/types';
import { haptics } from '@/services/haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';
import { BottomSheet } from './Overlays';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

/** Field-looking button that opens a sheet. */
function FieldButton({
  label,
  value,
  placeholder,
  icon,
  onPress,
  error,
}: {
  label?: string;
  value?: string;
  placeholder: string;
  icon: IconName;
  onPress: () => void;
  error?: string;
}) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text variant="label" tone="muted">
          {label}
        </Text>
      ) : null}
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? placeholder}: ${value ?? 'not set'}`}
        activeScale={0.99}
        style={[
          styles.field,
          { borderRadius: radius.lg, backgroundColor: colors.surfaceSunken, borderColor: error ? colors.danger : colors.border },
        ]}>
        <Icon name={icon} size={20} color={colors.textSubtle} />
        <Text variant="body" tone={value ? 'default' : 'subtle'} style={{ flex: 1 }} numberOfLines={1}>
          {value ?? placeholder}
        </Text>
        <Icon name="chevron-down" size={20} color={colors.textSubtle} />
      </PressableScale>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/* ---------------------------------------------------------------------------------------------
 * Select
 * -------------------------------------------------------------------------------------------*/

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: IconName;
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose…',
  icon = 'format-list-bulleted',
}: {
  label?: string;
  value: T | null;
  options: SelectOption<T>[];
  onChange: (v: T) => void;
  placeholder?: string;
  icon?: IconName;
}) {
  const { colors, radius } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <FieldButton label={label} value={current?.label} placeholder={placeholder} icon={current?.icon ?? icon} onPress={() => setOpen(true)} />
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label ?? placeholder}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <PressableScale
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => {
                haptics.tap();
                onChange(o.value);
                setOpen(false);
              }}
              style={[styles.option, { borderRadius: radius.md, backgroundColor: active ? colors.primarySoft : 'transparent' }]}>
              {o.icon ? <Icon name={o.icon} size={20} color={active ? colors.primaryStrong : colors.textMuted} /> : null}
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{o.label}</Text>
                {o.description ? (
                  <Text variant="caption" tone="muted">
                    {o.description}
                  </Text>
                ) : null}
              </View>
              {active ? <Icon name="check" size={20} color={colors.primaryStrong} /> : null}
            </PressableScale>
          );
        })}
      </BottomSheet>
    </>
  );
}

/* ---------------------------------------------------------------------------------------------
 * Date picker: a calendar grid, so only real dates can be chosen (29 Feb only in leap years).
 * -------------------------------------------------------------------------------------------*/

export function DateField({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = 'Pick a date',
  helper,
}: {
  label?: string;
  value: DayKey | null;
  onChange: (d: DayKey) => void;
  minDate?: DayKey;
  maxDate?: DayKey;
  placeholder?: string;
  helper?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <FieldButton
        label={label}
        value={value ? formatDay(value, { withYear: true, withWeekday: true }) : undefined}
        placeholder={placeholder}
        icon="calendar-month-outline"
        onPress={() => setOpen(true)}
      />
      {helper ? (
        <Text variant="caption" tone="muted">
          {helper}
        </Text>
      ) : null}
      <DatePickerSheet
        visible={open}
        onClose={() => setOpen(false)}
        value={value}
        minDate={minDate}
        maxDate={maxDate}
        title={label ?? 'Pick a date'}
        onConfirm={(d) => {
          onChange(d);
          setOpen(false);
        }}
      />
    </View>
  );
}

export function DatePickerSheet({
  visible,
  onClose,
  value,
  onConfirm,
  minDate,
  maxDate,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  value: DayKey | null;
  onConfirm: (d: DayKey) => void;
  minDate?: DayKey;
  maxDate?: DayKey;
  title: string;
}) {
  const { colors } = useTheme();
  const today = toDayKey();
  const start = parseDayKey(value ?? today);
  const [cursor, setCursor] = useState({ year: start.year, month: start.month });
  const [selected, setSelected] = useState<DayKey | null>(value);
  const rows = monthMatrix(cursor.year, cursor.month, 1);
  const allowed = (d: DayKey) => (!minDate || diffDays(minDate, d) >= 0) && (!maxDate || diffDays(d, maxDate) >= 0);

  const jumpYear = (delta: number) => {
    const year = cursor.year + delta;
    setCursor({ year, month: cursor.month });
    if (selected) {
      const s = parseDayKey(selected);
      // Keep the same day when it exists in the new year; 29 Feb falls back to 28 Feb.
      const day = isValidDate(year, s.month, s.day) ? s.day : daysInMonth(year, s.month);
      if (s.month === cursor.month) setSelected(makeDayKey(year, s.month, day));
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={selected ? formatDay(selected, { withYear: true, withWeekday: true }) : 'Only real calendar dates can be picked'}
      footer={<Button label="Set date" fullWidth disabled={!selected} onPress={() => selected && onConfirm(selected)} />}>
      <View style={styles.calHeader}>
        <IconButton icon="chevron-double-left" label="Previous year" size={36} onPress={() => jumpYear(-1)} />
        <IconButton icon="chevron-left" label="Previous month" size={36} onPress={() => setCursor(addMonths(cursor.year, cursor.month, -1))} />
        <Text variant="bodyStrong" style={{ flex: 1, textAlign: 'center' }}>
          {MONTH_LONG[cursor.month - 1]} {cursor.year}
        </Text>
        <IconButton icon="chevron-right" label="Next month" size={36} onPress={() => setCursor(addMonths(cursor.year, cursor.month, 1))} />
        <IconButton icon="chevron-double-right" label="Next year" size={36} onPress={() => jumpYear(1)} />
      </View>
      <View style={styles.row}>
        {[1, 2, 3, 4, 5, 6, 0].map((d, i) => (
          <View key={i} style={styles.cell}>
            <Text variant="caption" tone="subtle">
              {WEEKDAY_LETTER[d]}
            </Text>
          </View>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={styles.cell} />;
            const ok = allowed(day);
            const active = day === selected;
            const isToday = day === today;
            return (
              <PressableScale
                key={ci}
                disabled={!ok}
                onPress={() => {
                  haptics.tap();
                  setSelected(day);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: !ok }}
                accessibilityLabel={formatDay(day, { withYear: true, withWeekday: true })}
                style={styles.cell}>
                <View
                  style={[
                    styles.day,
                    active && { backgroundColor: colors.primaryStrong },
                    isToday && !active && { borderWidth: 1.5, borderColor: colors.primary },
                  ]}>
                  <Text variant="label" color={active ? colors.onPrimary : ok ? colors.text : colors.textSubtle}>
                    {parseDayKey(day).day}
                  </Text>
                </View>
              </PressableScale>
            );
          })}
        </View>
      ))}
    </BottomSheet>
  );
}

/* ---------------------------------------------------------------------------------------------
 * Time picker: hour grid + minute chips (5-minute steps).
 * -------------------------------------------------------------------------------------------*/

export function TimeField({
  label,
  value,
  onChange,
  placeholder = 'Pick a time',
}: {
  label?: string;
  value: TimeOfDay | null;
  onChange: (t: TimeOfDay) => void;
  placeholder?: string;
}) {
  const { colors, radius } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TimeOfDay>(value ?? { hour: 9, minute: 0 });
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const cell = (on: boolean) => ({
    backgroundColor: on ? colors.primaryStrong : colors.surfaceSunken,
    borderColor: on ? colors.primaryStrong : colors.border,
    borderRadius: radius.md,
  });
  return (
    <>
      <FieldButton
        label={label}
        value={value ? formatTime(value) : undefined}
        placeholder={placeholder}
        icon="clock-outline"
        onPress={() => {
          setDraft(value ?? { hour: 9, minute: 0 });
          setOpen(true);
        }}
      />
      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label ?? 'Pick a time'}
        subtitle={formatTime(draft)}
        footer={
          <Button
            label="Set time"
            fullWidth
            onPress={() => {
              onChange(draft);
              setOpen(false);
            }}
          />
        }>
        <Text variant="overline" tone="muted">
          Hour
        </Text>
        <View style={styles.grid}>
          {Array.from({ length: 24 }, (_, h) => (
            <PressableScale
              key={h}
              onPress={() => setDraft({ ...draft, hour: h })}
              accessibilityRole="button"
              accessibilityState={{ selected: draft.hour === h }}
              accessibilityLabel={formatTime({ hour: h, minute: 0 })}
              style={[styles.timeCell, cell(draft.hour === h)]}>
              <Text variant="label" color={draft.hour === h ? colors.onPrimary : colors.text}>
                {formatTime({ hour: h, minute: 0 }).replace(':00', '')}
              </Text>
            </PressableScale>
          ))}
        </View>
        <Text variant="overline" tone="muted" style={{ marginTop: 8 }}>
          Minute
        </Text>
        <View style={styles.grid}>
          {minutes.map((m) => (
            <PressableScale
              key={m}
              onPress={() => setDraft({ ...draft, minute: m })}
              accessibilityRole="button"
              accessibilityState={{ selected: draft.minute === m }}
              accessibilityLabel={`${m} minutes`}
              style={[styles.timeCell, cell(draft.minute === m)]}>
              <Text variant="label" color={draft.minute === m ? colors.onPrimary : colors.text}>
                :{String(m).padStart(2, '0')}
              </Text>
            </PressableScale>
          ))}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 14, borderWidth: 1.5 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  calHeader: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 4 },
  row: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeCell: { width: '22%', height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
