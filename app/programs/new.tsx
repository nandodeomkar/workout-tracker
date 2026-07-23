// Custom program builder (PROG-01, UI-SPEC screen 3 "Build your own") —
// replaces the Plan-03 "Coming soon" placeholder. Assembles a name + an
// ordered list of EXISTING templates (a day = a template, D-17) into a
// program via db/programs.ts's createProgram/addProgramDay/setActiveProgram,
// then chains into the TM-setup sheet (D-16) if any picked day carries a
// percent_tm exercise — mirroring app/programs/index.tsx#doMaterialize's own
// bundled-program chain-into-TM-setup branch exactly.
//
// The "+ Add day" picker reuses the exact folder-grouped
// TemplateRow/FolderSectionHeader list already rendered on Workout home
// (loadTemplatesGroupedByFolder + per-template loadTemplateDetail exercise
// counts), in single-select mode: picking a template appends it as the next
// day and closes the picker. A template may be picked more than once (e.g.
// an A/B/A split) — no de-dup guard, matching the UI-SPEC's explicit call-out.

import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { FolderSectionHeader } from '../../components/FolderSectionHeader';
import { TemplateRow } from '../../components/TemplateRow';
import { db } from '../../db/client';
import { addProgramDay, createProgram, setActiveProgram } from '../../db/programs';
import { loadTemplateDetail, loadTemplatesGroupedByFolder } from '../../db/templates';
import { theme } from '../../theme';

// Android-first transient feedback (mirrors app/programs/index.tsx precedent).
function notify(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}

// Uncategorized bucket's stable expanded-state key (templates.folder is
// null — Map/Record keys must be strings, matches app/(tabs)/index.tsx's
// own UNCATEGORIZED_KEY precedent).
const UNCATEGORIZED_KEY = '__uncategorized__';

interface DayRow {
  key: string;
  templateId: number;
  templateName: string;
  exerciseCount: number;
}

interface PickerTemplateGroup {
  folder: string | null;
  templates: { id: number; name: string; exerciseCount: number }[];
}

/**
 * Distinct template ids across the picked days each fetched once
 * (loadTemplateDetail), checking whether ANY exercise on ANY picked day
 * carries a `{type:"percent_tm"}` progression rule — D-16 applies to
 * custom-built %TM programs exactly like the bundled %TM wave. Malformed
 * progression JSON is skipped rather than thrown (T-06-01 guard, mirrors
 * db/programs.ts's own parse-and-skip convention).
 */
async function programHasPercentTm(templateIds: number[]): Promise<boolean> {
  for (const templateId of new Set(templateIds)) {
    const detail = await loadTemplateDetail(db, templateId);
    if (!detail) {
      continue;
    }
    for (const { templateExercise } of detail.exercises) {
      if (!templateExercise.progression) {
        continue;
      }
      try {
        const parsed = JSON.parse(templateExercise.progression) as { type?: string };
        if (parsed?.type === 'percent_tm') {
          return true;
        }
      } catch {
        // Malformed progression JSON — skip rather than crash (T-06-01).
      }
    }
  }
  return false;
}

