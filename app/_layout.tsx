import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  Fraunces_600SemiBold,
  Fraunces_600SemiBold_Italic,
} from '@expo-google-fonts/fraunces';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AppProvider, useApp } from '@/src/state/AppProvider';
import { ThemeProvider, useTheme } from '@/src/design/ThemeProvider';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

function Gate({ children }: { children: React.ReactNode }) {
  const { status, error } = useApp();
  const t = useTheme();

  if (status === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: t.canvas }]}>
        <ActivityIndicator color={t.accent} />
        <Text style={[styles.loadingText, { color: t.inkMuted }]}>Opening your journal…</Text>
      </View>
    );
  }
  if (status === 'error') {
    return (
      <View style={[styles.center, { backgroundColor: t.canvas }]}>
        <Text style={[styles.errorTitle, { color: t.ink }]}>Something went wrong</Text>
        <Text style={[styles.errorBody, { color: t.inkMuted }]}>{error}</Text>
        <Text style={[styles.errorHint, { color: t.inkMuted }]}>
          Your records are safe on this device. Close and reopen the app to try again.
        </Text>
      </View>
    );
  }
  return <>{children}</>;
}

function RootNav() {
  const { data, isDemo } = useApp();
  const hasBaby = isDemo || data.babies.some((b) => !b.isDemo);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name={hasBaby ? '(main)' : 'index'} />
      {!hasBaby && <Stack.Screen name="(main)" />}
    </Stack>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  const [fontsLoaded] = useFonts({
    'DMSans-Regular': DMSans_400Regular,
    'DMSans-Medium': DMSans_500Medium,
    'DMSans-SemiBold': DMSans_600SemiBold,
    'DMSans-Bold': DMSans_700Bold,
    'Fraunces-SemiBold': Fraunces_600SemiBold,
    'Fraunces-SemiBoldItalic': Fraunces_600SemiBold_Italic,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AppProvider>
      <ThemeProviderBridge>
        <Gate>
          <RootNav />
        </Gate>
      </ThemeProviderBridge>
    </AppProvider>
  );
}

function ThemeProviderBridge({ children }: { children: React.ReactNode }) {
  const { themeMode, setThemeMode } = useThemeModeBridge();
  return (
    <ThemeProvider mode={themeMode} setMode={setThemeMode}>
      <>
        <StatusBar style={themeMode === 'night' ? 'light' : 'dark'} />
        {children}
      </>
    </ThemeProvider>
  );
}

function useThemeModeBridge() {
  const app = useApp();
  return { themeMode: app.themeMode, setThemeMode: app.setThemeMode };
}

import { useThemeMode } from '@/src/design/ThemeProvider';

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorBody: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
