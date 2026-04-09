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
  const MAX_RETRIES = 2;
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= MAX_RETRIES) {
    try {
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
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt >= MAX_RETRIES;
      if (isLastAttempt) break;

      // Backoff curto para falhas transitórias (ex: 502/network lost em stream).
      const waitMs = 800 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      attempt += 1;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown LLM streaming error");
}

function buildCampaignPrompt(loreContent: string): string {
  const loreSection = loreContent
    ? `## World Lore (read carefully — every detail matters)\n\n${loreContent}`
    : `## World Setting\nNo lore files found. Invent a rich, original fantasy world with deep history.`;

  return `You are a legendary Dungeon Master, game designer, and storyteller. Your campaigns are worthy of novels and HBO series.

${loreSection}

---

## Your Mission

Design a COMPLETE, EPIC D&D 5e campaign rooted in the world lore above. This is not a generic adventure — it is a deeply personal story with real stakes, real relationships, and real consequences. Think Game of Thrones, The Witcher, and Critical Role all at once.

The campaign must feel hand-crafted for THIS world. Reference specific lore details, geography, gods, factions, and history from the source material.

---

## What to create

### Chronicle (the most important part)
A numbered, chronological list of ALL major events in the campaign — like a book outline. Each event must specify WHAT happens, WHERE, WHO is involved, and DM NOTES for when the player goes off-script. Include mandatory events (the story needs these) and optional events (triggered by player choices). The chronicle should have 15–25 events total.

### NPCs (minimum 12)
Every NPC must feel like a real person with their own life, agenda, and arc. Beyond personality and secrets, define:
- Their full arc: who are they at the start, how do they change, where do they end up?
- What kind of relationship they can form with the player (friend, rival, romance, mentor, enemy, traitor)?
- Their web of relationships with OTHER NPCs — not just the player
- when they are involved in the campaign, what they are doing, and how they are related to the player.

### Relationship Web
The beating heart of the campaign. Define at least:
- 2 potential ROMANCES (NPCs the player can pursue — include how they develop, what obstacles exist, what happens if the player commits or abandons them)
- 2 BETRAYALS (NPCs who will betray the player — when, why, and how it shatters the story)
- 1 INSEPARABLE FRIENDSHIP (an NPC who becomes the player's closest ally — their bond, what they share, what could break them apart)
- 2 MAJOR ENEMIES (antagonists the player will face repeatedly — include their escalating conflict)
- Other bonds: mentorships, family secrets, rivalries, complicated loyalties

### Sub-plots (minimum 2)
Side stories that run parallel to the main quest. The player can pursue or ignore them — but their consequences ripple into the main story. Examples: a rebellion brewing, a forbidden love affair between two NPCs, a cursed artifact changing the local town, a conspiracy within a trusted faction.

### Plot Twists (minimum 3)
Each twist must be genuinely surprising, earned by the story, and emotionally devastating. Not just "the villain was the ally all along" — go deeper. Include the exact moment it happens and the full emotional and strategic impact.

---

Return ONLY raw JSON. No markdown, no code block, no explanation. Just the JSON object.

{
  "title": "string",
  "tagline": "string (one punchy sentence that captures the soul of the campaign)",
  "themes": ["string"],
  "synopsis": "string (4-5 paragraphs — the full arc of the story, like a back-of-book summary)",
  "mainObjective": "string",
  "chronicle": [
    {
      "order": 1,
      "title": "string",
      "event": "string (what happens — be specific and vivid)",
      "when": "string (early game / mid game / late game / endgame)",
      "location": "string",
      "npcsInvolved": ["string"],
      "isMandatory": true,
      "dmNotes": "string (how to run this if the player is off-script, what triggers it, alternatives)"
    }
  ],
  "acts": [
    {
      "title": "string",
      "synopsis": "string",
      "chronicleRange": "string (e.g. events 1-7)",
      "mood": "string (tone of this act)",
      "keyScenes": ["string"]
    }
  ],
  "plotTwists": [
    {
      "title": "string",
      "reveal": "string",
      "when": "string (which chronicle event triggers this)",
      "impact": "string (emotional + strategic consequences)",
      "foreshadowing": "string (subtle hints the DM can drop earlier)"
    }
  ],
  "npcs": [
    {
      "name": "string",
      "role": "string",
      "appearance": "string",
      "personality": "string",
      "motivation": "string",
      "secret": "string",
      "arc": "string (how they change across the campaign)",
      "relationToPlayer": "string (how they start out with the player)",
      "canRomance": false,
      "willBetray": false,
      "isFriend": false,
      "isEnemy": false,
      "npcRelationships": [{"npc": "string", "nature": "string"}]
    }
  ],
  "relationships": [
    {
      "type": "romance|betrayal|friendship|rivalry|mentorship|enmity",
      "participants": ["string"],
      "description": "string (how this relationship forms and evolves)",
      "trigger": "string (what starts it — a specific moment or choice)",
      "development": "string (how it deepens over time)",
      "climax": "string (the defining moment of this relationship)",
      "outcome": "string (where it ends — multiple possible endings)"
    }
  ],
  "subplots": [
    {
      "title": "string",
      "description": "string",
      "npcsInvolved": ["string"],
      "howPlayerDiscoversIt": "string",
      "consequence_if_pursued": "string",
      "consequence_if_ignored": "string"
    }
  ],
  "geography": [
    {
      "name": "string",
      "type": "string",
      "description": "string",
      "atmosphere": "string",
      "secrets": "string",
      "storyRole": "string",
      "chronicleEvents": ["string (event titles set here)"]
    }
  ],
  "factions": [
    {
      "name": "string",
      "agenda": "string",
      "leader": "string",
      "internalConflict": "string",
      "relationToPlayer": "string",
      "canPlayerJoin": true,
      "consequence_if_allied": "string",
      "consequence_if_enemy": "string"
    }
  ],
  "openingScene": "string (vivid, immersive DM narration in second person — 4 paragraphs minimum, drops the player into immediate tension, references specific world details from the lore, no clichés)"
}`;
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
