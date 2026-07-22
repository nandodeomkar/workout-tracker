// Workout tab: session entry point (LOG-01/LOG-02, D-15, UI-SPEC "2.
// Start-workout entry").
//
// Two mutually exclusive states this plan implements:
//   - Active session in progress (resumed on cold start via
//     `findResumableWorkout`, RESEARCH.md Pattern 1, or already known to
//     Zustand this app-lifetime) -> a single "Resume workout" card.
//   - No active session -> "Start empty workout" (wired) plus a clearly
//     non-interactive "Start from history" placeholder (Plan 07 wires it
//     up) and the first-use empty-state copy.
//
// Reload runs on every focus via the cancelled-guard pattern from
// exercises/index.tsx, but skips the SQLite round-trip once Zustand already
// holds `activeWorkoutId` for this app lifetime.

import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { db } from '../../db/client';
import { findResumableWorkout, loadWorkoutDetail, startWorkout } from '../../db/workouts';
import type { Workout } from '../../db/schema';
import { useActiveWorkout } from '../../store/activeWorkout';
import { theme } from '../../theme';

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
  const activeWorkoutId = useActiveWorkout((state) => state.activeWorkoutId);
  const setActiveWorkout = useActiveWorkout((state) => state.setActiveWorkout);

  const [checking, setChecking] = useState(true);
  const [resumeInfo, setResumeInfo] = useState<ResumeInfo | null>(null);
  const [starting, setStarting] = useState(false);

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

          {/* Non-interactive placeholder — "Start from history" ships in
              Plan 07 (D-04). Rendered so the layout matches the locked
              UI-SPEC without implying functionality that isn't wired yet. */}
          <View style={[styles.startButtonOutline, styles.startButtonOutlineDisabled]}>
            <Text style={styles.startButtonOutlineText}>Start from history</Text>
          </View>

          <Text style={styles.emptyHeading}>No workout in progress</Text>
          <Text style={styles.emptyBody}>Start an empty workout, or repeat one from your history.</Text>
        </View>
      )}
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
  },
  startButtonOutlineDisabled: {
    opacity: 0.4,
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
});
