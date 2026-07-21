// Exercise library home (GAP-4 UX rework, sketch 001-C "Pills + A–Z").
//
// Structure, top to bottom: a titled app bar with a "+" add button, a
// full-width search field, a single-select muscle-group pill row (primary
// browse), then a sectioned A–Z list with sticky letter headers. This
// replaced the flat search + two stacked multi-select chip rows that device
// UAT judged cluttered/unintuitive (GAP-4). Search and the pill selection are
// applied purely in-memory (lib/exerciseFilter.ts) over a list reloaded on
// focus (GAP-3) — no per-keystroke SQL (RESEARCH.md).

import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { ExerciseRow } from '../../../components/ExerciseRow';
import { MuscleGroupPills } from '../../../components/MuscleGroupPills';
import type { MuscleGroup } from '../../../constants/taxonomy';
import { db } from '../../../db/client';
import { loadActiveExercises, loadAllExercises } from '../../../db/exercises';
import type { Exercise } from '../../../db/schema';
import { filterExercises } from '../../../lib/exerciseFilter';
import { theme } from '../../../theme';

interface Section {
  title: string;
  data: Exercise[];
}

function sectionLetter(name: string): string {
  const first = name.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : '#';
}

export default function ExercisesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(null);
  // "Show archived" reveal toggle (D-11) — default OFF, archived hidden.
  const [showArchived, setShowArchived] = useState(false);

  // Reload on focus AND on showArchived flip (GAP-3) — an edit/create/archive
  // on a pushed screen is reflected the moment we return here.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const load = showArchived ? loadAllExercises(db) : loadActiveExercises(db);
      load.then((rows) => {
        if (!cancelled) {
          setAllExercises(rows);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [showArchived]),
  );

  const visibleExercises = useMemo(
    () =>
      filterExercises(allExercises, {
        search,
        muscleGroups: muscleGroup ? [muscleGroup] : [],
        equipment: [],
      }),
    [allExercises, search, muscleGroup],
  );

  // Bucket the already-A–Z-ordered rows into sticky letter sections.
  const sections = useMemo<Section[]>(() => {
    const buckets: Section[] = [];
    let current: Section | null = null;
    for (const row of visibleExercises) {
      const letter = sectionLetter(row.name);
      if (!current || current.title !== letter) {
        current = { title: letter, data: [] };
        buckets.push(current);
      }
      current.data.push(row);
    }
    return buckets;
  }, [visibleExercises]);

  const hasQuery = search.trim().length > 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.appbar}>
          <Text style={styles.title}>Exercises</Text>
          <Pressable
            onPress={() => router.push('/exercises/new')}
            accessibilityRole="button"
            accessibilityLabel="Add exercise"
            style={styles.addButton}
          >
            <Text style={styles.addButtonText}>＋</Text>
          </Pressable>
        </View>

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
          {hasQuery ? (
            <Pressable onPress={() => setSearch('')} accessibilityRole="button" style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        <MuscleGroupPills selected={muscleGroup} onSelect={setMuscleGroup} />

        <Pressable
          onPress={() => setShowArchived((prev) => !prev)}
          accessibilityRole="button"
          accessibilityState={{ selected: showArchived }}
          style={styles.archivedToggle}
        >
          <Text style={[styles.archivedToggleText, showArchived ? styles.archivedToggleTextActive : null]}>
            {showArchived ? '✓ Showing archived' : 'Show archived'}
          </Text>
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <ExerciseRow
            name={item.name}
            muscleGroup={item.muscleGroup}
            equipment={item.equipment}
            isCustom={item.isCustom}
            archived={item.archived}
            onPress={() => router.push(`/exercises/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {allExercises.length === 0
                ? 'No exercises yet.'
                : hasQuery
                  ? `No matches for “${search.trim()}”.`
                  : 'No exercises match this filter.'}
            </Text>
            <Pressable onPress={() => router.push('/exercises/new')} accessibilityRole="button">
              <Text style={styles.emptyCreate}>＋ Create an exercise</Text>
            </Pressable>
          </View>
        }
        contentContainerStyle={sections.length === 0 ? styles.emptyContent : undefined}
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
  appbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: theme.colors.background,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
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
  archivedToggle: {
    alignSelf: 'flex-end',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
  },
  archivedToggleText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  archivedToggleTextActive: {
    color: theme.colors.accent,
    fontWeight: '700',
  },
  sectionHeader: {
    ...theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
  },
  empty: {
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  emptyCreate: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  emptyContent: {
    flexGrow: 1,
  },
});
