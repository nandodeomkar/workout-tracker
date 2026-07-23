// Placeholder training-max setup sheet (D-16, UI-SPEC screen 5) — Plan 05
// replaces this with the functional per-exercise TM entry + "Compute from
// 1RM" helper. Exists now only so expo-router's typed-routes resolves the
// router.push('/programs/training-maxes') call made by this plan's
// programs-manager screen after materializing the %TM bundled program
// (placeholder-route-then-implement precedent, Phase 2/5 — see
// 06-01-PLAN.md's phase symbol inventory).

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { theme } from '../../theme';

export default function TrainingMaxesPlaceholderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.flex}>
      <View style={[styles.appbar, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>‹ Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Set your training maxes</Text>
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
