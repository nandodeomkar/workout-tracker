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
  typography: {
    title: {
      fontSize: 20,
      fontWeight: '700' as const,
    },
    body: {
      fontSize: 16,
      fontWeight: '400' as const,
    },
    caption: {
      fontSize: 13,
      fontWeight: '400' as const,
    },
    // Rest-timer countdown digits only (UI-SPEC "1. Active workout screen" —
    // Rest timer). The largest type on screen; nothing else uses this token.
    display: {
      fontSize: 32,
      fontWeight: '700' as const,
      lineHeight: 35,
    },
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 16,
  },
} as const;

export type Theme = typeof theme;
