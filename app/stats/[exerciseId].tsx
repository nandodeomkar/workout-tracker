// Per-exercise progress chart + record board screen (STAT-01/STAT-03,
// D-03b/D-04/D-05/D-06/D-07/D-08/D-09, UI-SPEC "2. Per-exercise progress
// chart" + "3. Per-exercise record board"). Reachable from the exercise
// library detail's "View progress" link, the Stats-tab exercise picker, and
// PR-feed row taps (app/(tabs)/stats.tsx, app/stats/records.tsx) — all land
// on this one route; a Chart/Records toggle switches between the two views
// so both share `/stats/[exerciseId]` (Plan 05).
//
// Chart view live-loads on every focus (STAT-03/D-11 non-negotiable — never
// cached) via loadExerciseChartSets + the pure buildChartSeries reduction.
// Metric toggle defaults to Est. 1RM (D-04); range chips filter the
// already-fetched all-time series client-side (RESEARCH.md Open Question 2
// — no per-chip re-query).
//
// Records view reuses the same live-recompute discipline: loadAllHistorySets
// (already used by the Stats tab/records feed, Plan 04) is fetched
// alongside the chart data in the same useFocusEffect, filtered to this
// exerciseId in JS, and reduced via lib/records.ts#computeExerciseRecordBoard
// — no new query, nothing persisted (T-04-07).

import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { CartesianChart, Line, Scatter } from 'victory-native';
import { useFont } from '@shopify/react-native-skia';

import { MetricToggle } from '../../components/MetricToggle';
import { db } from '../../db/client';
import { loadExerciseById } from '../../db/exercises';
import { getSetting } from '../../db/settings';
import type { Exercise } from '../../db/schema';
import { loadAllHistorySets, loadExerciseChartSets } from '../../db/stats';
import { buildChartSeries, type ChartMetric, type ChartSet } from '../../lib/chartSeries';
import { CURATED_REP_MAXES, computeExerciseRecordBoard, type HistoricalSet } from '../../lib/records';
import { kgToDisplay } from '../../lib/weightUnits';
import { theme } from '../../theme';

type RangeOption = '3M' | '1Y' | 'All';
type ScreenView = 'chart' | 'records';

const METRIC_OPTIONS: { value: ChartMetric; label: string }[] = [
  { value: 'e1rm', label: 'Est. 1RM' },
  { value: 'topSet', label: 'Top Set' },
  { value: 'volume', label: 'Volume' },
];

const RANGE_OPTIONS: { value: RangeOption; label: string }[] = [
  { value: '3M', label: '3M' },
  { value: '1Y', label: '1Y' },
  { value: 'All', label: 'All' },
];

const VIEW_OPTIONS: { value: ScreenView; label: string }[] = [
  { value: 'chart', label: 'Chart' },
  { value: 'records', label: 'Records' },
];

/** "Jul 20, 2026" style date for a record-board row's secondary line. */
function formatRecordDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Returns an ISO cutoff date for the given range, or `null` for 'All' (no filter). */
function rangeCutoffISO(range: RangeOption): string | null {
  if (range === 'All') {
    return null;
  }
  const cutoff = new Date();
  if (range === '3M') {
    cutoff.setMonth(cutoff.getMonth() - 3);
  } else {
    cutoff.setFullYear(cutoff.getFullYear() - 1);
  }
  return cutoff.toISOString();
}

