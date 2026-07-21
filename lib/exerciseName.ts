// Name normalization for duplicate detection (D-12 / GAP-2).
//
// The library's duplicate-name warning must catch near-duplicates that
// differ only by case, surrounding/internal whitespace, punctuation, or a
// trailing plural "s" — e.g. "Seated Cable Rows" vs "Seated cable row".
// This is a pure, display-agnostic canonicalizer: it never touches SQL and
// is safe to run over an in-memory array of names.

/**
 * Canonical form of an exercise name for equality comparison:
 *   - lowercased
 *   - every run of non-alphanumeric characters collapsed to a single space
 *     (so hyphens/slashes/punctuation stop mattering: "Sit-Up" -> "sit up")
 *   - trimmed
 *   - a single trailing plural "s" removed, but never from a word ending in
 *     "ss" ("Rows" -> "row", but "Press" stays "press")
 *
 * Two names are considered duplicates when their normalized forms are equal.
 */
export function normalizeExerciseName(name: string): string {
  const collapsed = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  // Strip one trailing plural "s" (rows -> row, raises -> raise) while
  // preserving legitimate "...ss" endings (press, bench press).
  return collapsed.replace(/([^s])s$/, '$1');
}
