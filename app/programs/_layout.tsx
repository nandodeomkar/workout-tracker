// Stack layout for the standalone Programs route group (PROG-01/PROG-04,
// D-01/D-17). Mirrors app/templates/_layout.tsx / app/measurements/_layout.tsx:
// without this, expo-router cannot fold `programs/index` into the bare
// `/programs` route for typed-routes purposes, and `[programId]`/
// `training-maxes`/`new` would leak as phantom bottom tabs. Headers are off —
// each programs screen renders its own in-screen appbar. Registered as a
// sibling to (tabs)/active-workout/templates/measurements/tools in the root
// Stack (app/_layout.tsx), reached via router.push, never a bottom tab.
//
// All four screens are pre-registered up front (including the training-maxes
// and new placeholders) so expo-router's typed-routes resolves every
// router.push target this plan's screens use before Plans 05/06 replace the
// placeholders (placeholder-route-then-implement precedent, Phase 2/5).

import { Stack } from 'expo-router';

import { theme } from '../../theme';

export default function ProgramsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[programId]" />
      <Stack.Screen name="training-maxes" />
      <Stack.Screen name="new" />
    </Stack>
  );
}
