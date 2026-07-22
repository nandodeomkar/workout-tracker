// Workout detail placeholder — fleshed out in Task 3 (read-only recap +
// per-set breakdown + Edit CTA, HIST-02/D-13). This minimal stub exists so
// expo-router's typed-routes graph includes `/history/[workoutId]` before
// Task 3 lands, unblocking Task 2's `router.push` calls into this route
// (Rule 3 — a missing referenced route file blocks `npx tsc --noEmit`).

import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../../../theme';

export default function WorkoutDetailScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Loading…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  text: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
});
