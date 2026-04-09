import { NextRequest } from "next/server";
import { getOpenRouterClient } from "@/lib/openrouter";
import { DEFAULT_MODEL } from "@/lib/models";
import { retrieveContext } from "@/lib/rag";
import { buildSystemPrompt, buildTutorSystemPrompt } from "@/lib/system-prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { messages, model, mode } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response("Invalid messages", { status: 400 });
    }

    const isTutor = mode === "tutor";
    const selectedModel = model || DEFAULT_MODEL;

    let systemPrompt: string;
    if (isTutor) {
      systemPrompt = buildTutorSystemPrompt();
    } else {
      // Get the last user message for RAG retrieval
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const query = lastUser?.content ?? "";

      // Retrieve relevant context chunks
      let chunks: Awaited<ReturnType<typeof retrieveContext>> = [];
      try {
        chunks = await retrieveContext(query, 8);
      } catch (e) {
        console.warn("[RAG] Retrieval failed, continuing without context:", e);
      }
      systemPrompt = buildSystemPrompt(chunks);
    }

    // Stream response from OpenRouter
    const openrouter = getOpenRouterClient();
    const stream = await openrouter.chat.completions.create({
      model: selectedModel,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      temperature: 0.85,
      max_tokens: 2000,
    });

    // Return a ReadableStream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              controller.enqueue(encoder.encode(delta));
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("[/api/chat]", err);
    return new Response("Internal server error", { status: 500 });
  }
}
