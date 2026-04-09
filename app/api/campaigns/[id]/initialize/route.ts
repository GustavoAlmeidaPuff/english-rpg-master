import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { getOpenRouterClient } from "@/lib/openrouter";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 300;

const ROOT = process.cwd();
const LORE_DIR = path.join(ROOT, "lore");

function collectMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectMarkdownFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".md")) results.push(full);
  }
  return results;
}

function readAllLore(): string {
  const files = collectMarkdownFiles(LORE_DIR);
  if (files.length === 0) return "";
  return files
    .map((f) => {
      const content = fs.readFileSync(f, "utf-8");
      const rel = path.relative(ROOT, f).replace(/\\/g, "/");
      return `### [${rel}]\n\n${content}`;
    })
    .join("\n\n---\n\n");
}

function parseJsonSafe(text: string): unknown {
  // Strip markdown code fences
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Try direct parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // Find outermost JSON object
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        // Last resort: truncated JSON — close open structures
        return JSON.parse(closeJson(cleaned.slice(start)));
      }
    }
    throw new Error("No JSON object found in response");
  }
}

/** Attempt to close a truncated JSON string by counting brackets/quotes. */
function closeJson(partial: string): string {
  let inString = false;
  let escape = false;
  const stack: string[] = [];

  for (const ch of partial) {
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
  }

  let closing = "";
  for (let i = stack.length - 1; i >= 0; i--) {
    closing += stack[i] === "{" ? "}" : "]";
  }
  return partial + closing;
}

async function callLLM(
  model: string,
  prompt: string,
  maxTokens: number,
  onChunk: (chunk: string) => void
): Promise<string> {
  const openrouter = getOpenRouterClient();
  const stream = await openrouter.chat.completions.create({
    model,
    stream: true,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.9,
    max_tokens: maxTokens,
  });

  let accumulated = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) {
      accumulated += delta;
      onChunk(delta);
    }
  }
  return accumulated;
}

function buildCampaignPrompt(loreContent: string): string {
  const loreSection = loreContent
    ? `## World Lore\n\n${loreContent}`
    : `## World Setting\nNo lore files found — create an original rich fantasy world.`;

  return `You are a master D&D 5e Dungeon Master and campaign designer.

${loreSection}

---

Create a LONG, EPIC D&D 5e campaign plan based on the world above.

Return ONLY raw JSON (no markdown, no code block):

{
  "title": "string",
  "synopsis": "string (3-4 paragraphs)",
  "mainObjective": "string",
  "acts": [
    { "title": "string", "synopsis": "string", "keyScenes": ["string", "string", "string"] }
  ],
  "plotTwists": [
    { "reveal": "string", "when": "string", "impact": "string" }
  ],
  "npcs": [
    { "name": "string", "role": "string", "appearance": "string", "personality": "string", "secret": "string", "motivation": "string", "relationToPlayer": "string" }
  ],
  "geography": [
    { "name": "string", "type": "string", "description": "string", "atmosphere": "string", "secrets": "string", "storyRole": "string" }
  ],
  "factions": [
    { "name": "string", "agenda": "string", "leader": "string", "relationToPlayer": "string", "internalConflict": "string" }
  ],
  "openingScene": "string (vivid DM narration in second person, 3-4 paragraphs, drops the player into immediate tension or action)"
}

Requirements:
- At least 3 acts, 6 plot twists, 10 NPCs, 7 locations, 3 factions
- Plot twists must be surprising and earned by the story
- NPCs must have compelling secrets and feel like real people
- The opening scene must be immersive — no \"you wake up\" clichés`;
}

