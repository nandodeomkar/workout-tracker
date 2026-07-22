// Active-workout exercise card: header (name + muscle glyph) + set rows +
// "+ Add set" ghost row (UI-SPEC "1. Active workout screen" exercise card).
//
// The drag-handle and overflow ("⋯" Replace/Remove) controls are rendered
// as non-interactive visual placeholders this plan — Plan 05 wires reorder/
// replace/remove and makes them Pressable. Styling is exclusively theme.ts
// tokens (D-14); the ghost "add set" row uses a dashed border per UI-SPEC.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { muscleIcon } from '../constants/muscleIcons';
import { theme } from '../theme';
import { SetRow } from './SetRow';

export interface SetRowViewModel {
  key: string;
  setIndex: number;
  weightDisplay: number;
  repsDisplay: number;
  isWarmup: boolean;
  isCompleted: boolean;
}

interface ExerciseCardProps {
  exerciseName: string;
  muscleGroup: string;
  unit: 'kg' | 'lb';
  rows: SetRowViewModel[];
  onLogSet: (rowKey: string) => void;
  onAddSet: () => void;
  onIncrementWeight: (rowKey: string) => void;
  onDecrementWeight: (rowKey: string) => void;
  onIncrementReps: (rowKey: string) => void;
  onDecrementReps: (rowKey: string) => void;
  onEditNumber: (rowKey: string, field: 'weight' | 'reps') => void;
  onToggleWarmup: (rowKey: string) => void;
}

export function ExerciseCard({
  exerciseName,
  muscleGroup,
  unit,
  rows,
  onLogSet,
  onAddSet,
  onIncrementWeight,
  onDecrementWeight,
  onIncrementReps,
  onDecrementReps,
  onEditNumber,
  onToggleWarmup,
}: ExerciseCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {/* Non-interactive placeholder — reorder ships in Plan 05. */}
        <Text style={styles.dragHandle}>≡</Text>
        <Text style={styles.icon}>{muscleIcon(muscleGroup)}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {exerciseName}
        </Text>
        {/* Non-interactive placeholder — Replace/Remove ship in Plan 05. */}
        <Text style={styles.overflow}>⋯</Text>
      </View>

      <View style={styles.rows}>
        {rows.map((row) => (
          <SetRow
            key={row.key}
            setIndex={row.setIndex}
            weightDisplay={row.weightDisplay}
            repsDisplay={row.repsDisplay}
            unit={unit}
            isWarmup={row.isWarmup}
            isCompleted={row.isCompleted}
            onIncrementWeight={() => onIncrementWeight(row.key)}
            onDecrementWeight={() => onDecrementWeight(row.key)}
            onIncrementReps={() => onIncrementReps(row.key)}
            onDecrementReps={() => onDecrementReps(row.key)}
            onEditNumber={(field) => onEditNumber(row.key, field)}
            onToggleWarmup={() => onToggleWarmup(row.key)}
            onLogSet={() => onLogSet(row.key)}
          />
        ))}
      </View>

      <Pressable onPress={onAddSet} accessibilityRole="button" style={styles.addSetRow}>
        <Text style={styles.addSetText}>+ Add set</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dragHandle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    width: 24,
    textAlign: 'center',
  },
  icon: {
    fontSize: 18,
  },
  name: {
    ...theme.typography.title,
    color: theme.colors.text,
    flex: 1,
  },
  overflow: {
    ...theme.typography.title,
    color: theme.colors.textMuted,
    paddingHorizontal: theme.spacing.xs,
  },
  rows: {
    gap: theme.spacing.sm,
  },
  addSetRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  addSetText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
});
