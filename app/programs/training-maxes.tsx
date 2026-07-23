// Training-max setup sheet (PROG-03, D-10/D-16, UI-SPEC screen 5) — replaces
// the Plan-03 placeholder. Two modes via optional query params:
//   - ?programId=X (first-time mode, D-16): one row per distinct %TM
//     exercise in program X (listProgramTrainingMaxes), header "Set your
//     training maxes", Save disabled until every row has a non-zero value.
//   - ?exerciseId=Y (single-exercise edit mode, from program detail's
//     "Training Maxes" section Edit link): exactly one row, header "Edit
//     training max".
//
// Each row supports THREE D-10 entry sources, all feeding the SAME TM field
// (still editable, never auto-saved without the user seeing the number):
//   (a) direct entry — tap the TM value -> NumericKeypad.
//   (b) "Compute from 1RM" -> "Enter a 1RM" -> a second NumericKeypad ->
//       computeTrainingMaxFromOneRepMax(oneRepMaxKg) (lib/progression.ts).
//   (c) "Compute from 1RM" -> "Use my best logged 1RM" (only offered when
//       the exercise has one) -> the Phase-4 records path
//       (loadAllHistorySets -> computeExerciseRecordBoard -> bestE1RM.e1rm)
//       feeds the same computeTrainingMaxFromOneRepMax helper directly, no
//       keypad needed since there is nothing to type.
//
// Save writes every non-zero row via setTrainingMax (db/programs.ts) then
// returns to program detail (first-time mode, completing the Add-a-program
// chain) or back to wherever Edit was opened from (edit mode).

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { NumericKeypad } from '../../components/NumericKeypad';
import { db } from '../../db/client';
import { loadExerciseById } from '../../db/exercises';
import { getTrainingMax, listProgramTrainingMaxes, setTrainingMax } from '../../db/programs';
import { getSetting } from '../../db/settings';
import { loadAllHistorySets } from '../../db/stats';
import { computeTrainingMaxFromOneRepMax } from '../../lib/progression';
import { computeExerciseRecordBoard, type HistoricalSet } from '../../lib/records';
import { displayToKg, kgToDisplay } from '../../lib/weightUnits';
import { theme } from '../../theme';

type WeightUnit = 'kg' | 'lb';

// Android-first transient feedback — copied verbatim (app/active-workout/summary.tsx precedent).
function notify(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}

interface TmRow {
  exerciseId: number;
  exerciseName: string;
  /** Canonical kg, 0 = unset/uncomputed. */
  tmKg: number;
  bestE1RMKg: number | null;
}

type KeypadMode = 'tm' | 'oneRm';