function buildCharacterPrompt(loreContent: string, worldScript: string): string {
  let worldSummary = "";
  try {
    const w = JSON.parse(worldScript);
    worldSummary = `Campaign: ${w.title}\nSynopsis: ${w.synopsis}\nMain objective: ${w.mainObjective}`;
  } catch {
    worldSummary = worldScript.slice(0, 500);
  }

  return `You are a D&D 5e character designer.

${loreContent ? `## World Lore\n\n${loreContent}\n\n---\n\n` : ""}## Campaign Context
${worldSummary}

---

Create a complete D&D 5e Level 1 character who fits this world and has a personal stake in the campaign.

⚠️ CRITICAL RULES:
- Do NOT use the name, identity, or backstory of ANY character already mentioned in the world lore or campaign. The player character must be a BRAND NEW person who has NEVER appeared in any lore document or NPC list.
- Invent a completely original name that doesn't match any NPC in the campaign.
- Use standard array (15, 14, 13, 12, 10, 8) for ability scores, assigned to best fit the class
- Calculate HP correctly (max die + CON modifier at level 1)
- AC depends on armor worn + DEX modifier
- Backstory must connect personally to the campaign conflict but from a fresh perspective

Return ONLY raw JSON (no markdown, no code block):

{
  "name": "string",
  "race": "string",
  "subrace": "string or null",
  "class": "string",
  "subclass": "string or null",
  "level": 1,
  "background": "string",
  "alignment": "string",
  "appearance": "string (detailed physical description)",
  "personality": "string",
  "ideals": "string",
  "bonds": "string",
  "flaws": "string",
  "backstory": "string (3-4 paragraphs deeply tied to the campaign)",
  "attributes": {
    "strength": 0,
    "dexterity": 0,
    "constitution": 0,
    "intelligence": 0,
    "wisdom": 0,
    "charisma": 0
  },
  "savingThrowProficiencies": ["string"],
  "skillProficiencies": ["string"],
  "hp": 0,
  "ac": 0,
  "speed": 30,
  "initiative": 0,
  "proficiencyBonus": 2,
  "equipment": ["string"],
  "features": ["Feature Name: brief description"],
  "languages": ["string"],
  "toolProficiencies": ["string"],
  "weaponProficiencies": ["string"],
  "armorProficiencies": ["string"],
  "spells": null
}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { model: rawModel } = await req.json().catch(() => ({}));
  const model = rawModel || "google/gemma-4-26b-a4b-it:free";

  const encoder = new TextEncoder();
  let controllerClosed = false;

  const readable = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        if (!controllerClosed) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }
      }

      function close() {
        if (!controllerClosed) {
          controllerClosed = true;
          controller.close();
        }
      }

      try {
        // ── Step 1: Read lore ─────────────────────────────────────────────────
        send({ type: "log", message: "📚 Lendo arquivos de lore do mundo..." });
        const loreContent = readAllLore();
        const loreCount = collectMarkdownFiles(LORE_DIR).length;

        if (loreCount === 0) {
          send({ type: "log", message: "⚠️  Nenhum lore encontrado — gerando mundo original." });
        } else {
          send({ type: "log", message: `✅ ${loreCount} arquivo(s) de lore carregado(s).` });
        }

        // ── Step 2: Generate campaign script ──────────────────────────────────
        send({ type: "log", message: "🗺️  Gerando roteiro da campanha (atos, NPCs, plot twists)..." });
        send({ type: "thinking_start" });

        const campaignRaw = await callLLM(
          model,
          buildCampaignPrompt(loreContent),
          4000,
          (chunk) => send({ type: "stream", chunk })
        );

        send({ type: "thinking_end" });
        send({ type: "log", message: "🔍 Processando roteiro..." });

        let worldScript: unknown;
        try {
          worldScript = parseJsonSafe(campaignRaw);
        } catch (e) {
          send({ type: "error", message: `❌ Falha ao parsear roteiro: ${e instanceof Error ? e.message : e}` });
          close();
          return;
        }

        send({ type: "log", message: "✅ Roteiro gerado com sucesso!" });

        // ── Step 3: Generate character sheet ─────────────────────────────────
        send({ type: "log", message: "🧙 Criando seu personagem..." });
        send({ type: "thinking_start" });

        const characterRaw = await callLLM(
          model,
          buildCharacterPrompt(loreContent, JSON.stringify(worldScript)),
          2500,
          (chunk) => send({ type: "stream", chunk })
        );

        send({ type: "thinking_end" });
        send({ type: "log", message: "🔍 Processando ficha do personagem..." });

        let characterSheet: unknown;
        try {
          characterSheet = parseJsonSafe(characterRaw);
        } catch (e) {
          send({ type: "error", message: `❌ Falha ao parsear ficha: ${e instanceof Error ? e.message : e}` });
          close();
          return;
        }

        send({ type: "log", message: "✅ Personagem criado!" });

        // ── Step 4: Save to DB ────────────────────────────────────────────────
        send({ type: "log", message: "💾 Salvando no banco de dados..." });

        const campaignTitle = (worldScript as { title?: string })?.title ?? "Nova Campanha";

        await prisma.campaign.update({
          where: { id },
          data: {
            name: campaignTitle,
            model,
            initialized: true,
            worldScript: JSON.stringify(worldScript),
            characterSheet: JSON.stringify(characterSheet),
          },
        });

        send({ type: "log", message: "🎲 Campanha pronta! Entrando no mundo..." });
        send({ type: "done", campaignName: campaignTitle });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[initialize]", err);
        send({ type: "error", message: `❌ Erro inesperado: ${msg}` });
      } finally {
        close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
