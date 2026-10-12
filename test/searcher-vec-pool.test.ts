import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, it, vi } from 'vitest';

const vaultDir = mkdtempSync(path.join(tmpdir(), 'ohs-vec-pool-test-'));
process.env.OBSIDIAN_VAULT_PATH = vaultDir;

vi.mock('../src/embedder.js', () => ({
  embed: vi.fn((texts: string[]) => Promise.resolve<unknown[]>(texts.map(() => null))),
}));

const { closeDb, initVecTable, openDb, upsertNote } = await import('../src/db.js');
const { bumpIndexVersion, search } = await import('../src/searcher.js');
const { embed } = await import('../src/embedder.js');

// One note floods the KNN window with 120 near-identical chunks; the other is a single
// chunk that is strictly worse but still the second-best note in the vault. The pool is
// asked for 20 notes, so k = limit * 5 = 100 chunks — all of them the crowd note's.
const QUERY = new Float32Array([1, 0, 0, 0]);
const CROWD_EMBEDDING = new Float32Array([1, 0, 0, 0]); // cosine 1.00
const SINGLE_EMBEDDING = new Float32Array([0.9, 0.43588989, 0, 0]); // cosine 0.90

beforeAll(() => {
  openDb();
  initVecTable(4);
  upsertNote({
    path: 'vec-crowd.md',
    title: 'Vec Crowd',
    tags: [],
    content: 'crowd content',
    mtime: Date.now(),
    hash: 'hash-vec-crowd',
    chunks: Array.from({ length: 120 }, (_, i) => ({
      text: `crowd chunk ${i}`,
      embedding: CROWD_EMBEDDING,
    })),
  });
  upsertNote({
    path: 'vec-single.md',
    title: 'Vec Single',
    tags: [],
    content: 'single content',
    mtime: Date.now(),
    hash: 'hash-vec-single',
    chunks: [{ text: 'single chunk', embedding: SINGLE_EMBEDDING }],
  });
});

afterAll(() => {
  closeDb();
  rmSync(vaultDir, { recursive: true, force: true });
});

describe('semantic pool cutoff is per note, not per chunk', () => {
  it('grows the window until it holds `limit` distinct notes', async () => {
    vi.mocked(embed).mockResolvedValue([QUERY]);
    delete process.env.OBSIDIAN_VEC_PER_NOTE_CUTOFF;
    bumpIndexVersion();
    const results = await search('vec pool growth', { mode: 'semantic', limit: 20 });
    assert.deepEqual(
      results.map((r) => r.path),
      ['vec-crowd.md', 'vec-single.md'],
    );
  });

  it('OBSIDIAN_VEC_PER_NOTE_CUTOFF=0 restores the stock chunk-counted window', async () => {
    vi.mocked(embed).mockResolvedValue([QUERY]);
    process.env.OBSIDIAN_VEC_PER_NOTE_CUTOFF = '0';
    bumpIndexVersion();
    const results = await search('vec pool stock', { mode: 'semantic', limit: 20 });
    // Stock: the 100-chunk window is entirely crowd chunks, so the collapse leaves one
    // note in the pool and the single-chunk note is never reachable.
    assert.deepEqual(
      results.map((r) => r.path),
      ['vec-crowd.md'],
    );
    delete process.env.OBSIDIAN_VEC_PER_NOTE_CUTOFF;
  });
});
