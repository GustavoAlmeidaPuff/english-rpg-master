import { NextRequest } from "next/server";
import { getOpenRouterClient } from "@/lib/openrouter";
import { DEFAULT_MODEL } from "@/lib/models";
import { retrieveContextBySource } from "@/lib/rag";
import { buildSystemPrompt, buildTutorSystemPrompt } from "@/lib/system-prompt";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { messages, model, mode, campaignId } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response("Invalid messages", { status: 400 });
    }

    const isTutor = mode === "tutor";
    const selectedModel = model || DEFAULT_MODEL;

    let systemPrompt: string;
    if (isTutor) {
      systemPrompt = buildTutorSystemPrompt();
    } else {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const query = lastUser?.content ?? "";

      // Retrieve lore + SRD chunks in parallel with campaign context fetch
      const [loreChunks, dndChunks, campaign] = await Promise.all([
        retrieveContextBySource(query, "lore", 5).catch(() => []),
        retrieveContextBySource(query, "DND.SRD.Wiki-main", 3).catch(() => []),
        campaignId
          ? prisma.campaign
              .findUnique({
                where: { id: campaignId },
                select: { worldScript: true, characterSheet: true },
              })
              .catch(() => null)
          : null,
      ]);

      const chunks = [...loreChunks, ...dndChunks];
      // historyLength: user messages only (determines if this is the opening scene)
      const userMsgCount = messages.filter((m: { role: string }) => m.role === "user").length;
      systemPrompt = buildSystemPrompt(chunks, campaign ?? undefined, userMsgCount);
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

    // Identify the last user message for saving
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");

    const encoder = new TextEncoder();
    let accumulated = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content ?? "";
            if (delta) {
              accumulated += delta;
              controller.enqueue(encoder.encode(delta));
            }
          }
        } finally {
          controller.close();

          if (campaignId && !isTutor && lastUserMsg) {
            persistMessages(campaignId, lastUserMsg.content, accumulated, selectedModel, messages.length);
          }
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

async function persistMessages(
  campaignId: string,
  userContent: string,
  assistantContent: string,
  model: string,
  historyLength: number
) {
  try {
    await prisma.message.createMany({
      data: [
        { campaignId, role: "user", content: userContent },
        { campaignId, role: "assistant", content: assistantContent },
      ],
    });

    const isFirst = historyLength <= 1;
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        model,
        updatedAt: new Date(),
        ...(isFirst && {
          name: userContent.slice(0, 40).trim() + (userContent.length > 40 ? "…" : ""),
        }),
      },
    });
  } catch (e) {
    console.error("[DB] Failed to persist messages:", e);
  }
}
