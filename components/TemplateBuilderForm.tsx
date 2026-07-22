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
import { MuscleGroupPills } from './MuscleGroupPills';
import { EQUIPMENT, type EquipmentType, type MuscleGroup } from '../constants/taxonomy';
import { db } from '../db/client';
import { loadActiveExercises, loadAllExercises } from '../db/exercises';
import type { Exercise } from '../db/schema';
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
import { theme } from '../theme';

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

  // Add-exercise picker (reuses the active-workout screen's
  // ExerciseRow/MuscleGroupPills/FilterChipRow picker overlay wholesale).
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerExercises, setPickerExercises] = useState<Exercise[]>([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerMuscleGroup, setPickerMuscleGroup] = useState<MuscleGroup | null>(null);
  const [pickerEquipment, setPickerEquipment] = useState<EquipmentType[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadFolderNames(db).then((names) => {
      if (!cancelled) {
        setFolderNames(names);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadEdit = useCallback(async () => {
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
      })),
    );
    setLoading(false);
  }, [isEdit, templateId]);

  useEffect(() => {
    loadEdit();
  }, [loadEdit]);

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
