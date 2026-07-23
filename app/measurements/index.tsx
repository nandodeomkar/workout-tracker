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
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { MetricRow } from '../../components/MetricRow';
import { MetricToggle, type MetricToggleOption } from '../../components/MetricToggle';
import { NumericKeypad } from '../../components/NumericKeypad';
import { db } from '../../db/client';
import {
  createCustomMetric,
  loadLatestPerMetric,
  loadMetricDefinitions,
  upsertReadingForDate,
} from '../../db/measurements';
import type { BodyMeasurement, MetricDefinition } from '../../db/schema';
import { getSetting } from '../../db/settings';
import { cmToDisplay } from '../../lib/lengthUnits';
import { getMetricIcon, type UnitType } from '../../lib/measurementMetrics';
import { displayToKg, kgToDisplay } from '../../lib/weightUnits';
import { theme } from '../../theme';

type WeightUnit = 'kg' | 'lb';
type LengthUnit = 'cm' | 'in';

/** 3-way unit-type picker options for the "+ Add custom metric" form (05-UI-SPEC §1). */
const CUSTOM_METRIC_UNIT_OPTIONS: MetricToggleOption<UnitType>[] = [
  { value: 'weight', label: 'Weight' },
  { value: 'length', label: 'Length' },
  { value: 'percent', label: 'Percent' },
];

/**
 * Derives a stable metric_key from a free-text label: lowercase, trim,
 * non-alphanumeric runs collapsed to a single `_`, leading/trailing `_`
 * stripped. Disambiguates against `existingKeys` (a collision with a
 * built-in or another custom metric) by appending an incrementing numeric
 * suffix, mirroring createCustomMetric's onConflictDoNothing safety net
 * with a key that's actually distinct up front.
 */
function deriveMetricKey(label: string, existingKeys: Set<string>): string {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'metric';
  if (!existingKeys.has(base)) {
    return base;
  }
  let suffix = 2;
  let candidate = `${base}_${suffix}`;
  while (existingKeys.has(candidate)) {
    suffix += 1;
    candidate = `${base}_${suffix}`;
  }
  return candidate;
}

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
  const [customFormOpen, setCustomFormOpen] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customUnitType, setCustomUnitType] = useState<UnitType>('weight');

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

  const { bodyWeightDefs, bodyMeasurementDefs, customDefs } = useMemo(() => {
    return {
      bodyWeightDefs: definitions.filter((d) => !d.isCustom && d.position <= 1),
      bodyMeasurementDefs: definitions.filter((d) => !d.isCustom && d.position >= 2),
      customDefs: definitions.filter((d) => d.isCustom),
    };
  }, [definitions]);

  async function handleWeighInDone(value: number) {
    const valueKg = displayToKg(value, units);
    await upsertReadingForDate(db, { metric: 'weight', value: valueKg, measuredAt: todayISO(), unitType: 'weight' });
    setWeighInOpen(false);
    await load();
  }

  function handleLogMeasurements() {
    router.push('/measurements/entry');
  }

  async function handleSaveCustomMetric() {
    const label = customLabel.trim();
    if (!label) {
      return;
    }
    const existingKeys = new Set(definitions.map((d) => d.metricKey));
    const metricKey = deriveMetricKey(label, existingKeys);
    await createCustomMetric(db, { metricKey, label, unitType: customUnitType });
    setCustomLabel('');
    setCustomUnitType('weight');
    setCustomFormOpen(false);
    await load();
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

        {customDefs.length > 0 ? (
          <View style={styles.listSection}>
            <Text style={styles.sectionLabel}>Custom</Text>
            {customDefs.map(renderMetricRow)}
          </View>
        ) : null}

        {customFormOpen ? (
          <View style={styles.customForm}>
            <TextInput
              style={styles.customInput}
              placeholder="Metric name"
              placeholderTextColor={theme.colors.textMuted}
              value={customLabel}
              onChangeText={setCustomLabel}
              autoFocus
            />
            <MetricToggle options={CUSTOM_METRIC_UNIT_OPTIONS} value={customUnitType} onChange={setCustomUnitType} />
            <Pressable
              onPress={() => void handleSaveCustomMetric()}
              accessibilityRole="button"
              style={styles.customSaveButton}
            >
              <Text style={styles.customSaveButtonText}>Save</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setCustomFormOpen(true)}
            accessibilityRole="button"
            style={styles.addCustomLink}
          >
            <Text style={styles.addCustomLinkText}>+ Add custom metric</Text>
          </Pressable>
        )}
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
  addCustomLink: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing['2xl'],
  },
  addCustomLinkText: {
    ...theme.typography.caption,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  customForm: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginTop: theme.spacing['2xl'],
    gap: theme.spacing.md,
  },
  customInput: {
    ...theme.typography.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minHeight: 44,
  },
  customSaveButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  customSaveButtonText: {
    ...theme.typography.body,
    color: theme.colors.background,
    fontWeight: '700',
  },
});
