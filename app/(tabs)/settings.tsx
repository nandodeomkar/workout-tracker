import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { db } from '../../db/client';
import { getSetting, setSetting } from '../../db/settings';
import { theme } from '../../theme';

// "More" tab (settings/gear icon). Phase 2 adds exactly two functional rows
// (UI-SPEC "5. Minimal Settings additions") — Units (D-14) and Default rest
// (D-07) — both persisted to the `settings` key-value table. Everything else
// on this tab stays "Coming soon" (out of scope this phase).

const DEFAULT_REST_SECONDS = 90;
const REST_STEP_SECONDS = 15;
const MIN_REST_SECONDS = 15;

// Barbell-weight defaults + step/clamp bounds (D-06/D-07, UTIL-01). The two
// keys are stored and edited INDEPENDENTLY — never derived from each other
// (Pitfall 1: a 20kg bar and a 45lb bar are separate manufactured standards,
// not unit-conversions of one another).
const DEFAULT_BAR_WEIGHT_KG = 20;
const DEFAULT_BAR_WEIGHT_LB = 45;
const BAR_WEIGHT_STEP_KG = 2.5;
const BAR_WEIGHT_STEP_LB = 5;
const MAX_BAR_WEIGHT = 500;

type Unit = 'kg' | 'lb';

