// Program detail (PROG-01/PROG-02/PROG-03, UI-SPEC screen 4) — reached by
// tapping any row on the programs manager (screen 2). Lists every
// program_days row in order (D-04: every day is tappable, not only the
// pointed-to one), marks the day this program's pointer currently points at
// with a "▶ Next" badge (only meaningful when this program is active), and
// offers "Set as active" / "Remove program".
//
// Starting ANY day here — even a non-active program's day — goes through
// startWorkoutFromProgramDay (db/programs.ts), which both writes the origin
// marker (D-05) and moves the pointer to follow whatever day was started
// (D-04). Starting a day on a program that is NOT currently active first
// asks the non-destructive switch-active confirmation so a program's pointer
// is never silently advanced behind the user's back (D-05 distinction) —
// but only when a DIFFERENT program is currently active; if no program is
// active yet, there is nothing to switch from.
//
// TODO(Plan 05): insert a "🎯 Training Maxes" section here (rendered only
// when a day has a percent_tm exercise) — deferred, not built in this plan.

import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { db } from '../../db/client';
import {
  deleteProgram,
  loadActiveProgram,
  loadProgramDetail,
  setActiveProgram,
  startWorkoutFromProgramDay,
  type ActiveProgramDetail,
  type ProgramDayDetail,
  type ProgramDetail,
} from '../../db/programs';
import { useActiveWorkout } from '../../store/activeWorkout';
import { theme } from '../../theme';

// Android-first transient feedback — copied verbatim (app/active-workout/summary.tsx precedent).
function notify(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}

/** "Linear" | "%TM" | "" — derived from a day's template_exercises.progression, for the day-row caption. */
function progressionSummaryFor(dayDetail: ProgramDayDetail): string {
  const types = new Set<string>();
  for (const { templateExercise } of dayDetail.template.exercises) {
    if (!templateExercise.progression) {
      continue;
    }
    try {
      const parsed = JSON.parse(templateExercise.progression) as { type?: string };
      if (parsed?.type === 'linear' || parsed?.type === 'percent_tm') {
        types.add(parsed.type);
      }
    } catch {
      // Malformed progression JSON — skip rather than crash (ASVS V5).
    }
  }
  if (types.has('percent_tm')) {
    return '%TM';
  }
  if (types.has('linear')) {
    return 'Linear';
  }
  return '';
}

export default function ProgramDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { programId: programIdParam } = useLocalSearchParams<{ programId: string }>();
  const programId = Number(programIdParam);
  const setActiveWorkout = useActiveWorkout((state) => state.setActiveWorkout);

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ProgramDetail | undefined>(undefined);
  const [activeProgram, setActiveProgramState] = useState<ActiveProgramDetail | undefined>(undefined);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    const [detailResult, active] = await Promise.all([loadProgramDetail(db, programId), loadActiveProgram(db)]);
    setDetail(detailResult);
    setActiveProgramState(active);
    setLoading(false);
  }, [programId]);

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

  const isActiveProgram = activeProgram?.program.id === programId;
  const currentDayPosition = isActiveProgram ? activeProgram?.state.currentDayPosition : undefined;

  async function startDay(position: number) {
    if (starting) {
      return;
    }
    setStarting(true);
    try {
      const workout = await startWorkoutFromProgramDay(db, programId, position);
      setActiveWorkout(workout.id, 'logging');
      router.push({ pathname: '/active-workout/[workoutId]', params: { workoutId: String(workout.id) } });
    } finally {
      setStarting(false);
    }
  }

  // D-05: switching active programs never happens silently — only ask when
  // a DIFFERENT program is currently active; nothing to switch from when no
  // program is active yet.
  function handleStartDay(position: number) {
    if (!isActiveProgram && activeProgram) {
      Alert.alert(
        'Switch active program?',
        `${activeProgram.program.name} will no longer be your active program. Its own progress is saved and you can switch back anytime.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Switch', onPress: () => void startDay(position) },
        ],
      );
      return;
    }
    void startDay(position);
  }

  async function doSetActive() {
    await setActiveProgram(db, programId, 0);
    notify('Set as active');
    await load();
  }

  function handleSetActive() {
    if (isActiveProgram) {
      return;
    }
    if (activeProgram) {
      Alert.alert(
        'Switch active program?',
        `${activeProgram.program.name} will no longer be your active program. Its own progress is saved and you can switch back anytime.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Switch', onPress: () => void doSetActive() },
        ],
      );
      return;
    }
    void doSetActive();
  }

  async function doRemove() {
    await deleteProgram(db, programId);
    router.back();
  }

  function handleRemove() {
    Alert.alert(
      'Remove this program?',
      "This deletes the program and its day list. Your logged workout history isn't affected.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => void doRemove() },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.flex}>
        <View style={[styles.appbar, { paddingTop: insets.top + theme.spacing.sm }]}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}>
            <Text style={styles.backText}>‹ Programs</Text>
          </Pressable>
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyBody}>Program not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.appbar, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>‹ Programs</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {detail.program.name}
        </Text>
        {!isActiveProgram ? (
          <Pressable onPress={handleSetActive} accessibilityRole="button" style={styles.setActiveButton}>
            <Text style={styles.setActiveButtonText}>Set as active</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.daysSection}>
          {detail.days.map((dayDetail) => {
            const isNext = isActiveProgram && dayDetail.day.position === currentDayPosition;
            const exerciseCount = dayDetail.template.exercises.length;
            const summary = progressionSummaryFor(dayDetail);
            const caption = summary
              ? `${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'} · ${summary}`
              : `${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'}`;
            return (
              <Pressable
                key={dayDetail.day.id}
                onPress={() => handleStartDay(dayDetail.day.position)}
                disabled={starting}
                accessibilityRole="button"
                style={styles.dayRow}
              >
                <Text style={styles.dayIcon}>📋</Text>
                <View style={styles.textColumn}>
                  <View style={styles.dayNameRow}>
                    {isNext ? <Text style={styles.nextBadge}>▶ Next</Text> : null}
                    <Text style={styles.dayName} numberOfLines={1}>
                      {dayDetail.template.template.name}
                    </Text>
                  </View>
                  <Text style={styles.dayCaption} numberOfLines={1}>
                    {caption}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            );
          })}
        </View>

        {/* TODO(Plan 05): "🎯 Training Maxes" section — one row per distinct
            %TM exercise across this program's days (D-10/D-16), only
            rendered when at least one day carries a percent_tm rule.
            Deferred — not built in this plan. */}

        <Pressable onPress={handleRemove} accessibilityRole="button" style={styles.removeLink}>
          <Text style={styles.removeLinkText}>Remove program</Text>
        </Pressable>
      </ScrollView>
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
    flex: 1,
  },
  setActiveButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  setActiveButtonText: {
    ...theme.typography.caption,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  daysSection: {
    marginTop: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
  },
  dayIcon: {
    fontSize: 20,
    width: 26,
    textAlign: 'center',
  },
  textColumn: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  dayNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  nextBadge: {
    ...theme.typography.caption,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  dayName: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  dayCaption: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  chevron: {
    color: theme.colors.textMuted,
    fontSize: 22,
    marginLeft: theme.spacing.xs,
  },
  emptyBody: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  removeLink: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing['2xl'],
  },
  removeLinkText: {
    ...theme.typography.body,
    color: theme.colors.danger,
    fontWeight: '700',
  },
});
