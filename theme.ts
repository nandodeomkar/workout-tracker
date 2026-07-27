// Dark-only design tokens (D-14). No light theme in Phase 1 — deferred.
// Every screen/component must import from here rather than using ad-hoc
// inline color/spacing literals.
//
// This is the dark Modernist rendition (Phase 06.1, D-02/D-04): every existing
// color/spacing/typography/radius key is revalued in place so all consumer
// files keep compiling with no missing-token errors, while four new color
// keys and two new typography roles are additive. `danger` and `badge` are
// intentionally unified to the single accent red (`#ec3013`) across every
// consumer in the app — this is a deliberate mono-hue scheme change, not a
// regression (was `#EF4444` / `#F59E0B`).
export const theme = {
  colors: {
    background: '#131211',
    surface: '#1b1a18',
    surfaceAlt: '#242220',
    text: '#f5f2ef',
    textMuted: '#9b9797',
    textDim: '#7d7979',
    accent: '#ec3013',
    accentHover: '#ff563c',
    border: 'rgba(245,242,239,0.2)',
    danger: '#ec3013',
    badge: '#ec3013',
    divider: 'rgba(245,242,239,0.2)',
    dividerHairline: 'rgba(245,242,239,0.1)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    // Major section breaks on the Stats overview dashboard (PR feed / weekly
    // volume / exercise picker, D-01/D-02) — xl (24px) is already used for
    // screen-edge padding, so a distinct larger token keeps sections reading
    // as separate rather than as one card's internal padding.
    '2xl': 32,
  },
  // Archivo typography (Phase 06.1, D-02/UI-01). RN applies custom fonts by
  // family name, not numeric fontWeight, so weight is encoded in the family
  // string on every role (fontWeight stays as a cosmetic platform fallback).
  // Existing roles keep their fontSize/fontWeight/lineHeight unchanged — only
  // fontFamily is threaded in — so other screens' proportions are untouched.
  // Two new roles are added: `label` (uppercase kicker/tertiary text) and
  // `heading` (section/screen titles). The active-workout screen's
  // pixel-faithful sizes are composed inline from these fontFamily strings
  // plus explicit px, not added here as new per-pixel roles.
  typography: {
    title: {
      fontSize: 20,
      fontWeight: '700' as const,
      fontFamily: 'Archivo_700Bold',
    },
    body: {
      fontSize: 16,
      fontWeight: '400' as const,
      fontFamily: 'Archivo_400Regular',
    },
    caption: {
      fontSize: 13,
      fontWeight: '400' as const,
      fontFamily: 'Archivo_400Regular',
    },
    // Rest-timer countdown digits only (UI-SPEC "1. Active workout screen" —
    // Rest timer). The largest type on screen; nothing else uses this token.
    display: {
      fontSize: 32,
      fontWeight: '700' as const,
      lineHeight: 35,
      fontFamily: 'Archivo_800ExtraBold',
    },
    // Uppercase kicker / tertiary label role (new, D-02 typography extension).
    label: {
      fontSize: 10,
      fontWeight: '600' as const,
      letterSpacing: 1,
      textTransform: 'uppercase' as const,
      fontFamily: 'Archivo_600SemiBold',
    },
    // Screen/section title role (new).
    heading: {
      fontSize: 30,
      fontWeight: '800' as const,
      letterSpacing: -0.6,
      fontFamily: 'Archivo_800ExtraBold',
    },
  },
  // Zero radius everywhere (Phase 06.1, D-02/D-04 dark Modernist rendition) —
  // the Modernist language never rounds a corner.
  radius: {
    sm: 0,
    md: 0,
    lg: 0,
  },
} as const;

export type Theme = typeof theme;
