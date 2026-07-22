// Active-workout logging screen (LOG-01/LOG-02/LOG-03/LOG-05/D-01/D-06/D-07/
// D-08/D-09/D-15, UI-SPEC "1. Active workout screen") — the app's core loop:
// pre-filled checkmark-to-log sets, immediate crash-safe SQLite writes,
// add-exercise via the reused Phase-1 picker, an auto-starting rest timer,
// drag-reorder, replace/remove, and Discard/Finish.
//
// Mode (Pitfall 1): `logging` inserts new `sets` rows on checkmark;
// `editing` (History's future "Edit" entry, Plan 07) updates existing rows
// instead of duplicate-inserting. Any row that already has a `setId` is
// persisted via `updateSet` the instant it changes (steppers/keypad/warmup)
// — this covers both "editing mode field edits persist on change" (Pitfall
// 1) and "an already-logged set edited later in the same logging session
// stays in sync with what's on screen."
//
// Rest timer (LOG-03/D-07/D-09): auto-starts the instant a set is logged in
// `logging` mode only (never in `editing` mode — editing a past workout is
// not a live session). Duration resolves from the card's exercise's
// `rest_seconds` override, falling back to `settings.default_rest_seconds`
// (D-07/D-08, Pattern 5). `restEndsAt` is an absolute wall-clock timestamp
// stored in the Zustand session store (RESEARCH.md Pitfall 4) so
// `RestTimerBar` can recompute remaining time without drift.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { ExerciseCard, type SetRowViewModel } from '../../components/ExerciseCard';
import { ExerciseRow } from '../../components/ExerciseRow';
import { FilterChipRow } from '../../components/FilterChipRow';
import { MuscleGroupPills } from '../../components/MuscleGroupPills';
import { NumericKeypad } from '../../components/NumericKeypad';
import { RestTimerBar } from '../../components/RestTimerBar';
import { EQUIPMENT, type EquipmentType, type MuscleGroup } from '../../constants/taxonomy';
import { db } from '../../db/client';
import { loadActiveExercises, loadAllExercises } from '../../db/exercises';
import { getSetting } from '../../db/settings';
import type { Exercise, Workout } from '../../db/schema';
import {
  addWorkoutExercise,
  insertSet,
  loadLastPerformance,
  loadWorkoutDetail,
  removeWorkoutExercise,
  reorderWorkoutExercises,
  replaceWorkoutExercise,
  setExerciseRestOverride,
  updateSet,
} from '../../db/workouts';
import { filterExercises } from '../../lib/exerciseFilter';
import {
  cancelRestNotification,
  ensureNotificationChannel,
  requestRestPermission,
  scheduleRestNotification,
} from '../../lib/restTimer';
import { displayToKg, kgToDisplay } from '../../lib/weightUnits';
import { useActiveWorkout } from '../../store/activeWorkout';
import { theme } from '../../theme';

const DEFAULT_REST_SECONDS_FALLBACK = 90;

// Android-first transient feedback — copied verbatim from
// exercises/[id].tsx (RESEARCH.md "Android-first transient feedback").
function notify(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}

const WEIGHT_STEP_KG = 2.5;
const WEIGHT_STEP_LB = 5;

function stepWeightKg(currentKg: number, unit: 'kg' | 'lb', direction: 1 | -1): number {
  if (unit === 'kg') {
    return Math.max(0, currentKg + direction * WEIGHT_STEP_KG);
  }
  const currentLb = kgToDisplay(currentKg, 'lb');
  const nextLb = Math.max(0, currentLb + direction * WEIGHT_STEP_LB);
  return displayToKg(nextLb, 'lb');
}

interface Row {
  key: string;
  setId: number | null;
  setNumber: number;
  weightKg: number;
  reps: number;
  isWarmup: boolean;
  isCompleted: boolean;
}

interface ExerciseEntry {
  weId: number;
  exerciseId: number;
  name: string;
  muscleGroup: string;
  /** Per-exercise rest override (D-08); null = use the global default. */
  restSecondsOverride: number | null;
}

