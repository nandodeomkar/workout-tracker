// Full chronological PR history — "See all" (D-10, UI-SPEC "4. Full PR
// history"). Same row anatomy as the Stats overview's Section A feed, but
// unbounded: renders every PR event ever recorded, newest first, in a
// FlatList. Recomputed live from `sets` on every focus (STAT-03/D-11 — never
// stored/cached), mirroring app/(tabs)/stats.tsx's data-loading pattern.

import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { muscleIcon } from '../../constants/muscleIcons';
import { db } from '../../db/client';
import { loadAllExercises } from '../../db/exercises';
import type { Exercise } from '../../db/schema';
import { getSetting } from '../../db/settings';
import { loadAllHistorySets } from '../../db/stats';
import { computeAllTimeRecords, type HistoricalSet, type PREvent } from '../../lib/records';
import { kgToDisplay } from '../../lib/weightUnits';
import { theme } from '../../theme';

/** Short "Jul 20" style date for a PR row's secondary line (matches Section A). */
function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** "5RM" for a rep-max event, "Est. 1RM" for a best-e1RM event. */
function prKindLabel(event: PREvent): string {
  return event.kind === 'rep-max' ? `${event.reps}RM` : 'Est. 1RM';
}

export default function AllPRsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [historySets, setHistorySets] = useState<HistoricalSet[]>([]);
  const [exercisesById, setExercisesById] = useState<Map<number, Exercise>>(new Map());
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);

      (async () => {
        const [allHistorySets, allExercises, unitSetting] = await Promise.all([
          loadAllHistorySets(db),
          loadAllExercises(db),
          getSetting(db, 'units'),
        ]);

        if (cancelled) {
          return;
        }

        setHistorySets(allHistorySets);
        setExercisesById(new Map(allExercises.map((exercise) => [exercise.id, exercise])));
        setUnit(unitSetting === 'lb' ? 'lb' : 'kg');
        setLoading(false);
      })();

      return () => {
        cancelled = true;
      };
    }, []),
  );

  // STAT-03/D-11: recomputed live from historySets on every focus, never
  // stored/cached — this is the full, unbounded history (no slice()).
  const allPREvents = useMemo(() => {
    const { events } = computeAllTimeRecords(historySets);
    return [...events].sort((a, b) => b.date.localeCompare(a.date));
  }, [historySets]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.appbar, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>‹ Stats</Text>
        </Pressable>
      </View>

      <Text style={styles.heading}>All PRs</Text>

      {allPREvents.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyHeading}>No PRs yet</Text>
          <Text style={styles.emptyBody}>Log a working set and your first personal record will show up here.</Text>
        </View>
      ) : (
        <FlatList
          data={allPREvents}
          keyExtractor={(event, index) => `${event.exerciseId}-${event.kind}-${event.reps}-${event.workoutId}-${index}`}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: event }) => (
            <Pressable
              onPress={() =>
                router.push({ pathname: '/stats/[exerciseId]', params: { exerciseId: String(event.exerciseId) } })
              }
              accessibilityRole="button"
              style={styles.row}
            >
              <Text style={styles.rowIcon}>
                {muscleIcon(exercisesById.get(event.exerciseId)?.muscleGroup ?? 'Other')}
              </Text>
              <View style={styles.rowTextGroup}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {exercisesById.get(event.exerciseId)?.name ?? 'Exercise'}
                </Text>
                <Text style={styles.rowSecondary}>
                  {prKindLabel(event)} · {kgToDisplay(event.weightKg, unit)}
                  {unit} · {formatShortDate(event.date)}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  appbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: theme.spacing.md,
  },
  backText: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  heading: {
    ...theme.typography.title,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rowIcon: {
    fontSize: 20,
    width: 26,
    textAlign: 'center',
  },
  rowTextGroup: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  rowSecondary: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  emptyHeading: {
    ...theme.typography.title,
    color: theme.colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
