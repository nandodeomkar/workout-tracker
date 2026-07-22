// Workout tab: session entry point (LOG-01/LOG-02, D-15, UI-SPEC "2.
// Start-workout entry").
//
// Two mutually exclusive states this plan implements:
//   - Active session in progress (resumed on cold start via
//     `findResumableWorkout`, RESEARCH.md Pattern 1, or already known to
//     Zustand this app-lifetime) -> a single "Resume workout" card.
//   - No active session -> "Start empty workout" plus "Start from history"
//     (Plan 07, D-04): opens a picker (reusing WorkoutRow) over
//     `loadWorkoutHistory`; picking one starts a NEW workout, copies the
//     picked workout's exercise list in order via `addWorkoutExercise`
//     (D-05), and hands off to the active-workout screen, where each card
//     pre-fills from its OWN most-recent performance via `loadLastPerformance`
//     (D-06) — not necessarily the picked workout's numbers.
//
// Reload runs on every focus via the cancelled-guard pattern from
// exercises/index.tsx, but skips the SQLite round-trip once Zustand already
// holds `activeWorkoutId` for this app lifetime.

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { WorkoutRow } from '../../components/WorkoutRow';
import { db } from '../../db/client';
import { getSetting } from '../../db/settings';
import {
  addWorkoutExercise,
  findResumableWorkout,
  loadWorkoutDetail,
  loadWorkoutHistory,
  startWorkout,
  type WorkoutHistoryEntry,
} from '../../db/workouts';
import type { Workout } from '../../db/schema';
import { useActiveWorkout } from '../../store/activeWorkout';
import { theme } from '../../theme';

