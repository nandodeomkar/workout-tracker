// A–Z library row (D-08): name + "muscle group · equipment" secondary
// line, with a small "custom" badge when isCustom is true. Large tappable
// target. Styling is exclusively via theme.ts tokens (D-14).

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

interface ExerciseRowProps {
  name: string;
  muscleGroup: string;
  equipment: string;
  isCustom?: boolean;
  onPress?: () => void;
}

export function ExerciseRow({ name, muscleGroup, equipment, isCustom = false, onPress }: ExerciseRowProps) {
  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button">
      <View style={styles.textColumn}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {isCustom ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>custom</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.secondary} numberOfLines={1}>
          {muscleGroup} · {equipment}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  textColumn: {
    gap: theme.spacing.xs,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  name: {
    ...theme.typography.body,
    color: theme.colors.text,
    flexShrink: 1,
  },
  secondary: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  badge: {
    backgroundColor: theme.colors.badge,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
  },
  badgeText: {
    ...theme.typography.caption,
    color: theme.colors.background,
    fontWeight: '700',
  },
});
