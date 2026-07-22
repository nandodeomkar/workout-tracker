// Sticky bottom rest-timer bar (LOG-03/D-07/D-09, UI-SPEC "1. Active workout
// screen" — Rest timer).
//
// Drift-free countdown (RESEARCH.md Pitfall 4): remaining time is always
// `Math.max(0, restEndsAt - Date.now())`, recomputed on a 1s wall-clock
// interval — NEVER a decrementing state counter, which would desync after
// the JS thread is throttled while backgrounded. The parent screen owns
// `restEndsAt`/scheduling; this component is a pure countdown + controls
// renderer.

import { useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

interface RestTimerBarProps {
  /** Absolute wall-clock timestamp (ms since epoch) the rest ends at. */
  restEndsAt: number;
  /** Total configured rest duration (seconds) — used for the progress fill. */
  totalSeconds: number;
  /** Whether the notification permission is denied (shows the inline banner). */
  notificationsDenied: boolean;
  onSubtract15: () => void;
  onAdd15: () => void;
  onSkip: () => void;
}

function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function RestTimerBar({
  restEndsAt,
  totalSeconds,
  notificationsDenied,
  onSubtract15,
  onAdd15,
  onSkip,
}: RestTimerBarProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    // Recompute immediately on foreground so a backgrounded app doesn't show
    // a stale value for up to a full second after returning (Pitfall 4).
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNow(Date.now());
      }
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  const remainingMs = Math.max(0, restEndsAt - now);
  const countdownLabel = useMemo(() => formatCountdown(remainingMs), [remainingMs]);
  const progress = totalSeconds > 0 ? Math.min(1, Math.max(0, 1 - remainingMs / (totalSeconds * 1000))) : 1;
  const isDone = remainingMs <= 0;

  return (
    <View style={styles.bar}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {notificationsDenied ? (
        <Text style={styles.banner}>
          Notifications are off — the timer still counts down on screen, but won't alert you. Enable in
          system settings.
        </Text>
      ) : null}

      <View style={styles.controlsRow}>
        <Pressable
          onPress={onSubtract15}
          accessibilityRole="button"
          accessibilityLabel="Subtract 15 seconds"
          style={styles.sideControl}
        >
          <Text style={styles.sideControlText}>-15s</Text>
        </Pressable>

        <Text style={[styles.countdown, isDone ? styles.countdownDone : null]}>{countdownLabel}</Text>

        <View style={styles.rightControls}>
          <Pressable
            onPress={onAdd15}
            accessibilityRole="button"
            accessibilityLabel="Add 15 seconds"
            style={styles.sideControl}
          >
            <Text style={styles.sideControlText}>+15s</Text>
          </Pressable>
          <Pressable onPress={onSkip} accessibilityRole="button" accessibilityLabel="Skip rest" style={styles.skipControl}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    overflow: 'hidden',
  },
  progressTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: theme.colors.border,
  },
  progressFill: {
    height: 3,
    backgroundColor: theme.colors.accent,
  },
  banner: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideControl: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideControlText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  skipControl: {
    minHeight: 44,
    paddingHorizontal: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  countdown: {
    ...theme.typography.display,
    color: theme.colors.accent,
  },
  countdownDone: {
    opacity: 0.5,
  },
});
