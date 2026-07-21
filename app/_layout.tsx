import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { theme } from '../theme';

// NOTE: This is a placeholder root layout for Task 1 (scaffold verification).
// Task 3 replaces this with the real migration-gate + silent-seed wiring
// (useMigrations + runSeedIfNeeded) before rendering the (tabs) stack.
export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
