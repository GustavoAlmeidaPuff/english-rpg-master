import fs from "fs";
import path from "path";

const ROOT = path.join(process.cwd());
const LORE_DIR = path.join(ROOT, "lore");
const DND_DIR = path.join(ROOT, "DND.SRD.Wiki-main");
const CACHE_FILE = path.join(ROOT, "data", "embeddings-cache.json");

const CHUNK_SIZE = 800; // approximate tokens (~3 chars/token)
const CHUNK_OVERLAP = 100;

export interface Chunk {
  text: string;
  source: string;
  embedding?: number[];
}

// In-memory singleton
let _index: Chunk[] | null = null;

// ─── Chunking ────────────────────────────────────────────────────────────────

function chunkText(text: string, source: string): Chunk[] {
  const words = text.split(/\s+/);
  const chunks: Chunk[] = [];
  const step = CHUNK_SIZE - CHUNK_OVERLAP;

  for (let i = 0; i < words.length; i += step) {
    const slice = words.slice(i, i + CHUNK_SIZE).join(" ");
    if (slice.trim().length > 50) {
      chunks.push({ text: slice, source });
    }
  }
  return chunks;
}

function collectMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

// ─── Embeddings ──────────────────────────────────────────────────────────────

async function embedBatch(texts: string[]): Promise<number[][]> {
  const { getOpenRouterClient, EMBEDDING_MODEL } = await import("./openrouter");
  const openrouter = getOpenRouterClient();
  const response = await openrouter.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return response.data.map((d) => d.embedding);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Build the embeddings cache from all markdown files.
 * Run via: npm run index
 */
export async function buildIndex(): Promise<void> {
  const files = [
    ...collectMarkdownFiles(LORE_DIR),
    ...collectMarkdownFiles(DND_DIR),
  ];

  console.log(`Found ${files.length} markdown files. Chunking...`);
  const allChunks: Chunk[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const rel = path.relative(ROOT, file);
    const chunks = chunkText(content, rel);
    allChunks.push(...chunks);
  }

  console.log(`Total chunks: ${allChunks.length}. Generating embeddings...`);

  const BATCH = 100;
  for (let i = 0; i < allChunks.length; i += BATCH) {
    const batch = allChunks.slice(i, i + BATCH);
    const texts = batch.map((c) => c.text);
    const embeddings = await embedBatch(texts);
    for (let j = 0; j < batch.length; j++) {
      allChunks[i + j].embedding = embeddings[j];
    }
    console.log(`  Embedded ${Math.min(i + BATCH, allChunks.length)} / ${allChunks.length}`);
  }

  const dataDir = path.join(ROOT, "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(allChunks));
  console.log(`Cache saved to ${CACHE_FILE}`);
}

/**
 * Load the cached index into memory (singleton).
 */
function loadIndex(): Chunk[] {
  if (_index) return _index;
  if (!fs.existsSync(CACHE_FILE)) {
    console.warn(
      "[RAG] No embeddings cache found. Run `npm run index` first. Returning empty context."
    );
    _index = [];
    return _index;
  }
  _index = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")) as Chunk[];
  return _index;
}

/**
 * Retrieve the top-K most relevant chunks for a given query,
 * optionally filtered by source prefix.
 */
export async function retrieveContextBySource(
  query: string,
  sourcePrefix: string,
  topK: number,
  queryEmbedding?: number[]
): Promise<Chunk[]> {
  const index = loadIndex();
  const filtered = index.filter(
    (c) => c.embedding && c.source.startsWith(sourcePrefix)
  );
  if (filtered.length === 0) return [];

  const [embedding] = queryEmbedding
    ? [queryEmbedding]
    : await embedBatch([query]);

  return filtered
    .map((c) => ({
      chunk: c,
      score: cosineSimilarity(embedding, c.embedding!),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.chunk);
}

/**
 * Retrieve the top-K most relevant chunks for a given query.
 */
export async function retrieveContext(
  query: string,
  topK = 8
): Promise<Chunk[]> {
  const index = loadIndex();
  if (index.length === 0) return [];

  const [queryEmbedding] = await embedBatch([query]);

  const scored = index
    .filter((c) => c.embedding)
    .map((c) => ({
      chunk: c,
      score: cosineSimilarity(queryEmbedding, c.embedding!),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map((s) => s.chunk);
}
