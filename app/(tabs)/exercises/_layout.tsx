// Stack layout for the Exercises tab. Without this, expo-router treats every
// file in this folder (index, [id], new) as a sibling route and leaks
// `exercises/[id]` and `exercises/new` into the bottom tab bar as broken
// phantom tabs. Nesting them in a Stack keeps a single "Exercises" tab and
// pushes detail/create on top of the list. Headers are off — each screen
// renders its own in-screen app bar (back control + identity).

import { Stack } from 'expo-router';

import { theme } from '../../../theme';

export default function ExercisesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="new" />
    </Stack>
  );
}
