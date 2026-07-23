// Shared template builder body (TMPL-01/D-03/D-04) — mounted by both
// app/templates/new.tsx (create) and app/templates/[templateId].tsx (edit),
// mirroring the exercises new.tsx/[id].tsx two-route-file split while
// keeping the actual form logic in ONE place (not duplicated wholesale,
// per RESEARCH.md Open Question 2 + this plan's acceptance criteria).
//
// Name + free-text Folder field (tap-suggestions from loadFolderNames,
// D-04 — blank folder normalizes to null/Uncategorized), an ordered list of
// chosen exercises each with target-sets/target-reps steppers, a remove
// control, and simple up/down reorder controls (planner discretion, keeping
// every control 44x44). "+ Add exercise" reopens the same
// ExerciseRow/MuscleGroupPills/FilterChipRow picker overlay used in the
// active-workout screen, over loadActiveExercises + filterExercises.
//
// Create path: createTemplate -> setTemplateExercises.
// Edit path: loadTemplateDetail hydrates on mount -> updateTemplate +
// setTemplateExercises on save. The Android-only notify() helper is copied
// verbatim from app/(tabs)/exercises/[id].tsx (this codebase does not
// centralize it — every screen that needs it declares its own copy).

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { useRouter } from 'expo-router';

import { ExerciseRow } from './ExerciseRow';
import { FilterChipRow } from './FilterChipRow';
import { MetricToggle, type MetricToggleOption } from './MetricToggle';
import { MuscleGroupPills } from './MuscleGroupPills';
import { EQUIPMENT, type EquipmentType, type MuscleGroup } from '../constants/taxonomy';
import { db } from '../db/client';
import { loadActiveExercises, loadAllExercises } from '../db/exercises';
import type { Exercise } from '../db/schema';
import { getSetting } from '../db/settings';
import {
  createTemplate,
  loadFolderNames,
  loadTemplateDetail,
  loadTemplatesGroupedByFolder,
  setTemplateExercises,
  updateTemplate,
  type TemplateExerciseInput,
} from '../db/templates';
import { filterExercises } from '../lib/exerciseFilter';
import { DEFAULT_LINEAR_INCREMENT_KG } from '../lib/progression';
import { displayToKg, kgToDisplay } from '../lib/weightUnits';
import { theme } from '../theme';

type WeightUnit = 'kg' | 'lb';

// D-17: the three per-exercise progression authoring options — reused
// verbatim MetricToggle single-select (matches lib/progression.ts's two
// locked rule shapes; "None" writes progression: null).
type ProgressionType = 'none' | 'linear' | 'percent_tm';

const PROGRESSION_TYPE_OPTIONS: MetricToggleOption<ProgressionType>[] = [
  { value: 'none', label: 'None' },
  { value: 'linear', label: 'Linear' },
  { value: 'percent_tm', label: '%TM' },
];

/** Per-tap stepper granularity for the linear increment field, keyed by display unit (UI-SPEC screen 6). */
const LINEAR_INCREMENT_STEP: Record<WeightUnit, number> = { kg: DEFAULT_LINEAR_INCREMENT_KG.squat, lb: 5 };

interface BuilderPercentTmSetRow {
  key: string;
  /** Fraction 0.3-1.0 (30%-100% of TM), step 0.05. */
  pct: number;
  reps: number;
  /** Only ever serialized true when this is the LAST set in the scheme. */
  amrap: boolean;
}

function newPercentTmSetRow(): BuilderPercentTmSetRow {
  return { key: `pct-${Date.now()}-${Math.random()}`, pct: 0.75, reps: 5, amrap: false };
}

/**
 * Parses a stored `template_exercises.progression` JSON string back into
 * builder row state (edit-mode hydrate). Malformed/unrecognized JSON falls
 * back to "None" defaults rather than throwing (mirrors db/programs.ts's own
 * parse-and-skip guard, T-06-01).
 */
