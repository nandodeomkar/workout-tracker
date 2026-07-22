// Standalone + inline-reusable estimated-1RM sheet (D-11, UTIL-02).
//
// Full-screen picker-overlay component mirroring PlateCalculatorSheet's
// shape. Reuses the SINGLE shared Epley formula (lib/estimate1RM.ts) and the
// new NSCA %1RM->reps table (lib/percentOf1RM.ts) — no reimplementation.
// Entered weight/reps are converted display-unit -> kg via
// lib/weightUnits.ts before reaching estimate1RM; the result is converted
// back to the display unit for rendering.

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { estimate1RM } from '../lib/estimate1RM';
import { percentOf1RM } from '../lib/percentOf1RM';
import { displayToKg, kgToDisplay } from '../lib/weightUnits';
import { theme } from '../theme';

export interface OneRMCalculatorSheetProps {
  visible: boolean;
  initialWeightDisplay?: number;
  initialReps?: number;
  unit: 'kg' | 'lb';
  onClose: () => void;
}

export function OneRMCalculatorSheet({
  visible,
  initialWeightDisplay,
  initialReps,
  unit,
  onClose,
}: OneRMCalculatorSheetProps) {
  const insets = useSafeAreaInsets();
  const [weightText, setWeightText] = useState(String(initialWeightDisplay ?? ''));
  const [repsText, setRepsText] = useState(String(initialReps ?? ''));

  useEffect(() => {
    if (visible) {
      setWeightText(String(initialWeightDisplay ?? ''));
      setRepsText(String(initialReps ?? ''));
    }
  }, [visible, initialWeightDisplay, initialReps]);

  if (!visible) {
    return null;
  }

  const parsedWeight = Number(weightText);
  const parsedReps = Number(repsText);
  const weightDisplay = Number.isFinite(parsedWeight) && parsedWeight >= 0 ? parsedWeight : 0;
  const reps = Number.isFinite(parsedReps) && parsedReps >= 0 ? Math.round(parsedReps) : 0;

  const e1rmKg = estimate1RM(displayToKg(weightDisplay, unit), reps);
  const e1rmDisplay = kgToDisplay(e1rmKg, unit);
  const rows = percentOf1RM(e1rmKg);

  return (
    <View style={styles.pickerOverlay}>
      <View style={[styles.pickerHeader, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={onClose} accessibilityRole="button" style={styles.pickerCancelButton}>
          <Text style={styles.pickerCancelText}>‹ Close</Text>
        </Pressable>
        <Text style={styles.pickerTitle}>1RM calculator</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>{`Weight (${unit})`}</Text>
        <TextInput
          value={weightText}
          onChangeText={setWeightText}
          keyboardType="numeric"
          placeholder="Weight"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.input}
        />

        <Text style={styles.label}>Reps</Text>
        <TextInput
          value={repsText}
          onChangeText={setRepsText}
          keyboardType="numeric"
          placeholder="Reps"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.input}
        />

        <Text style={styles.resultHeading}>{`Estimated 1RM: ${e1rmDisplay}${unit}`}</Text>

        <View style={styles.tableHeaderRow}>
          <Text style={styles.tableHeaderCell}>%1RM</Text>
          <Text style={styles.tableHeaderCell}>Reps</Text>
          <Text style={styles.tableHeaderCell}>Weight</Text>
        </View>
        {rows.map((row) => (
          <View key={row.percent} style={styles.tableRow}>
            <Text style={styles.tableCell}>{`${row.percent}%`}</Text>
            <Text style={styles.tableCell}>{row.reps}</Text>
            <Text style={styles.tableCell}>{`${kgToDisplay(row.weight, unit)}${unit}`}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pickerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.background,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  pickerCancelButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: theme.spacing.md,
  },
  pickerCancelText: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  pickerTitle: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  input: {
    ...theme.typography.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    minHeight: 44,
  },
  resultHeading: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
    marginTop: theme.spacing.md,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  tableHeaderCell: {
    flex: 1,
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  tableRow: {
    flexDirection: 'row',
    minHeight: 44,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  tableCell: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.text,
  },
});
