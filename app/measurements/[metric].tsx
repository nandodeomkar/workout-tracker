// Per-metric detail screen (MEAS-02, D-09/D-11) — mirrors
// app/stats/[exerciseId].tsx's chart chrome verbatim: latest-value hero
// card, 3M/1Y/All range chips, victory-native trend line + single-point
// Scatter, empty/sparse states, and a dated history list with
// delete-to-correct (D-09). Data source is buildMeasurementSeries (one point
// per date, no min/max reduction) rather than lib/chartSeries.ts.

import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { CartesianChart, Line, Scatter } from 'victory-native';
import { useFont } from '@shopify/react-native-skia';

import { HistoryRow } from '../../components/HistoryRow';
import { MetricToggle } from '../../components/MetricToggle';
import { db } from '../../db/client';
import { deleteReading, loadMetricDefinitions, loadReadingsForMetric } from '../../db/measurements';
import type { BodyMeasurement, MetricDefinition } from '../../db/schema';
import { getSetting } from '../../db/settings';
import { rangeCutoffISO, type RangeOption } from '../../lib/dateRange';
import { cmToDisplay } from '../../lib/lengthUnits';
import { buildMeasurementSeries } from '../../lib/measurementSeries';
import type { UnitType } from '../../lib/measurementMetrics';
import { kgToDisplay } from '../../lib/weightUnits';
import { theme } from '../../theme';

type WeightUnit = 'kg' | 'lb';
type LengthUnit = 'cm' | 'in';

const RANGE_OPTIONS: { value: RangeOption; label: string }[] = [
  { value: '3M', label: '3M' },
  { value: '1Y', label: '1Y' },
  { value: 'All', label: 'All' },
];

/** "Jul 20, 2026" — parses a date-only YYYY-MM-DD string in local time (never via `new Date(iso)`, which would parse as UTC midnight and can shift a day in negative-offset timezones). */
function formatDateLabel(dateISO: string): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Converts a canonical stored value to a display-unit number (chart/hero), per the metric's unitType (D-05). */
function convertForDisplay(value: number, unitType: UnitType, units: WeightUnit, lengthUnits: LengthUnit): number {
  if (unitType === 'weight') {
    return kgToDisplay(value, units);
  }
  if (unitType === 'length') {
    return cmToDisplay(value, lengthUnits);
  }
  return Math.round(value * 10) / 10;
}

/** Unit-suffixed display label for a history-row value. */
function formatValueLabel(value: number, unitType: UnitType, units: WeightUnit, lengthUnits: LengthUnit): string {
  if (unitType === 'weight') {
    return `${kgToDisplay(value, units)}${units}`;
  }
  if (unitType === 'length') {
    return `${cmToDisplay(value, lengthUnits)}${lengthUnits}`;
  }
  return `${Math.round(value * 10) / 10}%`;
}

function unitSuffixFor(unitType: UnitType, units: WeightUnit, lengthUnits: LengthUnit): string {
  if (unitType === 'weight') {
    return units;
  }
  if (unitType === 'length') {
    return lengthUnits;
  }
  return '%';
}

