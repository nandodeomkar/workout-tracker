// Single-select muscle-group pill row (GAP-4, sketch 001-C).
//
// The library's primary browse control: an "All" pill plus one pill per
// muscle group. Exactly one is active at a time (tapping the active one is a
// no-op — "All" is how you clear). This replaces the previous two stacked
// multi-select chip rows (muscle + equipment) that device UAT judged
// cluttered and unintuitive (GAP-4). Styling is exclusively via theme.ts
// tokens (D-14). Large touch targets for gym use.

import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { MUSCLE_GROUPS, type MuscleGroup } from '../constants/taxonomy';
import { MUSCLE_ICONS } from '../constants/muscleIcons';
import { theme } from '../theme';

interface MuscleGroupPillsProps {
  selected: MuscleGroup | null;
  onSelect: (group: MuscleGroup | null) => void;
}

export function MuscleGroupPills({ selected, onSelect }: MuscleGroupPillsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <Pill label="All" active={selected === null} onPress={() => onSelect(null)} />
      {MUSCLE_GROUPS.map((group) => (
        <Pill
          key={group}
          label={`${MUSCLE_ICONS[group]} ${group}`}
          active={selected === group}
          onPress={() => onSelect(group)}
        />
      ))}
    </ScrollView>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.pill, active ? styles.pillActive : styles.pillIdle]}
    >
      <Text style={[styles.label, active ? styles.labelActive : styles.labelIdle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  pill: {
    flex: 0,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  pillIdle: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.border,
  },
  label: {
    ...theme.typography.caption,
  },
  labelActive: {
    color: theme.colors.background,
    fontWeight: '700',
  },
  labelIdle: {
    color: theme.colors.textMuted,
  },
});
