// Current-row derivation for the Instrument-mode left accent rail (REDESIGN-02).
//
// Pure, zero React Native / Drizzle imports (mirrors lib/warmupLadder.ts
// convention). This function does not read the DB or Zustand store itself;
// the caller supplies the row array. RowLite is a minimal structural
// interface (not the screen's real `Row`) so this file never pulls React
// Native in transitively — the screen's real Row is structurally assignable.

export interface RowLite {
  key: string;
  isWarmup: boolean;
  isCompleted: boolean;
}

/**
 * Returns the key of the first pending (not completed) NON-warmup row — the
 * Instrument-mode current-row accent-rail target — or null when every row is
 * completed, the list is empty, or only warmup rows remain pending.
 */
export function findCurrentRowKey(rows: RowLite[]): string | null {
  return rows.find((r) => !r.isCompleted && !r.isWarmup)?.key ?? null;
}
