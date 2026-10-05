import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { fonts, palettes, radius, spacing, typography, type Palette, type Scheme } from './tokens';

export type ThemeMode = 'system' | 'dark' | 'light';

export interface Theme {
  scheme: Scheme;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  type: typeof typography;
  fonts: typeof fonts;
}

const ThemeContext = createContext<Theme | null>(null);

export function makeTheme(scheme: Scheme): Theme {
  return { scheme, colors: palettes[scheme], spacing, radius, type: typography, fonts };
}

export function ThemeProvider({ mode, children }: { mode: ThemeMode; children: ReactNode }) {
  const system = useColorScheme();
  // "Calm night" is dark-first: when the system has no preference we stay dark.
  const scheme: Scheme = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode;
  const theme = useMemo(() => makeTheme(scheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  return theme ?? makeTheme('dark');
}
