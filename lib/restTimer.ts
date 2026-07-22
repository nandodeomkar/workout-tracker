// Rest-timer notification scheduling wrapper (LOG-03/D-09).
//
// Thin `expo-notifications` wrapper — the one place in the app that talks
// to the OS notification scheduler. Not a pure function module (mirrors
// db/*.ts's I/O-wrapper shape, not lib/estimate1RM.ts's pure-function
// shape) — RESEARCH.md Pattern 3.
//
// Ordering is load-bearing (RESEARCH.md Pitfall 5): the notification
// channel MUST be created before `requestPermissionsAsync()` is ever
// called, or Android 13+ silently never shows the system permission
// dialog at all. `ensureNotificationChannel` is therefore always called
// first — by every caller, before `requestRestPermission`.
//
// Pitfall 6 (Android 14+ SCHEDULE_EXACT_ALARM may be denied even when the
// notification permission itself is granted) is NOT something this module
// can detect reliably from JS — surfaced instead via the UI-SPEC's
// non-blocking "Notifications are off" inline banner (RestTimerBar), never
// a crash or a blocking dialog. LOG-03 must never gate logging.

import * as Notifications from 'expo-notifications';

// Bumped from 'rest-timer' → 'rest-timer-v2': the original channel was created
// with `sound: 'default'`, which expo-notifications interprets as a *custom*
// sound file named "default" (→ "Custom sound 'default' not found" error).
// Android notification channels are immutable after creation, so correcting the
// sound config requires a fresh channel id, not just editing the old one.
const REST_TIMER_CHANNEL_ID = 'rest-timer-v2';

/**
 * Idempotently creates the Android notification channel used for rest-timer
 * alerts. MUST be called before `requestRestPermission` (Pitfall 5) — safe
 * to call multiple times; `setNotificationChannelAsync` upserts by id.
 */
export async function ensureNotificationChannel(): Promise<void> {
  // `sound` intentionally omitted → the channel uses the OS default
  // notification sound. Passing the string 'default' would make
  // expo-notifications search for a bundled custom sound file named "default"
  // and throw; `null` would make the channel silent.
  await Notifications.setNotificationChannelAsync(REST_TIMER_CHANNEL_ID, {
    name: 'Rest timer',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

/**
 * Requests notification permission. Must be called AFTER
 * `ensureNotificationChannel` (Pitfall 5). Returns whether permission is
 * granted; callers use this to decide whether to show the "Notifications
 * are off" inline banner — never to block logging (LOG-03).
 */
export async function requestRestPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Schedules a one-shot "rest complete" notification `seconds` from now via
 * a TIME_INTERVAL trigger (RESEARCH.md Pattern 3). Returns the scheduled
 * notification's id so the caller can cancel/reschedule it later.
 */
export async function scheduleRestNotification(seconds: number): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Rest complete',
      body: 'Time for your next set.',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: REST_TIMER_CHANNEL_ID,
    },
  });
}

/**
 * Cancels a previously-scheduled rest notification. No-op when `id` is
 * `null` (nothing outstanding to cancel) — lets callers pass the store's
 * `restNotificationId` directly without a null-check at every call site.
 */
export async function cancelRestNotification(id: string | null): Promise<void> {
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
}
