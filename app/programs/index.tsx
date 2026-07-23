// Programs manager (PROG-01/PROG-04, UI-SPEC screen 2) — reached via
// Settings/More -> "Programs" (D-01/D-17's settled placement). Lists the
// single active program (D-01) plus every other user-owned program
// (loadAllPrograms), and offers "+ Add a program": two bundled rows
// (materializeBundledProgram, D-14/D-15) or "Build a custom program"
// (placeholder route, Plan 06). Adding/starting a bundled program while a
// different program is already active triggers the non-destructive
// switch-active confirmation (Copywriting Contract) before materializing —
// materializeBundledProgram itself always activates the freshly-cloned
// program at day 0 (db/programs.ts), so this screen never calls
// setActiveProgram directly.
//
// Reload runs on every focus via the cancelled-guard Promise pattern
// (app/measurements/index.tsx precedent) so a program added/removed
// elsewhere is never stale on return.

import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { BUNDLED_PROGRAMS, linear5x5, percentWave, resolveExerciseSeedIds } from '../../data/bundledPrograms';
import { db } from '../../db/client';
import {
  loadActiveProgram,
  loadAllPrograms,
  materializeBundledProgram,
  type ActiveProgramDetail,
  type BundledProgramDefinition,
  type ProgramSummary,
} from '../../db/programs';
import { theme } from '../../theme';

// Android-first transient feedback — copied verbatim (app/active-workout/summary.tsx precedent).
function notify(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}

const BUNDLE_ICON: Record<string, string> = {
  [linear5x5.name]: '📈',
  [percentWave.name]: '🌊',
};

const BUNDLE_CAPTION: Record<string, string> = {
  [linear5x5.name]: 'Full-body strength, 3 sessions a week. Increase weight every time you hit your reps.',
  [percentWave.name]: 'One main lift per day, 4-week wave built around your training max.',
};

