import { eq } from 'drizzle-orm';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { db } from '../../../db/client';
import { exercises, type Exercise } from '../../../db/schema';
import { theme } from '../../../theme';

// MINIMAL read-only list (Task 3 scope): proves the render half of
// migrate -> seed -> read -> render. Search/filter chips arrive in Plan 04.
export default function ExercisesScreen() {
  const [rows, setRows] = useState<Exercise[]>([]);

  useEffect(() => {
    let cancelled = false;
    db.select()
      .from(exercises)
      .where(eq(exercises.archived, false))
      .then((result) => {
        if (!cancelled) {
          setRows(result);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>{item.name}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.caption}>No exercises yet</Text>}
        contentContainerStyle={rows.length === 0 ? styles.emptyContent : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  row: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  name: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  caption: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
  emptyContent: {
    flexGrow: 1,
  },
});
