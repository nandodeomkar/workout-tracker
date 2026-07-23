// db/measurements.ts CRUD/history + validation-guard tests (MEAS-01/MEAS-02).

import { beforeEach, describe, expect, it } from 'vitest';

import { BUILT_IN_METRICS } from '../lib/measurementMetrics';
import {
  assertValidMeasuredAt,
  assertValidMeasurementValue,
  createCustomMetric,
  deleteReading,
  insertReading,
  insertReadingsForDate,
  loadLatestPerMetric,
  loadMetricDefinitions,
  loadReadingsForMetric,
  updateReading,
  upsertReadingForDate,
} from './measurements';
import { runSeedIfNeeded } from './seed/runSeed';
import { createTestDb } from './test/fixture';

describe('runSeedIfNeeded (metric_definitions)', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('seeds all 15 built-in metrics on a fresh database', async () => {
    await runSeedIfNeeded(db);

    const definitions = await loadMetricDefinitions(db);
    expect(definitions.length).toBe(BUILT_IN_METRICS.length);
    expect(definitions.every((d) => d.isCustom === false)).toBe(true);

    const keys = definitions.map((d) => d.metricKey).sort();
    const expectedKeys = BUILT_IN_METRICS.map((m) => m.metricKey).sort();
    expect(keys).toEqual(expectedKeys);
  });

  it('is idempotent: re-running does not duplicate metric_definitions rows', async () => {
    await runSeedIfNeeded(db);
    const firstCount = (await loadMetricDefinitions(db)).length;

    await runSeedIfNeeded(db);
    const secondCount = (await loadMetricDefinitions(db)).length;

    expect(secondCount).toBe(firstCount);
    expect(secondCount).toBe(BUILT_IN_METRICS.length);
  });
});

describe('assertValidMeasurementValue', () => {
  it('rejects NaN', () => {
    expect(() => assertValidMeasurementValue(NaN, 'weight')).toThrow();
  });

  it('rejects Infinity', () => {
    expect(() => assertValidMeasurementValue(Infinity, 'length')).toThrow();
  });

  it('rejects negative values', () => {
    expect(() => assertValidMeasurementValue(-1, 'percent')).toThrow();
  });

  it('caps weight at 1000kg', () => {
    expect(() => assertValidMeasurementValue(1001, 'weight')).toThrow();
    expect(assertValidMeasurementValue(1000, 'weight')).toBe(1000);
  });

  it('caps length at 300cm', () => {
    expect(() => assertValidMeasurementValue(301, 'length')).toThrow();
    expect(assertValidMeasurementValue(300, 'length')).toBe(300);
  });

  it('caps percent at 100', () => {
    expect(() => assertValidMeasurementValue(101, 'percent')).toThrow();
    expect(assertValidMeasurementValue(100, 'percent')).toBe(100);
  });
});

describe('assertValidMeasuredAt', () => {
  it('rejects a non-YYYY-MM-DD string', () => {
    expect(() => assertValidMeasuredAt('07/23/2026')).toThrow();
    expect(() => assertValidMeasuredAt('2026-07-23T10:00:00Z')).toThrow();
  });

  it('rejects a future date', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const futureDate = future.toISOString().slice(0, 10);
    expect(() => assertValidMeasuredAt(futureDate)).toThrow();
  });

  it('accepts today', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(assertValidMeasuredAt(today)).toBe(today);
  });
});

describe('insertReading / updateReading / deleteReading', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('inserts a reading and returns a new row with an id', async () => {
    const created = await insertReading(db, {
      metric: 'weight',
      value: 82.5,
      measuredAt: '2026-07-01',
      unitType: 'weight',
    });

    expect(created.id).toBeDefined();
    expect(created.value).toBe(82.5);
    expect(created.measuredAt).toBe('2026-07-01');
  });

  it('updates an existing reading value/date', async () => {
    const created = await insertReading(db, {
      metric: 'weight',
      value: 82.5,
      measuredAt: '2026-07-01',
      unitType: 'weight',
    });

    const updated = await updateReading(db, created.id, {
      value: 81,
      measuredAt: '2026-07-02',
      unitType: 'weight',
    });

    expect(updated.value).toBe(81);
    expect(updated.measuredAt).toBe('2026-07-02');
  });

  it('deletes a reading', async () => {
    const created = await insertReading(db, {
      metric: 'weight',
      value: 82.5,
      measuredAt: '2026-07-01',
      unitType: 'weight',
    });

    await deleteReading(db, created.id);

    const remaining = await loadReadingsForMetric(db, 'weight');
    expect(remaining).toHaveLength(0);
  });
});

