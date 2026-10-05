import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { haptics } from '@/services/haptics';
import { WEEKDAY_LETTER, WEEKDAY_LONG } from '@/domain/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

/* ---------------------------------------------------------------------------------------------
 * Form controls: TextField, SegmentedControl, Switch, Checkbox, RadioGroup, RatingPills,
 * Counter, WeekdayPicker, SwatchPicker, EmojiPicker, Stepper (wizard progress).
 * -------------------------------------------------------------------------------------------*/

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  helper?: string;
  error?: string;
  icon?: IconName;
  maxLength?: number;
  showCounter?: boolean;
}

export function TextField({ label, helper, error, icon, maxLength, showCounter, multiline, value, onFocus, onBlur, ...rest }: TextFieldProps) {
  const { colors, radius, type } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text variant="label" tone="muted">
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          {
            borderColor,
            borderRadius: radius.lg,
            backgroundColor: colors.surfaceSunken,
            minHeight: multiline ? 96 : 52,
            alignItems: multiline ? 'flex-start' : 'center',
          },
        ]}>
        {icon ? <Icon name={icon} size={20} color={focused ? colors.primary : colors.textSubtle} /> : null}
        <TextInput
          {...rest}
          value={value}
          multiline={multiline}
          maxLength={maxLength}
          accessibilityLabel={label ?? rest.placeholder}
          placeholderTextColor={colors.textSubtle}
          selectionColor={colors.primary}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            type.body,
            {
              flex: 1,
              color: colors.text,
              paddingVertical: multiline ? 12 : 0,
              textAlignVertical: multiline ? 'top' : 'center',
              minHeight: multiline ? 72 : 48,
              outlineStyle: 'none',
            } as object,
          ]}
        />
      </View>
      {error || helper || (showCounter && maxLength) ? (
        <View style={styles.helperRow}>
          <Text variant="caption" tone={error ? 'danger' : 'muted'} style={{ flex: 1 }}>
            {error ?? helper ?? ''}
          </Text>
          {showCounter && maxLength ? (
            <Text variant="caption" tone="subtle">
              {(value ?? '').length}/{maxLength}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  const { colors, radius } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segment = width / options.length;
  const x = useSharedValue(0);
  useEffect(() => {
    x.set(withSpring(index * segment, { damping: 20, stiffness: 220 }));
  }, [index, segment, x]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const height = size === 'sm' ? 36 : 44;
  return (
    <View
      accessibilityRole="tablist"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - 8)}
      style={[styles.segmented, { height, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
      {width > 0 ? (
        <Animated.View
          style={[
            styles.segmentIndicator,
            { width: segment, height: height - 8, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong },
            indicator,
          ]}
        />
      ) : null}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
            onPress={() => {
              haptics.tap();
              onChange(o.value);
            }}
            style={styles.segment}>
            {o.icon ? <Icon name={o.icon} size={16} color={active ? colors.text : colors.textMuted} /> : null}
            <Text variant="label" tone={active ? 'default' : 'muted'} numberOfLines={1}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function Switch({ value, onChange, label, disabled }: { value: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  const { colors } = useTheme();
  const x = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    x.set(withTiming(value ? 1 : 0, { duration: 180 }));
  }, [value, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 20 }] }));
  return (
    <PressableScale
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.tap();
        onChange(!value);
      }}
      hitSlop={8}
      style={[styles.switch, { backgroundColor: value ? colors.primaryStrong : colors.borderStrong }]}>
      <Animated.View style={[styles.knob, { backgroundColor: value ? colors.onPrimary : colors.surface }, knob]} />
    </PressableScale>
  );
}

/** Round habit checkbox with a satisfying pop. */
export function Checkbox({
  checked,
  onChange,
  label,
  size = 30,
  color,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  size?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const fill = color ?? colors.primary;
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      hitSlop={8}
      activeScale={0.9}
      onPress={() => {
        if (!checked) {
          scale.set(0.6);
          scale.set(withSpring(1, { damping: 8, stiffness: 260 }));
          haptics.success();
        } else haptics.tap();
        onChange(!checked);
      }}>
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 2,
            borderColor: checked ? fill : colors.borderStrong,
            backgroundColor: checked ? fill : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          },
          pop,
        ]}>
        {checked ? <Icon name="check-bold" size={size * 0.55} color={colors.onPrimary} /> : null}
      </Animated.View>
    </PressableScale>
  );
}

