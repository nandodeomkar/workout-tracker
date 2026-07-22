// Collapsible folder section header (TMPL-01/D-05) — first
// collapsible-section-header shape in the app; nearest structural precedent
// is ExerciseCard's header row (a Pressable disclosure row). Folder name
// left, a count badge, and a rotating chevron reflecting `expanded`. The
// parent (Workout home) owns the expanded/collapsed state per folder and
// passes the title through as-is — "Uncategorized" is the caller's concern,
// not this component's.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

interface FolderSectionHeaderProps {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
}

export function FolderSectionHeader({ title, count, expanded, onToggle }: FolderSectionHeaderProps) {
  return (
    <Pressable
      onPress={onToggle}
      style={styles.row}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${title}, ${count} ${count === 1 ? 'template' : 'templates'}`}
    >
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.countBadge}>
        <Text style={styles.countText}>{count}</Text>
      </View>
      <Text style={styles.chevron}>{expanded ? '⌄' : '›'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 44,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
  },
  title: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
    flex: 1,
  },
  countBadge: {
    minWidth: 24,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  chevron: {
    color: theme.colors.textMuted,
    fontSize: 18,
    marginLeft: theme.spacing.xs,
  },
});
