// Template list row (TMPL-01/D-05) — near-direct copy of WorkoutRow's
// anatomy: leading glyph + text column (primary line: template name;
// caption: "N exercises") + trailing chevron. Reuses the exact row
// padding/border/touch-target values as WorkoutRow. Presentational only —
// no db imports; the parent (Workout home) supplies the exercise count.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

interface TemplateRowProps {
  label: string;
  exerciseCount: number;
  onPress: () => void;
  /** Opens this template in the builder to edit and re-save it (TMPL-01, UAT Gap 1). */
  onEdit?: () => void;
}

export function TemplateRow({ label, exerciseCount, onPress, onEdit }: TemplateRowProps) {
  const exerciseLabel = `${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'}`;

  return (
    <Pressable
      onPress={onPress}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${exerciseLabel}`}
    >
      <Text style={styles.icon}>📋</Text>
      <View style={styles.textColumn}>
        <Text style={styles.name} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.secondary} numberOfLines={1}>
          {exerciseLabel}
        </Text>
      </View>
      {onEdit ? (
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${label}`}
          style={styles.editButton}
        >
          <Text style={styles.editButtonText}>✎</Text>
        </Pressable>
      ) : null}
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
  editButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
});