export default function NewProgramScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [days, setDays] = useState<DayRow[]>([]);
  const [saving, setSaving] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [templateGroups, setTemplateGroups] = useState<PickerTemplateGroup[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const loadPickerTemplates = useCallback(async () => {
    setPickerLoading(true);
    const groups = await loadTemplatesGroupedByFolder(db);
    const withCounts: PickerTemplateGroup[] = await Promise.all(
      groups.map(async (group) => ({
        folder: group.folder,
        templates: await Promise.all(
          group.templates.map(async (template) => {
            const detail = await loadTemplateDetail(db, template.id);
            return { id: template.id, name: template.name, exerciseCount: detail?.exercises.length ?? 0 };
          }),
        ),
      })),
    );
    setTemplateGroups(withCounts);
    setExpandedFolders((prev) => {
      const next = { ...prev };
      for (const group of withCounts) {
        const key = group.folder ?? UNCATEGORIZED_KEY;
        if (!(key in next)) {
          next[key] = true;
        }
      }
      return next;
    });
    setPickerLoading(false);
  }, []);

  function openPicker() {
    setPickerOpen(true);
    void loadPickerTemplates();
  }

  function closePicker() {
    setPickerOpen(false);
  }

  function toggleFolder(key: string) {
    setExpandedFolders((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));
  }

  function selectTemplateForDay(template: { id: number; name: string; exerciseCount: number }) {
    setDays((prev) => [
      ...prev,
      {
        key: `day-${Date.now()}-${template.id}-${prev.length}`,
        templateId: template.id,
        templateName: template.name,
        exerciseCount: template.exerciseCount,
      },
    ]);
    closePicker();
  }

  function removeDay(key: string) {
    setDays((prev) => prev.filter((day) => day.key !== key));
  }

  function moveDay(key: string, direction: -1 | 1) {
    setDays((prev) => {
      const index = prev.findIndex((day) => day.key === key);
      const targetIndex = index + direction;
      if (index === -1 || targetIndex < 0 || targetIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && days.length > 0 && !saving;

  async function handleSave() {
    if (!canSave) {
      return;
    }
    setSaving(true);
    try {
      const program = await createProgram(db, { name: trimmedName });
      for (const [index, day] of days.entries()) {
        await addProgramDay(db, { programId: program.id, position: index, templateId: day.templateId });
      }
      await setActiveProgram(db, program.id, 0);
      notify(`${trimmedName} created`);

      const hasPercentTm = await programHasPercentTm(days.map((day) => day.templateId));
      if (hasPercentTm) {
        // D-16: custom %TM programs prompt TM setup up front, exactly like
        // the bundled wave (app/programs/index.tsx#doMaterialize).
        router.replace({ pathname: '/programs/training-maxes', params: { programId: String(program.id) } });
      } else {
        router.replace({ pathname: '/programs/[programId]', params: { programId: String(program.id) } });
      }
    } catch {
      notify('Something went wrong loading your programs.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.appbar, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>‹ Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Build a program</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Program name"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.input}
          autoFocus
        />

        <Text style={styles.label}>Days</Text>
        {days.length === 0 ? (
          <Text style={styles.emptyText}>No days yet — add at least one template below.</Text>
        ) : (
          days.map((day, index) => (
            <View key={day.key} style={styles.dayRow}>
              <Text style={styles.dayIcon}>📋</Text>
              <View style={styles.textColumn}>
                <Text style={styles.dayName} numberOfLines={1}>
                  {day.templateName}
                </Text>
                <Text style={styles.daySecondary} numberOfLines={1}>
                  {`${day.exerciseCount} ${day.exerciseCount === 1 ? 'exercise' : 'exercises'}`}
                </Text>
              </View>
              <View style={styles.reorderGroup}>
                <Pressable
                  onPress={() => moveDay(day.key, -1)}
                  disabled={index === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Move up"
                  style={[styles.reorderButton, index === 0 ? styles.reorderButtonDisabled : null]}
                >
                  <Text style={styles.reorderButtonText}>▲</Text>
                </Pressable>
                <Pressable
                  onPress={() => moveDay(day.key, 1)}
                  disabled={index === days.length - 1}
                  accessibilityRole="button"
                  accessibilityLabel="Move down"
                  style={[styles.reorderButton, index === days.length - 1 ? styles.reorderButtonDisabled : null]}
                >
                  <Text style={styles.reorderButtonText}>▼</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => removeDay(day.key)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${day.templateName}`}
                style={styles.removeButton}
              >
                <Text style={styles.removeButtonText}>✕</Text>
              </Pressable>
            </View>
          ))
        )}

        <Pressable onPress={openPicker} accessibilityRole="button" style={styles.addDayButton}>
          <Text style={styles.addDayText}>+ Add day</Text>
        </Pressable>

        <Pressable
          onPress={() => void handleSave()}
          disabled={!canSave}
          style={[styles.saveButton, !canSave ? styles.saveButtonDisabled : null]}
          accessibilityRole="button"
        >
          <Text style={styles.saveButtonText}>Create program</Text>
        </Pressable>
      </ScrollView>

      {pickerOpen ? (
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerHeader, { paddingTop: insets.top + theme.spacing.sm }]}>
            <Pressable onPress={closePicker} accessibilityRole="button" style={styles.pickerCancelButton}>
              <Text style={styles.pickerCancelText}>‹ Cancel</Text>
            </Pressable>
            <Text style={styles.pickerTitle}>Add day</Text>
          </View>

          {pickerLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={theme.colors.accent} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.pickerContainer}>
              {templateGroups.length === 0 ? (
                <View style={styles.pickerEmpty}>
                  <Text style={styles.pickerEmptyText}>No templates yet — create one first.</Text>
                </View>
              ) : (
                templateGroups.map((group) => {
                  const key = group.folder ?? UNCATEGORIZED_KEY;
                  const expanded = expandedFolders[key] ?? true;
                  return (
                    <View key={key} style={styles.folderGroup}>
                      <FolderSectionHeader
                        title={group.folder ?? 'Uncategorized'}
                        count={group.templates.length}
                        expanded={expanded}
                        onToggle={() => toggleFolder(key)}
                      />
                      {expanded
                        ? group.templates.map((template) => (
                            <TemplateRow
                              key={template.id}
                              label={template.name}
                              exerciseCount={template.exerciseCount}
                              onPress={() => selectTemplateForDay(template)}
                            />
                          ))
                        : null}
                    </View>
                  );
                })
              )}
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
  },
  appbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
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
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.xl * 2,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
  },
  input: {
    ...theme.typography.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  emptyText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
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
  dayName: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  daySecondary: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  reorderGroup: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  reorderButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderButtonDisabled: {
    opacity: 0.35,
  },
  reorderButtonText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  removeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    ...theme.typography.body,
    color: theme.colors.danger,
  },
  addDayButton: {
    marginTop: theme.spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  addDayText: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  saveButton: {
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  saveButtonText: {
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
  },
  pickerCancelButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: theme.spacing.md,
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
  pickerContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  folderGroup: {
    marginBottom: theme.spacing.sm,
  },
  pickerEmpty: {
    alignItems: 'center',
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  pickerEmptyText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
