import React from 'react';
import { Tabs } from 'expo-router';
import { Milk, Moon, BookOpen, Settings } from 'lucide-react-native';
import { useTheme } from '@/src/design/ThemeProvider';

export default function MainTabsLayout() {
  const t = useTheme();

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
          title: 'Today',
          tabBarIcon: ({ size, color }) => <Milk size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          tabBarIcon: ({ size, color }) => <BookOpen size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="handoff"
        options={{
          title: 'Handoff',
          tabBarIcon: ({ size, color }) => <Moon size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ size, color }) => <Settings size={size} color={color} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}
