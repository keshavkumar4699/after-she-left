import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/ui';

/** Urge surfing: a 4-in / 6-out breathing guide. Urges peak and pass within minutes. */
export function BreathingCircle({ seconds = 60, onDone }: { seconds?: number; onDone?: () => void }) {
  const { colors } = useTheme();
  const scale = useSharedValue(0.6);
  const [left, setLeft] = useState(seconds);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    scale.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.6, { duration: 6000, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      ),
    );
    const tick = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          clearInterval(tick);
          onDoneRef.current?.();
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [scale]);

  // Each 10-second cycle: 4 s in, 6 s out (matches the animation above).
  const phase = (seconds - left) % 10 < 4 ? 'in' : 'out';
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={{ alignItems: 'center', gap: 16, paddingVertical: 12 }} accessibilityLabel={`Breathing exercise, ${left} seconds left`}>
      <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={[
            { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: colors.violetSoft, borderWidth: 2, borderColor: colors.violet },
            style,
          ]}
        />
        <Text variant="h2">{phase === 'in' ? 'Breathe in' : 'Breathe out'}</Text>
      </View>
      <Text variant="body" tone="muted">
        {left > 0 ? `${left}s · the urge will pass` : 'Well done. The wave passed.'}
      </Text>
    </View>
  );
}