function workoutLabel(workout: Workout): string {
  if (workout.name && workout.name.trim().length > 0) {
    return workout.name;
  }
  return new Date(workout.startedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function durationMsFor(workout: Workout): number | null {
  if (!workout.finishedAt) {
    return null;
  }
  return Math.max(0, new Date(workout.finishedAt).getTime() - new Date(workout.startedAt).getTime());
}

interface ResumeInfo {
  workout: Workout;
  exerciseCount: number;
}

function formatStartedAt(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

async function loadResumeInfo(workoutId: number): Promise<ResumeInfo | null> {
  const detail = await loadWorkoutDetail(db, workoutId);
  if (!detail) {
    return null;
  }
  return { workout: detail.workout, exerciseCount: detail.exercises.length };
}

export default function WorkoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeWorkoutId = useActiveWorkout((state) => state.activeWorkoutId);
  const setActiveWorkout = useActiveWorkout((state) => state.setActiveWorkout);

  const [checking, setChecking] = useState(true);
  const [resumeInfo, setResumeInfo] = useState<ResumeInfo | null>(null);
  const [starting, setStarting] = useState(false);
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');

  // "Start from history" picker (D-04) — reuses WorkoutRow, filtered to
  // finished workouts via loadWorkoutHistory (same query History's List view
  // uses).
  const [historyPickerOpen, setHistoryPickerOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<WorkoutHistoryEntry[]>([]);
  const [startingFromHistory, setStartingFromHistory] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setChecking(true);

      const load = async () => {
        if (activeWorkoutId != null) {
          // Zustand already knows a session is active this app lifetime
          // (RESEARCH.md Pattern 1) — just refresh its display info.
          const info = await loadResumeInfo(activeWorkoutId);
          if (!cancelled) {
            setResumeInfo(info);
            setChecking(false);
          }
          return;
        }
        const row = await findResumableWorkout(db);
        if (cancelled) {
          return;
        }
        if (!row) {
          setResumeInfo(null);
          setChecking(false);
          return;
        }
        const info = await loadResumeInfo(row.id);
        if (!cancelled) {
          setResumeInfo(info);
          setChecking(false);
        }
      };

      void load();
      return () => {
        cancelled = true;
      };
    }, [activeWorkoutId]),
  );

  useEffect(() => {
    if (!historyPickerOpen) {
      return;
    }
    let cancelled = false;
    Promise.all([loadWorkoutHistory(db), getSetting(db, 'units')]).then(([rows, unitSetting]) => {
      if (!cancelled) {
        setHistoryEntries(rows);
        setUnit(unitSetting === 'lb' ? 'lb' : 'kg');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [historyPickerOpen]);

  const handleResume = () => {
    const workout = resumeInfo?.workout;
    if (!workout) {
      return;
    }
    setActiveWorkout(workout.id, 'logging');
    router.push({ pathname: '/active-workout/[workoutId]', params: { workoutId: String(workout.id) } });
  };

  const handleStartEmpty = async () => {
    if (starting) {
      return;
    }
    setStarting(true);
    try {
      const workout = await startWorkout(db);
      setActiveWorkout(workout.id, 'logging');
      router.push({ pathname: '/active-workout/[workoutId]', params: { workoutId: String(workout.id) } });
    } finally {
      setStarting(false);
    }
  };

  function closeHistoryPicker() {
    setHistoryPickerOpen(false);
  }

  // Starts a NEW workout copying the picked workout's exercise list (D-05);
  // pre-fill happens naturally once the active-workout screen loads — each
  // card has zero sets yet, so it pre-fills from its own most-recent
  // performance via loadLastPerformance (D-06), not necessarily the picked
  // workout's numbers.
  const handlePickHistoryWorkout = async (pickedWorkoutId: number) => {
    if (startingFromHistory) {
      return;
    }
    setStartingFromHistory(true);
    try {
      const sourceDetail = await loadWorkoutDetail(db, pickedWorkoutId);
      const workout = await startWorkout(db);
      if (sourceDetail) {
        for (let index = 0; index < sourceDetail.exercises.length; index += 1) {
          const { workoutExercise } = sourceDetail.exercises[index];
          await addWorkoutExercise(db, workout.id, workoutExercise.exerciseId, index);
        }
      }
      setActiveWorkout(workout.id, 'logging');
      closeHistoryPicker();
      router.push({ pathname: '/active-workout/[workoutId]', params: { workoutId: String(workout.id) } });
    } finally {
      setStartingFromHistory(false);
    }
  };

  if (checking) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Workout</Text>

      {resumeInfo ? (
        <Pressable onPress={handleResume} accessibilityRole="button" style={styles.resumeCard}>
          <Text style={styles.resumeTitle}>Resume workout</Text>
          <Text style={styles.resumeMeta}>
            Started {formatStartedAt(resumeInfo.workout.startedAt)} · {resumeInfo.exerciseCount}{' '}
            {resumeInfo.exerciseCount === 1 ? 'exercise' : 'exercises'}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.startGroup}>
          <Pressable
            onPress={handleStartEmpty}
            disabled={starting}
            accessibilityRole="button"
            style={[styles.startButton, starting ? styles.startButtonDisabled : null]}
          >
            <Text style={styles.startButtonText}>Start empty workout</Text>
          </Pressable>

          <Pressable
            onPress={() => setHistoryPickerOpen(true)}
            accessibilityRole="button"
            style={styles.startButtonOutline}
          >
            <Text style={styles.startButtonOutlineText}>Start from history</Text>
          </Pressable>

          <Text style={styles.emptyHeading}>No workout in progress</Text>
          <Text style={styles.emptyBody}>Start an empty workout, or repeat one from your history.</Text>
        </View>
      )}

      {historyPickerOpen ? (
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerHeader, { paddingTop: insets.top + theme.spacing.sm }]}>
            <Pressable onPress={closeHistoryPicker} accessibilityRole="button" style={styles.pickerCancelButton}>
              <Text style={styles.pickerCancelText}>‹ Cancel</Text>
            </Pressable>
            <Text style={styles.pickerTitle}>Start from history</Text>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {historyEntries.length === 0 ? (
              <View style={styles.pickerEmpty}>
                <Text style={styles.pickerEmptyText}>No workouts yet</Text>
              </View>
            ) : (
              historyEntries.map((entry) => (
                <WorkoutRow
                  key={entry.workout.id}
                  label={workoutLabel(entry.workout)}
                  exerciseCount={entry.exerciseCount}
                  totalVolumeKg={entry.totalVolumeKg}
                  durationMs={durationMsFor(entry.workout)}
                  unit={unit}
                  onPress={() => void handlePickHistoryWorkout(entry.workout.id)}
                />
              ))
            )}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
    marginBottom: theme.spacing.xl,
  },
  resumeCard: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.accent,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  resumeTitle: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  resumeMeta: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  startGroup: {
    gap: theme.spacing.md,
  },
  startButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  startButtonDisabled: {
    opacity: 0.6,
  },
  startButtonText: {
    ...theme.typography.body,
    color: theme.colors.background,
    fontWeight: '700',
  },
  startButtonOutline: {
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  startButtonOutlineText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  emptyHeading: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
  },
  emptyBody: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  pickerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.background,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  pickerCancelButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: theme.spacing.md,
  },
  pickerCancelText: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  pickerTitle: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  pickerEmpty: {
    alignItems: 'center',
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  pickerEmptyText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
