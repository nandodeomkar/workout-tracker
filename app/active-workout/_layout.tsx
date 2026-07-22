// Stack layout for the active-workout route group. Mirrors
// app/(tabs)/exercises/_layout.tsx: a single Stack with headerShown off,
// since [workoutId].tsx and summary.tsx each render their own in-screen
// app-bar/CTA. This group is registered as a sibling to (tabs) in the root
// Stack (app/_layout.tsx), which is what makes the active-workout screen
// render full-screen over the tab bar (D-15/UI-SPEC).
//
// `summary` (LOG-05/D-10) is reached via `router.replace` from
// `[workoutId].tsx`'s "Finish workout" — replace (not push) so system back
// from the summary screen cannot re-enter the now-finished session.

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
      <Stack.Screen name="summary" />
    </Stack>
  );
}
