// Measurement entry form (MEAS-01/MEAS-02, D-08b/D-09) — a single full-screen
// route serving three entry models via optional query params:
//   - no params            -> dated-session mode (every metric, blanks skipped)
//   - ?metric=X            -> single-metric add mode (scoped to X + today,
//                              auto-opens the keypad)
//   - ?metric=X&readingId=Y -> edit mode (pre-filled, back-datable, deletable)
//
// Reached from app/measurements/index.tsx's "Log measurements" CTA and
// app/measurements/[metric].tsx's "+ Add a reading" links / history-row edit
// action (Plan 03's deferred wiring, completed in this plan's Task 2).
//
// Values entered via the reused NumericKeypad are DISPLAY-unit numbers
// (kg/lb, cm/in, percent-as-is). They are converted to canonical units
// (kg / cm / percent) only at save time via displayToKg/displayToCm — the
// same D-05 canonical-storage convention as the index/detail screens.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { MonthCalendar } from '../../components/MonthCalendar';
import { NumericKeypad } from '../../components/NumericKeypad';
import { db } from '../../db/client';
import {
  deleteReading,
  insertReadingsForDate,
  loadMetricDefinitions,
  loadReadingsForMetric,
  updateReading,
  type DatedEntry,
} from '../../db/measurements';
import type { MetricDefinition } from '../../db/schema';
import { getSetting } from '../../db/settings';
import { cmToDisplay, displayToCm } from '../../lib/lengthUnits';
import { getMetricIcon, type UnitType } from '../../lib/measurementMetrics';
import { displayToKg, kgToDisplay } from '../../lib/weightUnits';
import { theme } from '../../theme';

type WeightUnit = 'kg' | 'lb';
type LengthUnit = 'cm' | 'in';

/** Today's date in the same YYYY-MM-DD shape db/measurements.ts validates against. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** "Jul 20, 2026" — parses a date-only YYYY-MM-DD string in local time (never `new Date(iso)`, which parses as UTC midnight and can shift a day in negative-offset timezones — matches app/measurements/[metric].tsx#formatDateLabel). */
function formatDateLabel(dateISO: string): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Canonical stored value (kg/cm/percent) -> display-unit number, for pre-filling edit mode. */
function convertToDisplay(value: number, unitType: UnitType, units: WeightUnit, lengthUnits: LengthUnit): number {
  if (unitType === 'weight') {
    return kgToDisplay(value, units);
  }
  if (unitType === 'length') {
    return cmToDisplay(value, lengthUnits);
  }
  return value;
}

