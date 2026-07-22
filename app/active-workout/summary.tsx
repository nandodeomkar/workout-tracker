// Finish/summary screen (LOG-05/D-10, UI-SPEC "3. Finish / summary screen").
//
// Reached only by "Finish workout" (replace, not push — see
// [workoutId].tsx's handleFinishPress) after `finishWorkout` has already
// stamped `finished_at`. Reads the just-finished workout back from SQLite
// (D-15: this screen holds no session state itself) and computes:
//   - Duration: finishedAt − startedAt, formatted at render time.
//   - Volume: `lib/volume.ts#workingSetVolume` over every non-warmup set.
//   - PRs hit: `lib/prDetection.ts#detectPRs` against `loadPriorBests`
//     (prior FINISHED workouts strictly before this one).
// "Done" clears the ephemeral session store and returns to the Workout tab
// — SQLite already has the final, authoritative state.

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { db } from '../../db/client';
import { loadAllExercises } from '../../db/exercises';
import { getSetting } from '../../db/settings';
import type { Workout } from '../../db/schema';
import { loadPriorBests, loadWorkoutDetail } from '../../db/workouts';
import { detectPRs } from '../../lib/prDetection';
import { workingSetVolume } from '../../lib/volume';
import { kgToDisplay } from '../../lib/weightUnits';
import { useActiveWorkout } from '../../store/activeWorkout';
import { theme } from '../../theme';

type PRHitWithName = ReturnType<typeof detectPRs>[number] & { exerciseName: string };

function formatDuration(startedAt: string, finishedAt: string): string {
  const elapsedMs = Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime());
  const totalMinutes = Math.floor(elapsedMs / 60000);
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}`;
  }
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function WorkoutSummaryScreen() {
  const { workoutId: workoutIdParam } = useLocalSearchParams<{ workoutId: string }>();
  const workoutId = Number(workoutIdParam);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const clearActiveWorkout = useActiveWorkout((state) => state.clearActiveWorkout);

  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [volumeKg, setVolumeKg] = useState(0);
  const [prHits, setPrHits] = useState<PRHitWithName[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [detail, exercisesList, unitSetting] = await Promise.all([
        loadWorkoutDetail(db, workoutId),
        loadAllExercises(db),
        getSetting(db, 'units'),
      ]);

      if (cancelled) {
        return;
      }
      if (!detail) {
        setLoading(false);
        return;
      }

      const exerciseMap = new Map(exercisesList.map((exercise) => [exercise.id, exercise]));
      const allSets = detail.exercises.flatMap(({ workoutExercise, sets: setRows }) =>
        setRows.map((setRow) => ({
          exerciseId: workoutExercise.exerciseId,
          weightKg: setRow.weightKg,
          reps: setRow.reps,
          type: setRow.type,
        })),
      );
      const exerciseIds = [...new Set(detail.exercises.map((entry) => entry.workoutExercise.exerciseId))];
      const priorBests = await loadPriorBests(db, exerciseIds, workoutId);
      const hits = detectPRs(allSets, priorBests);

      if (cancelled) {
        return;
      }

      setWorkout(detail.workout);
      setUnit(unitSetting === 'lb' ? 'lb' : 'kg');
      setVolumeKg(workingSetVolume(allSets));
      setPrHits(
        hits.map((hit) => ({
          ...hit,
          exerciseName: exerciseMap.get(hit.exerciseId)?.name ?? 'Exercise',
        })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [workoutId]);

  const durationLabel = useMemo(() => {
    if (!workout?.finishedAt) {
      return '0:00';
    }
    return formatDuration(workout.startedAt, workout.finishedAt);
  }, [workout]);

  const volumeLabel = useMemo(() => `${kgToDisplay(volumeKg, unit)} ${unit}`, [volumeKg, unit]);

  function handleDone() {
    clearActiveWorkout();
    router.replace('/');
  }

  if (loading || !workout) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + theme.spacing.xl }]}
      >
        <Text style={styles.heading}>Workout complete</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{durationLabel}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{volumeLabel}</Text>
            <Text style={styles.statLabel}>Volume</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{prHits.length}</Text>
            <Text style={styles.statLabel}>PRs hit</Text>
          </View>
        </View>

        {prHits.length > 0 ? (
          <View style={styles.prList}>
            {prHits.map((hit, index) => (
              <View key={`${hit.exerciseId}-${hit.kind}-${index}`} style={styles.prRow}>
                <View style={styles.prBadge}>
                  <Text style={styles.prBadgeText}>PR</Text>
                </View>
                <Text style={styles.prText} numberOfLines={2}>
                  {hit.exerciseName} — new best: {kgToDisplay(hit.weightKg, unit)} {unit} × {hit.reps}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Pressable
        onPress={handleDone}
        accessibilityRole="button"
        style={[styles.doneButton, { marginBottom: insets.bottom + theme.spacing.lg }]}
      >
        <Text style={styles.doneButtonText}>Done</Text>
      </Pressable>
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
  scrollContent: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  heading: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.sm,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  statValue: {
    ...theme.typography.title,
    color: theme.colors.accent,
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  prList: {
    gap: theme.spacing.sm,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  prBadge: {
    backgroundColor: theme.colors.badge,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
  },
  prBadgeText: {
    ...theme.typography.caption,
    color: theme.colors.background,
    fontWeight: '700',
    fontSize: 10,
  },
  prText: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
  },
  doneButton: {
    marginHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  doneButtonText: {
    ...theme.typography.body,
    color: theme.colors.background,
    fontWeight: '700',
  },
});