export default function MeasurementDetailScreen() {
  const { metric: metricKey } = useLocalSearchParams<{ metric: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const font = useFont(require('../../assets/fonts/SpaceMono-Regular.ttf'), 12);

  const [loading, setLoading] = useState(true);
  const [definition, setDefinition] = useState<MetricDefinition | null>(null);
  const [readings, setReadings] = useState<BodyMeasurement[]>([]);
  const [units, setUnits] = useState<WeightUnit>('kg');
  const [lengthUnits, setLengthUnits] = useState<LengthUnit>('cm');
  const [range, setRange] = useState<RangeOption>('All');

  const load = useCallback(async () => {
    const [definitions, readingRows, unitsValue, lengthUnitsValue] = await Promise.all([
      loadMetricDefinitions(db),
      loadReadingsForMetric(db, metricKey),
      getSetting(db, 'units'),
      getSetting(db, 'length_units'),
    ]);
    setDefinition(definitions.find((d) => d.metricKey === metricKey) ?? null);
    setReadings(readingRows);
    setUnits(unitsValue === 'lb' ? 'lb' : 'kg');
    setLengthUnits(lengthUnitsValue === 'in' ? 'in' : 'cm');
    setLoading(false);
  }, [metricKey]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load().then(() => {
        if (cancelled) {
          return;
        }
      });
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const allPoints = useMemo(() => buildMeasurementSeries(readings), [readings]);

  const rangeFilteredPoints = useMemo(() => {
    const cutoff = rangeCutoffISO(range);
    if (cutoff === null) {
      return allPoints;
    }
    const cutoffDate = cutoff.slice(0, 10);
    return allPoints.filter((p) => p.date >= cutoffDate);
  }, [allPoints, range]);

  const displayPoints = useMemo(() => {
    if (!definition) {
      return [];
    }
    return rangeFilteredPoints.map((p) => ({
      date: p.date,
      value: convertForDisplay(p.value, definition.unitType, units, lengthUnits),
    }));
  }, [rangeFilteredPoints, definition, units, lengthUnits]);

  function handleAddReading() {
    // TODO(05-04): open dated-session entry scoped to this metric + today
  }

  function handleEditReading(_readingId: number) {
    // TODO(05-04): open dated-session entry in edit mode, pre-filled
  }

  function handleDeleteReading(readingId: number) {
    Alert.alert('Delete this reading?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteReading(db, readingId);
          await load();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  if (!definition) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Metric not found.</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backLink}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const latest = readings.length > 0 ? readings[readings.length - 1] : null;
  const unitSuffix = unitSuffixFor(definition.unitType, units, lengthUnits);

  return (
    <View style={styles.flex}>
      <View style={[styles.appbar, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>‹ Body Measurements</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>{definition.label}</Text>

        {readings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyHeading}>No {definition.label} logged yet</Text>
            <Text style={styles.emptyBody}>
              Add a reading to start tracking your {definition.label.toLowerCase()} over time.
            </Text>
            <Pressable onPress={handleAddReading} accessibilityRole="button">
              <Text style={styles.addLink}>+ Add a reading</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {latest ? (
              <View style={styles.heroCard}>
                <Text style={styles.heroValue}>
                  {convertForDisplay(latest.value, definition.unitType, units, lengthUnits)} {unitSuffix}
                </Text>
                <Text style={styles.heroDate}>{formatDateLabel(latest.measuredAt)}</Text>
              </View>
            ) : null}

            <MetricToggle options={RANGE_OPTIONS} value={range} onChange={setRange} />

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
              <Text style={styles.sparseCaption}>Log one more reading to see a trend line.</Text>
            ) : null}

            <View style={styles.historySection}>
              {[...readings].reverse().map((reading) => (
                <HistoryRow
                  key={reading.id}
                  dateLabel={formatDateLabel(reading.measuredAt)}
                  valueLabel={formatValueLabel(reading.value, definition.unitType, units, lengthUnits)}
                  onEdit={() => handleEditReading(reading.id)}
                  onDelete={() => handleDeleteReading(reading.id)}
                />
              ))}
            </View>

            <Pressable onPress={handleAddReading} accessibilityRole="button" style={styles.addLinkRow}>
              <Text style={styles.addLink}>+ Add a reading</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
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
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  heading: {
    ...theme.typography.title,
    color: theme.colors.text,
    paddingTop: theme.spacing.lg,
  },
  heroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.lg,
  },
  heroValue: {
    ...theme.typography.display,
    color: theme.colors.accent,
  },
  heroDate: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  chartContainer: {
    minHeight: 240,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  sparseCaption: {
    ...theme.typography.body,
    color: theme.colors.text,
    textAlign: 'center',
    paddingTop: theme.spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: theme.spacing.xl * 2,
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
  addLink: {
    ...theme.typography.caption,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  addLinkRow: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  historySection: {
    marginTop: theme.spacing.xl,
  },
});
