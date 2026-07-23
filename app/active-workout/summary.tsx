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
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { db } from '../../db/client';
import { loadAllExercises } from '../../db/exercises';
import { applyProgressionAndAdvance, loadProgramDetail, type ProgramProgressResult } from '../../db/programs';
import { getSetting } from '../../db/settings';
import type { Workout } from '../../db/schema';
import { addTemplateExercise, createTemplate, loadTemplatesGroupedByFolder } from '../../db/templates';
import { loadPriorBests, loadWorkoutDetail, type WorkoutDetail } from '../../db/workouts';
import { detectPRs } from '../../lib/prDetection';
import { buildTemplateExercisesFromWorkout } from '../../lib/templateCapture';
import { workingSetVolume } from '../../lib/volume';
import { kgToDisplay } from '../../lib/weightUnits';
import { useActiveWorkout } from '../../store/activeWorkout';
import { theme } from '../../theme';

type PRHitWithName = ReturnType<typeof detectPRs>[number] & { exerciseName: string };

// Program progress row (finish screen, D-02, UI-SPEC screen 7's Copywriting
// Contract) — pre-rendered text/badge computed once in the load effect
// (exercise names + display-unit formatting resolved there), so render never
// re-derives copy from raw ProgressionOutcome values.
interface ProgramProgressRow {
  key: string;
  text: string;
  badgeText: string | null;
  muted: boolean;
}

// Cycle-complete banner row (D-12, UI-SPEC screen 7) — one pre-rendered line
// per %TM training-max bump, computed once in the load effect alongside
// programProgressRows.
interface CycleCompleteRow {
  key: string;
  text: string;
}

