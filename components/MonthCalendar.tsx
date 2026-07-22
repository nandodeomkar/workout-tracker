// Custom month-grid calendar (HIST-01/D-12, UI-SPEC "4. History tab" —
// Calendar view). Zero new dependency: a plain 7-column View grid, no
// external calendar package (RESEARCH.md Standard Stack). Purely
// presentational date bucketing — no DB import; the caller supplies the
// year/month, the set of workout-day ISO dates for that month, and nav/
// day-select callbacks.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface MonthCalendarProps {
  /** Full year, e.g. 2026. */
  year: number;
  /** 1-indexed month (1 = January), matching db/workouts.ts#loadWorkoutsInMonth. */
  month: number;
  /** ISO "YYYY-MM-DD" dates (within this month) that have a logged workout. */
  workoutDays: Set<string>;
  /** ISO "YYYY-MM-DD" of the currently-selected/viewed day, if any. */
  selectedDay?: string | null;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDay: (dateISO: string) => void;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dayISO(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function MonthCalendar({
  year,
  month,
  workoutDays,
  selectedDay,
  onPrevMonth,
  onNextMonth,
  onSelectDay,
}: MonthCalendarProps) {
  // First weekday (0=Sun..6=Sat) and day count for the given month, computed
  // in UTC to match loadWorkoutsInMonth's Date.UTC month-boundary math.
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={onPrevMonth}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          style={styles.navButton}
        >
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>
          {MONTH_NAMES[month - 1]} {year}
        </Text>
        <Pressable
          onPress={onNextMonth}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={styles.navButton}
        >
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, index) => (
          <Text key={`weekday-${index}`} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={`week-${weekIndex}`} style={styles.weekRow}>
          {week.map((day, dayIndex) => {
            if (day == null) {
              return <View key={`empty-${dayIndex}`} style={styles.dayCellEmpty} />;
            }
            const dateISO = dayISO(year, month, day);
            const hasWorkout = workoutDays.has(dateISO);
            const selected = selectedDay === dateISO;
            return (
              <Pressable
                key={dateISO}
                onPress={() => (hasWorkout ? onSelectDay(dateISO) : undefined)}
                disabled={!hasWorkout}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: !hasWorkout }}
                accessibilityLabel={`${MONTH_NAMES[month - 1]} ${day}${hasWorkout ? ', workout logged' : ''}`}
                style={[styles.dayCell, selected ? styles.dayCellSelected : null]}
              >
                <Text style={styles.dayNumber}>{day}</Text>
                {hasWorkout ? <View style={styles.dot} /> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    ...theme.typography.title,
    color: theme.colors.textMuted,
  },
  monthLabel: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  weekRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  dayCellEmpty: {
    flex: 1,
    aspectRatio: 1,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayCellSelected: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.accent,
  },
  dayNumber: {
    ...theme.typography.caption,
    color: theme.colors.text,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.accent,
  },
});