function hydrateProgression(
  raw: string | null | undefined,
  unit: WeightUnit,
): Pick<BuilderExerciseRow, 'progressionType' | 'linearIncrementDisplay' | 'percentTmSets'> {
  const defaults: Pick<BuilderExerciseRow, 'progressionType' | 'linearIncrementDisplay' | 'percentTmSets'> = {
    progressionType: 'none',
    linearIncrementDisplay: LINEAR_INCREMENT_STEP[unit],
    percentTmSets: [newPercentTmSetRow()],
  };
  if (!raw) {
    return defaults;
  }
  try {
    const parsed = JSON.parse(raw) as { type?: string; incrementKg?: unknown; sets?: unknown };
    if (parsed.type === 'linear' && typeof parsed.incrementKg === 'number' && parsed.incrementKg > 0) {
      return { ...defaults, progressionType: 'linear', linearIncrementDisplay: kgToDisplay(parsed.incrementKg, unit) };
    }
    if (parsed.type === 'percent_tm' && Array.isArray(parsed.sets) && parsed.sets.length > 0) {
      const sets: BuilderPercentTmSetRow[] = parsed.sets.map((raw, index) => {
        const s = raw as { pct?: unknown; reps?: unknown; amrap?: unknown };
        return {
          key: `pct-${index}-${Date.now()}`,
          pct: typeof s.pct === 'number' ? s.pct : 0.75,
          reps: typeof s.reps === 'number' ? s.reps : 5,
          amrap: s.amrap === true,
        };
      });
      return { ...defaults, progressionType: 'percent_tm', percentTmSets: sets };
    }
  } catch {
    // Malformed progression JSON — fall back to None (T-06-01).
  }
  return defaults;
}

/**
 * Serializes a builder row's authored rule into the exact locked JSON shape
 * (`{type:"linear",incrementKg}` / `{type:"percent_tm",sets:[...]}`) for
 * `template_exercises.progression`, or `null` for "None"/an invalid linear
 * increment (<=0, mirrors db/programs.ts#parseValidLinearRule's own positive-
 * only invariant so a zeroed-out stepper never persists a dead rule).
 */
function serializeProgression(
  row: Pick<BuilderExerciseRow, 'progressionType' | 'linearIncrementDisplay' | 'percentTmSets'>,
  unit: WeightUnit,
): string | null {
  if (row.progressionType === 'linear') {
    const incrementKg = displayToKg(row.linearIncrementDisplay, unit);
    if (incrementKg > 0) {
      return JSON.stringify({ type: 'linear', incrementKg });
    }
    return null;
  }
  if (row.progressionType === 'percent_tm' && row.percentTmSets.length > 0) {
    return JSON.stringify({
      type: 'percent_tm',
      sets: row.percentTmSets.map((set, index) => ({
        pct: set.pct,
        reps: set.reps,
        ...(index === row.percentTmSets.length - 1 && set.amrap ? { amrap: true } : {}),
      })),
    });
  }
  return null;
}

// Android-first transient feedback (mirrors app/(tabs)/exercises/[id].tsx —
// this project duplicates this small helper per-file rather than sharing a
// lib/notify.ts module).
function notify(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}

interface BuilderExerciseRow {
  key: string;
  exerciseId: number;
  name: string;
  targetSets: number;
  targetReps: number;
  /** D-17: per-exercise progression authoring — defaults to 'none' (unchanged behavior). */
  progressionType: ProgressionType;
  /** Display-unit-native value (converted to canonical kg only at save time, Measurements-phase precedent). */
  linearIncrementDisplay: number;
  percentTmSets: BuilderPercentTmSetRow[];
}

const DEFAULT_TARGET_SETS = 3;
const DEFAULT_TARGET_REPS = 8;

interface TemplateBuilderFormProps {
  /** undefined = create mode; a number = edit mode for that template. */
  templateId?: number;
}

