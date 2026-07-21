// Horizontally scrollable multi-select chip row (D-07).
//
// Selected chips render with the theme accent style; unselected chips use
// surfaceAlt/border tokens. Large touch targets for gym use. Styling is
// exclusively via theme.ts tokens — no hardcoded colors/spacing (D-14).

import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { theme } from '../theme';

interface FilterChipRowProps {
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}

export function FilterChipRow({ options, selected, onToggle }: FilterChipRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {options.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <Pressable
            key={option}
            onPress={() => onToggle(option)}
            style={[styles.chip, isSelected ? styles.chipSelected : styles.chipUnselected]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={[styles.label, isSelected ? styles.labelSelected : styles.labelUnselected]}>
              {option}
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
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  chipUnselected: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.border,
  },
  label: {
    ...theme.typography.caption,
  },
  labelSelected: {
    color: theme.colors.background,
    fontWeight: '700',
  },
  labelUnselected: {
    color: theme.colors.text,
  },
});
