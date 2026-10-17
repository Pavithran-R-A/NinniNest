export type ThemeMode = 'day' | 'night';

export const palette = {
  ivory: '#F7F5F0',
  ink: '#24343C',
  teal: '#286F68',
  cinnamon: '#AB6F53',
  paleSage: '#E3ECE4',
  parchment: '#F0EBE2',
  mutedInk: '#52636B',
  cream: '#F6F0E6',
  nightCanvas: '#121F24',
  nightSurface: '#1C2B30',
  nightAccent: '#E1B48A',
} as const;

export interface Theme {
  mode: ThemeMode;
  canvas: string;
  surface: string;
  surfaceAlt: string;
  ribbon: string;
  ink: string;
  inkMuted: string;
  inkFaint: string;
  accent: string;
  accentSoft: string;
  accentInk: string;
  cinnamon: string;
  sage: string;
  hairline: string;
}

export const dayTheme: Theme = {
  mode: 'day',
  canvas: palette.ivory,
  surface: '#FFFFFF',
  surfaceAlt: palette.parchment,
  ribbon: palette.paleSage,
  ink: palette.ink,
  inkMuted: palette.mutedInk,
  inkFaint: '#7C8A90',
  accent: palette.teal,
  accentSoft: palette.paleSage,
  accentInk: '#FFFFFF',
  cinnamon: palette.cinnamon,
  sage: palette.paleSage,
  hairline: '#E2DCD2',
};

export const nightTheme: Theme = {
  mode: 'night',
  canvas: palette.nightCanvas,
  surface: palette.nightSurface,
  surfaceAlt: '#162629',
  ribbon: '#23383D',
  ink: palette.cream,
  inkMuted: '#B4A99A',
  inkFaint: '#8A9296',
  accent: palette.nightAccent,
  accentSoft: '#2E3E42',
  accentInk: '#121F24',
  cinnamon: '#C98B6A',
  sage: '#3A4F4B',
  hairline: '#2E3F44',
};

export const themes: Record<ThemeMode, Theme> = { day: dayTheme, night: nightTheme };

export const fontNames = {
  regular: 'DMSans-Regular',
  medium: 'DMSans-Medium',
  semiBold: 'DMSans-SemiBold',
  bold: 'DMSans-Bold',
  display: 'Fraunces-SemiBold',
  displayItalic: 'Fraunces-SemiBoldItalic',
} as const;

export type FontName = (typeof fontNames)[keyof typeof fontNames];

export const spacing = (n: number) => n * 8;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const type = {
  micro: 11,
  label: 13,
  body: 16,
  bodyLarge: 17,
  metric: 28,
  metricLarge: 40,
  headline: 26,
  hero: 34,
} as const;
