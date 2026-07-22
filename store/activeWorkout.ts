// Ephemeral active-workout session state (D-15).
//
// SQLite is the sole source of truth for the active workout's actual data
// (sets, exercises, etc.) — this store holds ONLY session-scoped UI state
// that doesn't need to survive an app kill by itself. Every set write goes
// straight to SQLite (db/workouts.ts#insertSet) the instant checkmark is
// tapped, so a killed app loses at most the last un-logged keystroke; the
// session itself resumes from `findResumableWorkout` (db/workouts.ts), not
// by rehydrating this store.
//
// Do NOT add `persist` middleware (AsyncStorage/MMKV) here — that would
// create a second, driftable persistence layer competing with SQLite
// (RESEARCH.md Anti-Patterns).
//
// `restEndsAt` is stored as an absolute wall-clock timestamp (ms since
// epoch), never a decrementing counter, so the on-screen countdown (Plan 06)
// can recompute remaining time via `restEndsAt - Date.now()` and survive
// backgrounding/JS-timer throttling without drift (RESEARCH.md Pitfall 4).

import { create } from 'zustand';

export type ActiveWorkoutMode = 'logging' | 'editing';

interface ActiveWorkoutState {
  activeWorkoutId: number | null;
  mode: ActiveWorkoutMode;
  restEndsAt: number | null;
  restNotificationId: string | null;
  setActiveWorkout: (id: number, mode: ActiveWorkoutMode) => void;
  clearActiveWorkout: () => void;
  setRestEndsAt: (restEndsAt: number | null) => void;
  setRestNotificationId: (restNotificationId: string | null) => void;
}

export const useActiveWorkout = create<ActiveWorkoutState>((set) => ({
  activeWorkoutId: null,
  mode: 'logging',
  restEndsAt: null,
  restNotificationId: null,

  setActiveWorkout: (id, mode) => set({ activeWorkoutId: id, mode }),

  clearActiveWorkout: () =>
    set({ activeWorkoutId: null, mode: 'logging', restEndsAt: null, restNotificationId: null }),

  setRestEndsAt: (restEndsAt) => set({ restEndsAt }),

  setRestNotificationId: (restNotificationId) => set({ restNotificationId }),
}));
