// Stats overview dashboard (D-01/D-02, UI-SPEC "1. Stats overview
// dashboard"). Single scrolling screen, sections separated by
// theme.spacing['2xl'] — no sub-tabs. This plan (04-03) builds Section B
// (weekly volume, STAT-02) and Section C (exercise picker, D-03a second
// entry point into the per-exercise chart from Plan 02). Section A (recent
// PR feed, STAT-03) is inserted by Plan 04 — see the placeholder below; no
// fake PR data is stubbed here.
//
// Live-loads on every focus (STAT-03/D-11 non-negotiable — never cached),
// mirroring app/stats/[exerciseId].tsx's useFocusEffect + cancelled-guard +
// Promise.all pattern.

import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { CartesianChart, StackedBar } from 'victory-native';
import { useFont } from '@shopify/react-native-skia';

import { MUSCLE_GROUP_COLORS, MUSCLE_GROUP_KEYS } from '../../constants/statsChart';
import { muscleIcon } from '../../constants/muscleIcons';
import { db } from '../../db/client';
import { getSetting } from '../../db/settings';
import { loadExercisesWithSets, loadWeeklyVolumeSets, type TrainedExercise } from '../../db/stats';
import { buildWeeklyVolume, type WeeklyVolumeRow, type WeeklyVolumeSet } from '../../lib/weeklyVolume';
import { kgToDisplay } from '../../lib/weightUnits';
import { theme } from '../../theme';

const WEEKS_BACK = 12;

/** ISO timestamp for the Monday-anchored start of the window `weeksBack` weeks ago. */
function weeksAgoIso(weeksBack: number): string {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - weeksBack * 7);
  return cutoff.toISOString();
}

export default function StatsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const font = useFont(require('../../assets/fonts/SpaceMono-Regular.ttf'), 12);

  const [loading, setLoading] = useState(true);
  const [weeklySets, setWeeklySets] = useState<WeeklyVolumeSet[]>([]);
  const [trainedExercises, setTrainedExercises] = useState<TrainedExercise[]>([]);
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [search, setSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);

      (async () => {
        const [volumeSets, exercisesWithSets, unitSetting] = await Promise.all([
          loadWeeklyVolumeSets(db, weeksAgoIso(WEEKS_BACK)),
          loadExercisesWithSets(db),
          getSetting(db, 'units'),
        ]);

        if (cancelled) {
          return;
        }

        setWeeklySets(volumeSets);
        setTrainedExercises(exercisesWithSets);
        setUnit(unitSetting === 'lb' ? 'lb' : 'kg');
        setLoading(false);
      })();

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const weeklyRows = useMemo(() => buildWeeklyVolume(weeklySets, WEEKS_BACK), [weeklySets]);

  const displayRows: WeeklyVolumeRow[] = useMemo(
    () =>
      weeklyRows.map((row) => {
        const converted = { weekStart: row.weekStart } as WeeklyVolumeRow;
        for (const key of MUSCLE_GROUP_KEYS) {
          converted[key] = kgToDisplay(row[key], unit);
        }
        return converted;
      }),
    [weeklyRows, unit],
  );

  const hasAnyVolume = weeklyRows.some((row) => MUSCLE_GROUP_KEYS.some((key) => row[key] > 0));

  const filteredExercises = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term.length === 0) {
      return trainedExercises;
    }
    return trainedExercises.filter((e) => e.name.toLowerCase().includes(term));
  }, [trainedExercises, search]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={{ paddingTop: insets.top }}>
      {/* Section A (recent PR feed, STAT-03) is inserted here by Plan 04-04.
          Intentionally no placeholder/mock PR data rendered in this plan. */}

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Weekly Volume</Text>

        {hasAnyVolume ? (
          <>
            <View style={styles.chartContainer}>
              <CartesianChart
                data={displayRows}
                xKey="weekStart"
                yKeys={[...MUSCLE_GROUP_KEYS]}
                domainPadding={{ left: 30, right: 30, top: 20 }}
                axisOptions={{ font }}
              >
                {({ points, chartBounds }) => (
                  <StackedBar
                    chartBounds={chartBounds}
                    points={MUSCLE_GROUP_KEYS.map((key) => points[key])}
                    colors={MUSCLE_GROUP_COLORS as string[]}
                    innerPadding={0.25}
                  />
                )}
              </CartesianChart>
            </View>

            <View style={styles.legend}>
              {MUSCLE_GROUP_KEYS.map((key, index) => (
                <View key={key} style={styles.legendItem}>
                  <View style={[styles.legendSwatch, { backgroundColor: MUSCLE_GROUP_COLORS[index] }]} />
                  <Text style={styles.legendIcon}>{muscleIcon(key)}</Text>
                  <Text style={styles.legendLabel}>{key}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyHeading}>No training logged yet</Text>
            <Text style={styles.emptyBody}>Finish a workout and your weekly volume will appear here.</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>View Progress</Text>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search exercises"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
        />

        {trainedExercises.length === 0 ? (
          <Text style={styles.noExercisesText}>No exercises trained yet.</Text>
        ) : (
          <View style={styles.pickerList}>
            {filteredExercises.map((exercise) => (
              <Pressable
                key={exercise.id}
                onPress={() =>
                  router.push({ pathname: '/stats/[exerciseId]', params: { exerciseId: String(exercise.id) } })
                }
                accessibilityRole="button"
                style={styles.pickerRow}
              >
                <Text style={styles.pickerIcon}>{muscleIcon(exercise.muscleGroup)}</Text>
                <Text style={styles.pickerName} numberOfLines={1}>
                  {exercise.name}
                </Text>
                <Text style={styles.pickerChevron}>›</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
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
  section: {
    marginTop: theme.spacing['2xl'],
    paddingHorizontal: theme.spacing.lg,
  },
  sectionHeading: {
    ...theme.typography.title,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  chartContainer: {
    minHeight: 220,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: theme.radius.sm,
  },
  legendIcon: {
    fontSize: 14,
  },
  legendLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  emptyState: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  emptyHeading: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyBody: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  searchInput: {
    ...theme.typography.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  noExercisesText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  pickerList: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    marginBottom: theme.spacing.xl,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  pickerIcon: {
    fontSize: 20,
    width: 26,
    textAlign: 'center',
  },
  pickerName: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
  },
  pickerChevron: {
    color: theme.colors.textMuted,
    fontSize: 22,
  },
});
