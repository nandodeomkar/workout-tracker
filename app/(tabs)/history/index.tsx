// History tab home (HIST-01/D-12, UI-SPEC "4. History tab") — replaces the
// old single-file "Coming soon" tab. A two-option segmented control ("List"/
// "Calendar", same single-select pill visual as MuscleGroupPills, reduced to
// two options) toggles between:
//   - List: loadWorkoutHistory, most-recent-first WorkoutRows.
//   - Calendar: MonthCalendar driven by loadWorkoutsInMonth for the
//     currently-viewed month; tapping a workout day navigates to that day's
//     detail.
// Reloads on focus (GAP-3 cancelled-guard pattern) so a just-finished or
// just-edited workout is reflected the moment this tab regains focus.

import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { MonthCalendar } from '../../../components/MonthCalendar';
import { WorkoutRow } from '../../../components/WorkoutRow';
import { db } from '../../../db/client';
import { getSetting } from '../../../db/settings';
import type { Workout } from '../../../db/schema';
import { loadWorkoutHistory, loadWorkoutsInMonth, type WorkoutHistoryEntry } from '../../../db/workouts';
import { theme } from '../../../theme';

type ViewMode = 'list' | 'calendar';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

// UTC-based bucketing to match db/workouts.ts#loadWorkoutsInMonth's
// Date.UTC month-boundary math — a workout's calendar day here must agree
// with which month/day the DB query considers it to fall on.
function utcDateISO(iso: string): string {
  const date = new Date(iso);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function workoutLabel(workout: Workout): string {
  if (workout.name && workout.name.trim().length > 0) {
    return workout.name;
  }
  return new Date(workout.startedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function durationMsFor(workout: Workout): number | null {
  if (!workout.finishedAt) {
    return null;
  }
  return Math.max(0, new Date(workout.finishedAt).getTime() - new Date(workout.startedAt).getTime());
}

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<ViewMode>('list');
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [entries, setEntries] = useState<WorkoutHistoryEntry[]>([]);
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  });
  const [monthWorkouts, setMonthWorkouts] = useState<Workout[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSetting(db, 'units').then((value) => {
        if (!cancelled) {
          setUnit(value === 'lb' ? 'lb' : 'kg');
        }
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (mode !== 'list') {
        return;
      }
      let cancelled = false;
      loadWorkoutHistory(db).then((rows) => {
        if (!cancelled) {
          setEntries(rows);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [mode]),
  );

  useFocusEffect(
    useCallback(() => {
      if (mode !== 'calendar') {
        return;
      }
      let cancelled = false;
      loadWorkoutsInMonth(db, monthCursor.year, monthCursor.month).then((rows) => {
        if (!cancelled) {
          setMonthWorkouts(rows);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [mode, monthCursor]),
  );

  const workoutDays = useMemo(
    () => new Set(monthWorkouts.map((workout) => utcDateISO(workout.startedAt))),
    [monthWorkouts],
  );

  // First workout found for a given day wins if a day somehow has more than
  // one finished workout — an edge case the UI-SPEC doesn't disambiguate;
  // any workout from that day is a reasonable detail target.
  const workoutIdByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const workout of monthWorkouts) {
      const iso = utcDateISO(workout.startedAt);
      if (!map.has(iso)) {
        map.set(iso, workout.id);
      }
    }
    return map;
  }, [monthWorkouts]);

  function handleSelectDay(dateISO: string) {
    const workoutId = workoutIdByDay.get(dateISO);
    if (workoutId != null) {
      router.push(`/history/${workoutId}`);
    }
  }

  function handlePrevMonth() {
    setMonthCursor((prev) => {
      const month = prev.month - 1;
      return month < 1 ? { year: prev.year - 1, month: 12 } : { year: prev.year, month };
    });
  }

  function handleNextMonth() {
    setMonthCursor((prev) => {
      const month = prev.month + 1;
      return month > 12 ? { year: prev.year + 1, month: 1 } : { year: prev.year, month };
    });
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.title}>History</Text>
        <View style={styles.segmentRow}>
          <SegmentButton label="List" active={mode === 'list'} onPress={() => setMode('list')} />
          <SegmentButton label="Calendar" active={mode === 'calendar'} onPress={() => setMode('calendar')} />
        </View>
      </View>

      {mode === 'list' ? (
        entries.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyHeading}>No workouts yet</Text>
            <Text style={styles.emptyBody}>Finish your first workout and it'll show up here.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.listContent}>
            {entries.map((entry) => (
              <WorkoutRow
                key={entry.workout.id}
                label={workoutLabel(entry.workout)}
                exerciseCount={entry.exerciseCount}
                totalVolumeKg={entry.totalVolumeKg}
                durationMs={durationMsFor(entry.workout)}
                unit={unit}
                onPress={() => router.push(`/history/${entry.workout.id}`)}
              />
            ))}
          </ScrollView>
        )
      ) : (
        <ScrollView contentContainerStyle={styles.calendarContent}>
          <MonthCalendar
            year={monthCursor.year}
            month={monthCursor.month}
            workoutDays={workoutDays}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onSelectDay={handleSelectDay}
          />
        </ScrollView>
      )}
    </View>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.segmentButton, active ? styles.segmentButtonActive : styles.segmentButtonIdle]}
    >
      <Text style={[styles.segmentLabel, active ? styles.segmentLabelActive : styles.segmentLabelIdle]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  segmentButtonIdle: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.border,
  },
  segmentLabel: {
    ...theme.typography.body,
    fontWeight: '700',
  },
  segmentLabelActive: {
    color: theme.colors.background,
  },
  segmentLabelIdle: {
    color: theme.colors.textMuted,
  },
  listContent: {
    paddingBottom: theme.spacing.xl,
  },
  calendarContent: {
    padding: theme.spacing.lg,
  },
  empty: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyHeading: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
  },
  emptyBody: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
