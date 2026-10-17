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
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/src/design/ThemeProvider';
import { fontNames, radius, spacing } from '@/src/design/tokens';
import { PrimaryButton } from '@/src/components/ui';
import { useApp } from '@/src/state/AppProvider';
import type { Baby } from '@/src/models/types';

function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00');
  return !Number.isNaN(d.getTime()) && d.getTime() <= Date.now();
}

export default function OnboardingScreen() {
  const t = useTheme();
  const { addBaby } = useApp();
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      setError('Please give your baby a nickname.');
      return;
    }
    if (!isValidDate(birth.trim())) {
      setError('Enter the birth date as YYYY-MM-DD (for example 2026-08-14).');
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
      setError('Could not save. Please try again — nothing was written yet.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: t.canvas }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Svg width={120} height={44} viewBox="0 0 120 44" style={styles.motif}>
          <Path
            d="M4 36 C 30 8, 62 44, 88 16 S 116 28, 116 28"
            stroke={t.accent}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
        <Text style={[styles.title, { color: t.ink, fontFamily: fontNames.display }]}>
          A quiet place for
        </Text>
        <Text style={[styles.title, { color: t.accent, fontFamily: fontNames.display }]}>
          the small hours
        </Text>
        <Text style={[styles.subtitle, { color: t.inkMuted }]}>
          No account. No cloud. Everything stays on this device until you choose to share it.
        </Text>

        <View style={styles.form}>
          <Text style={[styles.label, { color: t.ink }]}>Nickname</Text>
          <TextInput
            style={[styles.input, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
            value={name}
            onChangeText={setName}
            placeholder="What do you call them?"
            placeholderTextColor={t.inkFaint}
            maxLength={40}
            accessibilityLabel="Baby nickname"
          />
          <Text style={[styles.label, { color: t.ink }]}>Date of birth</Text>
          <TextInput
            style={[styles.input, { backgroundColor: t.surface, color: t.ink, borderColor: t.hairline }]}
            value={birth}
            onChangeText={setBirth}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={t.inkFaint}
            keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
            maxLength={10}
            accessibilityLabel="Baby date of birth"
          />
          {error && <Text style={[styles.error, { color: t.cinnamon }]}>{error}</Text>}
          <PrimaryButton
            label={saving ? 'Saving…' : 'Begin the journal'}
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
