import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, it, vi } from 'vitest';

// ─── Vault setup (before any imports that read OBSIDIAN_VAULT_PATH) ──────────

const vaultDir = mkdtempSync(path.join(tmpdir(), 'ohs-version-boost-test-'));
process.env.OBSIDIAN_VAULT_PATH = vaultDir;

// No API key in CI: embedQuery() returns null, so the vector arm stays empty.
vi.mock('../src/embedder.js', () => ({
  embed: vi.fn((texts: string[]) => Promise.resolve(texts.map(() => null))),
}));

const { bumpIndexVersion, search, seriesKey } = await import('../src/searcher.js');
const { closeDb, initVecTable, openDb, upsertNote } = await import('../src/db.js');

const fakeEmbedding = new Float32Array([0.1, 0.2, 0.3, 0.4]);
const PROBE = 'SERIESPROBE';
const OLDEST = '2026-09-14-team-eff-review-v2.md';
const MIDDLE = '2026-09-28-team-eff-review-v2.md';
const NEWEST = '2026-10-12-team-eff-review-v2.md';

const prevBoost = process.env.OBSIDIAN_VERSION_BOOST;
const prevRecency = process.env.OBSIDIAN_RECENCY_WEIGHT;

beforeAll(() => {
  delete process.env.OBSIDIAN_VERSION_BOOST;
  openDb();
  initVecTable(4);

  // Three versions of one report. The newest is the SHORTEST match (one probe hit vs
  // three), which is exactly the real-world shape: a freshly rewritten note scores below
  // its older, more repetitive siblings on BM25 alone.
  for (const [notePath, hash, hits] of [
    [OLDEST, 'hash-series-oldest', 3],
    [MIDDLE, 'hash-series-middle', 2],
    [NEWEST, 'hash-series-newest', 1],
  ] as const) {
    upsertNote({
      path: notePath,
      title: `Series Report ${hits}`,
      tags: [],
      content: Array.from({ length: hits }, () => `${PROBE} body text.`).join(' '),
      mtime: Date.now(),
      hash,
      chunks: [{ text: `${PROBE} body text.`, embedding: fakeEmbedding }],
    });
  }
});

afterAll(() => {
  closeDb();
  if (prevBoost === undefined) delete process.env.OBSIDIAN_VERSION_BOOST;
  else process.env.OBSIDIAN_VERSION_BOOST = prevBoost;
  if (prevRecency === undefined) delete process.env.OBSIDIAN_RECENCY_WEIGHT;
  else process.env.OBSIDIAN_RECENCY_WEIGHT = prevRecency;
  rmSync(vaultDir, { recursive: true, force: true });
});

async function probe(boost?: string) {
  if (boost === undefined) delete process.env.OBSIDIAN_VERSION_BOOST;
  else process.env.OBSIDIAN_VERSION_BOOST = boost;
  // The recency arm is a separate mechanism and would give the (equal-mtime) siblings a
  // rank order of its own; off here so any movement is attributable to the version boost.
  process.env.OBSIDIAN_RECENCY_WEIGHT = '0';
  bumpIndexVersion();
  try {
    return await search(PROBE);
  } finally {
    delete process.env.OBSIDIAN_VERSION_BOOST;
    delete process.env.OBSIDIAN_RECENCY_WEIGHT;
  }
}

const rankIn = (results: Awaited<ReturnType<typeof probe>>, notePath: string): number => {
  const index = results.findIndex((r) => r.path === notePath);
  assert.ok(index >= 0, `expected ${notePath} in results`);
  return index;
};

describe('document-series version boost', () => {
  it('leaves the order untouched when the boost is off', async () => {
    const off = await probe('0');
    assert.ok(rankIn(off, NEWEST) > rankIn(off, MIDDLE));
    assert.ok(rankIn(off, MIDDLE) > rankIn(off, OLDEST));
  });

  it('lifts the newest version above every sibling at the default boost', async () => {
    const off = await probe('0');
    const on = await probe();
    assert.equal(rankIn(on, NEWEST), 0);
    // The fused score saturates at 1, so the newest can tie the old leader — it must not
    // end up below it.
    assert.ok(on[0]!.score >= off[rankIn(off, OLDEST)]!.score);
    // Siblings keep their own scores — only the newest is bumped.
    for (const sibling of [OLDEST, MIDDLE]) {
      assert.equal(
        on.find((r) => r.path === sibling)!.score,
        off.find((r) => r.path === sibling)!.score,
      );
    }
  });
});

describe('series key normalisation', () => {
  it('strips the leading date and the trailing version suffix', () => {
    assert.equal(seriesKey(OLDEST), 'team-eff-review');
    assert.equal(seriesKey(NEWEST), 'team-eff-review');
    assert.equal(seriesKey('notes/2026-10-12_team-eff-review(2).md'), 'team-eff-review');
    assert.equal(seriesKey('2026-10-12 team-eff-review v3.md'), 'team-eff-review');
  });

  it('does not group a filename that is only a date', () => {
    assert.equal(seriesKey('2026-10-12.md'), null);
    assert.equal(seriesKey('notes/2026-10-12.md'), null);
  });
});