export function TemplateBuilderForm({ templateId }: TemplateBuilderFormProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isEdit = templateId != null;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [folder, setFolder] = useState('');
  const [folderNames, setFolderNames] = useState<string[]>([]);
  const [exerciseRows, setExerciseRows] = useState<BuilderExerciseRow[]>([]);
  // D-17: display unit for the linear-increment stepper's label/step size
  // (loaded once at mount, mirrors app/programs/training-maxes.tsx's own
  // one-shot getSetting(db, 'units') read).
  const [unit, setUnit] = useState<WeightUnit>('kg');

  // Add-exercise picker (reuses the active-workout screen's
  // ExerciseRow/MuscleGroupPills/FilterChipRow picker overlay wholesale).
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerExercises, setPickerExercises] = useState<Exercise[]>([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerMuscleGroup, setPickerMuscleGroup] = useState<MuscleGroup | null>(null);
  const [pickerEquipment, setPickerEquipment] = useState<EquipmentType[]>([]);

  const loadEdit = useCallback(
    async (resolvedUnit: WeightUnit) => {
      if (!isEdit) {
        return;
      }
      setLoading(true);
      const detail = await loadTemplateDetail(db, templateId!);
      if (!detail) {
        setLoading(false);
        return;
      }
      const allExercises = await loadAllExercises(db);
      const exerciseById = new Map(allExercises.map((exercise) => [exercise.id, exercise]));
      setName(detail.template.name);
      setFolder(detail.template.folder ?? '');
      setExerciseRows(
        detail.exercises.map(({ templateExercise }) => ({
          key: `te-${templateExercise.id}`,
          exerciseId: templateExercise.exerciseId,
          name: exerciseById.get(templateExercise.exerciseId)?.name ?? 'Unknown exercise',
          targetSets: templateExercise.targetSets,
          targetReps: templateExercise.targetReps,
          ...hydrateProgression(templateExercise.progression, resolvedUnit),
        })),
      );
      setLoading(false);
    },
    [isEdit, templateId],
  );

  // Single sequenced init: resolve the display unit BEFORE hydrating edit-mode
  // rows (the hydrate step needs `unit` to convert stored incrementKg into a
  // display value) — avoids a re-run race where a late-resolving unit setting
  // would re-fetch and clobber in-progress user edits.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [unitSetting, names] = await Promise.all([getSetting(db, 'units'), loadFolderNames(db)]);
      if (cancelled) {
        return;
      }
      const resolvedUnit: WeightUnit = unitSetting === 'lb' ? 'lb' : 'kg';
      setUnit(resolvedUnit);
      setFolderNames(names);
      if (isEdit) {
        await loadEdit(resolvedUnit);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, loadEdit]);

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

  function toggleEquipment(value: string) {
    setPickerEquipment((prev) =>
      prev.includes(value as EquipmentType)
        ? prev.filter((item) => item !== value)
        : [...prev, value as EquipmentType],
    );
  }

  function closePicker() {
    setPickerOpen(false);
    setPickerSearch('');
    setPickerMuscleGroup(null);
    setPickerEquipment([]);
  }

  function handleSelectExercise(exercise: Exercise) {
    setExerciseRows((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${exercise.id}`,
        exerciseId: exercise.id,
        name: exercise.name,
        targetSets: DEFAULT_TARGET_SETS,
        targetReps: DEFAULT_TARGET_REPS,
        progressionType: 'none',
        linearIncrementDisplay: LINEAR_INCREMENT_STEP[unit],
        percentTmSets: [newPercentTmSetRow()],
      },
    ]);
    closePicker();
  }

  function removeRow(key: string) {
    setExerciseRows((prev) => prev.filter((row) => row.key !== key));
  }

  function moveRow(key: string, direction: -1 | 1) {
    setExerciseRows((prev) => {
      const index = prev.findIndex((row) => row.key === key);
      const targetIndex = index + direction;
      if (index === -1 || targetIndex < 0 || targetIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function updateTargetSets(key: string, delta: number) {
    setExerciseRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, targetSets: Math.max(0, row.targetSets + delta) } : row)),
    );
  }

  function updateTargetReps(key: string, delta: number) {
    setExerciseRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, targetReps: Math.max(0, row.targetReps + delta) } : row)),
    );
  }

  function updateProgressionType(key: string, progressionType: ProgressionType) {
    setExerciseRows((prev) => prev.map((row) => (row.key === key ? { ...row, progressionType } : row)));
  }

  function updateLinearIncrement(key: string, direction: -1 | 1) {
    setExerciseRows((prev) =>
      prev.map((row) =>
        row.key === key
          ? { ...row, linearIncrementDisplay: Math.max(0, row.linearIncrementDisplay + direction * LINEAR_INCREMENT_STEP[unit]) }
          : row,
      ),
    );
  }

  function addPercentTmSet(key: string) {
    setExerciseRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, percentTmSets: [...row.percentTmSets, newPercentTmSetRow()] } : row)),
    );
  }

  function removePercentTmSet(key: string, setKey: string) {
    setExerciseRows((prev) =>
      prev.map((row) =>
        row.key === key && row.percentTmSets.length > 1
          ? { ...row, percentTmSets: row.percentTmSets.filter((set) => set.key !== setKey) }
          : row,
      ),
    );
  }

  function updatePercentTmPct(key: string, setKey: string, delta: number) {
    setExerciseRows((prev) =>
      prev.map((row) =>
        row.key === key
          ? {
              ...row,
              percentTmSets: row.percentTmSets.map((set) =>
                set.key === setKey
                  ? { ...set, pct: Math.min(1, Math.max(0.3, Math.round((set.pct + delta) * 100) / 100)) }
                  : set,
              ),
            }
          : row,
      ),
    );
  }

  function updatePercentTmReps(key: string, setKey: string, delta: number) {
    setExerciseRows((prev) =>
      prev.map((row) =>
        row.key === key
          ? {
              ...row,
              percentTmSets: row.percentTmSets.map((set) =>
                set.key === setKey ? { ...set, reps: Math.max(1, set.reps + delta) } : set,
              ),
            }
          : row,
      ),
    );
  }

  function toggleAmrap(key: string, setKey: string) {
    setExerciseRows((prev) =>
      prev.map((row) =>
        row.key === key
          ? {
              ...row,
              percentTmSets: row.percentTmSets.map((set) =>
                set.key === setKey ? { ...set, amrap: !set.amrap } : set,
              ),
            }
          : row,
      ),
    );
  }

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    try {
      const folderValue = folder.trim().length > 0 ? folder.trim() : null;
      const rows: TemplateExerciseInput[] = exerciseRows.map((row, index) => ({
        exerciseId: row.exerciseId,
        position: index,
        targetSets: row.targetSets,
        targetReps: row.targetReps,
        targetWeightKg: null,
        progression: serializeProgression(row, unit),
      }));

      if (isEdit) {
        await updateTemplate(db, templateId!, { name: trimmedName, folder: folderValue });
        await setTemplateExercises(db, templateId!, rows);
        notify(`Saved — “${trimmedName}” updated`);
      } else {
        // Position orders templates WITHIN their folder bucket (Assumptions
        // Log A5) — count existing templates already in the target folder.
        const groups = await loadTemplatesGroupedByFolder(db);
        const matchingGroup = groups.find((group) => group.folder === folderValue);
        const position = matchingGroup?.templates.length ?? 0;
        const created = await createTemplate(db, { name: trimmedName, folder: folderValue, position });
        await setTemplateExercises(db, created.id, rows);
        notify(`Saved — “${trimmedName}” created`);
        router.replace({ pathname: '/templates/[templateId]', params: { templateId: String(created.id) } });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.appbar, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit template' : 'New template'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Template name"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.input}
          autoFocus={!isEdit}
        />

        <Text style={styles.label}>Folder (optional)</Text>
        <TextInput
          value={folder}
          onChangeText={setFolder}
          placeholder="e.g. Push / Pull / Legs"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.input}
        />
        {folderNames.length > 0 ? (
          <FilterChipRow options={folderNames} selected={folder.trim() ? [folder.trim()] : []} onToggle={setFolder} />
        ) : null}

        <Text style={styles.label}>Exercises</Text>
        {exerciseRows.length === 0 ? (
          <Text style={styles.emptyText}>No exercises yet — add at least one below.</Text>
        ) : (
          exerciseRows.map((row, index) => (
            <View key={row.key} style={styles.exerciseRow}>
              <View style={styles.exerciseRowHeader}>
                <Text style={styles.exerciseRowName} numberOfLines={1}>
                  {row.name}
                </Text>
                <Pressable
                  onPress={() => removeRow(row.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${row.name}`}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>✕</Text>
                </Pressable>
              </View>
              <View style={styles.exerciseRowControls}>
                <View style={styles.stepperGroup}>
                  <Pressable
                    onPress={() => updateTargetSets(row.key, -1)}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease target sets"
                    style={styles.stepButton}
                  >
                    <Text style={styles.stepButtonText}>−</Text>
                  </Pressable>
                  <Text style={styles.stepperValue}>{row.targetSets} sets</Text>
                  <Pressable
                    onPress={() => updateTargetSets(row.key, 1)}
                    accessibilityRole="button"
                    accessibilityLabel="Increase target sets"
                    style={styles.stepButton}
                  >
                    <Text style={styles.stepButtonText}>+</Text>
                  </Pressable>
                </View>
                <View style={styles.stepperGroup}>
                  <Pressable
                    onPress={() => updateTargetReps(row.key, -1)}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease target reps"
                    style={styles.stepButton}
                  >
                    <Text style={styles.stepButtonText}>−</Text>
                  </Pressable>
                  <Text style={styles.stepperValue}>{row.targetReps} reps</Text>
                  <Pressable
                    onPress={() => updateTargetReps(row.key, 1)}
                    accessibilityRole="button"
                    accessibilityLabel="Increase target reps"
                    style={styles.stepButton}
                  >
                    <Text style={styles.stepButtonText}>+</Text>
                  </Pressable>
                </View>
                <View style={styles.reorderGroup}>
                  <Pressable
                    onPress={() => moveRow(row.key, -1)}
                    disabled={index === 0}
                    accessibilityRole="button"
                    accessibilityLabel="Move up"
                    style={[styles.reorderButton, index === 0 ? styles.reorderButtonDisabled : null]}
                  >
                    <Text style={styles.reorderButtonText}>▲</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => moveRow(row.key, 1)}
                    disabled={index === exerciseRows.length - 1}
                    accessibilityRole="button"
                    accessibilityLabel="Move down"
                    style={[
                      styles.reorderButton,
                      index === exerciseRows.length - 1 ? styles.reorderButtonDisabled : null,
                    ]}
                  >
                    <Text style={styles.reorderButtonText}>▼</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.progressionSection}>
                <Text style={styles.progressionLabel}>Progression</Text>
                <MetricToggle
                  options={PROGRESSION_TYPE_OPTIONS}
                  value={row.progressionType}
                  onChange={(value) => updateProgressionType(row.key, value)}
                />

                {row.progressionType === 'linear' ? (
                  <View style={styles.stepperGroup}>
                    <Pressable
                      onPress={() => updateLinearIncrement(row.key, -1)}
                      accessibilityRole="button"
                      accessibilityLabel="Decrease increment"
                      style={styles.stepButton}
                    >
                      <Text style={styles.stepButtonText}>−</Text>
                    </Pressable>
                    <Text style={styles.stepperValue}>
                      +{row.linearIncrementDisplay}
                      {unit} per success
                    </Text>
                    <Pressable
                      onPress={() => updateLinearIncrement(row.key, 1)}
                      accessibilityRole="button"
                      accessibilityLabel="Increase increment"
                      style={styles.stepButton}
                    >
                      <Text style={styles.stepButtonText}>+</Text>
                    </Pressable>
                  </View>
                ) : null}

                {row.progressionType === 'percent_tm' ? (
                  <View style={styles.percentTmCard}>
                    {row.percentTmSets.map((setRow, setIndex) => (
                      <View key={setRow.key} style={styles.percentTmSetRow}>
                        <View style={styles.stepperGroup}>
                          <Pressable
                            onPress={() => updatePercentTmPct(row.key, setRow.key, -0.05)}
                            accessibilityRole="button"
                            accessibilityLabel="Decrease percent of training max"
                            style={styles.stepButton}
                          >
                            <Text style={styles.stepButtonText}>−</Text>
                          </Pressable>
                          <Text style={styles.stepperValue}>{Math.round(setRow.pct * 100)}% of TM</Text>
                          <Pressable
                            onPress={() => updatePercentTmPct(row.key, setRow.key, 0.05)}
                            accessibilityRole="button"
                            accessibilityLabel="Increase percent of training max"
                            style={styles.stepButton}
                          >
                            <Text style={styles.stepButtonText}>+</Text>
                          </Pressable>
                        </View>
                        <View style={styles.stepperGroup}>
                          <Pressable
                            onPress={() => updatePercentTmReps(row.key, setRow.key, -1)}
                            accessibilityRole="button"
                            accessibilityLabel="Decrease reps"
                            style={styles.stepButton}
                          >
                            <Text style={styles.stepButtonText}>−</Text>
                          </Pressable>
                          <Text style={styles.stepperValue}>{setRow.reps} reps</Text>
                          <Pressable
                            onPress={() => updatePercentTmReps(row.key, setRow.key, 1)}
                            accessibilityRole="button"
                            accessibilityLabel="Increase reps"
                            style={styles.stepButton}
                          >
                            <Text style={styles.stepButtonText}>+</Text>
                          </Pressable>
                        </View>
                        {setIndex === row.percentTmSets.length - 1 ? (
                          <Pressable
                            onPress={() => toggleAmrap(row.key, setRow.key)}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: setRow.amrap }}
                            accessibilityLabel="AMRAP on last set"
                            style={styles.amrapToggle}
                          >
                            <Text style={styles.amrapToggleText}>{setRow.amrap ? '☑' : '☐'} AMRAP</Text>
                          </Pressable>
                        ) : null}
                        <Pressable
                          onPress={() => removePercentTmSet(row.key, setRow.key)}
                          disabled={row.percentTmSets.length === 1}
                          accessibilityRole="button"
                          accessibilityLabel="Remove set"
                          style={[styles.removeButton, row.percentTmSets.length === 1 ? styles.reorderButtonDisabled : null]}
                        >
                          <Text style={styles.removeButtonText}>✕</Text>
                        </Pressable>
                      </View>
                    ))}
                    <Pressable
                      onPress={() => addPercentTmSet(row.key)}
                      accessibilityRole="button"
                      style={styles.addSetButton}
                    >
                      <Text style={styles.addExerciseText}>+ Add set</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </View>
          ))
        )}

        <Pressable onPress={() => setPickerOpen(true)} accessibilityRole="button" style={styles.addExerciseButton}>
          <Text style={styles.addExerciseText}>+ Add exercise</Text>
        </Pressable>

        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={[styles.saveButton, !canSave ? styles.saveButtonDisabled : null]}
          accessibilityRole="button"
        >
          <Text style={styles.saveButtonText}>{isEdit ? 'Save changes' : 'Create template'}</Text>
        </Pressable>
      </ScrollView>

      {pickerOpen ? (
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerHeader, { paddingTop: insets.top + theme.spacing.sm }]}>
            <Pressable onPress={closePicker} accessibilityRole="button" style={styles.pickerCancelButton}>
              <Text style={styles.pickerCancelText}>‹ Cancel</Text>
            </Pressable>
            <Text style={styles.pickerTitle}>Add exercise</Text>
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
                  onPress={() => handleSelectExercise(exercise)}
                />
              ))
            )}
          </ScrollView>
        </View>
      ) : null}
    </KeyboardAvoidingView>
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
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  headerTitle: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  container: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
  },
  input: {
    ...theme.typography.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  emptyText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  exerciseRow: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  exerciseRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  exerciseRowName: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
  },
  removeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    ...theme.typography.body,
    color: theme.colors.danger,
  },
  exerciseRowControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  stepButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
  },
  stepButtonText: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
  },
  stepperValue: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    minWidth: 56,
    textAlign: 'center',
  },
  reorderGroup: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginLeft: 'auto',
  },
  reorderButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderButtonDisabled: {
    opacity: 0.35,
  },
  reorderButtonText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  progressionSection: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  progressionLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  percentTmCard: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  percentTmSetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  amrapToggle: {
    minHeight: 44,
    justifyContent: 'center',
  },
  amrapToggleText: {
    ...theme.typography.caption,
    color: theme.colors.text,
    fontWeight: '700',
  },
  addSetButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  addExerciseButton: {
    marginTop: theme.spacing.sm,
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
  saveButton: {
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  saveButtonText: {
    ...theme.typography.body,
    color: theme.colors.background,
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
