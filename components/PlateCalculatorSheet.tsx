// Standalone + inline-reusable plate-breakdown sheet (D-07/D-08, UTIL-01).
//
// Full-screen picker-overlay component mirroring the `pickerOverlay` /
// `pickerHeader` / `pickerCancelButton` shape already used twice in this
// codebase (app/(tabs)/index.tsx history picker, app/active-workout/
// [workoutId].tsx add-exercise picker — see 03-PATTERNS.md). The entered
// weight is converted to a number and clamped non-negative (T-03-11) before
// being passed straight into `solvePlates` — display-unit rounding
// (lib/weightUnits.ts) is never applied to the plate math itself (Pitfall 2).

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { solvePlates } from '../lib/plateSolver';
import { theme } from '../theme';

export interface PlateCalculatorSheetProps {
  visible: boolean;
  initialWeightDisplay?: number;
  unit: 'kg' | 'lb';
  barWeightDisplay: number;
  onClose: () => void;
}

export function PlateCalculatorSheet({
  visible,
  initialWeightDisplay,
  unit,
  barWeightDisplay,
  onClose,
}: PlateCalculatorSheetProps) {
  const insets = useSafeAreaInsets();
  const [weightText, setWeightText] = useState(String(initialWeightDisplay ?? barWeightDisplay));

  // Reset the editable field whenever the sheet is (re)opened with a new
  // target weight, mirroring the inline-prefill contract (D-07).
  useEffect(() => {
    if (visible) {
      setWeightText(String(initialWeightDisplay ?? barWeightDisplay));
    }
  }, [visible, initialWeightDisplay, barWeightDisplay]);

  if (!visible) {
    return null;
  }

  const parsedWeight = Number(weightText);
  const targetWeight = Number.isFinite(parsedWeight) && parsedWeight >= 0 ? parsedWeight : 0;
  const result = solvePlates(targetWeight, barWeightDisplay, unit);

  return (
    <View style={styles.pickerOverlay}>
      <View style={[styles.pickerHeader, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={onClose} accessibilityRole="button" style={styles.pickerCancelButton}>
          <Text style={styles.pickerCancelText}>‹ Close</Text>
        </Pressable>
        <Text style={styles.pickerTitle}>Plate calculator</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>{`Target weight (${unit})`}</Text>
        <TextInput
          value={weightText}
          onChangeText={setWeightText}
          keyboardType="numeric"
          placeholder="Weight"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.input}
        />

        <Text style={styles.label}>{`Bar weight: ${barWeightDisplay}${unit}`}</Text>

        <Text style={styles.resultHeading}>Per-side plates (descending)</Text>
        {result.perSidePlates.length === 0 ? (
          <Text style={styles.emptyText}>No plates needed — bar only</Text>
        ) : (
          <View style={styles.plateRow}>
            {result.perSidePlates.map((plate, index) => (
              <View key={`${plate}-${index}`} style={styles.plateChip}>
                <Text style={styles.plateChipText}>{plate}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.achievableText}>
          {result.deltaFromTarget !== 0
            ? `closest ${result.achievableWeight}${unit}, ${result.deltaFromTarget > 0 ? '+' : ''}${result.deltaFromTarget}`
            : `${result.achievableWeight}${unit} (exact)`}
        </Text>
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
    color: theme.colors.text,
    fontWeight: '700',
    marginTop: theme.spacing.md,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  plateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  plateChip: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  plateChipText: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
  },
  achievableText: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
    marginTop: theme.spacing.md,
  },
});
