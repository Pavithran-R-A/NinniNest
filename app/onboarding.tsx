import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '@/src/design/ThemeProvider';
import { fontNames, radius, spacing } from '@/src/design/tokens';
import { PrimaryButton } from '@/src/components/ui';
import { useApp } from '@/src/state/AppProvider';
import { useI18n } from '@/src/i18n/useI18n';
import { BRAND } from '@/src/i18n/brand';
import type { Baby } from '@/src/models/types';

function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00');
  return !Number.isNaN(d.getTime()) && d.getTime() <= Date.now();
}

// Journal motif: a single calm line drawing a night arc over a horizon dot.
function Motif({ color, dot }: { color: string; dot: string }) {
  return (
    <Svg width={160} height={56} viewBox="0 0 160 56">
      <Path
        d="M6 44 C 40 10, 84 50, 120 20 S 154 30, 154 30"
        stroke={color}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
      />
      <Circle cx={28} cy={12} r={2.5} fill={dot} />
    </Svg>
  );
}

export default function OnboardingScreen() {
  const t = useTheme();
  const { addBaby } = useApp();
  const { t: tr } = useI18n();
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      setError(tr('onb.errName'));
      return;
    }
    if (!isValidDate(birth.trim())) {
      setError(tr('onb.errDate'));
      return;
    }
    setSaving(true);
    const baby: Baby = {
      id: crypto.randomUUID(),
      name: name.trim(),
      birthDate: birth.trim(),
      createdAt: new Date().toISOString(),
    };
    const ok = await addBaby(baby);
    setSaving(false);
    if (ok) {
      router.replace('/(main)/today');
    } else {
      setError(tr('onb.errSave'));
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: t.canvas }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.brand, { color: t.inkFaint }]}>{BRAND.name}</Text>
        <Motif color={t.accent} dot={t.cinnamon} />
        <Text style={[styles.title, { color: t.ink, fontFamily: fontNames.display }]}>
          {tr('onb.title1')}
        </Text>
        <Text style={[styles.title, { color: t.accent, fontFamily: fontNames.display }]}>
          {tr('onb.title2')}
        </Text>
        <Text style={[styles.subtitle, { color: t.inkMuted }]}>{tr('onb.subtitle')}</Text>

        <View style={styles.form}>
          <Text style={[styles.label, { color: t.ink }]}>{tr('onb.nickname')}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
            value={name}
            onChangeText={setName}
            placeholder={tr('onb.nicknamePlaceholder')}
            placeholderTextColor={t.inkFaint}
            maxLength={40}
            accessibilityLabel={tr('onb.nickname')}
          />
          <Text style={[styles.label, { color: t.ink }]}>{tr('onb.birth')}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
            value={birth}
            onChangeText={setBirth}
            placeholder={tr('onb.birthPlaceholder')}
            placeholderTextColor={t.inkFaint}
            keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
            maxLength={10}
            accessibilityLabel={tr('onb.birth')}
          />
          {error && <Text style={[styles.error, { color: t.cinnamon }]}>{error}</Text>}
          <PrimaryButton
            label={saving ? tr('onb.saving') : tr('onb.begin')}
            onPress={save}
            disabled={saving}
            style={{ marginTop: spacing(3), minHeight: 52 }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing(4),
    paddingBottom: spacing(8),
  },
  brand: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: spacing(2),
  },
  motif: { marginBottom: spacing(3) },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing(2),
    marginBottom: spacing(5),
    maxWidth: 320,
  },
  form: { marginTop: spacing(2) },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing(1),
    marginTop: spacing(3),
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2.5),
    fontSize: 16,
  },
  error: {
    marginTop: spacing(2),
    fontSize: 14,
    lineHeight: 20,
  },
});
