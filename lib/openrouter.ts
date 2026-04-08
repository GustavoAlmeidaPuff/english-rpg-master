/**
 * Server-only OpenRouter client.
 * Do NOT import this file in client components ("use client").
 */
import OpenAI from "openai";

export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? "openai/text-embedding-3-small";

// Re-export for convenience
export { POPULAR_MODELS, DEFAULT_MODEL } from "./models";

/** Lazy singleton — created on first use so build-time imports don't throw. */
let _client: OpenAI | null = null;

export function getOpenRouterClient(): OpenAI {
  if (_client) return _client;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing OPENROUTER_API_KEY. Create a .env.local file based on .env.local.example."
    );
  }

  _client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    defaultHeaders: {
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": process.env.APP_TITLE ?? "RPG Master",
    },
  });

  return _client;
}
