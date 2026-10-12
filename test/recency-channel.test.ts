import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, it, vi } from 'vitest';

// ─── Vault setup (before any imports that read OBSIDIAN_VAULT_PATH) ──────────

const vaultDir = mkdtempSync(path.join(tmpdir(), 'ohs-recency-test-'));
process.env.OBSIDIAN_VAULT_PATH = vaultDir;

// No API key in CI: embedQuery() returns null, so the vector arm stays empty and the
// fixture only has to reason about BM25 + fuzzy title + recency.
vi.mock('../src/embedder.js', () => ({
  embed: vi.fn((texts: string[]) => Promise.resolve(texts.map(() => null))),
}));

const { closeDb, initVecTable, openDb, upsertNote } = await import('../src/db.js');
const { bumpIndexVersion, search } = await import('../src/searcher.js');

const fakeEmbedding = new Float32Array([0.1, 0.2, 0.3, 0.4]);
const DAY = 86_400_000;
const OLD_PATH = 'recency-old.md';
const NEW_PATH = 'recency-new.md';
const PROBE = 'RECENCYPROBE';

const prevWeight = process.env.OBSIDIAN_RECENCY_WEIGHT;
const prevWindow = process.env.OBSIDIAN_RECENCY_WINDOW_DAYS;

beforeAll(() => {
  delete process.env.OBSIDIAN_RECENCY_WEIGHT;
  delete process.env.OBSIDIAN_RECENCY_WINDOW_DAYS;
  openDb();
  initVecTable(4);

  // Identical title and body, different mtime: the text arms score them equally and
  // break the tie by index order (older first), so any change in their relative
  // position or score is attributable to the recency arm alone.
  for (const [notePath, hash, ageDays] of [
    [OLD_PATH, 'hash-recency-old', 30],
    [NEW_PATH, 'hash-recency-new', 1],
  ] as const) {
    upsertNote({
      path: notePath,
      title: 'Recency Probe',
      tags: [],
      content: `${PROBE} shared body text.`,
      mtime: Date.now() - ageDays * DAY,
      hash,
      chunks: [{ text: `${PROBE} shared body text.`, embedding: fakeEmbedding }],
    });
  }
});

afterAll(() => {
  closeDb();
  if (prevWeight === undefined) delete process.env.OBSIDIAN_RECENCY_WEIGHT;
  else process.env.OBSIDIAN_RECENCY_WEIGHT = prevWeight;
  if (prevWindow === undefined) delete process.env.OBSIDIAN_RECENCY_WINDOW_DAYS;
  else process.env.OBSIDIAN_RECENCY_WINDOW_DAYS = prevWindow;
  rmSync(vaultDir, { recursive: true, force: true });
});

async function probe(env: { weight?: string; window?: string } = {}) {
  if (env.weight === undefined) delete process.env.OBSIDIAN_RECENCY_WEIGHT;
  else process.env.OBSIDIAN_RECENCY_WEIGHT = env.weight;
  if (env.window === undefined) delete process.env.OBSIDIAN_RECENCY_WINDOW_DAYS;
  else process.env.OBSIDIAN_RECENCY_WINDOW_DAYS = env.window;
  bumpIndexVersion();
  try {
    return await search(PROBE);
  } finally {
    delete process.env.OBSIDIAN_RECENCY_WEIGHT;
    delete process.env.OBSIDIAN_RECENCY_WINDOW_DAYS;
  }
}

const scoreOf = (results: Awaited<ReturnType<typeof probe>>, notePath: string): number => {
  const hit = results.find((r) => r.path === notePath);
  assert.ok(hit, `expected ${notePath} in results`);
  return hit.score;
};

describe('recency ranking channel', () => {
  it('raises the fresher note score and lowers the older one at the default weight', async () => {
    const off = await probe({ weight: '0' });
    const on = await probe();
    assert.deepEqual(new Set(on.map((r) => r.path)), new Set([OLD_PATH, NEW_PATH]));
    assert.ok(
      scoreOf(on, NEW_PATH) > scoreOf(off, NEW_PATH),
      `fresher note should gain (${scoreOf(on, NEW_PATH)} vs ${scoreOf(off, NEW_PATH)})`,
    );
    assert.ok(
      scoreOf(on, OLD_PATH) < scoreOf(off, OLD_PATH),
      `older note should lose (${scoreOf(on, OLD_PATH)} vs ${scoreOf(off, OLD_PATH)})`,
    );
  });

  it('overtakes the older note once the weight dominates', async () => {
    const off = await probe({ weight: '0' });
    const on = await probe({ weight: '5' });
    // Baseline order comes from the text arms (older note first); a dominant recency
    // weight reverses it. This pins the DIRECTION of the channel.
    assert.equal(off[0]!.path, OLD_PATH);
    assert.equal(on[0]!.path, NEW_PATH);
  });

  it('never invents hits: a query matching no note still returns nothing', async () => {
    delete process.env.OBSIDIAN_RECENCY_WEIGHT;
    bumpIndexVersion();
    // 'zzzqqqxxx' shares no trigram with the fixture, so every text arm is empty and
    // the recency arm has no retrieved pool to re-rank — it must not fill the list.
    assert.deepEqual(await search('zzzqqqxxx'), []);
  });

  it('window removes the stale note from the arm without hiding it from search', async () => {
    const wide = await probe({ window: '90' });
    const narrow = await probe({ window: '7' });
    assert.deepEqual(new Set(narrow.map((r) => r.path)), new Set([OLD_PATH, NEW_PATH]));
    assert.equal(scoreOf(narrow, NEW_PATH), scoreOf(wide, NEW_PATH));
    assert.ok(
      scoreOf(narrow, OLD_PATH) < scoreOf(wide, OLD_PATH),
      `windowed stale note should lose its boost (${scoreOf(narrow, OLD_PATH)} vs ${scoreOf(wide, OLD_PATH)})`,
    );
  });
});