function emptyRow(prefixId: number | string, setNumber: number): Row {
  return {
    key: `p-${prefixId}-${setNumber}`,
    setId: null,
    setNumber,
    weightKg: 0,
    reps: 0,
    isWarmup: false,
    isCompleted: false,
  };
}

export default function ActiveWorkoutScreen() {
  const { workoutId: workoutIdParam } = useLocalSearchParams<{ workoutId: string }>();
  const workoutId = Number(workoutIdParam);
  const insets = useSafeAreaInsets();
  const mode = useActiveWorkout((state) => state.mode);
  const restEndsAt = useActiveWorkout((state) => state.restEndsAt);
  const restNotificationId = useActiveWorkout((state) => state.restNotificationId);
  const setRestEndsAt = useActiveWorkout((state) => state.setRestEndsAt);
  const setRestNotificationId = useActiveWorkout((state) => state.setRestNotificationId);

  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [exerciseEntries, setExerciseEntries] = useState<ExerciseEntry[]>([]);
  const [rowsByWE, setRowsByWE] = useState<Record<number, Row[]>>({});
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [defaultRestSeconds, setDefaultRestSeconds] = useState(DEFAULT_REST_SECONDS_FALLBACK);
  const [restTotalSeconds, setRestTotalSeconds] = useState(DEFAULT_REST_SECONDS_FALLBACK);
  const [notificationsDenied, setNotificationsDenied] = useState(false);
  const [editingTarget, setEditingTarget] = useState<{
    weId: number;
    rowKey: string;
    field: 'weight' | 'reps';
  } | null>(null);

  // Add-exercise picker (reuses the Phase-1 ExerciseRow/MuscleGroupPills/
  // FilterChipRow components wholesale, per UI-SPEC "Exercise picker").
  // Plan 05 (LOG-04) reuses the same overlay for Replace — `pickerMode`
  // distinguishes the two so a single `handleSelectExercise` can branch.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'add' | 'replace'>('add');
  const [replaceTargetWeId, setReplaceTargetWeId] = useState<number | null>(null);
  const [pickerExercises, setPickerExercises] = useState<Exercise[]>([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerMuscleGroup, setPickerMuscleGroup] = useState<MuscleGroup | null>(null);
  const [pickerEquipment, setPickerEquipment] = useState<EquipmentType[]>([]);

  // Measured on-screen position of each exercise card (LOG-04 drag-reorder,
  // RESEARCH.md "hand-roll via gesture-handler+reanimated"). Populated by
  // each card wrapper's `onLayout`; read only on drag-end to translate a
  // gesture's net vertical movement into a target index — a ref (not state)
  // because layout updates must never trigger a re-render.
  const cardLayoutsRef = useRef<Record<number, { y: number; height: number }>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [detail, exercisesList, unitSetting, defaultRestSetting] = await Promise.all([
      loadWorkoutDetail(db, workoutId),
      loadAllExercises(db),
      getSetting(db, 'units'),
      getSetting(db, 'default_rest_seconds'),
    ]);

    if (!detail) {
      setWorkout(null);
      setLoading(false);
      return;
    }

    setWorkout(detail.workout);
    setUnit(unitSetting === 'lb' ? 'lb' : 'kg');
    const parsedDefaultRest = Number(defaultRestSetting ?? DEFAULT_REST_SECONDS_FALLBACK);
    setDefaultRestSeconds(Number.isFinite(parsedDefaultRest) ? parsedDefaultRest : DEFAULT_REST_SECONDS_FALLBACK);

    const exerciseMap = new Map(exercisesList.map((exercise) => [exercise.id, exercise]));
    const entries: ExerciseEntry[] = [];
    const nextRows: Record<number, Row[]> = {};

    for (const { workoutExercise, sets: setRows } of detail.exercises) {
      const exercise = exerciseMap.get(workoutExercise.exerciseId);
      entries.push({
        weId: workoutExercise.id,
        exerciseId: workoutExercise.exerciseId,
        name: exercise?.name ?? 'Unknown exercise',
        muscleGroup: exercise?.muscleGroup ?? 'Other',
        restSecondsOverride: exercise?.restSeconds ?? null,
      });

      if (setRows.length > 0) {
        nextRows[workoutExercise.id] = setRows.map((setRow) => ({
          key: `s-${setRow.id}`,
          setId: setRow.id,
          setNumber: setRow.setNumber,
          weightKg: setRow.weightKg,
          reps: setRow.reps,
          isWarmup: setRow.type === 'warmup',
          isCompleted: true,
        }));
      } else {
        // No completed sets on this card yet — pre-fill from the exercise's
        // last FINISHED performance (D-06/Pattern 2). Empty (a single blank
        // row) when this exercise has never been logged.
        const lastPerformance = await loadLastPerformance(db, workoutExercise.exerciseId);
        nextRows[workoutExercise.id] =
          lastPerformance.length > 0
            ? lastPerformance.map((setRow, index) => ({
                key: `p-${workoutExercise.id}-${index}`,
                setId: null,
                setNumber: index + 1,
                weightKg: setRow.weightKg,
                reps: setRow.reps,
                isWarmup: setRow.type === 'warmup',
                isCompleted: false,
              }))
            : [emptyRow(workoutExercise.id, 1)];
      }
    }

    setExerciseEntries(entries);
    setRowsByWE(nextRows);
    setLoading(false);
  }, [workoutId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Ticking elapsed-time readout in the app-bar. Recomputed from the
  // workout's absolute `startedAt` every tick, never a decrementing counter
  // (same drift-avoidance principle as RESEARCH.md's rest-timer guidance).
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Notification channel/permission bootstrap (Pitfall 5: channel MUST exist
  // before the permission request). Logging-mode only — editing a past
  // workout never schedules rest notifications. Denial only drives the
  // non-blocking "Notifications are off" banner (LOG-03 must never gate
  // logging), never a crash or blocking dialog.
  useEffect(() => {
    if (mode !== 'logging') {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await ensureNotificationChannel();
        const granted = await requestRestPermission();
        if (!cancelled) {
          setNotificationsDenied(!granted);
        }
      } catch {
        if (!cancelled) {
          setNotificationsDenied(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // Cancels any outstanding rest notification when this screen unmounts
  // entirely (e.g. Discard/Finish navigate away) so a stale alert never
  // fires for a session that's no longer active (T-02-16).
  useEffect(() => {
    return () => {
      void cancelRestNotification(useActiveWorkout.getState().restNotificationId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-starts (or restarts) the rest timer on ✓ (D-07/D-09) — resolves
  // duration from the card's exercise rest override, falling back to the
  // global default (Pattern 5), cancels any outstanding notification, and
  // schedules a new one. Never throws into the caller: a notification
  // scheduling failure must not block logging (LOG-03).
  async function startRestTimer(seconds: number) {
    const endsAt = Date.now() + seconds * 1000;
    setRestEndsAt(endsAt);
    setRestTotalSeconds(seconds);
    try {
      await ensureNotificationChannel();
      await cancelRestNotification(restNotificationId);
      const id = await scheduleRestNotification(seconds);
      setRestNotificationId(id);
    } catch {
      setRestNotificationId(null);
    }
  }

  async function handleSkipRest() {
    try {
      await cancelRestNotification(restNotificationId);
    } catch {
      // Non-blocking — the on-screen bar clears regardless.
    }
    setRestEndsAt(null);
    setRestNotificationId(null);
  }

  // ±15s (D-09): recompute the absolute end time and cancel/reschedule the
  // notification against it. Subtracting past zero ends the rest early,
  // same as Skip.
  async function handleAdjustRest(deltaSeconds: number) {
    if (restEndsAt == null) {
      return;
    }
    const nextEndsAt = restEndsAt + deltaSeconds * 1000;
    const remainingMs = nextEndsAt - Date.now();
    if (remainingMs <= 0) {
      await handleSkipRest();
      return;
    }
    setRestEndsAt(nextEndsAt);
    setRestTotalSeconds((prev) => Math.max(1, prev + deltaSeconds));
    try {
      await cancelRestNotification(restNotificationId);
      const id = await scheduleRestNotification(Math.ceil(remainingMs / 1000));
      setRestNotificationId(id);
    } catch {
      setRestNotificationId(null);
    }
  }

  // Rest-override pill (D-08): persists to `exercises.rest_seconds`,
  // updating every card showing this exercise (an exercise's override is
  // global to that exercise, not per-card).
  async function handleChangeRestSeconds(weId: number, restSeconds: number) {
    const entry = exerciseEntries.find((e) => e.weId === weId);
    if (!entry) {
      return;
    }
    try {
      await setExerciseRestOverride(db, entry.exerciseId, restSeconds);
      setExerciseEntries((prev) =>
        prev.map((e) => (e.exerciseId === entry.exerciseId ? { ...e, restSecondsOverride: restSeconds } : e)),
      );
    } catch {
      notify("Couldn't save rest time. Check your device storage and try again.");
    }
  }

  const elapsedLabel = useMemo(() => {
    if (!workout) {
      return '0:00';
    }
    const elapsedMs = Math.max(0, nowTick - new Date(workout.startedAt).getTime());
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }, [workout, nowTick]);

  async function persistRow(row: Row) {
    if (row.setId == null) {
      return;
    }
    try {
      await updateSet(db, row.setId, {
        weightKg: row.weightKg,
        reps: row.reps,
        type: row.isWarmup ? 'warmup' : 'normal',
      });
    } catch {
      notify("Couldn't save that set. Check your device storage and try again.");
    }
  }

  function updateRow(weId: number, rowKey: string, updater: (row: Row) => Row) {
    const rows = rowsByWE[weId] ?? [];
    const nextRows = rows.map((row) => (row.key === rowKey ? updater(row) : row));
    setRowsByWE({ ...rowsByWE, [weId]: nextRows });

    const newRow = nextRows.find((row) => row.key === rowKey);
    // Any row that already has a DB row (setId set) stays in sync the
    // instant it changes — covers both edit-mode field edits (Pitfall 1)
    // and a logging-session set that's tweaked after being logged.
    if (newRow && newRow.setId != null) {
      void persistRow(newRow);
    }
  }

  const handleIncrementWeight = (weId: number, rowKey: string) =>
    updateRow(weId, rowKey, (row) => ({ ...row, weightKg: stepWeightKg(row.weightKg, unit, 1) }));
  const handleDecrementWeight = (weId: number, rowKey: string) =>
    updateRow(weId, rowKey, (row) => ({ ...row, weightKg: stepWeightKg(row.weightKg, unit, -1) }));
  const handleIncrementReps = (weId: number, rowKey: string) =>
    updateRow(weId, rowKey, (row) => ({ ...row, reps: row.reps + 1 }));
  const handleDecrementReps = (weId: number, rowKey: string) =>
    updateRow(weId, rowKey, (row) => ({ ...row, reps: Math.max(0, row.reps - 1) }));
  const handleToggleWarmup = (weId: number, rowKey: string) =>
    updateRow(weId, rowKey, (row) => ({ ...row, isWarmup: !row.isWarmup }));

  function handleEditNumber(weId: number, rowKey: string, field: 'weight' | 'reps') {
    setEditingTarget({ weId, rowKey, field });
  }

  const editingRow = editingTarget
    ? (rowsByWE[editingTarget.weId] ?? []).find((row) => row.key === editingTarget.rowKey)
    : undefined;
  const editingInitialValue =
    editingTarget && editingRow
      ? editingTarget.field === 'weight'
        ? kgToDisplay(editingRow.weightKg, unit)
        : editingRow.reps
      : 0;

  function handleKeypadDone(value: number) {
    if (!editingTarget) {
      return;
    }
    const { weId, rowKey, field } = editingTarget;
    if (field === 'weight') {
      const weightKg = Math.max(0, displayToKg(value, unit));
      updateRow(weId, rowKey, (row) => ({ ...row, weightKg }));
    } else {
      updateRow(weId, rowKey, (row) => ({ ...row, reps: Math.max(0, Math.round(value)) }));
    }
    setEditingTarget(null);
  }

  async function handleLogSet(weId: number, rowKey: string) {
    const rows = rowsByWE[weId] ?? [];
    const row = rows.find((r) => r.key === rowKey);
    if (!row) {
      return;
    }

    if (row.setId != null) {
      // Existing DB row — checkmark re-confirms/updates it, never inserts
      // (Pitfall 1/D-13). In logging mode this is the "already completed,
      // tapping ✓ again is a no-op for now" case (D-01); in editing mode it
      // explicitly re-persists via updateSet.
      if (mode === 'editing') {
        await persistRow(row);
      }
      return;
    }

    // Not-yet-persisted row (pre-filled/added, either mode) — the crash-safe
    // write: exactly one committed `sets` row per checkmark tap (LOG-02/D-15).
    try {
      const created = await insertSet(db, {
        workoutExerciseId: weId,
        setNumber: row.setNumber,
        weightKg: row.weightKg,
        reps: row.reps,
        type: row.isWarmup ? 'warmup' : 'normal',
      });
      setRowsByWE((prev) => {
        const currentRows = prev[weId] ?? [];
        return {
          ...prev,
          [weId]: currentRows.map((r) => (r.key === rowKey ? { ...r, setId: created.id, isCompleted: true } : r)),
        };
      });

      // Auto-start the rest timer (D-07/D-09) — logging mode only; editing a
      // past workout is not a live session (mode gate).
      if (mode === 'logging') {
        const entry = exerciseEntries.find((e) => e.weId === weId);
        const seconds = entry?.restSecondsOverride ?? defaultRestSeconds;
        void startRestTimer(seconds);
      }
    } catch {
      notify("Couldn't save that set. Check your device storage and try again.");
    }
  }

  function handleAddSet(weId: number) {
    const rows = rowsByWE[weId] ?? [];
    const last = rows[rows.length - 1];
    const newRow: Row = {
      key: `p-${weId}-${Date.now()}`,
      setId: null,
      setNumber: rows.length + 1,
      weightKg: last?.weightKg ?? 0,
      reps: last?.reps ?? 0,
      isWarmup: false,
      isCompleted: false,
    };
    setRowsByWE({ ...rowsByWE, [weId]: [...rows, newRow] });
  }

  useEffect(() => {
    if (!pickerOpen) {
      return;
    }
    let cancelled = false;
    loadActiveExercises(db).then((rows) => {
      if (!cancelled) {
        setPickerExercises(rows);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pickerOpen]);

  const pickerFiltered = useMemo(
    () =>
      filterExercises(pickerExercises, {
        search: pickerSearch,
        muscleGroups: pickerMuscleGroup ? [pickerMuscleGroup] : [],
        equipment: pickerEquipment,
      }),
    [pickerExercises, pickerSearch, pickerMuscleGroup, pickerEquipment],
  );

  function closePicker() {
    setPickerOpen(false);
    setPickerMode('add');
    setReplaceTargetWeId(null);
    setPickerSearch('');
    setPickerMuscleGroup(null);
    setPickerEquipment([]);
  }

  async function loadPrefillRows(prefixId: number, exerciseId: number): Promise<Row[]> {
    const lastPerformance = await loadLastPerformance(db, exerciseId);
    return lastPerformance.length > 0
      ? lastPerformance.map((setRow, index) => ({
          key: `p-${prefixId}-${index}`,
          setId: null,
          setNumber: index + 1,
          weightKg: setRow.weightKg,
          reps: setRow.reps,
          isWarmup: setRow.type === 'warmup',
          isCompleted: false,
        }))
      : [emptyRow(prefixId, 1)];
  }

  async function handleAddExercise(exercise: Exercise) {
    const created = await addWorkoutExercise(db, workoutId, exercise.id, exerciseEntries.length);
    const newRows = await loadPrefillRows(created.id, exercise.id);

    setExerciseEntries((prev) => [
      ...prev,
      {
        weId: created.id,
        exerciseId: exercise.id,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        restSecondsOverride: exercise.restSeconds ?? null,
      },
    ]);
    setRowsByWE((prev) => ({ ...prev, [created.id]: newRows }));
    closePicker();
  }

  // Remove the exercise slot and add the picked one back at the same
  // position (LOG-04/FLAG-1) — a *new* workout_exercises row, never a
  // silent `exercise_id` reattribution of the already-logged sets.
  async function handleRemoveAndAddReplacement(weId: number, exercise: Exercise) {
    const position = exerciseEntries.findIndex((entry) => entry.weId === weId);
    await removeWorkoutExercise(db, weId);
    const created = await addWorkoutExercise(db, workoutId, exercise.id, position === -1 ? exerciseEntries.length : position);
    const newRows = await loadPrefillRows(created.id, exercise.id);

    setExerciseEntries((prev) => {
      const next = prev.filter((entry) => entry.weId !== weId);
      const insertAt = position === -1 ? next.length : position;
      next.splice(insertAt, 0, {
        weId: created.id,
        exerciseId: exercise.id,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        restSecondsOverride: exercise.restSeconds ?? null,
      });
      return next;
    });
    setRowsByWE((prev) => {
      const next = { ...prev };
      delete next[weId];
      next[created.id] = newRows;
      return next;
    });
    closePicker();
  }

  // In-place swap when the card has zero logged sets; the FLAG-1 guard in
  // `replaceWorkoutExercise` throws once sets exist, in which case we ask
  // before falling back to remove+re-add (never silently reattribute).
  async function handleReplaceExercise(weId: number, exercise: Exercise) {
    try {
      await replaceWorkoutExercise(db, weId, exercise.id);
      const newRows = await loadPrefillRows(weId, exercise.id);
      setExerciseEntries((prev) =>
        prev.map((entry) =>
          entry.weId === weId
            ? {
                ...entry,
                exerciseId: exercise.id,
                name: exercise.name,
                muscleGroup: exercise.muscleGroup,
                restSecondsOverride: exercise.restSeconds ?? null,
              }
            : entry,
        ),
      );
      setRowsByWE((prev) => ({ ...prev, [weId]: newRows }));
      closePicker();
    } catch {
      Alert.alert(
        'Exercise has logged sets',
        'This exercise has logged sets — remove it and add the new one instead?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove & add', style: 'destructive', onPress: () => void handleRemoveAndAddReplacement(weId, exercise) },
        ],
      );
    }
  }

  async function handleSelectExercise(exercise: Exercise) {
    if (pickerMode === 'replace' && replaceTargetWeId != null) {
      await handleReplaceExercise(replaceTargetWeId, exercise);
      return;
    }
    await handleAddExercise(exercise);
  }

  function openReplacePicker(weId: number) {
    setPickerMode('replace');
    setReplaceTargetWeId(weId);
    setPickerOpen(true);
  }

  // Remove is confirmed only when the card has ≥1 completed set — UI-SPEC's
  // "confirm only when data is actually at risk" rule; a card with nothing
  // logged is removed silently.
  async function doRemoveExercise(weId: number) {
    try {
      await removeWorkoutExercise(db, weId);
      setExerciseEntries((prev) => prev.filter((entry) => entry.weId !== weId));
      setRowsByWE((prev) => {
        const next = { ...prev };
        delete next[weId];
        return next;
      });
    } catch {
      notify("Couldn't remove that exercise. Check your device storage and try again.");
    }
  }

  function handleRemovePress(weId: number, exerciseName: string) {
    const hasCompletedSets = (rowsByWE[weId] ?? []).some((row) => row.isCompleted);
    if (!hasCompletedSets) {
      void doRemoveExercise(weId);
      return;
    }
    Alert.alert(`Remove ${exerciseName}?`, 'Its logged sets in this workout will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void doRemoveExercise(weId) },
    ]);
  }

  function handleOverflowPress(weId: number, exerciseName: string) {
    Alert.alert(exerciseName, undefined, [
      { text: 'Replace', onPress: () => openReplacePicker(weId) },
      { text: 'Remove', style: 'destructive', onPress: () => handleRemovePress(weId, exerciseName) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  // Drag-end (LOG-04/D-16 reorder): translate the released card's net
  // vertical translation into a target index using each card's last
  // measured `onLayout` position, splice the local order, then persist via
  // `reorderWorkoutExercises`. A translation under 8px is treated as a tap
  // (long-press-without-move), not a reorder attempt.
  async function handleReorderDragEnd(weId: number, translationY: number) {
    if (Math.abs(translationY) < 8) {
      return;
    }
    const fromIndex = exerciseEntries.findIndex((entry) => entry.weId === weId);
    const fromLayout = cardLayoutsRef.current[weId];
    if (fromIndex === -1 || !fromLayout) {
      return;
    }

    const draggedCenterY = fromLayout.y + fromLayout.height / 2 + translationY;
    let targetIndex = fromIndex;
    for (let i = 0; i < exerciseEntries.length; i += 1) {
      const layout = cardLayoutsRef.current[exerciseEntries[i].weId];
      if (!layout) {
        continue;
      }
      if (draggedCenterY >= layout.y && draggedCenterY < layout.y + layout.height) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex === fromIndex) {
      return;
    }

    const reordered = [...exerciseEntries];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    setExerciseEntries(reordered);

    try {
      await reorderWorkoutExercises(
        db,
        workoutId,
        reordered.map((entry) => entry.weId),
      );
    } catch {
      notify("Couldn't save the new order. Check your device storage and try again.");
    }
  }

  function toggleEquipment(value: string) {
    setPickerEquipment((prev) =>
      prev.includes(value as EquipmentType)
        ? prev.filter((item) => item !== value)
        : [...prev, value as EquipmentType],
    );
  }

  function toViewModel(row: Row): SetRowViewModel {
    return {
      key: row.key,
      setIndex: row.setNumber,
      weightDisplay: kgToDisplay(row.weightKg, unit),
      repsDisplay: row.reps,
      isWarmup: row.isWarmup,
      isCompleted: row.isCompleted,
    };
  }

  // Discard/Finish are rendered now (UI-SPEC app-bar anatomy) but their
  // confirm dialogs, cascade delete, and summary computation are Plan 06 —
  // intentionally inert here.
  const handleDiscardPress = () => {};
  const handleFinishPress = () => {};

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Workout not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.appbar, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={handleDiscardPress} accessibilityRole="button" style={styles.discardButton}>
          <Text style={styles.discardText}>Discard</Text>
        </Pressable>
        <View style={styles.titleColumn}>
          <Text style={styles.workoutTitle} numberOfLines={1}>
            {workout.name ?? 'Workout'}
          </Text>
          <Text style={styles.elapsedText}>{elapsedLabel}</Text>
        </View>
        <Pressable onPress={handleFinishPress} accessibilityRole="button" style={styles.finishButton}>
          <Text style={styles.finishButtonText}>Finish workout</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {exerciseEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyBody}>Add an exercise to start logging.</Text>
            <Pressable onPress={() => setPickerOpen(true)} accessibilityRole="button">
              <Text style={styles.emptyAction}>＋ Add exercise</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {exerciseEntries.map((entry) => (
              <View
                key={entry.weId}
                onLayout={(event) => {
                  const { y, height } = event.nativeEvent.layout;
                  cardLayoutsRef.current[entry.weId] = { y, height };
                }}
              >
                <ExerciseCard
                  exerciseName={entry.name}
                  muscleGroup={entry.muscleGroup}
                  unit={unit}
                  rows={(rowsByWE[entry.weId] ?? []).map(toViewModel)}
                  restSeconds={entry.restSecondsOverride ?? defaultRestSeconds}
                  onChangeRestSeconds={(seconds) => void handleChangeRestSeconds(entry.weId, seconds)}
                  onLogSet={(rowKey) => void handleLogSet(entry.weId, rowKey)}
                  onAddSet={() => handleAddSet(entry.weId)}
                  onIncrementWeight={(rowKey) => handleIncrementWeight(entry.weId, rowKey)}
                  onDecrementWeight={(rowKey) => handleDecrementWeight(entry.weId, rowKey)}
                  onIncrementReps={(rowKey) => handleIncrementReps(entry.weId, rowKey)}
                  onDecrementReps={(rowKey) => handleDecrementReps(entry.weId, rowKey)}
                  onEditNumber={(rowKey, field) => handleEditNumber(entry.weId, rowKey, field)}
                  onToggleWarmup={(rowKey) => handleToggleWarmup(entry.weId, rowKey)}
                  onDragEnd={(translationY) => void handleReorderDragEnd(entry.weId, translationY)}
                  onOverflowPress={() => handleOverflowPress(entry.weId, entry.name)}
                />
              </View>
            ))}

            <Pressable onPress={() => setPickerOpen(true)} accessibilityRole="button" style={styles.addExerciseButton}>
              <Text style={styles.addExerciseText}>＋ Add exercise</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {restEndsAt != null ? (
        <RestTimerBar
          restEndsAt={restEndsAt}
          totalSeconds={restTotalSeconds}
          notificationsDenied={notificationsDenied}
          onSubtract15={() => void handleAdjustRest(-15)}
          onAdd15={() => void handleAdjustRest(15)}
          onSkip={() => void handleSkipRest()}
        />
      ) : null}

      <NumericKeypad
        visible={editingTarget != null}
        label={editingTarget?.field === 'reps' ? 'Reps' : `Weight (${unit})`}
        initialValue={editingInitialValue}
        allowDecimal={editingTarget?.field === 'weight'}
        onDone={handleKeypadDone}
        onCancel={() => setEditingTarget(null)}
      />

      {pickerOpen ? (
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerHeader, { paddingTop: insets.top + theme.spacing.sm }]}>
            <Pressable onPress={closePicker} accessibilityRole="button" style={styles.pickerCancelButton}>
              <Text style={styles.pickerCancelText}>‹ Cancel</Text>
            </Pressable>
            <Text style={styles.pickerTitle}>{pickerMode === 'replace' ? 'Replace exercise' : 'Add exercise'}</Text>
          </View>

          <View style={styles.pickerSearchRow}>
            <TextInput
              value={pickerSearch}
              onChangeText={setPickerSearch}
              placeholder="Search exercises"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.pickerSearchInput}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          <MuscleGroupPills selected={pickerMuscleGroup} onSelect={setPickerMuscleGroup} />
          <FilterChipRow options={EQUIPMENT} selected={pickerEquipment} onToggle={toggleEquipment} />

          <ScrollView keyboardShouldPersistTaps="handled">
            {pickerFiltered.length === 0 ? (
              <View style={styles.pickerEmpty}>
                <Text style={styles.pickerEmptyText}>
                  {pickerSearch.trim().length > 0
                    ? `No matches for “${pickerSearch.trim()}”.`
                    : 'No exercises match this filter.'}
                </Text>
              </View>
            ) : (
              pickerFiltered.map((exercise) => (
                <ExerciseRow
                  key={exercise.id}
                  name={exercise.name}
                  muscleGroup={exercise.muscleGroup}
                  equipment={exercise.equipment}
                  isCustom={exercise.isCustom}
                  onPress={() => void handleSelectExercise(exercise)}
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
  notFoundText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
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
  discardButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: theme.spacing.sm,
  },
  discardText: {
    ...theme.typography.body,
    color: theme.colors.danger,
    fontWeight: '700',
  },
  titleColumn: {
    flex: 1,
    alignItems: 'center',
  },
  workoutTitle: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  elapsedText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  finishButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
  },
  finishButtonText: {
    ...theme.typography.caption,
    color: theme.colors.background,
    fontWeight: '700',
  },
  scrollContent: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl,
  },
  emptyBody: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  emptyAction: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  addExerciseButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  addExerciseText: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
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
  pickerSearchRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  pickerSearchInput: {
    ...theme.typography.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
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
