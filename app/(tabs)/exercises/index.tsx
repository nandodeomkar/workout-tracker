import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ExerciseRow } from '../../../components/ExerciseRow';
import { FilterChipRow } from '../../../components/FilterChipRow';
import { EQUIPMENT, MUSCLE_GROUPS, type EquipmentType, type MuscleGroup } from '../../../constants/taxonomy';
import { db } from '../../../db/client';
import { loadActiveExercises } from '../../../db/exercises';
import type { Exercise } from '../../../db/schema';
import { filterExercises, type ExerciseFilter } from '../../../lib/exerciseFilter';
import { theme } from '../../../theme';

const EMPTY_FILTER: ExerciseFilter = { search: '', muscleGroups: [], equipment: [] };

export default function ExercisesScreen() {
  const router = useRouter();
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [equipment, setEquipment] = useState<EquipmentType[]>([]);

  // Load once on mount (RESEARCH.md Anti-Pattern: no per-keystroke SQL).
  useEffect(() => {
    let cancelled = false;
    loadActiveExercises(db).then((rows) => {
      if (!cancelled) {
        setAllExercises(rows);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filter: ExerciseFilter = useMemo(
    () => ({ search, muscleGroups, equipment }),
    [search, muscleGroups, equipment],
  );

  const visibleExercises = useMemo(
    () => filterExercises(allExercises, filter),
    [allExercises, filter],
  );

  const hasActiveFilters =
    search.length > 0 || muscleGroups.length > 0 || equipment.length > 0;

  const toggleMuscleGroup = useCallback((value: string) => {
    setMuscleGroups((prev) =>
      prev.includes(value as MuscleGroup)
        ? prev.filter((v) => v !== value)
        : [...prev, value as MuscleGroup],
    );
  }, []);

  const toggleEquipment = useCallback((value: string) => {
    setEquipment((prev) =>
      prev.includes(value as EquipmentType)
        ? prev.filter((v) => v !== value)
        : [...prev, value as EquipmentType],
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSearch('');
    setMuscleGroups([]);
    setEquipment([]);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchRow}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search exercises"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {hasActiveFilters ? (
            <Pressable onPress={clearFilters} accessibilityRole="button" style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
        <FilterChipRow options={MUSCLE_GROUPS} selected={muscleGroups} onToggle={toggleMuscleGroup} />
        <FilterChipRow options={EQUIPMENT} selected={equipment} onToggle={toggleEquipment} />
      </View>
      <FlatList
        data={visibleExercises}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ExerciseRow
            name={item.name}
            muscleGroup={item.muscleGroup}
            equipment={item.equipment}
            isCustom={item.isCustom}
            onPress={() => router.push(`/exercises/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {allExercises.length === 0 ? 'No exercises yet' : 'No exercises match your filters'}
          </Text>
        }
        contentContainerStyle={visibleExercises.length === 0 ? styles.emptyContent : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    paddingBottom: theme.spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  clearButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  clearButtonText: {
    ...theme.typography.caption,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  emptyText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
  emptyContent: {
    flexGrow: 1,
  },
});
