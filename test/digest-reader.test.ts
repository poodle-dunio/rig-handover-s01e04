import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('nightly run log reader', () => {
  it('aggregates the sample night and counts the bad line', () => {
    const digest = readNight('runs', '2026-10-28');
    expect(digest?.badLines).toBe(1);
    expect(digest?.rows.map((row) => row.job)).toEqual([
      'digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs',
    ]);
    expect(digest?.rows.find((row) => row.job === 'fixtures/refresh')).toEqual({
      job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3, lastStatus: 'ok',
      lastError: 'upstream 503', firstTime: '2026-10-29T01:30:00+01:00',
      lastTime: '2026-10-29T01:37:00+01:00',
    });
    expect(digest?.rows.find((row) => row.job === 'digest/render')?.owner).toBeNull();
    expect(digest?.rows.find((row) => row.job === 'notes/backup')?.lastStatus).toBe('fail');
  });

  it('returns null for a missing or invalid night', () => {
    expect(readNight('runs', '2000-01-01')).toBeNull();
    expect(readNight('runs', '../rig')).toBeNull();
  });
});
