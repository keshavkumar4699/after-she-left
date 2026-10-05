/**
 * "Calm night" design tokens. Dark-first; the light theme is its own set of steps (not an
 * automatic inversion), validated for contrast against its own surfaces.
 *
 * Contrast notes (WCAG):
 *  - text on bg/surface ≥ 7:1, textMuted ≥ 6:1, textSubtle (placeholders/disabled only) ≥ 3:1
 *  - chart marks (primary/accent/violet/danger) ≥ 3:1 against the surface
 *  - buttons use `primaryStrong` + `onPrimary` (≥ 4.5:1)
 */

export type Scheme = 'dark' | 'light';

export interface Palette {
  bg: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  /** Chart marks, ring fills, selected states. */
  primary: string;
  /** Filled buttons and teal text. */
  primaryStrong: string;
  onPrimary: string;
  primarySoft: string;
  /** Ring/meter track: a quiet step of the same teal ramp. */
  track: string;
  accent: string;
  accentSoft: string;
  violet: string;
  violetSoft: string;
  danger: string;
  dangerSoft: string;
  rest: string;
  scrim: string;
  shadow: string;
  heroGradient: [string, string, string];
  prayerGradient: [string, string, string];
  tabBar: string;
}

export const palettes: Record<Scheme, Palette> = {
  dark: {
    bg: '#0B0E1A',
    surface: '#121729',
    surfaceRaised: '#1A2036',
    surfaceSunken: '#0E1222',
    border: '#262D47',
    borderStrong: '#343D5E',
    text: '#EEF0F8',
    textMuted: '#9AA3BF',
    textSubtle: '#6B7393',
    primary: '#2DD4BF',
    primaryStrong: '#2DD4BF',
    onPrimary: '#04201C',
    primarySoft: 'rgba(45, 212, 191, 0.14)',
    track: '#1D3340',
    accent: '#F5B544',
    accentSoft: 'rgba(245, 181, 68, 0.14)',
    violet: '#8B7CF6',
    violetSoft: 'rgba(139, 124, 246, 0.16)',
    danger: '#F27474',
    dangerSoft: 'rgba(242, 116, 116, 0.14)',
    rest: '#2A3150',
    scrim: 'rgba(4, 6, 14, 0.66)',
    shadow: '#000000',
    heroGradient: ['#1C1F3F', '#16243A', '#0F2A2E'],
    prayerGradient: ['#231E4A', '#1A1E3A', '#122030'],
    tabBar: '#0E1222',
  },
  light: {
    bg: '#F7F6F2',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    surfaceSunken: '#EFEDE6',
    border: '#E6E2D8',
    borderStrong: '#D3CEC1',
    text: '#12152A',
    textMuted: '#5A6079',
    textSubtle: '#8A8FA3',
    primary: '#0D9488',
    primaryStrong: '#0F766E',
    onPrimary: '#FFFFFF',
    primarySoft: 'rgba(13, 148, 136, 0.12)',
    track: '#D7EEEA',
    accent: '#B7791F',
    accentSoft: 'rgba(245, 181, 68, 0.2)',
    violet: '#6D5BD0',
    violetSoft: 'rgba(109, 91, 208, 0.12)',
    danger: '#D14343',
    dangerSoft: 'rgba(209, 67, 67, 0.1)',
    rest: '#E4E1D8',
    scrim: 'rgba(18, 21, 42, 0.42)',
    shadow: '#3A3A60',
    heroGradient: ['#ECE9FF', '#E6F2F7', '#E2F5F1'],
    prayerGradient: ['#EEEAFF', '#F4F0FF', '#FBF7EE'],
    tabBar: '#FFFFFF',
  },
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  serif: 'Fraunces_400Regular',
  serifItalic: 'Fraunces_400Regular_Italic',
  serifSemibold: 'Fraunces_600SemiBold',
} as const;

export const typography = {
  display: { fontFamily: fonts.serifSemibold, fontSize: 34, lineHeight: 40, letterSpacing: -0.4 },
  title: { fontFamily: fonts.serifSemibold, fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  h2: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  h3: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.1 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, letterSpacing: 0.1 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  overline: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  number: { fontFamily: fonts.semibold, fontSize: 28, lineHeight: 32, letterSpacing: -0.5 },
  hero: { fontFamily: fonts.semibold, fontSize: 48, lineHeight: 52, letterSpacing: -1 },
  serif: { fontFamily: fonts.serif, fontSize: 19, lineHeight: 30 },
  serifItalic: { fontFamily: fonts.serifItalic, fontSize: 17, lineHeight: 26 },
} as const;

export type TypeVariant = keyof typeof typography;

/** Habit / circumstance color swatches (identity colors, always paired with emoji/icon + name). */
export const SWATCHES = ['#2DD4BF', '#8B7CF6', '#F5B544', '#F27474', '#60A5FA', '#F472B6', '#A3E635', '#FB923C'] as const;

export const motion = {
  fast: 160,
  base: 240,
  slow: 420,
} as const;
