// Focus-mode advance-to-next-pending-set transition (REDESIGN-03, D-06).
//
// Pure, zero React Native / Drizzle imports (mirrors lib/warmupLadder.ts
// convention). This function does not read the DB or Zustand store itself —
// the caller supplies exerciseOrder + rowsByWE + currentWeId. Re-expresses
// the prototype's `focusLog` (lines 566-580) as a pure function; it has no
// existing precedent in this codebase (RESEARCH.md landmine #9).
//
// Semantic note: advanceFocus targets the first pending row of ANY type
// (warmup or working), because Focus mode logs warmup targets too — this
// differs from lib/findCurrentRowKey.ts, which targets only the first
// pending WORKING row (the Instrument-mode accent rail).

export interface FocusRow {
  key: string;
  isCompleted: boolean;
}

export interface AdvanceFocusInput {
  exerciseOrder: number[];
  rowsByWE: Record<number, FocusRow[]>;
  currentWeId: number;
}

export interface FocusTarget {
  weId: number;
  rowKey: string;
}

function firstPendingKey(rows: FocusRow[] | undefined): string | null {
  return rows?.find((r) => !r.isCompleted)?.key ?? null;
}

/**
 * Returns the next {weId, rowKey} to focus:
 * 1. First pending row in currentWeId, if one exists.
 * 2. Else the first pending row of the next exercise (in exerciseOrder AFTER
 *    currentWeId) that has any pending row.
 * 3. Else scans from the START of exerciseOrder for any exercise with a
 *    pending row (handles a skipped-earlier exercise).
 * 4. Returns null only when NO exercise has any pending row.
 *
 * currentWeId not present in exerciseOrder is treated as "start scan from
 * the beginning" (branch 3 covers this — the index lookup below yields -1,
 * so the "after current" slice is empty and the wrap-scan runs the full list).
 */
export function advanceFocus(input: AdvanceFocusInput): FocusTarget | null {
  const { exerciseOrder, rowsByWE, currentWeId } = input;

  const currentKey = firstPendingKey(rowsByWE[currentWeId]);
  if (currentKey !== null) {
    return { weId: currentWeId, rowKey: currentKey };
  }

  // currentWeId not present in exerciseOrder → indexOf yields -1, so the
  // "after current" loop below starts at index 0 and scans the whole list —
  // exactly the "start scan from beginning" behavior this case requires.
  const currentIndex = exerciseOrder.indexOf(currentWeId);

  for (let i = currentIndex + 1; i < exerciseOrder.length; i += 1) {
    const weId = exerciseOrder[i];
    const rowKey = firstPendingKey(rowsByWE[weId]);
    if (rowKey !== null) {
      return { weId, rowKey };
    }
  }

  // Wrap: scan from the start of exerciseOrder up to (and including)
  // currentIndex for any exercise with a pending row (skipped-earlier case).
  for (let i = 0; i <= currentIndex && i < exerciseOrder.length; i += 1) {
    const weId = exerciseOrder[i];
    const rowKey = firstPendingKey(rowsByWE[weId]);
    if (rowKey !== null) {
      return { weId, rowKey };
    }
  }

  return null;
}
