// History list row (HIST-01/D-12) — near-direct copy of ExerciseRow's
// anatomy: leading glyph + text column (primary line: workout date/name;
// caption: "N exercises · volume · duration") + trailing chevron. Reuses the
// exact row padding/border/touch-target values as ExerciseRow. Also reused
// by the Workout tab's "Start from history" picker (D-04/D-05).
//
// Takes a pre-computed summary (exerciseCount, totalVolumeKg, durationMs)
// plus the active display unit and formats via lib/weightUnits.ts#kgToDisplay
// and lib/duration.ts#formatDurationMs — never inlines its own conversion.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDurationMs } from '../lib/duration';
import { kgToDisplay } from '../lib/weightUnits';
import { theme } from '../theme';

interface WorkoutRowProps {
  /** Primary line — workout name if set, otherwise a formatted date. */
  label: string;
  exerciseCount: number;
  totalVolumeKg: number;
  /** null when duration is unknown/not applicable (should not occur for finished workouts). */
  durationMs: number | null;
  unit: 'kg' | 'lb';
  onPress?: () => void;
}

export function WorkoutRow({
  label,
  exerciseCount,
  totalVolumeKg,
  durationMs,
  unit,
  onPress,
}: WorkoutRowProps) {
  const volumeDisplay = kgToDisplay(totalVolumeKg, unit);
  const durationLabel = durationMs != null ? formatDurationMs(durationMs) : '--:--';
  const exerciseLabel = `${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'}`;

  return (
    <Pressable
      onPress={onPress}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${exerciseLabel}, ${volumeDisplay} ${unit}, ${durationLabel}`}
    >
      <Text style={styles.icon}>🏋</Text>
      <View style={styles.textColumn}>
        <Text style={styles.name} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.secondary} numberOfLines={1}>
          {exerciseLabel} · {volumeDisplay}
          {unit} · {durationLabel}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  icon: {
    fontSize: 20,
    width: 26,
    textAlign: 'center',
  },
  textColumn: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  name: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  secondary: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  chevron: {
    color: theme.colors.textMuted,
    fontSize: 22,
    marginLeft: theme.spacing.xs,
  },
});
