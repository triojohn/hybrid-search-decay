import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      VAULT_PATH: '/tmp/test-vault',
      // Fixtures are micro-corpora (notes of 15-113 chars) where corpus-relative length
      // de-biasing is meaningless: at a ~3x-average ratio it reorders near-ties that the
      // raw BM25 order deliberately settled. Pin the legacy behaviour for the suite and
      // let the dedicated length-normalization test opt in per case. Production default
      // stays ON (config.bm25LengthNorm).
      OBSIDIAN_BM25_LENGTH_NORM: '0',
    },
    maxWorkers: 1,
    testTimeout: 30_000,
    isolate: false,
    // Runs before every test file: clears the module registry the files share under
    // `isolate: false`, so none of them inherits another file's vault binding.
    setupFiles: ['./test/setup-module-isolation.ts'],
    include: ['test/**/*.test.ts'],
    // integration.test.ts needs a real embedder; indexer-watcher-live-e2e.test.ts
    // runs a real (unmocked) chokidar watcher whose shared module state would
    // leak into the isolate:false suite — both run standalone via their own
    // npm scripts (test:integration / test:e2e-watcher).
    exclude: [
      'test/integration.test.ts',
      'test/indexer-watcher-live-e2e.test.ts',
      'test/reranker-real-model.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      thresholds: {
        lines: 71,
        functions: 77,
        branches: 55,
      },
    },
  },
});