export default function SettingsScreen() {
  const router = useRouter();
  const [units, setUnits] = useState<Unit>('kg');
  const [defaultRestSeconds, setDefaultRestSeconds] = useState<number>(DEFAULT_REST_SECONDS);
  const [barWeightKg, setBarWeightKg] = useState<number>(DEFAULT_BAR_WEIGHT_KG);
  const [barWeightLb, setBarWeightLb] = useState<number>(DEFAULT_BAR_WEIGHT_LB);
  const [loaded, setLoaded] = useState(false);

  // useFocusEffect cancelled-guard reload pattern (RESEARCH.md Pattern 5 /
  // Phase 1 precedent) — reload whenever the tab regains focus so an edit
  // made elsewhere (none yet, but future-proof) is never stale.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [unitsValue, restValue, barKgValue, barLbValue] = await Promise.all([
          getSetting(db, 'units'),
          getSetting(db, 'default_rest_seconds'),
          getSetting(db, 'bar_weight_kg'),
          getSetting(db, 'bar_weight_lb'),
        ]);
        if (cancelled) {
          return;
        }
        setUnits(unitsValue === 'lb' ? 'lb' : 'kg');
        const parsedRest = Number(restValue ?? DEFAULT_REST_SECONDS);
        setDefaultRestSeconds(Number.isFinite(parsedRest) && parsedRest > 0 ? parsedRest : DEFAULT_REST_SECONDS);
        const parsedBarKg = Number(barKgValue ?? DEFAULT_BAR_WEIGHT_KG);
        setBarWeightKg(Number.isFinite(parsedBarKg) && parsedBarKg >= 0 ? parsedBarKg : DEFAULT_BAR_WEIGHT_KG);
        const parsedBarLb = Number(barLbValue ?? DEFAULT_BAR_WEIGHT_LB);
        setBarWeightLb(Number.isFinite(parsedBarLb) && parsedBarLb >= 0 ? parsedBarLb : DEFAULT_BAR_WEIGHT_LB);
        setLoaded(true);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  async function handleSelectUnit(nextUnit: Unit) {
    if (nextUnit === units) {
      return;
    }
    setUnits(nextUnit);
    await setSetting(db, 'units', nextUnit);
  }

  async function handleStepRest(direction: 1 | -1) {
    const next = Math.max(MIN_REST_SECONDS, defaultRestSeconds + direction * REST_STEP_SECONDS);
    setDefaultRestSeconds(next);
    await setSetting(db, 'default_rest_seconds', String(next));
  }

  // T-03-10 mitigation: clamp non-negative + sane upper bound before persist.
  // bar_weight_kg / bar_weight_lb are written independently — stepping one
  // never touches the other's stored value (Pitfall 1).
  async function handleStepBarWeight(direction: 1 | -1) {
    if (units === 'kg') {
      const next = Math.min(MAX_BAR_WEIGHT, Math.max(0, barWeightKg + direction * BAR_WEIGHT_STEP_KG));
      setBarWeightKg(next);
      await setSetting(db, 'bar_weight_kg', String(next));
    } else {
      const next = Math.min(MAX_BAR_WEIGHT, Math.max(0, barWeightLb + direction * BAR_WEIGHT_STEP_LB));
      setBarWeightLb(next);
      await setSetting(db, 'bar_weight_lb', String(next));
    }
  }

  if (!loaded) {
    return <View style={styles.container} />;
  }

  const barWeightDisplay = units === 'kg' ? barWeightKg : barWeightLb;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>More</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Units</Text>
        <View style={styles.unitRow}>
          <UnitPill label="kg" active={units === 'kg'} onPress={() => void handleSelectUnit('kg')} />
          <UnitPill label="lb" active={units === 'lb'} onPress={() => void handleSelectUnit('lb')} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>{`Default rest: ${defaultRestSeconds}s`}</Text>
        <View style={styles.stepperRow}>
          <Pressable
            onPress={() => void handleStepRest(-1)}
            accessibilityRole="button"
            accessibilityLabel="Decrease default rest"
            style={styles.stepperButton}
          >
            <Text style={styles.stepperText}>−</Text>
          </Pressable>
          <Text style={styles.stepperValue}>{`${defaultRestSeconds}s`}</Text>
          <Pressable
            onPress={() => void handleStepRest(1)}
            accessibilityRole="button"
            accessibilityLabel="Increase default rest"
            style={styles.stepperButton}
          >
            <Text style={styles.stepperText}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>{`Barbell weight: ${barWeightDisplay}${units}`}</Text>
        <View style={styles.stepperRow}>
          <Pressable
            onPress={() => void handleStepBarWeight(-1)}
            accessibilityRole="button"
            accessibilityLabel="Decrease barbell weight"
            style={styles.stepperButton}
          >
            <Text style={styles.stepperText}>−</Text>
          </Pressable>
          <Text style={styles.stepperValue}>{`${barWeightDisplay}${units}`}</Text>
          <Pressable
            onPress={() => void handleStepBarWeight(1)}
            accessibilityRole="button"
            accessibilityLabel="Increase barbell weight"
            style={styles.stepperButton}
          >
            <Text style={styles.stepperText}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Tools</Text>
        <Pressable
          onPress={() => router.push('/tools/plate-calculator')}
          accessibilityRole="button"
          style={styles.toolRow}
        >
          <Text style={styles.toolRowText}>Plate calculator</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/tools/one-rm-calculator')}
          accessibilityRole="button"
          style={styles.toolRow}
        >
          <Text style={styles.toolRowText}>1RM calculator</Text>
        </Pressable>
      </View>

      <Text style={styles.caption}>More settings coming soon</Text>
    </View>
  );
}

function UnitPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.pill, active ? styles.pillActive : styles.pillIdle]}
    >
      <Text style={[styles.pillLabel, active ? styles.pillLabelActive : styles.pillLabelIdle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
    marginBottom: theme.spacing.xl,
  },
  section: {
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  unitRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  pill: {
    flex: 0,
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  pillIdle: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.border,
  },
  pillLabel: {
    ...theme.typography.body,
    fontWeight: '700',
  },
  pillLabelActive: {
    color: theme.colors.background,
  },
  pillLabelIdle: {
    color: theme.colors.textMuted,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  stepperButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  stepperText: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  stepperValue: {
    ...theme.typography.body,
    color: theme.colors.text,
    minWidth: 48,
    textAlign: 'center',
  },
  caption: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
  },
  toolRow: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  toolRowText: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
});
