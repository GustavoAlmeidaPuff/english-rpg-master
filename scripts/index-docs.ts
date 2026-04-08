/**
 * Run with: npm run index
 *
 * This script reads all .md files from:
 *   - lore/          (your custom world lore books)
 *   - DND.SRD.Wiki-main/  (D&D 5e SRD rules)
 *
 * It chunks them, generates embeddings via OpenRouter, and saves the
 * result to data/embeddings-cache.json for use during RAG retrieval.
 *
 * Re-run whenever you add or update lore files.
 */

import path from "path";
import dotenv from "dotenv";

// Load .env.local
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

// Validate API key before doing anything
if (!process.env.OPENROUTER_API_KEY) {
  console.error(
    "\n❌  OPENROUTER_API_KEY is not set.\n" +
      "    Create a .env.local file with:\n\n" +
      "    OPENROUTER_API_KEY=sk-or-...\n"
  );
  process.exit(1);
}

import { buildIndex } from "../lib/rag";

(async () => {
  console.log("\n🗂️  RPG Master — Document Indexer\n");
  try {
    await buildIndex();
    console.log("\n✅  Indexing complete! You can now run `npm run dev`.\n");
  } catch (err) {
    console.error("\n❌  Indexing failed:", err);
    process.exit(1);
  }
})();
