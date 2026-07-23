// Placeholder custom-program builder (PROG-01, UI-SPEC screen 3 "Build your
// own") — Plan 06 replaces this with the functional name field + ordered
// template-day picker + Save flow. Exists now only so expo-router's
// typed-routes resolves the router.push('/programs/new') call made by this
// plan's Add-a-program overlay's "Build a custom program" link
// (placeholder-route-then-implement precedent, Phase 2/5).

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { theme } from '../../theme';

export default function NewProgramPlaceholderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.flex}>
      <View style={[styles.appbar, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>‹ Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Build a custom program</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.bodyText}>Coming soon</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  appbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: theme.spacing.md,
  },
  backText: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  bodyText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
});
