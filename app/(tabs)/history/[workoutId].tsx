// Workout detail (read-only) + Edit entry (HIST-02/D-13, UI-SPEC "4. History
// tab" — Workout detail). Same stat-row anatomy as the Finish/summary screen
// (duration/volume/PRs, computed via workingSetVolume/detectPRs/kgToDisplay)
// plus a per-exercise, per-set breakdown. The single "Edit" CTA sets the
// session mode to 'editing' and reopens the active-workout screen on this
// workout's data — no separate lighter editor (D-13/Pitfall 1: the
// mode='editing' branch built in Plan 04 updates existing `sets` rows via
// updateSet, never duplicate-inserts). Reloads on focus (GAP-3
// cancelled-guard pattern) so returning from an edit reflects the change.

import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { db } from '../../../db/client';
import { loadAllExercises } from '../../../db/exercises';
import { getSetting } from '../../../db/settings';
import type { Exercise } from '../../../db/schema';
import { loadPriorBests, loadWorkoutDetail, type WorkoutDetail } from '../../../db/workouts';
import { formatDurationMs } from '../../../lib/duration';
import { detectPRs } from '../../../lib/prDetection';
import { workingSetVolume } from '../../../lib/volume';
import { kgToDisplay } from '../../../lib/weightUnits';
import { useActiveWorkout } from '../../../store/activeWorkout';
import { theme } from '../../../theme';

type PRHitWithName = ReturnType<typeof detectPRs>[number] & { exerciseName: string };

function workoutTitle(startedAt: string, name: string | null): string {
  if (name && name.trim().length > 0) {
    return name;
  }
  return new Date(startedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function WorkoutDetailScreen() {
  const { workoutId: workoutIdParam } = useLocalSearchParams<{ workoutId: string }>();
  const workoutId = Number(workoutIdParam);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setActiveWorkout = useActiveWorkout((state) => state.setActiveWorkout);

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<WorkoutDetail | null>(null);
  const [exercisesById, setExercisesById] = useState<Map<number, Exercise>>(new Map());
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [prHits, setPrHits] = useState<PRHitWithName[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);

      (async () => {
        const [workoutDetail, exercisesList, unitSetting] = await Promise.all([
          loadWorkoutDetail(db, workoutId),
          loadAllExercises(db),
          getSetting(db, 'units'),
        ]);

        if (cancelled) {
          return;
        }
        if (!workoutDetail) {
          setDetail(null);
          setLoading(false);
          return;
        }

        const exerciseMap = new Map(exercisesList.map((exercise) => [exercise.id, exercise]));
        const allSets = workoutDetail.exercises.flatMap(({ workoutExercise, sets: setRows }) =>
          setRows.map((setRow) => ({
            exerciseId: workoutExercise.exerciseId,
            weightKg: setRow.weightKg,
            reps: setRow.reps,
            type: setRow.type,
          })),
        );
        const exerciseIds = [...new Set(workoutDetail.exercises.map((entry) => entry.workoutExercise.exerciseId))];
        const priorBests = await loadPriorBests(db, exerciseIds, workoutId);
        const hits = detectPRs(allSets, priorBests);

        if (cancelled) {
          return;
        }

        setDetail(workoutDetail);
        setExercisesById(exerciseMap);
        setUnit(unitSetting === 'lb' ? 'lb' : 'kg');
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
    }, [workoutId]),
  );

  const volumeKg = useMemo(() => {
    if (!detail) {
      return 0;
    }
    const allSets = detail.exercises.flatMap(({ sets: setRows }) => setRows);
    return workingSetVolume(allSets);
  }, [detail]);

  const durationLabel = useMemo(() => {
    if (!detail?.workout.finishedAt) {
      return '--:--';
    }
    return formatDurationMs(
      new Date(detail.workout.finishedAt).getTime() - new Date(detail.workout.startedAt).getTime(),
    );
  }, [detail]);

  function handleEdit() {
    setActiveWorkout(workoutId, 'editing');
    router.push({ pathname: '/active-workout/[workoutId]', params: { workoutId: String(workoutId) } });
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Workout not found.</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backLink}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const { workout } = detail;
  const title = workoutTitle(workout.startedAt, workout.name);

  return (
    <View style={styles.flex}>
      <View style={[styles.appbar, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>‹ History</Text>
        </Pressable>
        <Pressable onPress={handleEdit} accessibilityRole="button" style={styles.editButton}>
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading} numberOfLines={2}>
          {title}
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{durationLabel}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {kgToDisplay(volumeKg, unit)} {unit}
            </Text>
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

        <View style={styles.exerciseList}>
          {detail.exercises.map(({ workoutExercise, sets: setRows }) => {
            const exercise = exercisesById.get(workoutExercise.exerciseId);
            return (
              <View key={workoutExercise.id} style={styles.exerciseBlock}>
                <Text style={styles.exerciseName}>{exercise?.name ?? 'Unknown exercise'}</Text>
                {setRows.map((setRow) => (
                  <View key={setRow.id} style={styles.setRow}>
                    <Text style={styles.setIndex}>{setRow.type === 'warmup' ? 'W' : setRow.setNumber}</Text>
                    <Text style={styles.setText}>
                      {kgToDisplay(setRow.weightKg, unit)} {unit} × {setRow.reps}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      </ScrollView>
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
    gap: theme.spacing.md,
  },
  notFoundText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  backLink: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
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
  editButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingLeft: theme.spacing.md,
  },
  editText: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
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
  exerciseList: {
    gap: theme.spacing.md,
  },
  exerciseBlock: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  exerciseName: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    minHeight: 40,
  },
  setIndex: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    width: 20,
    textAlign: 'center',
    fontWeight: '700',
  },
  setText: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
});
