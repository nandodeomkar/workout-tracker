# Debug: sparse-caption-low-contrast

**Status:** resolved — fixed in plan 04-07 (commit b805503); on-device UAT Test 2 re-passed 2026-07-23
**Discovered:** Phase 04 UAT — Test 2 (Empty / sparse states)
**Severity:** cosmetic

## Symptoms

- expected: The "Log one more workout..." caption on the single-point chart state is easily legible.
- actual: "'Log one more workout' caption visible but hard to read".
- errors: None.
- reproduction: Same as chart-single-point-invisible — open the chart for an exercise with exactly one logged workout. Test 2 in 04-UAT.md.
- timeline: Discovered during Phase 04 device UAT (2026-07-23).

## Investigation

Caption element: `app/stats/[exerciseId].tsx:199`

```tsx
<Text style={styles.sparseCaption}>Log one more workout to see a trend line.</Text>
```

Style `sparseCaption` (`app/stats/[exerciseId].tsx:304-309`):

```ts
sparseCaption: {
  ...theme.typography.caption,   // fontSize: 13, weight 400
  color: theme.colors.textMuted, // #8B94A3
  paddingHorizontal: theme.spacing.lg,
  paddingTop: theme.spacing.sm,
},
```

Contrast: `#8B94A3` on background `#0B0E11` ≈ 6.3:1 (passes WCAG AA numerically). But it is rendered at 13px in the muted grey, left-aligned, directly under a chart card that — because of the sibling defect (chart-single-point-invisible) — looks empty. The combination (small + muted + adjacent-empty-chart) is what reads as "hard to read / broken."

## Root cause

Caption uses the smallest type token (`caption`, 13px) in the muted color (`textMuted`), which is the low-emphasis treatment. For a state whose entire job is to tell the user what to do next, low-emphasis muted styling undersells legibility on a phone in gym conditions. Cosmetic — no functional break.

## Files involved

- `app/stats/[exerciseId].tsx:304-309` — `sparseCaption` style (color + size).
- `app/stats/[exerciseId].tsx:198-200` — placement of the caption.

## Suggested fix direction

Raise legibility of the sparse caption:
- Use a higher-emphasis color (`theme.colors.text`) or at minimum keep muted but bump to `theme.typography.body` (16px).
- Consider centering it (`textAlign: 'center'`) to visually pair it with the single point rather than left-aligning under an empty-looking card.

Best fixed together with chart-single-point-invisible so the single-point state reads as intentional (dot + clear caption) rather than broken.
