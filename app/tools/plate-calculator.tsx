// Standalone Plate Calculator (UTIL-01 standalone reachability, D-07).
//
// Reads the active unit + its independent bar-weight key from settings, then
// mounts PlateCalculatorSheet always-visible with no target-weight prefill
// (user enters weight fresh) — the SAME sheet component mounted inline in
// the active-workout screen (Plan 06); built once, consumed twice. The
// sheet's own picker-overlay header ("‹ Close") already provides the
// back-navigation affordance, mapped to router.back().

import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';

import { PlateCalculatorSheet } from '../../components/PlateCalculatorSheet';
import { db } from '../../db/client';
import { getSetting } from '../../db/settings';

type Unit = 'kg' | 'lb';

const DEFAULT_BAR_WEIGHT_KG = 20;
const DEFAULT_BAR_WEIGHT_LB = 45;

export default function PlateCalculatorScreen() {
  const router = useRouter();
  const [unit, setUnit] = useState<Unit>('kg');
  const [barWeightKg, setBarWeightKg] = useState<number>(DEFAULT_BAR_WEIGHT_KG);
  const [barWeightLb, setBarWeightLb] = useState<number>(DEFAULT_BAR_WEIGHT_LB);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [unitsValue, barKgValue, barLbValue] = await Promise.all([
          getSetting(db, 'units'),
          getSetting(db, 'bar_weight_kg'),
          getSetting(db, 'bar_weight_lb'),
        ]);
        if (cancelled) {
          return;
        }
        setUnit(unitsValue === 'lb' ? 'lb' : 'kg');
        const parsedKg = Number(barKgValue ?? DEFAULT_BAR_WEIGHT_KG);
        setBarWeightKg(Number.isFinite(parsedKg) && parsedKg >= 0 ? parsedKg : DEFAULT_BAR_WEIGHT_KG);
        const parsedLb = Number(barLbValue ?? DEFAULT_BAR_WEIGHT_LB);
        setBarWeightLb(Number.isFinite(parsedLb) && parsedLb >= 0 ? parsedLb : DEFAULT_BAR_WEIGHT_LB);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const barWeightDisplay = unit === 'kg' ? barWeightKg : barWeightLb;

  return (
    <PlateCalculatorSheet
      visible
      unit={unit}
      barWeightDisplay={barWeightDisplay}
      onClose={() => router.back()}
    />
  );
}
