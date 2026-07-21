// Custom exercise creation form (D-09/D-12).
//
// Exactly four fields: name (required), muscle group, equipment (both
// single-select from the same fixed lists seeded exercises use), and
// optional notes — nothing else. A debounced duplicate-name lookup shows a
// non-blocking inline warning with "open existing" and "proceed anyway"
// (creation is never blocked by a duplicate name, D-12).

import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { FilterChipRow } from '../../../components/FilterChipRow';
import { EQUIPMENT, MUSCLE_GROUPS, type EquipmentType, type MuscleGroup } from '../../../constants/taxonomy';
import { db } from '../../../db/client';
import { createExercise, findDuplicatesByName } from '../../../db/exercises';
import type { Exercise } from '../../../db/schema';
import { theme } from '../../../theme';

export default function NewExerciseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(MUSCLE_GROUPS[0]);
  const [equipment, setEquipment] = useState<EquipmentType>(EQUIPMENT[0]);
  const [notes, setNotes] = useState('');
  const [duplicates, setDuplicates] = useState<Exercise[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const trimmedName = name.trim();

  // Debounced single-row duplicate lookup (D-12) — this is a rare on-input
  // lookup, not the per-keystroke library re-query anti-pattern that
  // applies to the search/filter list (RESEARCH.md).
  useEffect(() => {
    if (trimmedName.length === 0) {
      setDuplicates([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      findDuplicatesByName(db, trimmedName).then((rows) => {
        if (!cancelled) {
          setDuplicates(rows);
        }
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedName]);

  const canSubmit = trimmedName.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }
    setSubmitting(true);
    try {
      const created = await createExercise(db, {
        name: trimmedName,
        muscleGroup,
        equipment,
        notes: notes.trim().length > 0 ? notes.trim() : null,
      });
      router.replace(`/exercises/${created.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.appbar, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>‹ Exercises</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New exercise</Text>
      </View>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Exercise name"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.input}
          autoFocus
        />

        {duplicates.length > 0 ? (
          <View style={styles.duplicateWarning}>
            <Text style={styles.duplicateText}>&quot;{duplicates[0].name}&quot; already exists.</Text>
            <View style={styles.duplicateActions}>
              <Pressable
                onPress={() => router.push(`/exercises/${duplicates[0].id}`)}
                accessibilityRole="button"
              >
                <Text style={styles.duplicateLink}>Open existing</Text>
              </Pressable>
              <Pressable onPress={handleSubmit} accessibilityRole="button">
                <Text style={styles.duplicateLink}>Proceed anyway</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

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
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={[styles.submitButton, !canSubmit ? styles.submitButtonDisabled : null]}
          accessibilityRole="button"
        >
          <Text style={styles.submitButtonText}>Create exercise</Text>
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
    paddingVertical: theme.spacing.xs,
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
  notesInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  duplicateWarning: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.badge,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  duplicateText: {
    ...theme.typography.caption,
    color: theme.colors.text,
  },
  duplicateActions: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
  },
  duplicateLink: {
    ...theme.typography.caption,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  submitButton: {
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  submitButtonText: {
    ...theme.typography.body,
    color: theme.colors.background,
    fontWeight: '700',
  },
});