export function RadioGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; description?: string; icon?: IconName }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={o.label}
            onPress={() => {
              haptics.tap();
              onChange(o.value);
            }}
            style={[
              styles.radio,
              {
                borderRadius: radius.lg,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primarySoft : colors.surface,
              },
            ]}>
            {o.icon ? <Icon name={o.icon} size={22} color={active ? colors.primaryStrong : colors.textMuted} /> : null}
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">{o.label}</Text>
              {o.description ? (
                <Text variant="caption" tone="muted">
                  {o.description}
                </Text>
              ) : null}
            </View>
            <View style={[styles.radioOuter, { borderColor: active ? colors.primary : colors.borderStrong }]}>
              {active ? <View style={[styles.radioInner, { backgroundColor: colors.primary }]} /> : null}
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** 1–5 pills (severity, etc.). Each pill shows its number, so meaning is never color-only. */
export function RatingPills({
  value,
  onChange,
  labels,
  tone = 'danger',
}: {
  value: number;
  onChange: (v: number) => void;
  labels?: [string, string];
  tone?: 'danger' | 'primary' | 'accent';
}) {
  const { colors, radius } = useTheme();
  const strong = tone === 'danger' ? colors.danger : tone === 'accent' ? colors.accent : colors.primary;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="adjustable" accessibilityValue={{ min: 1, max: 5, now: value }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= value;
          return (
            <PressableScale
              key={n}
              onPress={() => {
                haptics.tap();
                onChange(n);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${n} of 5`}
              style={{
                flex: 1,
                height: 40,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: on ? strong : colors.surfaceSunken,
                borderWidth: 1,
                borderColor: on ? strong : colors.border,
              }}>
              <Text variant="label" color={on ? '#0B0E1A' : colors.textMuted}>
                {n}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      {labels ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="caption" tone="muted">
            {labels[0]}
          </Text>
          <Text variant="caption" tone="muted">
            {labels[1]}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function Counter({
  value,
  onChange,
  min = 1,
  max = 7,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const { colors, radius } = useTheme();
  const step = (d: number) => {
    const next = Math.min(max, Math.max(min, value + d));
    if (next !== value) {
      haptics.tap();
      onChange(next);
    }
  };
  return (
    <View
      style={[styles.counter, { borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: value }}>
      <PressableScale onPress={() => step(-1)} accessibilityRole="button" accessibilityLabel="Decrease" disabled={value <= min} style={styles.counterBtn}>
        <Icon name="minus" size={20} />
      </PressableScale>
      <Text variant="h3" style={{ minWidth: 56, textAlign: 'center' }}>
        {value}
        {suffix ? <Text variant="caption" tone="muted">{` ${suffix}`}</Text> : null}
      </Text>
      <PressableScale onPress={() => step(1)} accessibilityRole="button" accessibilityLabel="Increase" disabled={value >= max} style={styles.counterBtn}>
        <Icon name="plus" size={20} />
      </PressableScale>
    </View>
  );
}

export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const { colors } = useTheme();
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {order.map((d) => {
        const on = value.includes(d);
        return (
          <PressableScale
            key={d}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={WEEKDAY_LONG[d]}
            onPress={() => {
              haptics.tap();
              onChange(on ? value.filter((x) => x !== d) : [...value, d].sort());
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? colors.primaryStrong : colors.surfaceSunken,
              borderWidth: 1,
              borderColor: on ? colors.primaryStrong : colors.border,
            }}>
            <Text variant="label" color={on ? colors.onPrimary : colors.textMuted}>
              {WEEKDAY_LETTER[d]}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function SwatchPicker({ colors: swatches, value, onChange }: { colors: readonly string[]; value: string; onChange: (c: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {swatches.map((c) => {
        const on = c === value;
        return (
          <PressableScale
            key={c}
            onPress={() => onChange(c)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`Color ${c}`}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: c,
              borderWidth: 3,
              borderColor: on ? colors.text : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {on ? <Icon name="check" size={18} color="#0B0E1A" /> : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

export function EmojiPicker({ options, value, onChange }: { options: string[]; value: string; onChange: (e: string) => void }) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((e) => {
        const on = e === value;
        return (
          <PressableScale
            key={e}
            onPress={() => onChange(e)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`Emoji ${e}`}
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? colors.primarySoft : colors.surfaceSunken,
              borderWidth: 1,
              borderColor: on ? colors.primary : colors.border,
            }}>
            <Text style={{ fontSize: 22, lineHeight: 28 }}>{e}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Wizard progress: labelled segments. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }} accessibilityLabel={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {steps.map((s, i) => (
          <View
            key={s}
            style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= current ? colors.primary : colors.border }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" tone="muted">
          Step {current + 1} of {steps.length}
        </Text>
        <Text variant="caption" tone="primary">
          {steps[current]}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', gap: 10, borderWidth: 1.5, paddingHorizontal: 14 },
  helperRow: { flexDirection: 'row', gap: 8 },
  segmented: { flexDirection: 'row', padding: 4, borderWidth: 1, position: 'relative' },
  segmentIndicator: { position: 'absolute', top: 4, left: 4, borderWidth: 1 },
  segment: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  switch: { width: 50, height: 30, borderRadius: 15, padding: 3, justifyContent: 'center' },
  knob: { width: 24, height: 24, borderRadius: 12 },
  radio: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1.5 },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  counter: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, alignSelf: 'flex-start', padding: 4 },
  counterBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
});
