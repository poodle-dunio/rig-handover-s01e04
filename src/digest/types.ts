export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: 'ok' | 'retry' | 'fail';
  lastError: string | null;
  firstTime: string;
  lastTime: string;
};

export type Digest = { rows: DigestRow[]; badLines: number; counts: Record<DigestRow['lastStatus'], number> };
export type ReadNight = (runsDir: string, night: string) => Digest | null;
