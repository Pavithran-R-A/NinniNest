import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Schema-shape guards for the REAL SQLite DDL.
 *
 * Motivation (found on the first real device run, 0.9.1): the fresh-install
 * CREATE TABLE for active_timers lacked the v2 columns (segments, lastSide),
 * which were only added by the v1→v2 migration — migrations never run on a
 * fresh v3 database, so every timer start failed with "no such column".
 * Upgrade-path tests could not catch a fresh-install defect; these source
 * assertions can. The repository writes are covered by the repo's own
 * device matrix as well.
 */

const REPO_SRC = readFileSync(
  fileURLToPath(new URL('../src/data/SqliteCareRepository.ts', import.meta.url)),
  'utf8'
);

describe('fresh-install SQLite schema shape (real DDL guard)', () => {
  it('active_timers CREATE TABLE includes every column addTimer writes', () => {
    const createMatch = REPO_SRC.match(/CREATE TABLE IF NOT EXISTS active_timers \(([\s\S]*?)\);/);
    expect(createMatch).not.toBeNull();
    const ddl = createMatch![1];
    for (const col of ['id', 'babyId', 'kind', 'startedAt', 'side', 'segments', 'lastSide', 'isDemo']) {
      expect(ddl).toMatch(new RegExp(`\\b${col}\\b`));
    }
  });

  it('the v2 column repair runs on EVERY init, not only during v1→v2 upgrades', () => {
    // The unconditional tail call repairs databases created directly at v3
    // whose active_timers table predates the columns (idempotent, PRAGMA-guarded).
    const ensureBody = REPO_SRC.match(/private async ensureSchema\(\): Promise<void> \{([\s\S]*?)\n  \}/);
    expect(ensureBody).not.toBeNull();
    const body = ensureBody![1];
    expect(body).toContain('await this.migrateV1toV2();');
    // It must appear AFTER the version-branch block, i.e. run for every init.
    const branchEnd = body.lastIndexOf('schema_version');
    const callAt = body.lastIndexOf('await this.migrateV1toV2();');
    expect(callAt).toBeGreaterThan(branchEnd);
  });

  it('every other CREATE TABLE still carries the columns its writes need', () => {
    // babies gained columns in v3; growth/milestones etc. were born complete.
    const babies = REPO_SRC.match(/CREATE TABLE IF NOT EXISTS babies \(([\s\S]*?)\);/);
    expect(babies![1]).toMatch(/\bphotoUri\b/);
    expect(babies![1]).toMatch(/\bpreferredUnits\b/);
  });
});
