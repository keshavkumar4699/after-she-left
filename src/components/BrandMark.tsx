import Svg, { Circle, Defs, Line, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

/** The app mark: a sun rising over the horizon inside an almost-complete progress ring. */
export function BrandMark({ size = 72 }: { size?: number }) {
  const { colors } = useTheme();
  const r = 160;
  const c = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" accessibilityLabel="After She Left">
      <Defs>
        <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#8B7CF6" />
          <Stop offset="0.55" stopColor="#2DD4BF" />
          <Stop offset="1" stopColor="#5EEAD4" />
        </LinearGradient>
        <RadialGradient id="sun" cx="0.4" cy="0.35" r="0.7">
          <Stop offset="0" stopColor="#FFD98A" />
          <Stop offset="1" stopColor="#F5B544" />
        </RadialGradient>
      </Defs>
      <Circle cx={256} cy={256} r={r} fill="none" stroke={colors.track} strokeWidth={44} />
      <Circle
        cx={256}
        cy={256}
        r={r}
        fill="none"
        stroke="url(#ring)"
        strokeWidth={44}
        strokeLinecap="round"
        strokeDasharray={`${c * 0.8} ${c}`}
        rotation={-54}
        origin="256, 256"
      />
      <Path d="M196 302 A60 60 0 0 1 316 302 Z" fill="url(#sun)" />
      <Line x1={168} y1={318} x2={344} y2={318} stroke={colors.text} strokeWidth={22} strokeLinecap="round" />
    </Svg>
  );
}
