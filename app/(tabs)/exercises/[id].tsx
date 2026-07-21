// Exercise edit/detail screen (D-10/D-11).
//
// Works identically for seeded and custom exercises — the form always
// calls updateExercise, which never touches seed_id/is_custom (D-10).
// Archive/Unarchive is the only removal path; there is NO delete control
// in this screen (D-11: no hard delete in v1).

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useLocalSearchParams, useRouter } from 'expo-router';

import { FilterChipRow } from '../../../components/FilterChipRow';
import { EQUIPMENT, MUSCLE_GROUPS, type EquipmentType, type MuscleGroup } from '../../../constants/taxonomy';
import { muscleIcon } from '../../../constants/muscleIcons';
import { db } from '../../../db/client';
import { loadExerciseById, setArchived, updateExercise } from '../../../db/exercises';
import type { Exercise } from '../../../db/schema';
import { theme } from '../../../theme';

// Android-first transient feedback (the app's target platform). No-op on
// other platforms — an edit still persists; only the confirmation toast is
// skipped, which a later iOS build can replace with its own affordance.
function notify(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}

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
      // Confirms the write landed and, crucially, that it propagates to the
      // list/search (which reload on focus, GAP-3) — the stale-list confusion
      // that hurt UAT confidence (GAP-4).
      notify(`Saved — “${updated.name}” updated everywhere`);
    } finally {
      setSaving(false);
    }
  };

  const applyArchived = async (nextArchived: boolean) => {
    if (archiving) {
      return;
    }
    setArchiving(true);
    try {
      const updated = await setArchived(db, exerciseId, nextArchived);
      setExercise(updated);
      notify(nextArchived ? `“${updated.name}” archived` : `“${updated.name}” unarchived`);
    } finally {
      setArchiving(false);
    }
  };

  const handleToggleArchived = () => {
    if (!exercise || archiving) {
      return;
    }
    if (exercise.archived) {
      // Unarchive is non-destructive — no confirmation needed.
      void applyArchived(false);
      return;
    }
    // Archiving hides the exercise from the default library — confirm first,
    // and make clear it is reversible, not a delete (D-11).
    Alert.alert(
      'Archive exercise?',
      `“${exercise.name}” will be hidden from the library. You can unarchive it any time from "Show archived".`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive', style: 'destructive', onPress: () => void applyArchived(true) },
      ],
    );
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
      <View style={styles.appbar}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>‹ Exercises</Text>
        </Pressable>
        {exercise.isCustom ? (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>CUSTOM</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.headerTitleRow}>
        <Text style={styles.headerIcon}>{muscleIcon(exercise.muscleGroup)}</Text>
        <Text style={styles.headerTitle} numberOfLines={2}>
          {exercise.name}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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
  appbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  backButton: {
    paddingVertical: theme.spacing.xs,
    paddingRight: theme.spacing.md,
  },
  backText: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  headerBadge: {
    backgroundColor: theme.colors.badge,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  headerBadgeText: {
    ...theme.typography.caption,
    color: theme.colors.background,
    fontWeight: '700',
    fontSize: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  headerIcon: {
    fontSize: 24,
  },
  headerTitle: {
    ...theme.typography.title,
    color: theme.colors.text,
    flexShrink: 1,
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
