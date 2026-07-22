// Single-select pill row (D-05/D-06) — reused for both the per-exercise
// chart's metric toggle (Est. 1RM / Top Set / Volume) and its range chips
// (3M / 1Y / All). Unlike FilterChipRow (multi-select), this is a radio
// group: exactly one option is selected at a time. Styling is exclusively
// via theme.ts tokens.

import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { theme } from '../theme';

export interface MetricToggleOption<T extends string> {
  value: T;
  label: string;
}

interface MetricToggleProps<T extends string> {
  options: MetricToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function MetricToggle<T extends string>({ options, value, onChange }: MetricToggleProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.pill, isSelected ? styles.pillSelected : styles.pillUnselected]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={[styles.label, isSelected ? styles.labelSelected : styles.labelUnselected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  pill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  pillSelected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  pillUnselected: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.border,
  },
  label: {
    ...theme.typography.caption,
    fontWeight: '700',
  },
  labelSelected: {
    color: theme.colors.background,
  },
  labelUnselected: {
    color: theme.colors.text,
  },
});