/** Display-unit number entered via the keypad -> canonical value (kg/cm/percent), for writes (D-05). */
function convertToCanonical(value: number, unitType: UnitType, units: WeightUnit, lengthUnits: LengthUnit): number {
  if (unitType === 'weight') {
    return displayToKg(value, units);
  }
  if (unitType === 'length') {
    return displayToCm(value, lengthUnits);
  }
  return value;
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

export default function MeasurementEntryScreen() {
  const { metric: metricParam, readingId: readingIdParam } = useLocalSearchParams<{
    metric?: string;
    readingId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const readingId = readingIdParam ? Number(readingIdParam) : null;
  const isEdit = readingId !== null && !Number.isNaN(readingId);
  const isSingle = !isEdit && !!metricParam;
  const isSession = !isEdit && !metricParam;

  const [loading, setLoading] = useState(true);
  const [definitions, setDefinitions] = useState<MetricDefinition[]>([]);
  const [units, setUnits] = useState<WeightUnit>('kg');
  const [lengthUnits, setLengthUnits] = useState<LengthUnit>('cm');
  const [date, setDate] = useState(todayISO());
  const [values, setValues] = useState<Map<string, number>>(new Map());
  const [activeMetricKey, setActiveMetricKey] = useState<string | null>(null);
  const [keypadVisible, setKeypadVisible] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarYear, setCalendarYear] = useState(() => Number(todayISO().slice(0, 4)));
  const [calendarMonth, setCalendarMonth] = useState(() => Number(todayISO().slice(5, 7)));

  const load = useCallback(async () => {
    const [defs, unitsValue, lengthUnitsValue] = await Promise.all([
      loadMetricDefinitions(db),
      getSetting(db, 'units'),
      getSetting(db, 'length_units'),
    ]);
    const resolvedUnits: WeightUnit = unitsValue === 'lb' ? 'lb' : 'kg';
    const resolvedLengthUnits: LengthUnit = lengthUnitsValue === 'in' ? 'in' : 'cm';
    setDefinitions(defs);
    setUnits(resolvedUnits);
    setLengthUnits(resolvedLengthUnits);

    if (isEdit && metricParam && readingId !== null) {
      const readings = await loadReadingsForMetric(db, metricParam);
      const reading = readings.find((r) => r.id === readingId);
      const def = defs.find((d) => d.metricKey === metricParam);
      if (reading && def) {
        setDate(reading.measuredAt);
        setCalendarYear(Number(reading.measuredAt.slice(0, 4)));
        setCalendarMonth(Number(reading.measuredAt.slice(5, 7)));
        const displayVal = convertToDisplay(reading.value, def.unitType, resolvedUnits, resolvedLengthUnits);
        setValues(new Map([[metricParam, displayVal]]));
      }
    } else {
      setDate(todayISO());
      setValues(new Map());
    }
    setLoading(false);
  }, [isEdit, metricParam, readingId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setActiveMetricKey(null);
      setKeypadVisible(false);
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

  // Single-metric add mode auto-opens the keypad on entry (05-UI-SPEC "3. Add/Edit
  // Measurements form") to minimize taps — guarded so it only fires once per load.
  useEffect(() => {
    if (!loading && isSingle && metricParam && activeMetricKey === null && !keypadVisible) {
      setActiveMetricKey(metricParam);
      setKeypadVisible(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isSingle, metricParam]);

  const { bodyWeightDefs, bodyMeasurementDefs, customDefs } = useMemo(() => {
    return {
      bodyWeightDefs: definitions.filter((d) => !d.isCustom && d.position <= 1),
      bodyMeasurementDefs: definitions.filter((d) => !d.isCustom && d.position >= 2),
      customDefs: definitions.filter((d) => d.isCustom),
    };
  }, [definitions]);

  const singleDefinition = useMemo(
    () => definitions.find((d) => d.metricKey === metricParam) ?? null,
    [definitions, metricParam],
  );

  // Every day in the displayed month that is today-or-earlier — passed as
  // MonthCalendar's `workoutDays` so its built-in disabled-state logic makes
  // exactly those days selectable, and no future day is ever tappable (D-09).
  const selectableDays = useMemo(() => {
    const daysInMonth = new Date(Date.UTC(calendarYear, calendarMonth, 0)).getUTCDate();
    const today = todayISO();
    const set = new Set<string>();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const iso = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (iso <= today) {
        set.add(iso);
      }
    }
    return set;
  }, [calendarYear, calendarMonth]);

  function handlePrevMonth() {
    setCalendarMonth((m) => {
      if (m === 1) {
        setCalendarYear((y) => y - 1);
        return 12;
      }
      return m - 1;
    });
  }

  function handleNextMonth() {
    setCalendarMonth((m) => {
      if (m === 12) {
        setCalendarYear((y) => y + 1);
        return 1;
      }
      return m + 1;
    });
  }

  function handleSelectDay(dateISO: string) {
    if (dateISO > todayISO()) {
      // Defensive — MonthCalendar's disabled state already prevents this tap.
      return;
    }
    setDate(dateISO);
    setCalendarOpen(false);
  }

  function handleOpenKeypad(metricKey: string) {
    setActiveMetricKey(metricKey);
    setKeypadVisible(true);
  }

  function handleKeypadDone(value: number) {
    if (activeMetricKey) {
      setValues((prev) => {
        const next = new Map(prev);
        next.set(activeMetricKey, value);
        return next;
      });
    }
    setKeypadVisible(false);
  }

  function keypadLabelFor(metricKey: string): string {
    const def = definitions.find((d) => d.metricKey === metricKey);
    if (!def) {
      return metricKey;
    }
    return `${def.label} (${unitSuffixFor(def.unitType, units, lengthUnits)})`;
  }

  function formatRowValue(def: MetricDefinition): string {
    const raw = values.get(def.metricKey);
    if (raw === undefined) {
      return '—';
    }
    return `${raw}${unitSuffixFor(def.unitType, units, lengthUnits)}`;
  }

  async function handleSave() {
    if (isEdit && readingId !== null && metricParam) {
      const def = definitions.find((d) => d.metricKey === metricParam);
      if (!def) {
        router.back();
        return;
      }
      const displayVal = values.get(metricParam) ?? 0;
      const canonicalVal = convertToCanonical(displayVal, def.unitType, units, lengthUnits);
      await updateReading(db, readingId, { value: canonicalVal, measuredAt: date, unitType: def.unitType });
      router.back();
      return;
    }

    if (isSingle && metricParam) {
      const def = definitions.find((d) => d.metricKey === metricParam);
      if (!def || !values.has(metricParam)) {
        router.back();
        return;
      }
      const displayVal = values.get(metricParam)!;
      const canonicalVal = convertToCanonical(displayVal, def.unitType, units, lengthUnits);
      await insertReadingsForDate(db, date, [{ metric: metricParam, value: canonicalVal, unitType: def.unitType }]);
      router.back();
      return;
    }

    // Dated-session mode — only touched (filled) rows are written (D-08b).
    const entries: DatedEntry[] = [];
    for (const [metricKey, displayVal] of values.entries()) {
      const def = definitions.find((d) => d.metricKey === metricKey);
      if (!def) {
        continue;
      }
      entries.push({
        metric: metricKey,
        value: convertToCanonical(displayVal, def.unitType, units, lengthUnits),
        unitType: def.unitType,
      });
    }

    if (entries.length === 0) {
      router.back();
      return;
    }

    await insertReadingsForDate(db, date, entries);
    router.back();
  }

  function handleDelete() {
    Alert.alert('Delete this reading?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (readingId !== null) {
            await deleteReading(db, readingId);
          }
          router.back();
        },
      },
    ]);
  }

  function renderMetricRow(def: MetricDefinition) {
    return (
      <Pressable
        key={def.metricKey}
        onPress={() => handleOpenKeypad(def.metricKey)}
        accessibilityRole="button"
        style={styles.metricRow}
      >
        <Text style={styles.metricIcon}>{getMetricIcon(def.metricKey)}</Text>
        <Text style={styles.metricLabel} numberOfLines={1}>
          {def.label}
        </Text>
        <Text style={styles.metricValue}>{formatRowValue(def)}</Text>
      </Pressable>
    );
  }

  const headerTitle = isEdit ? 'Edit reading' : isSingle ? (singleDefinition?.label ?? metricParam ?? '') : 'Log measurements';
  const saveLabel = isEdit ? 'Save changes' : isSingle ? 'Save reading' : 'Save measurements';

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
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.cancelButton}>
          <Text style={styles.cancelText}>‹ Cancel</Text>
        </Pressable>
        <Text style={styles.formTitle} numberOfLines={1}>
          {headerTitle}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => setCalendarOpen(true)} accessibilityRole="button" style={styles.dateRow}>
          <Text style={styles.dateLabel}>Date</Text>
          <Text style={styles.dateValue}>{formatDateLabel(date)}</Text>
        </Pressable>

        {isSession ? (
          <>
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
          </>
        ) : null}

        {(isSingle || isEdit) && singleDefinition ? (
          <View style={styles.listSection}>{renderMetricRow(singleDefinition)}</View>
        ) : null}

        <Pressable onPress={() => void handleSave()} accessibilityRole="button" style={styles.saveButton}>
          <Text style={styles.saveButtonText}>{saveLabel}</Text>
        </Pressable>

        {isEdit ? (
          <Pressable onPress={handleDelete} accessibilityRole="button" style={styles.deleteLinkRow}>
            <Text style={styles.deleteLinkText}>Delete reading</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <NumericKeypad
        visible={keypadVisible}
        label={activeMetricKey ? keypadLabelFor(activeMetricKey) : ''}
        initialValue={activeMetricKey ? values.get(activeMetricKey) ?? 0 : 0}
        allowDecimal
        onDone={handleKeypadDone}
        onCancel={() => setKeypadVisible(false)}
      />

      {calendarOpen ? (
        <View style={styles.calendarOverlay}>
          <Pressable
            style={styles.calendarBackdrop}
            onPress={() => setCalendarOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close calendar"
          />
          <View style={styles.calendarPanel}>
            <MonthCalendar
              year={calendarYear}
              month={calendarMonth}
              workoutDays={selectableDays}
              selectedDay={date}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onSelectDay={handleSelectDay}
            />
          </View>
        </View>
      ) : null}
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
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  cancelButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: theme.spacing.md,
  },
  cancelText: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  formTitle: {
    ...theme.typography.title,
    color: theme.colors.text,
    flexShrink: 1,
  },
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.lg,
    minHeight: 44,
  },
  dateLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  dateValue: {
    ...theme.typography.body,
    color: theme.colors.text,
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
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  metricIcon: {
    fontSize: 20,
    width: 26,
    textAlign: 'center',
  },
  metricLabel: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
  },
  metricValue: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  saveButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.xl,
  },
  saveButtonText: {
    ...theme.typography.body,
    color: theme.colors.background,
    fontWeight: '700',
  },
  deleteLinkRow: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  deleteLinkText: {
    ...theme.typography.caption,
    color: theme.colors.danger,
    fontWeight: '700',
  },
  calendarOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  calendarPanel: {
    width: '90%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
  },
});
