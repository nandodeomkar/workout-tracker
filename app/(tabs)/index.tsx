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

import { FolderSectionHeader } from '../../components/FolderSectionHeader';
import { TemplateRow } from '../../components/TemplateRow';
import { WorkoutRow } from '../../components/WorkoutRow';
import { db } from '../../db/client';
import {
  loadActiveProgram,
  loadProgramDetail,
  startWorkoutFromProgramDay,
  type ActiveProgramDetail,
} from '../../db/programs';
import { getSetting } from '../../db/settings';
import {
  loadTemplateDetail,
  loadTemplatesGroupedByFolder,
  startWorkoutFromTemplate,
} from '../../db/templates';
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

// Uncategorized bucket's stable expanded-state key (templates.folder is
// null for it — Map/Record keys must be strings, D-05).
const UNCATEGORIZED_KEY = '__uncategorized__';

interface TemplateGroupDisplay {
  folder: string | null;
  templates: { id: number; name: string; exerciseCount: number }[];
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

  // Folder-grouped template list (TMPL-01/D-05) — reloads on every focus
  // (own cancelled-guard, independent of the resume-info load above since it
  // doesn't depend on activeWorkoutId) so a template just created/edited in
  // the builder shows up immediately on return.
  const [templateGroups, setTemplateGroups] = useState<TemplateGroupDisplay[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [startingFromTemplate, setStartingFromTemplate] = useState(false);

  // "Next in program" card (PROG-01/D-01/D-04, UI-SPEC screen 1) — own
  // cancelled-guard load, independent of the resume/template loads above,
  // reloading on every focus so a program added/removed elsewhere (Settings
  // -> Programs) is never stale. Omitted entirely (no card, no empty state)
  // when no program is active (D-01).
  const [activeProgram, setActiveProgram] = useState<ActiveProgramDetail | undefined>(undefined);
  const [programTotalDays, setProgramTotalDays] = useState(0);
  const [startingFromProgram, setStartingFromProgram] = useState(false);

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

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const loadTemplates = async () => {
        const groups = await loadTemplatesGroupedByFolder(db);
        const withCounts: TemplateGroupDisplay[] = await Promise.all(
          groups.map(async (group) => ({
            folder: group.folder,
            templates: await Promise.all(
              group.templates.map(async (template) => {
                const detail = await loadTemplateDetail(db, template.id);
                return { id: template.id, name: template.name, exerciseCount: detail?.exercises.length ?? 0 };
              }),
            ),
          })),
        );
        if (cancelled) {
          return;
        }
        setTemplateGroups(withCounts);
        setExpandedFolders((prev) => {
          const next = { ...prev };
          for (const group of withCounts) {
            const key = group.folder ?? UNCATEGORIZED_KEY;
            if (!(key in next)) {
              next[key] = true; // default expanded (D-05)
            }
          }
          return next;
        });
      };

      void loadTemplates();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const loadProgram = async () => {
        const active = await loadActiveProgram(db);
        if (cancelled) {
          return;
        }
        if (!active) {
          setActiveProgram(undefined);
          setProgramTotalDays(0);
          return;
        }
        const detail = await loadProgramDetail(db, active.program.id);
        if (cancelled) {
          return;
        }
        setActiveProgram(active);
        setProgramTotalDays(detail?.days.length ?? 0);
      };

      void loadProgram();
      return () => {
        cancelled = true;
      };
    }, []),
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

  function toggleFolder(key: string) {
    setExpandedFolders((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // Starts a workout from a template (TMPL-02/D-05): startWorkoutFromTemplate
  // writes workouts.template_id and copies template_exercises into
  // workout_exercises in position order (db/templates.ts, Plan 03) — no
  // ad-hoc copy loop here (T-03-14).
  const handlePickTemplate = async (templateId: number) => {
    if (startingFromTemplate) {
      return;
    }
    setStartingFromTemplate(true);
    try {
      const workout = await startWorkoutFromTemplate(db, templateId);
      setActiveWorkout(workout.id, 'logging');
      router.push({ pathname: '/active-workout/[workoutId]', params: { workoutId: String(workout.id) } });
    } finally {
      setStartingFromTemplate(false);
    }
  };

  // Starts the active program's currently-pointed-to day (D-01/D-04):
  // startWorkoutFromProgramDay (db/programs.ts) writes the origin marker
  // (D-05) and re-confirms the pointer at this position — mirrors
  // handlePickTemplate's guard-against-double-tap + navigation.
  const handleStartProgramDay = async () => {
    if (startingFromProgram || !activeProgram?.currentDay) {
      return;
    }
    setStartingFromProgram(true);
    try {
      const workout = await startWorkoutFromProgramDay(
        db,
        activeProgram.program.id,
        activeProgram.currentDay.day.position,
      );
      setActiveWorkout(workout.id, 'logging');
      router.push({ pathname: '/active-workout/[workoutId]', params: { workoutId: String(workout.id) } });
    } finally {
      setStartingFromProgram(false);
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
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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

        {activeProgram?.currentDay ? (
          <Pressable
            onPress={() => void handleStartProgramDay()}
            disabled={startingFromProgram}
            accessibilityRole="button"
            style={styles.programCard}
          >
            <Text style={styles.programCardTitle}>{'🗓️'} {activeProgram.program.name}</Text>
            <Text style={styles.programCardMeta}>
              {`Day ${activeProgram.currentDay.day.position + 1} of ${programTotalDays}: ${activeProgram.currentDay.template.template.name}`}
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.templatesSection}>
          <View style={styles.templatesSectionHeader}>
            <Text style={styles.sectionTitle}>Templates</Text>
            <Pressable
              onPress={() => router.push('/templates/new')}
              accessibilityRole="button"
              style={styles.newTemplateButton}
            >
              <Text style={styles.newTemplateButtonText}>+ New template</Text>
            </Pressable>
          </View>

          {templateGroups.length === 0 ? (
            <Text style={styles.emptyBody}>No templates yet. Create one to start faster next time.</Text>
          ) : (
            templateGroups.map((group) => {
              const key = group.folder ?? UNCATEGORIZED_KEY;
              const expanded = expandedFolders[key] ?? true;
              return (
                <View key={key} style={styles.folderGroup}>
                  <FolderSectionHeader
                    title={group.folder ?? 'Uncategorized'}
                    count={group.templates.length}
                    expanded={expanded}
                    onToggle={() => toggleFolder(key)}
                  />
                  {expanded
                    ? group.templates.map((template) => (
                        <TemplateRow
                          key={template.id}
                          label={template.name}
                          exerciseCount={template.exerciseCount}
                          onPress={() => void handlePickTemplate(template.id)}
                          onEdit={() =>
                            router.push({
                              pathname: '/templates/[templateId]',
                              params: { templateId: String(template.id) },
                            })
                          }
                        />
                      ))
                    : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

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
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing.xl * 2,
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
  programCard: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.accent,
    padding: theme.spacing.lg,
    marginTop: theme.spacing['2xl'],
    gap: theme.spacing.xs,
  },
  programCardTitle: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  programCardMeta: {
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
  templatesSection: {
    marginTop: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  templatesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...theme.typography.title,
    fontSize: 17,
    color: theme.colors.text,
  },
  newTemplateButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  newTemplateButtonText: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  folderGroup: {
    gap: theme.spacing.xs,
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
