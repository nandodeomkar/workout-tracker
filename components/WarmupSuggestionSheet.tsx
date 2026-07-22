// Inline-only warm-up ladder sheet (D-09/D-10, UTIL-03).
//
// Full-screen picker-overlay mirroring PlateCalculatorSheet/
// OneRMCalculatorSheet. Computes the fixed 4-step ladder via
// lib/warmupLadder.ts#buildWarmupSets (already plate-rounded through
// solvePlates) and renders each step with a one-tap "Accept" Pressable.
// This component only EMITS accepts via onAccept — the actual insertSet
// persist-as-warmup call is owned by the parent active-workout screen,
// wired in Plan 06 (D-10).

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildWarmupSets } from '../lib/warmupLadder';
import { theme } from '../theme';

export interface WarmupSuggestionSheetProps {
  visible: boolean;
  workingWeightDisplay: number;
  unit: 'kg' | 'lb';
  barWeightDisplay: number;
  onAccept: (step: { weight: number; reps: number }) => void;
  onClose: () => void;
}

export function WarmupSuggestionSheet({
  visible,
  workingWeightDisplay,
  unit,
  barWeightDisplay,
  onAccept,
  onClose,
}: WarmupSuggestionSheetProps) {
  const insets = useSafeAreaInsets();

  if (!visible) {
    return null;
  }

  const steps = buildWarmupSets(workingWeightDisplay, barWeightDisplay, unit);

  return (
    <View style={styles.pickerOverlay}>
      <View style={[styles.pickerHeader, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={onClose} accessibilityRole="button" style={styles.pickerCancelButton}>
          <Text style={styles.pickerCancelText}>‹ Close</Text>
        </Pressable>
        <Text style={styles.pickerTitle}>Warm-up suggestions</Text>
      </View>

      <View style={styles.content}>
        {steps.map((step, index) => (
          <View key={`${step.label}-${index}`} style={styles.stepRow}>
            <View style={styles.stepTextColumn}>
              <Text style={styles.stepLabel}>{step.label}</Text>
              <Text style={styles.stepDetail}>{`${step.weight}${unit} × ${step.reps} reps`}</Text>
            </View>
            <Pressable
              onPress={() => onAccept({ weight: step.weight, reps: step.reps })}
              accessibilityRole="button"
              accessibilityLabel={`Accept ${step.label} warm-up set`}
              style={styles.acceptButton}
            >
              <Text style={styles.acceptButtonText}>Accept</Text>
            </Pressable>
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
    gap: theme.spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  stepTextColumn: {
    gap: theme.spacing.xs,
  },
  stepLabel: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
  },
  stepDetail: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  acceptButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
  },
  acceptButtonText: {
    ...theme.typography.body,
    color: theme.colors.background,
    fontWeight: '700',
  },
});
