// Measurements index screen (MEAS-01/MEAS-02, D-07/D-08a/D-10) — reached via
// Settings/More -> "Body Measurements". Lists every seeded metric with its
// latest-value caption (MetricRow), a quick weigh-in fast path that upserts
// today's canonical-kg body weight, and a "Log measurements" CTA that Plan
// 04 wires to the dated-session entry form.
//
// Reload runs on every focus via the cancelled-guard Promise.all pattern
// (app/(tabs)/settings.tsx precedent) so a reading logged elsewhere (or
// deleted on the per-metric detail screen) is never stale on return.

import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { MetricRow } from '../../components/MetricRow';
import { NumericKeypad } from '../../components/NumericKeypad';
import { db } from '../../db/client';
import { loadLatestPerMetric, loadMetricDefinitions, upsertReadingForDate } from '../../db/measurements';
import type { BodyMeasurement, MetricDefinition } from '../../db/schema';
import { getSetting } from '../../db/settings';
import { cmToDisplay } from '../../lib/lengthUnits';
import { getMetricIcon, type UnitType } from '../../lib/measurementMetrics';
import { displayToKg, kgToDisplay } from '../../lib/weightUnits';
import { theme } from '../../theme';

type WeightUnit = 'kg' | 'lb';
type LengthUnit = 'cm' | 'in';

/** Today's date in the same YYYY-MM-DD shape db/measurements.ts validates against. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** "Today" / "N days ago" / "Jul 20, 2026" — matches the index list caption contract. */
function formatRelativeDate(measuredAt: string): string {
  const today = todayISO();
  if (measuredAt === today) {
    return 'Today';
  }
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((new Date(today).getTime() - new Date(measuredAt).getTime()) / msPerDay);
  if (diffDays === 1) {
    return '1 day ago';
  }
  if (diffDays > 1 && diffDays < 7) {
    return `${diffDays} days ago`;
  }
  return new Date(measuredAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Unit-aware display value for one reading, per the metric's unitType (D-05). */
function formatMetricValue(value: number, unitType: UnitType, units: WeightUnit, lengthUnits: LengthUnit): string {
  if (unitType === 'weight') {
    return `${kgToDisplay(value, units)}${units}`;
  }
  if (unitType === 'length') {
    return `${cmToDisplay(value, lengthUnits)}${lengthUnits}`;
  }
  return `${Math.round(value * 10) / 10}%`;
}

export default function MeasurementsIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [definitions, setDefinitions] = useState<MetricDefinition[]>([]);
  const [latestByMetric, setLatestByMetric] = useState<Map<string, BodyMeasurement>>(new Map());
  const [units, setUnits] = useState<WeightUnit>('kg');
  const [lengthUnits, setLengthUnits] = useState<LengthUnit>('cm');
  const [weighInOpen, setWeighInOpen] = useState(false);

  const load = useCallback(async () => {
    const [defs, latest, unitsValue, lengthUnitsValue] = await Promise.all([
      loadMetricDefinitions(db),
      loadLatestPerMetric(db),
      getSetting(db, 'units'),
      getSetting(db, 'length_units'),
    ]);
    setDefinitions(defs);
    setLatestByMetric(new Map(latest.map((row) => [row.metric, row])));
    setUnits(unitsValue === 'lb' ? 'lb' : 'kg');
    setLengthUnits(lengthUnitsValue === 'in' ? 'in' : 'cm');
    setLoading(false);
  }, []);

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

  const weightEntry = latestByMetric.get('weight') ?? null;
  const loggedToday = weightEntry !== null && weightEntry.measuredAt === todayISO();

  const weighInCaption = loggedToday
    ? `Logged today: ${kgToDisplay(weightEntry!.value, units)}${units}`
    : 'Log today’s weight';

  const weighInInitialValue = weightEntry ? kgToDisplay(weightEntry.value, units) : 0;

  const { bodyWeightDefs, bodyMeasurementDefs } = useMemo(() => {
    return {
      bodyWeightDefs: definitions.filter((d) => d.position <= 1),
      bodyMeasurementDefs: definitions.filter((d) => d.position >= 2),
    };
  }, [definitions]);

  async function handleWeighInDone(value: number) {
    const valueKg = displayToKg(value, units);
    await upsertReadingForDate(db, { metric: 'weight', value: valueKg, measuredAt: todayISO(), unitType: 'weight' });
    setWeighInOpen(false);
    await load();
  }

  function handleLogMeasurements() {
    // TODO(05-04): open dated-session entry
  }

  function renderMetricRow(def: MetricDefinition) {
    const reading = latestByMetric.get(def.metricKey) ?? null;
    const caption = reading
      ? `${formatMetricValue(reading.value, def.unitType, units, lengthUnits)} · ${formatRelativeDate(reading.measuredAt)}`
      : 'No data yet';
    return (
      <MetricRow
        key={def.metricKey}
        icon={getMetricIcon(def.metricKey)}
        label={def.label}
        caption={caption}
        onPress={() => router.push(`/measurements/${def.metricKey}`)}
      />
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.appbar, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>‹ More</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Body Measurements</Text>

        <Pressable
          onPress={() => setWeighInOpen(true)}
          accessibilityRole="button"
          style={styles.weighInCard}
        >
          <Text style={styles.weighInTitle}>{'⚖️'} Quick weigh-in</Text>
          <Text style={styles.weighInCaption}>{weighInCaption}</Text>
        </Pressable>

        <Pressable onPress={handleLogMeasurements} accessibilityRole="button" style={styles.logButton}>
          <Text style={styles.logButtonText}>Log measurements</Text>
        </Pressable>

        <View style={styles.listSection}>
          <Text style={styles.sectionLabel}>Body Weight</Text>
          {bodyWeightDefs.map(renderMetricRow)}
        </View>

        <View style={styles.listSection}>
          <Text style={styles.sectionLabel}>Body Measurements</Text>
          {bodyMeasurementDefs.map(renderMetricRow)}
        </View>
      </ScrollView>

      <NumericKeypad
        visible={weighInOpen}
        label={`Body weight (${units})`}
        initialValue={weighInInitialValue}
        allowDecimal
        onDone={(value) => void handleWeighInDone(value)}
        onCancel={() => setWeighInOpen(false)}
      />
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
  weighInCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.accent,
    padding: theme.spacing.lg,
    marginTop: theme.spacing['2xl'],
    gap: theme.spacing.xs,
  },
  weighInTitle: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  weighInCaption: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  logButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  logButtonText: {
    ...theme.typography.body,
    color: theme.colors.background,
    fontWeight: '700',
  },
  listSection: {
    marginTop: theme.spacing['2xl'],
  },
  sectionLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
});