// Android-first transient feedback — copied verbatim from
// exercises/[id].tsx (RESEARCH.md "Android-first transient feedback").
function notify(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}

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
  const [workoutDetail, setWorkoutDetail] = useState<WorkoutDetail | null>(null);
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [volumeKg, setVolumeKg] = useState(0);
  const [prHits, setPrHits] = useState<PRHitWithName[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  // D-02: program-origin finish state (null for an ad-hoc/template-only/empty
  // workout — Pitfall 7, zero layout change for the common case).
  const [programProgress, setProgramProgress] = useState<ProgramProgressResult | null>(null);
  const [programProgressRows, setProgramProgressRows] = useState<ProgramProgressRow[]>([]);
  const [cycleCompleteRows, setCycleCompleteRows] = useState<CycleCompleteRow[]>([]);
  const [nextDayLabel, setNextDayLabel] = useState<string | null>(null);

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

      // D-02/Pitfall 7: guard on program origin BEFORE any program-table
      // query — an ad-hoc/template-only/empty finish does zero program work.
      // applyProgressionAndAdvance runs exactly once here, as part of this
      // one-shot load effect (never re-invoked on re-render).
      const resolvedUnit: 'kg' | 'lb' = unitSetting === 'lb' ? 'lb' : 'kg';
      let progressResult: ProgramProgressResult | null = null;
      let rows: ProgramProgressRow[] = [];
      let cycleRows: CycleCompleteRow[] = [];
      let dayLabel: string | null = null;
      if (detail.workout.programId != null) {
        progressResult = await applyProgressionAndAdvance(db, workoutId);
        if (progressResult.applied) {
          rows = progressResult.outcomes.map((outcome, index) => {
            const exerciseName = exerciseMap.get(outcome.exerciseId)?.name ?? 'Exercise';
            if (outcome.type === 'linear') {
              if (outcome.outcome === 'success') {
                return {
                  key: `${outcome.exerciseId}-${index}`,
                  text: `${exerciseName} — hit all sets.`,
                  badgeText: `+${kgToDisplay(outcome.incrementKg, resolvedUnit)}${resolvedUnit}`,
                  muted: false,
                };
              }
              if (outcome.outcome === 'hold') {
                return {
                  key: `${outcome.exerciseId}-${index}`,
                  text: `${exerciseName} — missed a rep. Same weight next time (${outcome.consecutiveFails}/${outcome.failThreshold}).`,
                  badgeText: null,
                  muted: true,
                };
              }
              // deload
              return {
                key: `${outcome.exerciseId}-${index}`,
                text: `${exerciseName} — ${outcome.failThreshold} misses in a row.`,
                badgeText: `−${Math.round(outcome.deloadPct * 100)}%`,
                muted: false,
              };
            }
            // percent_tm — the per-set prescription line. The TM-bump-on-wrap
            // (Plan 05) IS implemented: applyProgressionAndAdvance bumps
            // training_maxes on a cycle-wrapping finish, surfaced via the
            // cycle-complete banner rows (cycleRows) built below.
            return {
              key: `${outcome.exerciseId}-${index}`,
              text: `${exerciseName} — prescribed ${Math.round(outcome.pct * 100)}% × ${outcome.reps}.`,
              badgeText: null,
              muted: false,
            };
          });

          const programDetail = await loadProgramDetail(db, detail.workout.programId);
          const nextDay = programDetail?.days.find((d) => d.day.position === progressResult!.nextPosition);
          dayLabel = nextDay?.template.template.name ?? null;

          // D-12/UI-SPEC screen 7: cycle-complete banner rows — one line per
          // %TM training max bumped on THIS finish (only ever non-empty when
          // progressResult.wrapped is true, per applyProgressionAndAdvance's
          // own wrapped-only gate).
          cycleRows = progressResult.bumpedTrainingMaxes.map((bump, index) => {
            const exerciseName = exerciseMap.get(bump.exerciseId)?.name ?? 'Exercise';
            const deltaDisplay = kgToDisplay(bump.newTmKg - bump.previousTmKg, resolvedUnit);
            const newTmDisplay = kgToDisplay(bump.newTmKg, resolvedUnit);
            return {
              key: `${bump.exerciseId}-${index}`,
              text: `${exerciseName} training max +${deltaDisplay}${resolvedUnit} → ${newTmDisplay}${resolvedUnit}`,
            };
          });
        }
      }

      if (cancelled) {
        return;
      }

      setWorkout(detail.workout);
      setWorkoutDetail(detail);
      setUnit(resolvedUnit);
      setVolumeKg(workingSetVolume(allSets));
      setPrHits(
        hits.map((hit) => ({
          ...hit,
          exerciseName: exerciseMap.get(hit.exerciseId)?.name ?? 'Exercise',
        })),
      );
      setProgramProgress(progressResult);
      setProgramProgressRows(rows);
      setCycleCompleteRows(cycleRows);
      setNextDayLabel(dayLabel);
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

  // Save-as-template (TMPL-03/D-02/D-03): maps the just-finished workout's
  // exercises into the pure capture shape, aggregates working-set counts +
  // typical (last non-warmup) reps via lib/templateCapture.ts, then creates
  // an Uncategorized template (folder null) with those rows. targetWeightKg
  // is always null — weights come from last-performance pre-fill the next
  // time the template is started (see lib/templatePrefill.ts).
  async function handleSaveAsTemplate() {
    if (!workout || !workoutDetail || savingTemplate) {
      return;
    }
    setSavingTemplate(true);
    try {
      const captureInput = workoutDetail.exercises.map(({ workoutExercise, sets: setRows }) => ({
        exerciseId: workoutExercise.exerciseId,
        sets: setRows.map((setRow) => ({ reps: setRow.reps, type: setRow.type })),
      }));
      const captured = buildTemplateExercisesFromWorkout(captureInput);

      const groups = await loadTemplatesGroupedByFolder(db);
      const uncategorizedGroup = groups.find((group) => group.folder === null);
      const position = uncategorizedGroup?.templates.length ?? 0;

      const created = await createTemplate(db, { name: workoutLabel(workout), folder: null, position });
      for (const exercise of captured) {
        await addTemplateExercise(db, {
          templateId: created.id,
          exerciseId: exercise.exerciseId,
          position: exercise.position,
          targetSets: exercise.targetSets,
          targetReps: exercise.targetReps,
          targetWeightKg: null,
        });
      }
      notify('Saved as template');
    } catch {
      notify("Couldn't save as template. Check your device storage and try again.");
    } finally {
      setSavingTemplate(false);
    }
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

        {/* D-12/UI-SPEC screen 7: cycle-complete banner — a distinct
            accent-bordered surface card (resumeCard treatment) ABOVE the
            per-exercise Program-progress rows, rendered only on the
            cycle-wrapping finish that actually bumped at least one %TM
            training max. The one place an exclamation mark is allowed
            (rare celebratory event, Copywriting Contract). */}
        {programProgress?.wrapped && cycleCompleteRows.length > 0 ? (
          <View style={styles.cycleCompleteCard}>
            <Text style={styles.cycleCompleteHeading}>🎉 Cycle complete</Text>
            {cycleCompleteRows.map((row) => (
              <Text key={row.key} style={styles.cycleCompleteLine}>
                {row.text}
              </Text>
            ))}
          </View>
        ) : null}

        {/* D-02: Program progress — only rendered for a program-origin finish
            (programProgress?.applied), zero layout change for ad-hoc/
            template-only/empty finishes. %TM informational rows show no
            badge (weight was prescribed, not earned) — the TM-bump write
            itself is reported above via the cycle-complete banner, not here. */}
        {programProgress?.applied && programProgressRows.length > 0 ? (
          <View style={styles.programProgressSection}>
            <Text style={styles.programProgressHeading}>Program progress</Text>
            <View style={styles.prList}>
              {programProgressRows.map((row) => (
                <View key={row.key} style={styles.prRow}>
                  {row.badgeText ? (
                    <View style={styles.prBadge}>
                      <Text style={styles.prBadgeText}>{row.badgeText}</Text>
                    </View>
                  ) : null}
                  <Text style={[styles.prText, row.muted && styles.mutedOutcomeText]} numberOfLines={2}>
                    {row.text}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {programProgress?.applied ? (
          <Text style={styles.nextUpCaption}>
            Next up: Day {programProgress.nextPosition + 1} of {programProgress.totalDays}
            {nextDayLabel ? ` — ${nextDayLabel}` : ''}.
          </Text>
        ) : null}

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
        onPress={() => void handleSaveAsTemplate()}
        accessibilityRole="button"
        disabled={savingTemplate}
        style={[styles.saveTemplateButton, { opacity: savingTemplate ? 0.6 : 1 }]}
      >
        <Text style={styles.saveTemplateButtonText}>Save as template</Text>
      </Pressable>

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
  cycleCompleteCard: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.accent,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  cycleCompleteHeading: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  cycleCompleteLine: {
    ...theme.typography.caption,
    color: theme.colors.text,
  },
  programProgressSection: {
    gap: theme.spacing.sm,
  },
  programProgressHeading: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  mutedOutcomeText: {
    color: theme.colors.textMuted,
  },
  nextUpCaption: {
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
  saveTemplateButton: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  saveTemplateButtonText: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
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