export default function ProgramsIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [activeProgram, setActiveProgram] = useState<ActiveProgramDetail | undefined>(undefined);
  const [allPrograms, setAllPrograms] = useState<ProgramSummary[]>([]);
  const [addOverlayOpen, setAddOverlayOpen] = useState(false);
  const [previewBundle, setPreviewBundle] = useState<BundledProgramDefinition | null>(null);
  const [materializing, setMaterializing] = useState(false);

  const load = useCallback(async () => {
    const [active, summaries] = await Promise.all([loadActiveProgram(db), loadAllPrograms(db)]);
    setActiveProgram(active);
    setAllPrograms(summaries);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load().then(() => {
        if (cancelled) {
          return;
        }
      });
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  function openAddOverlay() {
    setPreviewBundle(null);
    setAddOverlayOpen(true);
  }

  function closeAddOverlay() {
    setAddOverlayOpen(false);
    setPreviewBundle(null);
  }

  function openProgramDetail(programId: number) {
    router.push({ pathname: '/programs/[programId]', params: { programId: String(programId) } });
  }

  // D-15/Pattern 2: resolves this install's seed_id -> exercises.id map, then
  // clones the bundle into user-owned rows. materializeBundledProgram always
  // activates the new program at day 0 (db/programs.ts) — Add and Start are
  // the same action at this data-layer contract.
  async function doMaterialize(bundle: BundledProgramDefinition) {
    if (materializing) {
      return;
    }
    setMaterializing(true);
    try {
      const seedMap = await resolveExerciseSeedIds(db, bundle);
      const program = await materializeBundledProgram(db, bundle, seedMap);
      notify(`${bundle.name} added`);
      closeAddOverlay();
      await load();
      if (bundle === percentWave) {
        // D-16: %TM programs prompt TM setup up front — the seed can't know
        // the user's training maxes. programId scopes the first-time setup
        // sheet to this program's distinct %TM exercises.
        router.push({ pathname: '/programs/training-maxes', params: { programId: String(program.id) } });
      } else {
        openProgramDetail(program.id);
      }
    } catch {
      notify('Something went wrong loading your programs.');
    } finally {
      setMaterializing(false);
    }
  }

  // Non-destructive switch-active confirmation (Copywriting Contract) — only
  // shown when a DIFFERENT program is already active; nothing to switch from
  // otherwise.
  function handleAddAndStart(bundle: BundledProgramDefinition) {
    if (activeProgram) {
      Alert.alert(
        'Switch active program?',
        `${activeProgram.program.name} will no longer be your active program. Its own progress is saved and you can switch back anytime.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Switch', onPress: () => void doMaterialize(bundle) },
        ],
      );
      return;
    }
    void doMaterialize(bundle);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  const activeSummary = allPrograms.find((summary) => summary.program.id === activeProgram?.program.id);
  const nonActivePrograms = allPrograms.filter((summary) => summary.program.id !== activeProgram?.program.id);
  const hasAnyProgram = allPrograms.length > 0;

  const activeDayLabel = activeProgram?.currentDay
    ? `Day ${activeProgram.currentDay.day.position + 1} of ${activeSummary?.dayCount ?? 0}: ${activeProgram.currentDay.template.template.name}`
    : `${activeSummary?.dayCount ?? 0} ${activeSummary?.dayCount === 1 ? 'day' : 'days'} · ${activeSummary?.origin ?? 'Custom'}`;

  return (
    <View style={styles.flex}>
      <View style={[styles.appbar, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>‹ More</Text>
        </Pressable>
        <Text style={styles.title}>Programs</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {activeProgram ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Active</Text>
            <Pressable
              onPress={() => openProgramDetail(activeProgram.program.id)}
              accessibilityRole="button"
              style={styles.programRow}
            >
              <Text style={styles.programIcon}>{'🗓️'}</Text>
              <View style={styles.textColumn}>
                <Text style={styles.programName} numberOfLines={1}>
                  {activeProgram.program.name}
                </Text>
                <Text style={styles.programCaption} numberOfLines={1}>
                  {activeDayLabel}
                </Text>
              </View>
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>Active</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Your programs</Text>
          {!hasAnyProgram ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyHeading}>No programs yet</Text>
              <Text style={styles.emptyBody}>
                Add a bundled program or build your own from your templates to auto-advance your training.
              </Text>
            </View>
          ) : nonActivePrograms.length === 0 ? (
            <Text style={styles.emptyBody}>Every program you have added is active above.</Text>
          ) : (
            nonActivePrograms.map((summary) => (
              <Pressable
                key={summary.program.id}
                onPress={() => openProgramDetail(summary.program.id)}
                accessibilityRole="button"
                style={styles.programRow}
              >
                <Text style={styles.programIcon}>{'🗓️'}</Text>
                <View style={styles.textColumn}>
                  <Text style={styles.programName} numberOfLines={1}>
                    {summary.program.name}
                  </Text>
                  <Text style={styles.programCaption} numberOfLines={1}>
                    {`${summary.dayCount} ${summary.dayCount === 1 ? 'day' : 'days'} · ${summary.origin}`}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))
          )}
        </View>

        <Pressable onPress={openAddOverlay} accessibilityRole="button" style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Add a program</Text>
        </Pressable>
      </ScrollView>

      {addOverlayOpen ? (
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerHeader, { paddingTop: insets.top + theme.spacing.sm }]}>
            <Pressable
              onPress={previewBundle ? () => setPreviewBundle(null) : closeAddOverlay}
              accessibilityRole="button"
              style={styles.pickerCancelButton}
            >
              <Text style={styles.pickerCancelText}>{previewBundle ? '‹ Back' : '‹ Cancel'}</Text>
            </Pressable>
            <Text style={styles.pickerTitle}>{previewBundle ? previewBundle.name : 'Add a program'}</Text>
          </View>

          {previewBundle ? (
            <>
              <ScrollView contentContainerStyle={styles.previewList}>
                {previewBundle.days.map((day, index) => (
                  <View key={`${day.name}-${index}`} style={styles.programRow}>
                    <Text style={styles.programIcon}>📋</Text>
                    <View style={styles.textColumn}>
                      <Text style={styles.programName} numberOfLines={1}>
                        {day.name}
                      </Text>
                      <Text style={styles.programCaption} numberOfLines={1}>
                        {`${day.exercises.length} ${day.exercises.length === 1 ? 'exercise' : 'exercises'}`}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.previewFooter}>
                <Pressable
                  onPress={() => handleAddAndStart(previewBundle)}
                  disabled={materializing}
                  accessibilityRole="button"
                  style={[styles.addAndStartButton, materializing ? styles.addAndStartButtonDisabled : null]}
                >
                  <Text style={styles.addAndStartButtonText}>Add & start</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <ScrollView contentContainerStyle={styles.overlayContainer}>
              <Text style={styles.overlaySectionLabel}>Bundled programs</Text>
              {BUNDLED_PROGRAMS.map((bundle) => (
                <Pressable
                  key={bundle.name}
                  onPress={() => setPreviewBundle(bundle)}
                  accessibilityRole="button"
                  style={styles.programRow}
                >
                  <Text style={styles.programIcon}>{BUNDLE_ICON[bundle.name] ?? '🗓️'}</Text>
                  <View style={styles.textColumn}>
                    <Text style={styles.programName}>{bundle.name}</Text>
                    <Text style={styles.programCaption}>{BUNDLE_CAPTION[bundle.name] ?? ''}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}

              <Text style={[styles.overlaySectionLabel, styles.overlaySectionLabelSpaced]}>Build your own</Text>
              <Pressable
                onPress={() => {
                  closeAddOverlay();
                  router.push('/programs/new');
                }}
                accessibilityRole="button"
                style={styles.buildCustomLink}
              >
                <Text style={styles.buildCustomLinkText}>{'🗓️'} Build a custom program</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  appbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
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
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  section: {
    marginTop: theme.spacing['2xl'],
  },
  sectionLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  programRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
  },
  programIcon: {
    fontSize: 20,
    width: 26,
    textAlign: 'center',
  },
  textColumn: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  programName: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  programCaption: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  chevron: {
    color: theme.colors.textMuted,
    fontSize: 22,
    marginLeft: theme.spacing.xs,
  },
  activePill: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  activePillText: {
    ...theme.typography.caption,
    color: theme.colors.background,
    fontWeight: '700',
  },
  emptyState: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  emptyHeading: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
  },
  emptyBody: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  addButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing['2xl'],
  },
  addButtonText: {
    ...theme.typography.body,
    color: theme.colors.background,
    fontWeight: '700',
  },
  pickerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.background,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  pickerCancelButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  pickerCancelText: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  pickerTitle: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  overlayContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  overlaySectionLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  overlaySectionLabelSpaced: {
    marginTop: theme.spacing['2xl'],
  },
  buildCustomLink: {
    minHeight: 44,
    justifyContent: 'center',
  },
  buildCustomLinkText: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  previewList: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  previewFooter: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  addAndStartButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  addAndStartButtonDisabled: {
    opacity: 0.6,
  },
  addAndStartButtonText: {
    ...theme.typography.body,
    color: theme.colors.background,
    fontWeight: '700',
  },
});
