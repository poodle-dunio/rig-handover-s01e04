import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Digest } from '../src/digest/types.js';

let runsDir: string;

beforeEach(() => {
  runsDir = mkdtempSync(join(process.cwd(), '.test-runs-'));
});

afterEach(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

function app() {
  return createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
}

function save(night: string, contents: string) {
  writeFileSync(join(runsDir, `${night}.jsonl`), contents);
}

describe('digest routes', () => {
  it('returns the same jobs in the same order in HTML and JSON', async () => {
    save('2026-10-28', [
      JSON.stringify({ at: '2026-10-29T01:00:00+01:00', job: 'zeta', status: 'fail', owner: null, error: 'failed' }),
      JSON.stringify({ at: '2026-10-29T02:00:00+01:00', job: 'alpha', status: 'ok', owner: 'rook' }),
    ].join('\n'));
    const page = await app().request('/digest/2026-10-28');
    const api = await app().request('/api/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(api.status).toBe(200);
    const html = await page.text();
    const digest = await api.json() as Digest;
    expect(digest.rows.map((row) => row.job)).toEqual(['alpha', 'zeta']);
    expect(html.indexOf('alpha')).toBeGreaterThan(-1);
    expect(html.indexOf('zeta')).toBeGreaterThan(html.indexOf('alpha'));
    expect(html).toContain('—');
  });

  it.each(['/digest/2026-10-30', '/api/digest/2026-10-30'])('returns 404 when %s has no file', async (path) => {
    expect((await app().request(path)).status).toBe(404);
  });

  it('renders an empty night and returns empty rows', async () => {
    save('2026-10-30', '');
    const page = await app().request('/digest/2026-10-30');
    const api = await app().request('/api/digest/2026-10-30');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(api.status).toBe(200);
    expect((await api.json() as Digest).rows).toEqual([]);
  });

  it('keeps a night with a bad line available and counts the bad line', async () => {
    save('2026-10-31', [
      JSON.stringify({ at: '2026-10-31T23:00:00+01:00', job: 'valid-job', status: 'ok', owner: 'rook' }),
      '{bad json',
    ].join('\n'));
    const page = await app().request('/digest/2026-10-31');
    const api = await app().request('/api/digest/2026-10-31');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('valid-job');
    expect(api.status).toBe(200);
    const digest = await api.json() as Digest;
    expect(digest.badLines).toBe(1);
    expect(digest.rows.map((row) => row.job)).toEqual(['valid-job']);
  });
});
