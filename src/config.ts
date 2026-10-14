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
  /**
   * Length-normalize the per-note BM25 score so equal matches score alike regardless of
   * file size. Off (0/false/no) restores the raw FTS5 bm25 score byte-for-byte.
   */
  get bm25LengthNorm(): boolean {
    const raw = process.env.OBSIDIAN_BM25_LENGTH_NORM?.trim().toLowerCase();
    return raw !== '0' && raw !== 'false' && raw !== 'no';
  },
  /** Exponent of the relative-length factor (chars / avgChars) ** exp applied to the score. */
  get bm25LengthExp(): number {
    const raw = Number(process.env.OBSIDIAN_BM25_LENGTH_EXP);
    return Number.isFinite(raw) ? raw : 0.5;
  },
  /**
   * Cut the semantic pool off per NOTE rather than per chunk: the KNN window is grown
   * until it holds `limit` distinct notes before the pool is trimmed. Off (0/false/no)
   * restores the upstream behaviour, where the pool is the top `limit * 5` chunks and a
   * note with many chunks can crowd the pool down to fewer distinct notes.
   */
  get vecPerNoteCutoff(): boolean {
    const raw = process.env.OBSIDIAN_VEC_PER_NOTE_CUTOFF?.trim().toLowerCase();
    return raw !== '0' && raw !== 'false' && raw !== 'no';
  },
  /**
   * Relative bump (e.g. 0.02 = +2%) applied to the fused score of the newest note in a
   * document series — notes sharing a normalised title (leading ISO date and trailing
   * version suffix stripped). Lifts the current version above the older ones it loses to,
   * without touching its siblings. 0/false/no disables it (upstream ranking).
   */
  get versionBoost(): number {
    const raw = process.env.OBSIDIAN_VERSION_BOOST?.trim().toLowerCase();
    if (raw === '0' || raw === 'false' || raw === 'no') return 0;
    const num = Number(process.env.OBSIDIAN_VERSION_BOOST);
    return Number.isFinite(num) && num > 0 ? num : 0.02;
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
