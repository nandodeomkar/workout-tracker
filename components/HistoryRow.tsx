// Per-metric dated-reading row (MEAS-02, D-09) — mirrors the recordRow
// pattern from app/stats/[exerciseId].tsx (theme.spacing.lg padding,
// hairline border-bottom): date + right-aligned value, plus two 44x44
// icon-only edit/delete buttons. Both icon buttons carry a mandatory
// accessibilityLabel since they render no visible text (05-UI-SPEC "2.
// Per-metric detail" Dim-2 sign-off). Presentational only — no db imports;
// the parent (per-metric detail screen) owns the edit/delete handlers.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

interface HistoryRowProps {
  dateLabel: string;
  valueLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}

export function HistoryRow({ dateLabel, valueLabel, onEdit, onDelete }: HistoryRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.date} numberOfLines={1}>
        {dateLabel}
      </Text>
      <Text style={styles.value} numberOfLines={1}>
        {valueLabel}
      </Text>
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel="Edit reading"
        style={styles.iconButton}
      >
        <Text style={styles.iconButtonText}>✎</Text>
      </Pressable>
      <Pressable
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel="Delete reading"
        style={styles.iconButton}
      >
        <Text style={styles.iconButtonText}>🗑</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  date: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
  },
  value: {
    ...theme.typography.body,
    color: theme.colors.text,
    textAlign: 'right',
  },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
});
