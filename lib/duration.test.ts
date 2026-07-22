// D-10: elapsed-time formatting tests.

import { describe, expect, it } from 'vitest';

import { formatDurationMs } from './duration';

describe('formatDurationMs', () => {
  it('formats sub-minute durations as m:ss', () => {
    expect(formatDurationMs(45_000)).toBe('0:45');
  });

  it('formats multi-minute durations under an hour as m:ss', () => {
    expect(formatDurationMs(65 * 1000)).toBe('1:05');
  });

  it('formats exactly one hour as h:mm', () => {
    expect(formatDurationMs(60 * 60 * 1000)).toBe('1:00');
  });

  it('formats over an hour as h:mm', () => {
    expect(formatDurationMs(90 * 60 * 1000)).toBe('1:30');
  });

  it('clamps negative durations to zero', () => {
    expect(formatDurationMs(-500)).toBe('0:00');
  });

  it('handles zero without crashing', () => {
    expect(formatDurationMs(0)).toBe('0:00');
  });
});
