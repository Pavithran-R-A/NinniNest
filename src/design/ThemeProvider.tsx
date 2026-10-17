import React, { createContext, useContext, useMemo } from 'react';
import { themes, type Theme, type ThemeMode } from '@/src/design/tokens';

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: themes.day,
  mode: 'day',
  setMode: () => {},
});

export function ThemeProvider({
  mode,
  setMode,
  children,
}: {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ theme: themes[mode], mode, setMode }),
    [mode, setMode]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useThemeMode() {
  return useContext(ThemeContext);
}
