// Stack layout for the active-workout route group. Mirrors
// app/(tabs)/exercises/_layout.tsx: a single Stack with headerShown off,
// since [workoutId].tsx renders its own in-screen app-bar (Discard / elapsed
// time / Finish workout). This group is registered as a sibling to (tabs) in
// the root Stack (app/_layout.tsx), which is what makes the active-workout
// screen render full-screen over the tab bar (D-15/UI-SPEC).

import { Stack } from 'expo-router';

import { theme } from '../../theme';

export default function ActiveWorkoutLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="[workoutId]" />
    </Stack>
  );
}
