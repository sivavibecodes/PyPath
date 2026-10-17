import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PythonEngineProvider } from '@/engine';
import { syncService } from '@/services/sync';
import { colors } from '@/theme';

const queryClient = new QueryClient();

export default function RootLayout() {
  useEffect(() => {
    // Start background auto-sync for progress outbox
    syncService.startAutoSync(45000);
    return () => syncService.stopAutoSync();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PythonEngineProvider>
          <StatusBar style="light" backgroundColor={colors.bg} />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="lesson/[id]"
              options={{ title: 'Lesson', headerBackTitle: 'Path' }}
            />
            <Stack.Screen
              name="lab/[id]"
              options={{ title: 'Code Lab', headerBackTitle: 'Lesson' }}
            />
            <Stack.Screen
              name="exam/[id]"
              options={{ title: 'Mock Exam', headerBackTitle: 'Exit' }}
            />
          </Stack>
        </PythonEngineProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
