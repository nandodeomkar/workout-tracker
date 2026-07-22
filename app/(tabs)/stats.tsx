// Stats overview dashboard (D-01/D-02, UI-SPEC "1. Stats overview
// dashboard"). Single scrolling screen, sections separated by
// theme.spacing['2xl'] — no sub-tabs. Plan 03 built Section B (weekly
// volume, STAT-02) and Section C (exercise picker, D-03a second entry point
// into the per-exercise chart). This plan (04-04) adds Section A: the
// recent PR feed (STAT-03), recomputed live from `sets` on every focus —
// never stored (D-11).
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
import { loadAllExercises } from '../../db/exercises';
import type { Exercise } from '../../db/schema';
import { getSetting } from '../../db/settings';
import { loadAllHistorySets, loadExercisesWithSets, loadWeeklyVolumeSets, type TrainedExercise } from '../../db/stats';
import { computeAllTimeRecords, type HistoricalSet, type PREvent } from '../../lib/records';
import { buildWeeklyVolume, type WeeklyVolumeRow, type WeeklyVolumeSet } from '../../lib/weeklyVolume';
import { kgToDisplay } from '../../lib/weightUnits';
import { theme } from '../../theme';

const WEEKS_BACK = 12;
/** D-10: overview PR feed is capped to the most recent N events across all exercises. */
const RECENT_PR_LIMIT = 12;

/** ISO timestamp for the Monday-anchored start of the window `weeksBack` weeks ago. */
function weeksAgoIso(weeksBack: number): string {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - weeksBack * 7);
  return cutoff.toISOString();
}

/** Short "Jul 20" style date for a PR feed row's secondary line. */
function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** "5RM" for a rep-max event, "Est. 1RM" for a best-e1RM event. */
function prKindLabel(event: PREvent): string {
  return event.kind === 'rep-max' ? `${event.reps}RM` : 'Est. 1RM';
}

export default function StatsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const font = useFont(require('../../assets/fonts/SpaceMono-Regular.ttf'), 12);

  const [loading, setLoading] = useState(true);
  const [weeklySets, setWeeklySets] = useState<WeeklyVolumeSet[]>([]);
  const [trainedExercises, setTrainedExercises] = useState<TrainedExercise[]>([]);
  const [historySets, setHistorySets] = useState<HistoricalSet[]>([]);
  const [exercisesById, setExercisesById] = useState<Map<number, Exercise>>(new Map());
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [search, setSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);

      (async () => {
        const [volumeSets, exercisesWithSets, allHistorySets, allExercises, unitSetting] = await Promise.all([
          loadWeeklyVolumeSets(db, weeksAgoIso(WEEKS_BACK)),
          loadExercisesWithSets(db),
          loadAllHistorySets(db),
          loadAllExercises(db),
          getSetting(db, 'units'),
        ]);

        if (cancelled) {
          return;
        }

        setWeeklySets(volumeSets);
        setTrainedExercises(exercisesWithSets);
        setHistorySets(allHistorySets);
        setExercisesById(new Map(allExercises.map((exercise) => [exercise.id, exercise])));
        setUnit(unitSetting === 'lb' ? 'lb' : 'kg');
        setLoading(false);
      })();

      return () => {
        cancelled = true;
      };
    }, []),
  );

  // STAT-03/D-11: recomputed live from historySets on every focus, never
  // stored/cached — no persistence path exists for this value.
  const recentPREvents = useMemo(() => {
    const { events } = computeAllTimeRecords(historySets);
    return [...events].sort((a, b) => b.date.localeCompare(a.date)).slice(0, RECENT_PR_LIMIT);
  }, [historySets]);

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
      <View style={[styles.section, styles.firstSection]}>
        <Text style={styles.sectionHeading}>Recent PRs</Text>

        {recentPREvents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyHeading}>No PRs yet</Text>
            <Text style={styles.emptyBody}>Log a working set and your first personal record will show up here.</Text>
          </View>
        ) : (
          <>
            <View style={styles.prFeedList}>
              {recentPREvents.map((event, index) => (
                <Pressable
                  key={`${event.exerciseId}-${event.kind}-${event.reps}-${event.workoutId}-${index}`}
                  onPress={() =>
                    router.push({ pathname: '/stats/[exerciseId]', params: { exerciseId: String(event.exerciseId) } })
                  }
                  accessibilityRole="button"
                  style={styles.prFeedRow}
                >
                  <Text style={styles.prFeedIcon}>
                    {muscleIcon(exercisesById.get(event.exerciseId)?.muscleGroup ?? 'Other')}
                  </Text>
                  <View style={styles.prFeedTextGroup}>
                    <Text style={styles.prFeedName} numberOfLines={1}>
                      {exercisesById.get(event.exerciseId)?.name ?? 'Exercise'}
                    </Text>
                    <Text style={styles.prFeedSecondary}>
                      {prKindLabel(event)} · {kgToDisplay(event.weightKg, unit)}
                      {unit} · {formatShortDate(event.date)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => router.push('/stats/records')}
              accessibilityRole="button"
              style={styles.seeAllLink}
            >
              <Text style={styles.seeAllText}>See all</Text>
            </Pressable>
          </>
        )}
      </View>

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
  firstSection: {
    marginTop: theme.spacing.lg,
  },
  sectionHeading: {
    ...theme.typography.title,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  prFeedList: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  prFeedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  prFeedIcon: {
    fontSize: 20,
    width: 26,
    textAlign: 'center',
  },
  prFeedTextGroup: {
    flex: 1,
    gap: 2,
  },
  prFeedName: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  prFeedSecondary: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  seeAllLink: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: theme.spacing.sm,
  },
  seeAllText: {
    ...theme.typography.caption,
    color: theme.colors.accent,
    fontWeight: '700',
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
