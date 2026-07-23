// Stack layout for the standalone Measurements route group (MEAS-01/MEAS-02,
// D-07/D-10). Mirrors app/templates/_layout.tsx / app/tools/_layout.tsx:
// without this, expo-router cannot fold `measurements/index` into the bare
// `/measurements` route for typed-routes purposes, and `[metric]`/`entry`
// would leak as phantom bottom tabs. Headers are off — each measurements
// screen renders its own in-screen appbar. Registered as a sibling to
// (tabs)/active-workout/templates/tools in the root Stack (app/_layout.tsx),
// reached via router.push, never a bottom tab.

import { Stack } from 'expo-router';

import { theme } from '../../theme';

export default function MeasurementsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[metric]" />
      <Stack.Screen name="entry" />
    </Stack>
  );
}
