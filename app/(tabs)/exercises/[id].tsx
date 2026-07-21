// Exercise edit/detail screen (D-10/D-11).
//
// Works identically for seeded and custom exercises — the form always
// calls updateExercise, which never touches seed_id/is_custom (D-10).
// Archive/Unarchive is the only removal path; there is NO delete control
// in this screen (D-11: no hard delete in v1).

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { FilterChipRow } from '../../../components/FilterChipRow';
import { EQUIPMENT, MUSCLE_GROUPS, type EquipmentType, type MuscleGroup } from '../../../constants/taxonomy';
import { db } from '../../../db/client';
import { loadExerciseById, setArchived, updateExercise } from '../../../db/exercises';
import type { Exercise } from '../../../db/schema';
import { theme } from '../../../theme';

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exerciseId = Number(id);
  const router = useRouter();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(MUSCLE_GROUPS[0]);
  const [equipment, setEquipment] = useState<EquipmentType>(EQUIPMENT[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const loadExercise = useCallback(async () => {
    setLoading(true);
    const row = await loadExerciseById(db, exerciseId);
    if (row) {
      setExercise(row);
      setName(row.name);
      setMuscleGroup(row.muscleGroup as MuscleGroup);
      setEquipment(row.equipment as EquipmentType);
      setNotes(row.notes ?? '');
    }
    setLoading(false);
  }, [exerciseId]);

  useEffect(() => {
    loadExercise();
  }, [loadExercise]);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    try {
      const updated = await updateExercise(db, exerciseId, {
        name: trimmedName,
        muscleGroup,
        equipment,
        notes: notes.trim().length > 0 ? notes.trim() : null,
      });
      setExercise(updated);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleArchived = async () => {
    if (!exercise || archiving) {
      return;
    }
    setArchiving(true);
    try {
      const updated = await setArchived(db, exerciseId, !exercise.archived);
      setExercise(updated);
    } finally {
      setArchiving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  if (!exercise) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Exercise not found.</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backLink}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        {exercise.archived ? (
          <View style={styles.archivedBanner}>
            <Text style={styles.archivedBannerText}>This exercise is archived.</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Exercise name"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.input}
        />

        <Text style={styles.label}>Muscle group</Text>
        <FilterChipRow
          options={MUSCLE_GROUPS}
          selected={[muscleGroup]}
          onToggle={(value) => setMuscleGroup(value as MuscleGroup)}
        />

        <Text style={styles.label}>Equipment</Text>
        <FilterChipRow
          options={EQUIPMENT}
          selected={[equipment]}
          onToggle={(value) => setEquipment(value as EquipmentType)}
        />

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes"
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.input, styles.notesInput]}
          multiline
        />

        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={[styles.saveButton, !canSave ? styles.saveButtonDisabled : null]}
          accessibilityRole="button"
        >
          <Text style={styles.saveButtonText}>Save changes</Text>
        </Pressable>

        <Pressable
          onPress={handleToggleArchived}
          disabled={archiving}
          style={styles.archiveButton}
          accessibilityRole="button"
        >
          <Text style={styles.archiveButtonText}>
            {exercise.archived ? 'Unarchive' : 'Archive'}
          </Text>
        </Pressable>
      </ScrollView>
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
  container: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  archivedBanner: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.badge,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  archivedBannerText: {
    ...theme.typography.caption,
    color: theme.colors.badge,
    fontWeight: '700',
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
  notesInput: {
    minHeight: 96,
    textAlignVertical: 'top',
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
  archiveButton: {
    marginTop: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.danger,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  archiveButtonText: {
    ...theme.typography.body,
    color: theme.colors.danger,
    fontWeight: '700',
  },
});