export default function ExerciseChartScreen() {
  const { exerciseId: exerciseIdParam } = useLocalSearchParams<{ exerciseId: string }>();
  const exerciseId = Number(exerciseIdParam);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const font = useFont(require('../../assets/fonts/SpaceMono-Regular.ttf'), 12);

  const [loading, setLoading] = useState(true);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [chartSets, setChartSets] = useState<ChartSet[]>([]);
  const [historySets, setHistorySets] = useState<HistoricalSet[]>([]);
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [metric, setMetric] = useState<ChartMetric>('e1rm');
  const [range, setRange] = useState<RangeOption>('All');
  const [view, setView] = useState<ScreenView>('chart');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);

      (async () => {
        const [sets, allHistorySets, exerciseRow, unitSetting] = await Promise.all([
          loadExerciseChartSets(db, exerciseId),
          loadAllHistorySets(db),
          loadExerciseById(db, exerciseId),
          getSetting(db, 'units'),
        ]);

        if (cancelled) {
          return;
        }

        setExercise(exerciseRow ?? null);
        setUnit(unitSetting === 'lb' ? 'lb' : 'kg');
        setChartSets(sets);
        setHistorySets(allHistorySets);
        setLoading(false);
      })();

      return () => {
        cancelled = true;
      };
    }, [exerciseId]),
  );

  const allPoints = useMemo(() => buildChartSeries(chartSets, metric), [chartSets, metric]);

  // T-04-07: derived live (never persisted) from the same all-history fetch
  // the Stats tab/records feed already use — filtered to this exerciseId in
  // JS, no new query added (per plan's explicit "do NOT add a new query"
  // instruction).
  const recordBoard = useMemo(
    () => computeExerciseRecordBoard(historySets.filter((s) => s.exerciseId === exerciseId)),
    [historySets, exerciseId],
  );

  const rangeFilteredPoints = useMemo(() => {
    const cutoff = rangeCutoffISO(range);
    if (cutoff === null) {
      return allPoints;
    }
    return allPoints.filter((p) => p.date >= cutoff);
  }, [allPoints, range]);

  const displayPoints = useMemo(
    () => rangeFilteredPoints.map((p) => ({ date: p.date, value: kgToDisplay(p.value, unit) })),
    [rangeFilteredPoints, unit],
  );

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
    <View style={styles.flex}>
      <View style={[styles.appbar, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>‹ Stats</Text>
        </Pressable>
      </View>

      <Text style={styles.heading} numberOfLines={2}>
        {exercise.name}
      </Text>

      <MetricToggle options={VIEW_OPTIONS} value={view} onChange={setView} />

      {view === 'chart' ? (
        <>
          <MetricToggle options={METRIC_OPTIONS} value={metric} onChange={setMetric} />
          <MetricToggle options={RANGE_OPTIONS} value={range} onChange={setRange} />

          {displayPoints.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyHeading}>No data yet for {exercise.name}</Text>
              <Text style={styles.emptyBody}>Log a working set for this exercise to start tracking progress.</Text>
            </View>
          ) : (
            <>
              <View style={styles.chartContainer}>
                <CartesianChart data={displayPoints} xKey="date" yKeys={['value']} axisOptions={{ font }}>
                  {({ points }) => (
                    <>
                      <Line points={points.value} color={theme.colors.accent} strokeWidth={3} />
                      <Scatter points={points.value} color={theme.colors.accent} radius={6} />
                    </>
                  )}
                </CartesianChart>
              </View>
              {displayPoints.length === 1 ? (
                <Text style={styles.sparseCaption}>Log one more workout to see a trend line.</Text>
              ) : null}
            </>
          )}
        </>
      ) : recordBoard.repMaxes.length === 0 && recordBoard.bestE1RM === null ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyHeading}>No records yet</Text>
          <Text style={styles.emptyBody}>Your rep-max records will appear here once you log a set.</Text>
        </View>
      ) : (
        <View style={styles.recordsSection}>
          <Text style={styles.recordsHeading}>Records</Text>

          {recordBoard.bestE1RM ? (
            <View style={styles.recordHeroCard}>
              <Text style={styles.recordHeroLabel}>Best Est. 1RM</Text>
              <Text style={styles.recordHeroValue}>
                {kgToDisplay(recordBoard.bestE1RM.e1rm, unit)} {unit}
              </Text>
              <Text style={styles.recordDate}>{formatRecordDate(recordBoard.bestE1RM.date)}</Text>
            </View>
          ) : null}

          {recordBoard.repMaxes.length > 0 ? (
            <View style={styles.recordCard}>
              {CURATED_REP_MAXES.map((repCount) => {
                const entry = recordBoard.repMaxes.find((r) => r.reps === repCount);
                if (!entry) {
                  return null;
                }
                return (
                  <View key={repCount} style={styles.recordRow}>
                    <Text style={styles.recordLabel}>{repCount}RM</Text>
                    <View style={styles.recordValueGroup}>
                      <Text style={styles.recordValue}>
                        {kgToDisplay(entry.weightKg, unit)} {unit}
                      </Text>
                      <Text style={styles.recordDate}>{formatRecordDate(entry.date)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      )}
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
    paddingBottom: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: theme.spacing.md,
  },
  backText: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  heading: {
    ...theme.typography.title,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  chartContainer: {
    minHeight: 240,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  sparseCaption: {
    ...theme.typography.body,
    color: theme.colors.text,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  emptyHeading: {
    ...theme.typography.title,
    color: theme.colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  recordsSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  recordsHeading: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  recordHeroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  recordHeroLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  recordHeroValue: {
    ...theme.typography.display,
    color: theme.colors.accent,
  },
  recordCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  recordLabel: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
  },
  recordValueGroup: {
    alignItems: 'flex-end',
    gap: 2,
  },
  recordValue: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  recordDate: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
});
