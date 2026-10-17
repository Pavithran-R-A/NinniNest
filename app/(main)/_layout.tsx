import React from 'react';
import { Tabs } from 'expo-router';
import { Milk, Moon, BookOpen, Settings, Baby, LineChart } from 'lucide-react-native';
import { useTheme } from '@/src/design/ThemeProvider';
import { useApp } from '@/src/state/AppProvider';

export default function MainTabsLayout() {
  const t = useTheme();
  const { t: tr } = useApp();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.inkMuted,
        tabBarStyle: {
          backgroundColor: t.surface,
          borderTopColor: t.hairline,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: tr('nav.today'),
          tabBarIcon: ({ size, color }) => <Milk size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: tr('nav.journal'),
          tabBarIcon: ({ size, color }) => <BookOpen size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="handoff"
        options={{
          title: tr('nav.handoff'),
          tabBarIcon: ({ size, color }) => <Moon size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: tr('nav.family'),
          tabBarIcon: ({ size, color }) => <Baby size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: tr('nav.insights'),
          tabBarIcon: ({ size, color }) => <LineChart size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: tr('nav.settings'),
          tabBarIcon: ({ size, color }) => <Settings size={size} color={color} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}
