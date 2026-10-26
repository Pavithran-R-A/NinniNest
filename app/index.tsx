import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '@/src/design/ThemeProvider';
import { fontNames, radius, spacing } from '@/src/design/tokens';
import { PrimaryButton } from '@/src/components/ui';
import { useApp } from '@/src/state/AppProvider';

export default function WelcomeScreen() {
  const t = useTheme();
  const { status, currentBaby } = useApp();

  // Returning users land here on every cold start (this is the app's root
  // route). When a profile already exists, go straight to their journal —
  // tapping "Begin" again would otherwise create a duplicate profile.
  // Found in the first real device run (0.9.0): SQLite persistence worked,
  // but the app always opened on this welcome screen after force-stop.
  useEffect(() => {
    if (status === 'ready' && currentBaby) {
      router.replace('/(main)/today');
    }
  }, [status, currentBaby]);

  return (
    <View style={[styles.flex, { backgroundColor: t.canvas }]}>
      <View style={styles.hero}>
        <Svg width={220} height={140} viewBox="0 0 220 140">
          <Circle cx={110} cy={70} r={54} stroke={t.accent} strokeWidth={1.5} fill="none" opacity={0.35} />
          <Path
            d="M46 96 C 78 40, 132 116, 178 48"
            stroke={t.accent}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
          />
          <Circle cx={178} cy={48} r={3.5} fill={t.cinnamon} />
        </Svg>
      </View>
      <View style={styles.copy}>
        <Text style={[styles.kicker, { color: t.cinnamon }]}>NinniNest</Text>
        <Text style={[styles.title, { color: t.ink, fontFamily: fontNames.display }]}>
          Know what happened.
        </Text>
        <Text style={[styles.title, { color: t.ink, fontFamily: fontNames.display }]}>
          Share what matters.
        </Text>
        <Text style={[styles.title, { color: t.accent, fontFamily: fontNames.display }]}>
          Rest easier.
        </Text>
        <Text style={[styles.body, { color: t.inkMuted }]}>
          A calm, private care journal for the blur of the first months. Feedings, sleep,
          diapers and handovers — recorded in seconds, kept entirely on this device.
        </Text>
      </View>
      <View style={styles.actions}>
        <Text style={[styles.privacy, { color: t.inkMuted }]}>
          No account needed. Nothing leaves your device unless you export it yourself.
        </Text>
        <PrimaryButton
          label="Begin without an account"
          onPress={() => router.push('/onboarding')}
          style={{ minHeight: 56, borderRadius: radius.md }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    paddingHorizontal: spacing(5),
    paddingBottom: spacing(4),
  },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: spacing(2),
  },
  title: {
    fontSize: 30,
    lineHeight: 37,
    fontWeight: '600',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing(3),
  },
  actions: {
    paddingHorizontal: spacing(5),
    paddingBottom: spacing(6),
    gap: spacing(3),
  },
  privacy: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
