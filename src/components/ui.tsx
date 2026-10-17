import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '@/src/design/ThemeProvider';
import { radius, spacing } from '@/src/design/tokens';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

export function PrimaryButton({
  label, onPress, variant = 'primary', disabled, style, textStyle, accessibilityLabel,
}: Props) {
  const t = useTheme();
  const bg =
    variant === 'primary' ? t.accent : variant === 'secondary' ? t.surfaceAlt : 'transparent';
  const fg =
    variant === 'primary' ? t.accentInk : variant === 'secondary' ? t.ink : t.accent;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <Text style={[styles.text, { color: fg }, textStyle]}>{label}</Text>
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({
  options, value, onChange, label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={[styles.segmentWrap, { backgroundColor: t.surfaceAlt }]}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[
              styles.segment,
              { backgroundColor: active ? t.accent : 'transparent' },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: active ? t.accentInk : t.inkMuted },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.hairline }, style]}>
      {children}
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: t.ink }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: t.inkMuted }]}>{body}</Text>
    </View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  const t = useTheme();
  return (
    <View style={[styles.error, { backgroundColor: t.surfaceAlt, borderColor: t.cinnamon }]}>
      <Text style={[styles.errorText, { color: t.ink }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing(3),
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
  segmentWrap: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(2),
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing(3),
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing(6),
    paddingHorizontal: spacing(4),
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: spacing(1),
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  error: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing(2.5),
    marginBottom: spacing(2),
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
