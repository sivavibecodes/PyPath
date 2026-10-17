import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
import { colors } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Path',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🗺️</Text>,
        }}
      />
      <Tabs.Screen
        name="cert"
        options={{
          title: 'Cert Hub',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🎓</Text>,
        }}
      />
      <Tabs.Screen
        name="reference"
        options={{
          title: 'Cheat Sheet',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📖</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>👤</Text>,
        }}
      />
    </Tabs>
  );
}
