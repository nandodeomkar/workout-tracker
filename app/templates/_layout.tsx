// Stack layout for the standalone Templates route group (TMPL-01, D-03).
// Mirrors app/(tabs)/exercises/_layout.tsx: without this, expo-router would
// leak `templates/new` and `templates/[templateId]` as phantom bottom tabs.
// Headers are off — the shared TemplateBuilderForm renders its own in-screen
// appbar. Registered as a sibling to (tabs)/active-workout/tools in the root
// Stack (app/_layout.tsx), reached via router.push, never a bottom tab.

import { Stack } from 'expo-router';

import { theme } from '../../theme';

export default function TemplatesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="new" />
      <Stack.Screen name="[templateId]" />
    </Stack>
  );
}
