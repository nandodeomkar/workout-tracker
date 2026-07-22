// Stack layout for the History tab. Without this, expo-router treats every
// file in this folder (index, [workoutId]) as a sibling route and leaks
// `history/[workoutId]` into the bottom tab bar as a broken phantom tab
// (same Phase-1 GAP-4 fix as exercises/_layout.tsx). Headers are off — each
// screen renders its own in-screen app-bar/segmented-control chrome.

import { Stack } from 'expo-router';

import { theme } from '../../../theme';

export default function HistoryLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[workoutId]" />
    </Stack>
  );
}
