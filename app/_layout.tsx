import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { db } from '../db/client';
import { runSeedIfNeeded } from '../db/seed/runSeed';
import migrations from '../drizzle/migrations';
import { theme } from '../theme';

// Root layout: gates the app shell on the migration + silent-seed pipeline
// (FNDN-01/FNDN-02/D-16). While migrations are pending or the first-launch
// seed is still running, render null — silent, no progress screen. On
// migration error, hard-stop with an error screen (never a silent crash or
// partial-migrated render, per T-1-01).
export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!success || seeded) {
      return;
    }
    let cancelled = false;
    runSeedIfNeeded(db).finally(() => {
      if (!cancelled) {
        setSeeded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [success, seeded]);

  if (error) {
    return <MigrationErrorScreen error={error} />;
  }

  if (!success || !seeded) {
    return null;
  }

  return (
    // GestureHandlerRootView must wrap the app once at the root so any
    // screen (the active-workout drag-reorder gesture, LOG-04) can use
    // react-native-gesture-handler — per its own setup docs, a nested-only
    // wrapper would silently fail to receive touch events.
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        {/* Sibling to (tabs), not nested inside it — this is the "full-screen
            over tabs" mechanism for the active-workout session (D-15). */}
        <Stack.Screen name="active-workout" />
        {/* Standalone Tools group (Plate/1RM calculators, UTIL-01/UTIL-02) —
            another sibling, reached via router.push from More, never a
            bottom tab (Open Question 1). */}
        <Stack.Screen name="tools" />
        {/* Templates builder group (TMPL-01/D-03) — pushed sibling route
            from Workout home, never a bottom tab. */}
        <Stack.Screen name="templates" />
        {/* Body Measurements group (MEAS-01/MEAS-02, D-07/D-10) — pushed
            sibling route from Settings/More, never a bottom tab. */}
        <Stack.Screen name="measurements" />
      </Stack>
    </GestureHandlerRootView>
  );
}

function MigrationErrorScreen({ error }: { error: Error }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Database error</Text>
      <Text style={styles.message}>{error.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.danger,
    marginBottom: theme.spacing.sm,
  },
  message: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
