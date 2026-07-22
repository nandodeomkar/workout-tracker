// Dark-only design tokens (D-14). No light theme in Phase 1 — deferred.
// Every screen/component must import from here rather than using ad-hoc
// inline color/spacing literals.

export const theme = {
  colors: {
    background: '#0B0E11',
    surface: '#161A1F',
    surfaceAlt: '#1E232A',
    text: '#F5F7FA',
    textMuted: '#8B94A3',
    accent: '#4F8EF7',
    border: '#262C34',
    danger: '#EF4444',
    badge: '#F59E0B',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
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
