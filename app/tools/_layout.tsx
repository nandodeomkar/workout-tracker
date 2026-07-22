// Stack layout for the standalone Tools route group (UTIL-01/UTIL-02
// standalone reachability, D-07/D-11). Mirrors app/active-workout/_layout.tsx:
// a single Stack with headerShown off, since each tools screen renders its
// own in-screen appbar. Registered as a sibling to (tabs) and active-workout
// in the root Stack (app/_layout.tsx) — no new bottom tab (Open Question 1).

import { Stack } from 'expo-router';

import { theme } from '../../theme';

export default function ToolsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="plate-calculator" />
      <Stack.Screen name="one-rm-calculator" />
    </Stack>
  );
}