export default function TrainingMaxesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { programId: programIdParam, exerciseId: exerciseIdParam } = useLocalSearchParams<{
    programId?: string;
    exerciseId?: string;
  }>();

  const isEditMode = exerciseIdParam != null;
  const programId = programIdParam != null ? Number(programIdParam) : undefined;
  const singleExerciseId = exerciseIdParam != null ? Number(exerciseIdParam) : undefined;

  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [rows, setRows] = useState<TmRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [expandedHelperFor, setExpandedHelperFor] = useState<number | null>(null);
  const [keypad, setKeypad] = useState<{ exerciseId: number; mode: KeypadMode } | null>(null);

  const load = useCallback(async () => {
    const unitSetting = (await getSetting(db, 'units')) === 'lb' ? 'lb' : 'kg';

    let entries: Array<{ exerciseId: number; maxKg: number | null }>;
    if (isEditMode && singleExerciseId != null) {
      const tm = await getTrainingMax(db, singleExerciseId);
      entries = [{ exerciseId: singleExerciseId, maxKg: tm?.maxKg ?? null }];
    } else if (programId != null) {
      entries = await listProgramTrainingMaxes(db, programId);
    } else {
      entries = [];
    }

    const historySets = await loadAllHistorySets(db);
    const setsByExerciseId = new Map<number, HistoricalSet[]>();
    for (const historySet of historySets) {
      const list = setsByExerciseId.get(historySet.exerciseId) ?? [];
      list.push(historySet);
      setsByExerciseId.set(historySet.exerciseId, list);
    }

    const builtRows: TmRow[] = [];
    for (const entry of entries) {
      const exercise = await loadExerciseById(db, entry.exerciseId);
      const board = computeExerciseRecordBoard(setsByExerciseId.get(entry.exerciseId) ?? []);
      builtRows.push({
        exerciseId: entry.exerciseId,
        exerciseName: exercise?.name ?? 'Exercise',
        tmKg: entry.maxKg ?? 0,
        bestE1RMKg: board.bestE1RM?.e1rm ?? null,
      });
    }

    setUnit(unitSetting);
    setRows(builtRows);
    setLoading(false);
  }, [isEditMode, singleExerciseId, programId]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateRowTmKg(exerciseId: number, tmKg: number) {
    setRows((prev) => prev.map((row) => (row.exerciseId === exerciseId ? { ...row, tmKg } : row)));
  }

  function openTmKeypad(exerciseId: number) {
    setExpandedHelperFor(null);
    setKeypad({ exerciseId, mode: 'tm' });
  }

  function openOneRmKeypad(exerciseId: number) {
    setExpandedHelperFor(null);
    setKeypad({ exerciseId, mode: 'oneRm' });
  }

  function useBestLoggedOneRm(row: TmRow) {
    if (row.bestE1RMKg == null) {
      return;
    }
    updateRowTmKg(row.exerciseId, computeTrainingMaxFromOneRepMax(row.bestE1RMKg));
    setExpandedHelperFor(null);
  }

  function handleKeypadDone(value: number) {
    if (!keypad) {
      return;
    }
    if (keypad.mode === 'tm') {
      updateRowTmKg(keypad.exerciseId, displayToKg(value, unit));
    } else {
      const oneRmKg = displayToKg(value, unit);
      updateRowTmKg(keypad.exerciseId, computeTrainingMaxFromOneRepMax(oneRmKg));
    }
    setKeypad(null);
  }

  const activeRow = keypad ? rows.find((row) => row.exerciseId === keypad.exerciseId) : undefined;
  const keypadLabel =
    keypad?.mode === 'tm'
      ? `${activeRow?.exerciseName ?? 'Exercise'} training max (${unit})`
      : `Enter your 1RM for ${activeRow?.exerciseName ?? 'Exercise'} (${unit})`;
  const keypadInitialValue =
    keypad?.mode === 'tm' && activeRow && activeRow.tmKg > 0 ? kgToDisplay(activeRow.tmKg, unit) : 0;

  const canSave = rows.length > 0 && rows.every((row) => row.tmKg > 0);

  async function handleSave() {
    if (saving || !canSave) {
      return;
    }
    setSaving(true);
    try {
      for (const row of rows) {
        await setTrainingMax(db, row.exerciseId, row.tmKg);
      }
      notify('Training maxes saved');
      if (isEditMode) {
        router.back();
      } else if (programId != null) {
        router.replace({ pathname: '/programs/[programId]', params: { programId: String(programId) } });
      } else {
        router.back();
      }
    } finally {
      setSaving(false);
    }
  }

  const title = isEditMode ? 'Edit training max' : 'Set your training maxes';
  const saveLabel = isEditMode ? 'Save' : 'Save training maxes';

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.appbar, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>‹ Cancel</Text>
        </Pressable>
        <Text style={styles.title}>{title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {rows.length === 0 ? (
          <Text style={styles.emptyBody}>No training-max exercises found for this program.</Text>
        ) : (
          rows.map((row) => (
            <View key={row.exerciseId} style={styles.exerciseBlock}>
              <Pressable onPress={() => openTmKeypad(row.exerciseId)} accessibilityRole="button" style={styles.tmRow}>
                <Text style={styles.exerciseName} numberOfLines={1}>
                  {row.exerciseName}
                </Text>
                <Text style={styles.tmValue}>{row.tmKg > 0 ? `${kgToDisplay(row.tmKg, unit)} ${unit}` : `— ${unit}`}</Text>
              </Pressable>

              <Pressable
                onPress={() => setExpandedHelperFor((prev) => (prev === row.exerciseId ? null : row.exerciseId))}
                accessibilityRole="button"
                style={styles.helperLink}
              >
                <Text style={styles.helperLinkText}>Compute from 1RM</Text>
              </Pressable>

              {expandedHelperFor === row.exerciseId ? (
                <View style={styles.helperMenu}>
                  <Pressable
                    onPress={() => openOneRmKeypad(row.exerciseId)}
                    accessibilityRole="button"
                    style={styles.helperOption}
                  >
                    <Text style={styles.helperOptionText}>Enter a 1RM</Text>
                  </Pressable>
                  {row.bestE1RMKg != null ? (
                    <Pressable
                      onPress={() => useBestLoggedOneRm(row)}
                      accessibilityRole="button"
                      style={styles.helperOption}
                    >
                      <Text style={styles.helperOptionText}>
                        Use my best logged 1RM ({kgToDisplay(row.bestE1RMKg, unit)} {unit})
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))
        )}

        {rows.length > 0 ? (
          <Pressable
            onPress={() => void handleSave()}
            disabled={!canSave || saving}
            accessibilityRole="button"
            style={[styles.saveButton, (!canSave || saving) && styles.saveButtonDisabled]}
          >
            <Text style={styles.saveButtonText}>{saveLabel}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <NumericKeypad
        visible={keypad !== null}
        label={keypadLabel}
        initialValue={keypadInitialValue}
        allowDecimal
        onDone={handleKeypadDone}
        onCancel={() => setKeypad(null)}
      />
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
    flexShrink: 1,
  },
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl * 2,
  },
  emptyBody: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  exerciseBlock: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  tmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  exerciseName: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
  },
  tmValue: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
  },
  helperLink: {
    minHeight: 32,
    justifyContent: 'center',
  },
  helperLinkText: {
    ...theme.typography.caption,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  helperMenu: {
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  helperOption: {
    minHeight: 44,
    justifyContent: 'center',
  },
  helperOptionText: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  saveButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    ...theme.typography.body,
    color: theme.colors.background,
    fontWeight: '700',
  },
});
