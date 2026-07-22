// Active-workout exercise card: header (name + muscle glyph) + set rows +
// "+ Add set" ghost row (UI-SPEC "1. Active workout screen" exercise card).
//
// The drag-handle is a hand-rolled long-press-to-drag gesture
// (react-native-gesture-handler `Gesture.Pan().activateAfterLongPress(...)`
// + reanimated shared values, per RESEARCH.md's "no third-party
// draggable-list" guidance) — it only reports the drag's final vertical
// translation to the parent screen, which owns the ordered exercise list
// and each card's measured on-screen position (LOG-04/D-16). The overflow
// "⋯" opens the Replace/Remove menu (also parent-owned — both mutate
// workout_exercises via db/workouts.ts and need workoutId-level context).

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

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
  /** Fired once, on drag release, with the gesture's net vertical translation (px). */
  onDragEnd: (translationY: number) => void;
  /** Opens the Replace/Remove action menu (parent owns the menu itself). */
  onOverflowPress: () => void;
}

const LONG_PRESS_ACTIVATION_MS = 350;

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
  onDragEnd,
  onOverflowPress,
}: ExerciseCardProps) {
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  function handleDragEndOnJs(translation: number) {
    onDragEnd(translation);
  }

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_ACTIVATION_MS)
    .onStart(() => {
      isDragging.value = true;
    })
    .onUpdate((event) => {
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const finalTranslation = event.translationY;
      translateY.value = withSpring(0);
      isDragging.value = false;
      runOnJS(handleDragEndOnJs)(finalTranslation);
    })
    .onFinalize(() => {
      isDragging.value = false;
      translateY.value = withSpring(0);
    });

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: isDragging.value ? 0.92 : 1,
    zIndex: isDragging.value ? 10 : 0,
    elevation: isDragging.value ? 6 : 0,
  }));

  return (
    <Animated.View style={[styles.card, animatedCardStyle]}>
      <View style={styles.header}>
        <GestureDetector gesture={panGesture}>
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel="Reorder exercise"
            style={styles.dragHandleButton}
          >
            <Text style={styles.dragHandle}>≡</Text>
          </View>
        </GestureDetector>
        <Text style={styles.icon}>{muscleIcon(muscleGroup)}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {exerciseName}
        </Text>
        <Pressable
          onPress={onOverflowPress}
          accessibilityRole="button"
          accessibilityLabel="Exercise options"
          style={styles.overflowButton}
        >
          <Text style={styles.overflow}>⋯</Text>
        </Pressable>
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
    </Animated.View>
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
  dragHandleButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
  overflowButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
