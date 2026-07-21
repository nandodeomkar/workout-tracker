// A–Z library row (D-08 / GAP-4): leading muscle-group glyph + name +
// "muscle group · equipment" secondary line, a small "custom" badge when
// isCustom, and a trailing chevron affordance so the row reads as tappable.
// Large tappable target. Styling is exclusively via theme.ts tokens (D-14).

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { muscleIcon } from '../constants/muscleIcons';
import { theme } from '../theme';

interface ExerciseRowProps {
  name: string;
  muscleGroup: string;
  equipment: string;
  isCustom?: boolean;
  archived?: boolean;
  onPress?: () => void;
}

export function ExerciseRow({
  name,
  muscleGroup,
  equipment,
  isCustom = false,
  archived = false,
  onPress,
}: ExerciseRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, archived ? styles.rowArchived : null]}
      accessibilityRole="button"
    >
      <Text style={styles.icon}>{muscleIcon(muscleGroup)}</Text>
      <View style={styles.textColumn}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {isCustom ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>CUSTOM</Text>
            </View>
          ) : null}
          {archived ? (
            <View style={styles.archivedTag}>
              <Text style={styles.archivedTagText}>ARCHIVED</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.secondary} numberOfLines={1}>
          {muscleGroup} · {equipment}
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
  rowArchived: {
    opacity: 0.55,
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
    fontSize: 10,
  },
  archivedTag: {
    borderRadius: theme.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.textMuted,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
  },
  archivedTagText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '700',
    fontSize: 10,
  },
  chevron: {
    color: theme.colors.textMuted,
    fontSize: 22,
    marginLeft: theme.spacing.xs,
  },
});
