import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Digest, DigestRow, ReadNight } from './types.js';

type Entry = {
  at: string;
  job: string;
  status: DigestRow['lastStatus'];
  owner: string | null;
  error?: string;
};

function parseEntry(line: string): Entry | null {
  try {
    const value: unknown = JSON.parse(line);
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Record<string, unknown>;
    if (typeof record.at !== 'string' || Number.isNaN(Date.parse(record.at)) ||
        typeof record.job !== 'string' || !record.job ||
        (record.status !== 'ok' && record.status !== 'retry' && record.status !== 'fail') ||
        (typeof record.owner !== 'string' && record.owner !== null) ||
        (record.error !== undefined && typeof record.error !== 'string')) return null;
    return record as Entry;
  } catch {
    return null;
  }
}

export const readNight: ReadNight = (runsDir, night): Digest | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }

  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  const jobs = new Map<string, { row: DigestRow; lastErrorAt: number }>();
  let badLines = 0;
  const counts = { ok: 0, retry: 0, fail: 0 };

  for (const line of lines) {
    const entry = parseEntry(line);
    if (!entry) {
      badLines++;
      continue;
    }
    const time = Date.parse(entry.at);
    counts[entry.status]++;
    const existing = jobs.get(entry.job);
    if (!existing) {
      jobs.set(entry.job, {
        row: {
          job: entry.job, owner: entry.owner, runs: 1,
          retries: Number(entry.status === 'retry'), lastStatus: entry.status,
          lastError: entry.error ?? null, firstTime: entry.at, lastTime: entry.at,
        },
        lastErrorAt: entry.error === undefined ? -Infinity : time,
      });
      continue;
    }
    const { row } = existing;
    row.runs++;
    if (entry.status === 'retry') row.retries++;
    if (time < Date.parse(row.firstTime)) row.firstTime = entry.at;
    if (time >= Date.parse(row.lastTime)) {
      row.lastTime = entry.at;
      row.lastStatus = entry.status;
      row.owner = entry.owner;
    }
    if (entry.error !== undefined && time >= existing.lastErrorAt) {
      row.lastError = entry.error;
      existing.lastErrorAt = time;
    }
  }

  return { rows: [...jobs.values()].map(({ row }) => row).sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0), badLines, counts };
};
