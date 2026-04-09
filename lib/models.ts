/**
 * Model constants safe to import in both client and server components.
 * Keep this file free of any server-only dependencies (OpenAI SDK, fs, etc).
 */

export const POPULAR_MODELS = [
  { id: "google/gemma-3-4b-it:free", label: "Gemma 3 4B (free)" },
  { id: "google/gemma-3-12b-it:free", label: "Gemma 3 12B (free)" },
  { id: "google/gemma-3-27b-it:free", label: "Gemma 3 27B (free)" },
  { id: "google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B (free)" },
  { id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B (free)" },
  { id: "meta-llama/llama-3.2-3b-instruct:free", label: "Llama 3.2 3B (free)" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B (free)" },
  { id: "openai/gpt-oss-20b:free", label: "GPT-OSS 20B (free)" },
  { id: "openai/gpt-oss-120b:free", label: "GPT-OSS 120B (free)" },
  { id: "qwen/qwen3-next-80b-a3b-instruct:free", label: "Qwen3 Next 80B (free)" },
  { id: "qwen/qwen3-coder:free", label: "Qwen3 Coder (free)" },
  { id: "nvidia/nemotron-3-nano-30b-a3b:free", label: "Nemotron 3 Nano 30B (free)" },
  { id: "minimax/minimax-m2.5:free", label: "MiniMax M2.5 (free)" },
  { id: "mistralai/mistral-nemo", label: "Mistral Nemo" },
];

export const DEFAULT_MODEL = "mistralai/mistral-nemo";
