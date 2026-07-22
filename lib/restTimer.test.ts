// D-09/LOG-03: rest-timer scheduling wrapper tests.
//
// Mocks `expo-notifications` entirely (02-PATTERNS.md — the one new
// testing pattern this phase introduces) — this tests the helper contract
// (call shape, ordering, cancel no-op-on-null) not actual device delivery,
// which is the mandatory manual screen-off check (CLAUDE.md gotcha).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const scheduleNotificationAsync = vi.fn(async (_request: unknown) => 'scheduled-id-1');
const cancelScheduledNotificationAsync = vi.fn(async (_id: string) => undefined);
const setNotificationChannelAsync = vi.fn(async (_channelId: string, _config: unknown) => null);
const getPermissionsAsync = vi.fn(async () => ({ granted: false }));
const requestPermissionsAsync = vi.fn(async () => ({ granted: true }));

vi.mock('expo-notifications', () => ({
  scheduleNotificationAsync: (request: unknown) => scheduleNotificationAsync(request),
  cancelScheduledNotificationAsync: (id: string) => cancelScheduledNotificationAsync(id),
  setNotificationChannelAsync: (channelId: string, config: unknown) => setNotificationChannelAsync(channelId, config),
  getPermissionsAsync: () => getPermissionsAsync(),
  requestPermissionsAsync: () => requestPermissionsAsync(),
  AndroidImportance: { HIGH: 6 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

import {
  cancelRestNotification,
  ensureNotificationChannel,
  requestRestPermission,
  scheduleRestNotification,
} from './restTimer';

describe('restTimer', () => {
  beforeEach(() => {
    scheduleNotificationAsync.mockClear();
    cancelScheduledNotificationAsync.mockClear();
    setNotificationChannelAsync.mockClear();
    getPermissionsAsync.mockClear();
    requestPermissionsAsync.mockClear();
  });

  it('scheduleRestNotification schedules a TIME_INTERVAL trigger with the given seconds', async () => {
    const id = await scheduleRestNotification(90);

    expect(id).toBe('scheduled-id-1');
    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const request = scheduleNotificationAsync.mock.calls[0][0] as {
      content: { title: string; body: string };
      trigger: { type: string; seconds: number };
    };
    expect(request.trigger).toMatchObject({ type: 'timeInterval', seconds: 90 });
    expect(request.content.title).toBe('Rest complete');
  });

  it('cancelRestNotification(null) does nothing', async () => {
    await cancelRestNotification(null);
    expect(cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it("cancelRestNotification('x') cancels the scheduled notification by id", async () => {
    await cancelRestNotification('x');
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith('x');
  });

  it('ensureNotificationChannel is invoked before requestRestPermission (Pitfall 5 ordering)', async () => {
    const order: string[] = [];
    setNotificationChannelAsync.mockImplementationOnce(async () => {
      order.push('channel');
      return null;
    });
    requestPermissionsAsync.mockImplementationOnce(async () => {
      order.push('permission');
      return { granted: true };
    });

    await ensureNotificationChannel();
    await requestRestPermission();

    expect(order).toEqual(['channel', 'permission']);
  });

  it('requestRestPermission short-circuits when already granted, without re-prompting', async () => {
    getPermissionsAsync.mockResolvedValueOnce({ granted: true });

    const granted = await requestRestPermission();

    expect(granted).toBe(true);
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });
});
