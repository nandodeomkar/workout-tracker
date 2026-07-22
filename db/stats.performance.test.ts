// STAT-04 performance regression guard (Plan 04-06). Times the three stat
// query paths built in Plans 02-04 against a deterministic ~5-year / ~15,600
// -set synthetic history (db/test/syntheticHistory.ts), asserting each stays
// under a conservative ceiling. This is the data-layer half of "charts stay
// responsive with years of history" — it cannot prove Skia GPU frame time
// (see Task 3's on-device checkpoint), but it does catch an accidental N+1
// or unbounded scan regression in db/stats.ts (T-04-08).
//
// Duration excludes the one-time seed cost: seeding happens in beforeEach,
// only the query + pure-reduction pair is wrapped in performance.now().

import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDb } from './test/fixture';
import { seedSyntheticHistory } from './test/syntheticHistory';
import { loadAllHistorySets, loadExerciseChartSets, loadWeeklyVolumeSets } from './stats';
import { buildChartSeries } from '../lib/chartSeries';
import { buildWeeklyVolume } from '../lib/weeklyVolume';
import { computeAllTimeRecords } from '../lib/records';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe('stats query performance (STAT-04)', () => {
  let db: ReturnType<typeof createTestDb>['db'];
  let sampleExerciseId: number;

  beforeEach(() => {
    ({ db } = createTestDb());
    const summary = seedSyntheticHistory(db);
    sampleExerciseId = summary.sampleExerciseId;

    // Guards this whole suite against silently passing on a trivial/empty
    // dataset (Task 1/2 acceptance criteria: setCount >= 12000).
    expect(summary.workoutCount).toBeGreaterThanOrEqual(700);
    expect(summary.setCount).toBeGreaterThanOrEqual(12000);
  });

  it('Path 1 (smallest scope): per-exercise chart series stays well under the ceiling', async () => {
    const t0 = performance.now();
    const rows = await loadExerciseChartSets(db, sampleExerciseId);
    buildChartSeries(rows, 'e1rm');
    const ms = performance.now() - t0;

    expect(rows.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(200);
  });

  it('Path 2 (bounded window): 12-week volume-by-muscle-group stays well under the ceiling', async () => {
    const twelveWeeksAgoIso = new Date(Date.now() - 12 * 7 * MS_PER_DAY).toISOString();

    const t0 = performance.now();
    const rows = await loadWeeklyVolumeSets(db, twelveWeeksAgoIso);
    buildWeeklyVolume(rows, 12);
    const ms = performance.now() - t0;

    expect(ms).toBeLessThan(300);
  });

  it('Path 3 (worst case, all history): PR scan completes in under 500ms in Node', async () => {
    const t0 = performance.now();
    const rows = await loadAllHistorySets(db);
    computeAllTimeRecords(rows);
    const ms = performance.now() - t0;

    expect(rows.length).toBeGreaterThanOrEqual(12000);
    expect(ms).toBeLessThan(500);
  });
});
