// Set-entry row: warmup chip, weight steppers+number, reps steppers+number,
// and the checkmark log button (D-01/D-02/LOG-06, UI-SPEC "1. Active workout
// screen"). Purely controlled/presentational — the parent screen owns the
// canonical kg values, unit conversion, and DB writes; this component only
// renders already-converted display values and fires callbacks.
//
// Every icon-only control carries the UI-SPEC-mandated accessibilityLabel
// and accessibilityRole="button" (ExerciseRow.tsx convention). Steppers,
// the number-tap targets, and the checkmark button all keep a 44x44 minimum
// touch target (UI-SPEC Spacing Scale exception) for one-handed gym use.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

interface SetRowProps {
  setIndex: number;
  weightDisplay: number;
  repsDisplay: number;
  unit: 'kg' | 'lb';
  isWarmup: boolean;
  isCompleted: boolean;
  onIncrementWeight: () => void;
  onDecrementWeight: () => void;
  onIncrementReps: () => void;
  onDecrementReps: () => void;
  onEditNumber: (field: 'weight' | 'reps') => void;
  onToggleWarmup: () => void;
  onLogSet: () => void;
}

export function SetRow({
  setIndex,
  weightDisplay,
  repsDisplay,
  unit,
  isWarmup,
  isCompleted,
  onIncrementWeight,
  onDecrementWeight,
  onIncrementReps,
  onDecrementReps,
  onEditNumber,
  onToggleWarmup,
  onLogSet,
}: SetRowProps) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onToggleWarmup}
        accessibilityRole="button"
        accessibilityLabel="Toggle warmup set"
        accessibilityState={{ selected: isWarmup }}
        style={[styles.indexChip, isWarmup ? styles.indexChipWarmup : null]}
      >
        <Text style={[styles.indexChipText, isWarmup ? styles.indexChipTextWarmup : null]}>
          {isWarmup ? 'W' : setIndex}
        </Text>
      </Pressable>

      <View style={styles.numberControl}>
        <Pressable
          onPress={onDecrementWeight}
          accessibilityRole="button"
          accessibilityLabel="Decrease weight"
          style={styles.stepper}
        >
          <Text style={styles.stepperText}>-</Text>
        </Pressable>
        <Pressable onPress={() => onEditNumber('weight')} accessibilityRole="button" style={styles.numberTap}>
          <Text style={styles.numberText} numberOfLines={1}>
            {weightDisplay}
            <Text style={styles.unitText}> {unit}</Text>
          </Text>
        </Pressable>
        <Pressable
          onPress={onIncrementWeight}
          accessibilityRole="button"
          accessibilityLabel="Increase weight"
          style={styles.stepper}
        >
          <Text style={styles.stepperText}>+</Text>
        </Pressable>
      </View>

      <View style={styles.numberControl}>
        <Pressable
          onPress={onDecrementReps}
          accessibilityRole="button"
          accessibilityLabel="Decrease reps"
          style={styles.stepper}
        >
          <Text style={styles.stepperText}>-</Text>
        </Pressable>
        <Pressable onPress={() => onEditNumber('reps')} accessibilityRole="button" style={styles.numberTap}>
          <Text style={styles.numberText}>{repsDisplay}</Text>
        </Pressable>
        <Pressable
          onPress={onIncrementReps}
          accessibilityRole="button"
          accessibilityLabel="Increase reps"
          style={styles.stepper}
        >
          <Text style={styles.stepperText}>+</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onLogSet}
        accessibilityRole="button"
        accessibilityLabel="Log set"
        accessibilityState={{ selected: isCompleted }}
        style={[styles.logButton, isCompleted ? styles.logButtonCompleted : styles.logButtonOutline]}
      >
        <Text style={[styles.logButtonText, isCompleted ? styles.logButtonTextCompleted : null]}>✓</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    minHeight: 56,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  indexChip: {
    minWidth: 32,
    minHeight: 32,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexChipText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  indexChipWarmup: {
    backgroundColor: theme.colors.badge,
  },
  indexChipTextWarmup: {
    color: theme.colors.background,
  },
  numberControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  stepper: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    ...theme.typography.title,
    color: theme.colors.textMuted,
  },
  numberTap: {
    minWidth: 60,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
  },
  unitText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '400',
  },
  logButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  logButtonOutline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.accent,
  },
  logButtonCompleted: {
    backgroundColor: theme.colors.accent,
  },
  logButtonText: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  logButtonTextCompleted: {
    color: theme.colors.background,
  },
});
