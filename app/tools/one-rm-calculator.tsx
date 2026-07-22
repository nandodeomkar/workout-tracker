// Standalone 1RM Calculator (UTIL-02 standalone reachability, D-11).
//
// Reads the active unit from settings, then mounts OneRMCalculatorSheet
// always-visible with no prefill (user enters weight/reps fresh) — the SAME
// sheet component mounted inline in the active-workout screen (Plan 06);
// built once, consumed twice. The sheet's own picker-overlay header
// ("‹ Close") already provides the back-navigation affordance, mapped to
// router.back().

import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';

import { OneRMCalculatorSheet } from '../../components/OneRMCalculatorSheet';
import { db } from '../../db/client';
import { getSetting } from '../../db/settings';

type Unit = 'kg' | 'lb';

export default function OneRMCalculatorScreen() {
  const router = useRouter();
  const [unit, setUnit] = useState<Unit>('kg');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const unitsValue = await getSetting(db, 'units');
        if (cancelled) {
          return;
        }
        setUnit(unitsValue === 'lb' ? 'lb' : 'kg');
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return <OneRMCalculatorSheet visible unit={unit} onClose={() => router.back()} />;
}