describe('loadReadingsForMetric', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('returns only the given metric, ordered by measuredAt then id ascending', async () => {
    await insertReading(db, { metric: 'weight', value: 80, measuredAt: '2026-07-03', unitType: 'weight' });
    await insertReading(db, { metric: 'waist', value: 90, measuredAt: '2026-07-01', unitType: 'length' });
    await insertReading(db, { metric: 'weight', value: 79, measuredAt: '2026-07-01', unitType: 'weight' });
    await insertReading(db, { metric: 'weight', value: 78, measuredAt: '2026-07-02', unitType: 'weight' });

    const readings = await loadReadingsForMetric(db, 'weight');

    expect(readings).toHaveLength(3);
    expect(readings.map((r) => r.measuredAt)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
    expect(readings.every((r) => r.metric === 'weight')).toBe(true);
  });
});

describe('upsertReadingForDate', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('inserts a new row when no reading exists for that (metric, date)', async () => {
    const result = await upsertReadingForDate(db, {
      metric: 'weight',
      value: 80,
      measuredAt: '2026-07-01',
      unitType: 'weight',
    });

    expect(result.value).toBe(80);
    const all = await loadReadingsForMetric(db, 'weight');
    expect(all).toHaveLength(1);
  });

  it('updates the existing row when one already exists for that (metric, date)', async () => {
    await upsertReadingForDate(db, { metric: 'weight', value: 80, measuredAt: '2026-07-01', unitType: 'weight' });
    await upsertReadingForDate(db, { metric: 'weight', value: 81, measuredAt: '2026-07-01', unitType: 'weight' });

    const all = await loadReadingsForMetric(db, 'weight');
    expect(all).toHaveLength(1);
    expect(all[0]?.value).toBe(81);
  });
});

describe('insertReadingsForDate', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('inserts multiple metrics for one date in a single call', async () => {
    await insertReadingsForDate(db, '2026-07-01', [
      { metric: 'weight', value: 80, unitType: 'weight' },
      { metric: 'waist', value: 88, unitType: 'length' },
    ]);

    const weight = await loadReadingsForMetric(db, 'weight');
    const waist = await loadReadingsForMetric(db, 'waist');
    expect(weight).toHaveLength(1);
    expect(waist).toHaveLength(1);
  });

  it('updates in place on a repeat call for the same date (upsert semantics)', async () => {
    await insertReadingsForDate(db, '2026-07-01', [{ metric: 'weight', value: 80, unitType: 'weight' }]);
    await insertReadingsForDate(db, '2026-07-01', [{ metric: 'weight', value: 82, unitType: 'weight' }]);

    const weight = await loadReadingsForMetric(db, 'weight');
    expect(weight).toHaveLength(1);
    expect(weight[0]?.value).toBe(82);
  });
});

describe('createCustomMetric', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('persists a custom metric with its unit type at the next position (D-06)', async () => {
    await runSeedIfNeeded(db);

    await createCustomMetric(db, { metricKey: 'left_ankle', label: 'Left Ankle', unitType: 'length' });

    const definitions = await loadMetricDefinitions(db);
    const custom = definitions.find((d) => d.metricKey === 'left_ankle');

    expect(custom).toBeDefined();
    expect(custom?.label).toBe('Left Ankle');
    expect(custom?.unitType).toBe('length');
    expect(custom?.isCustom).toBe(true);
    expect(custom?.position).toBe(Math.max(...BUILT_IN_METRICS.map((m) => m.position)) + 1);
  });

  it('is a no-op on a duplicate metricKey', async () => {
    await createCustomMetric(db, { metricKey: 'left_ankle', label: 'Left Ankle', unitType: 'length' });
    await createCustomMetric(db, { metricKey: 'left_ankle', label: 'Renamed', unitType: 'weight' });

    const definitions = await loadMetricDefinitions(db);
    const matches = definitions.filter((d) => d.metricKey === 'left_ankle');

    expect(matches).toHaveLength(1);
    expect(matches[0]?.label).toBe('Left Ankle');
  });
});

describe('loadLatestPerMetric', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('returns the single most recent reading per metric', async () => {
    await insertReading(db, { metric: 'weight', value: 80, measuredAt: '2026-07-01', unitType: 'weight' });
    await insertReading(db, { metric: 'weight', value: 79, measuredAt: '2026-07-02', unitType: 'weight' });
    await insertReading(db, { metric: 'waist', value: 90, measuredAt: '2026-07-01', unitType: 'length' });

    const latest = await loadLatestPerMetric(db);

    const weightLatest = latest.find((r) => r.metric === 'weight');
    const waistLatest = latest.find((r) => r.metric === 'waist');
    expect(weightLatest?.measuredAt).toBe('2026-07-02');
    expect(waistLatest?.measuredAt).toBe('2026-07-01');
  });
});
