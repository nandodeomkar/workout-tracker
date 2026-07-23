// Measurements metric-list row (MEAS-01/MEAS-02, D-07) — near-direct copy of
// TemplateRow's anatomy: leading glyph + text column (primary line: metric
// label; caption: latest-value + relative date, or "No data yet") + trailing
// chevron. Reuses the exact row padding/border/touch-target values as
// TemplateRow. Presentational only — no db imports; the parent (Measurements
// index) supplies the icon/caption.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

interface MetricRowProps {
  icon: string;
  label: string;
  caption: string;
  onPress: () => void;
}

export function MetricRow({ icon, label, caption, onPress }: MetricRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${caption}`}
    >
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.textColumn}>
        <Text style={styles.name} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.secondary} numberOfLines={1}>
          {caption}
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
