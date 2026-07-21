import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../../theme';

// "More" tab (settings/gear icon). Deferred per D-16/Deferred Ideas: no
// functional units/rest/plates settings UI in Phase 1 — coming-soon only.
export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>More</Text>
      <Text style={styles.caption}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  caption: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
});
