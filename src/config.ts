import path from 'node:path';

export const DEFAULT_RERANKER_MODEL = 'onnx-community/gte-multilingual-reranker-base';

export const config = {
  get obsidianPrefix(): string {
    return process.env.OBSIDIAN_PREFIX ?? '';
  },
  get vaultPath(): string {
    const v = process.env.OBSIDIAN_VAULT_PATH;
    if (!v) throw new Error('OBSIDIAN_VAULT_PATH environment variable is required');
    return v;
  },
  get ignorePatterns(): string[] {
    return (process.env.OBSIDIAN_IGNORE_PATTERNS ?? '.obsidian/**,templates/**,*.canvas')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
  },
  get includePatterns(): string[] {
    return (process.env.OBSIDIAN_INCLUDE_PATTERNS ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
  },
  get respectGitignore(): boolean {
    const raw = process.env.OBSIDIAN_RESPECT_GITIGNORE?.trim().toLowerCase();
    return raw !== 'false' && raw !== '0' && raw !== 'no';
  },
  get apiKey(): string | undefined {
    return process.env.OPENAI_API_KEY;
  },
  get apiBaseUrl(): string {
    return process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
  },
  get apiModel(): string {
    return process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
  },
  get localModel(): string {
    return process.env.LOCAL_EMBEDDING_MODEL ?? 'Xenova/multilingual-e5-small';
  },
  get rerankerModel(): string {
    return process.env.RERANKER_MODEL ?? DEFAULT_RERANKER_MODEL;
  },
  /** Weight of the recency RRF arm. <= 0 removes the arm entirely (upstream behaviour). */
  get recencyWeight(): number {
    const raw = Number(process.env.OBSIDIAN_RECENCY_WEIGHT);
    return Number.isFinite(raw) ? raw : 0.75;
  },
  /** Only notes modified within this many days compete on freshness. 0 = no window. */
  get recencyWindowDays(): number {
    const raw = Number(process.env.OBSIDIAN_RECENCY_WINDOW_DAYS);
    return Number.isFinite(raw) ? raw : 90;
  },
  get dbPath(): string {
    const v = process.env.OBSIDIAN_VAULT_PATH;
    if (!v) throw new Error('OBSIDIAN_VAULT_PATH environment variable is required');
    return path.join(v, '.obsidian-hybrid-search.db');
  },
  // internal defaults
  chunkContextFallback: 512,
  chunkOverlap: 64,
  chunkMinLength: 50,
  chunkHeadingLevel: 0,
  batchSize: 10,
  debounce: 5_000,
};
