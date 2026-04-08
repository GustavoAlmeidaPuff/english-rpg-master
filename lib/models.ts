/**
 * Model constants safe to import in both client and server components.
 * Keep this file free of any server-only dependencies (OpenAI SDK, fs, etc).
 */

export const POPULAR_MODELS = [
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { id: "anthropic/claude-3-haiku", label: "Claude 3 Haiku (fast)" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini (fast)" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
  { id: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B" },
  { id: "mistralai/mistral-nemo", label: "Mistral Nemo (free)" },
];

export const DEFAULT_MODEL = "anthropic/claude-3.5-sonnet";
