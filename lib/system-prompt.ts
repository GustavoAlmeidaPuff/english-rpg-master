import type { Chunk } from "./rag";

export function buildTutorSystemPrompt(): string {
  return `You are a helpful English tutor and D&D companion assistant. The player is a Brazilian Portuguese speaker learning English while playing a D&D RPG.

The player will ask you quick questions about the DM's narrative — typically about the meaning of English words or phrases, grammar, or story/lore details.

## Your job
- Answer in **Brazilian Portuguese** unless the player explicitly asks otherwise.
- Be concise and clear. This is a quick aside during a game session, not a lesson.
- If the question is about a word or phrase: give a simple definition, how to pronounce it (optional), and a quick example of usage.
- If the question is about story context or a character: explain briefly based on the conversation so far.
- If the question is about D&D rules or concepts: explain in simple terms.
- Do NOT continue the game narrative. Do NOT write new story content.
- Do NOT include any feedback XML tags.
- Keep answers short — 1 to 4 sentences is ideal.`;
}

/**
 * This string is appended to every user message so the model sees it LAST
 * (high recency weight) and adds feedback AFTER writing the narrative.
 * Keeping it out of the system prompt prevents the model from starting with it.
 */
export const FEEDBACK_INJECTION = `

---
[After your in-character DM narrative above, append a short English feedback block in Brazilian Portuguese using this exact format:]
<feedback>
1. ✅ O que foi bom: destaque o que o jogador escreveu bem.
2. ✏️ Correções: aponte erros (gramática, vocabulário, tempo verbal). Mostre a versão corrigida.
3. 💬 Mais natural: como um nativo diria a mesma coisa.
4. 📝 Dica: uma dica rápida sobre inglês, relacionada à mensagem.
Seja encorajador e específico. Se estiver perfeito, diga isso e dê vocabulário avançado de RPG.
</feedback>`;

interface CampaignContext {
  worldScript?: string | null;
  characterSheet?: string | null;
}

/** Compact summary — targets ~600 tokens max */
function formatWorldScript(raw: string, isOpening: boolean): string {
  try {
    const w = JSON.parse(raw);
    const lines: string[] = [];

    lines.push(`CAMPAIGN: "${w.title}"`);
    lines.push(`OBJECTIVE: ${w.mainObjective}`);

    if (w.synopsis) {
      const short = w.synopsis.length > 300 ? w.synopsis.slice(0, 300) + "…" : w.synopsis;
      lines.push(`SYNOPSIS: ${short}`);
    }

    if (Array.isArray(w.acts) && w.acts.length > 0) {
      lines.push(`ACTS: ${w.acts.map((a: { title: string }) => a.title).join(" → ")}`);
    }

    if (Array.isArray(w.plotTwists) && w.plotTwists.length > 0) {
      lines.push("PLOT TWISTS (SECRET — never reveal directly):");
      for (const pt of w.plotTwists) {
        lines.push(`  • [${pt.when}] ${String(pt.reveal).slice(0, 120)}`);
      }
    }

    if (Array.isArray(w.npcs) && w.npcs.length > 0) {
      lines.push("NPCs:");
      for (const npc of w.npcs) {
        lines.push(
          `  • ${npc.name} (${npc.role}) | ${String(npc.personality).slice(0, 60)} | SECRET: ${String(npc.secret).slice(0, 80)}`
        );
      }
    }

    if (Array.isArray(w.geography) && w.geography.length > 0) {
      lines.push("LOCATIONS:");
      for (const loc of w.geography) {
        lines.push(`  • ${loc.name} (${loc.type}): ${String(loc.description).slice(0, 80)}`);
      }
    }

    if (Array.isArray(w.factions) && w.factions.length > 0) {
      lines.push("FACTIONS:");
      for (const f of w.factions) {
        lines.push(`  • ${f.name} — ${String(f.agenda).slice(0, 80)} [Leader: ${f.leader}]`);
      }
    }

    if (isOpening && w.openingScene) {
      lines.push(`\nOPENING SCENE — narrate this for the player's very first message:\n${w.openingScene}`);
    }

    return lines.join("\n");
  } catch {
    return raw.slice(0, 800);
  }
}

/** Compact character block — ~200 tokens */
function formatCharacterSheet(raw: string): string {
  try {
    const c = JSON.parse(raw);
    const a = c.attributes ?? {};
    function mod(s: number) {
      const m = Math.floor((s - 10) / 2);
      return m >= 0 ? `+${m}` : `${m}`;
    }
    return `PLAYER CHARACTER: ${c.name} | ${[c.subrace, c.race].filter(Boolean).join(" ")} ${[c.class, c.subclass].filter(Boolean).join("/")} Lv${c.level} | ${c.background} | ${c.alignment}
STATS: STR${a.strength}(${mod(a.strength)}) DEX${a.dexterity}(${mod(a.dexterity)}) CON${a.constitution}(${mod(a.constitution)}) INT${a.intelligence}(${mod(a.intelligence)}) WIS${a.wisdom}(${mod(a.wisdom)}) CHA${a.charisma}(${mod(a.charisma)})
HP:${c.hp} AC:${c.ac} Speed:${c.speed}ft Prof:+${c.proficiencyBonus}
SAVES: ${(c.savingThrowProficiencies ?? []).join(", ")}
SKILLS: ${(c.skillProficiencies ?? []).join(", ")}
GEAR: ${(c.equipment ?? []).join(", ")}
PERSONALITY: ${c.personality} | IDEALS: ${c.ideals} | BONDS: ${c.bonds} | FLAWS: ${c.flaws}`;
  } catch {
    return raw.slice(0, 400);
  }
}

export function buildSystemPrompt(
  chunks: Chunk[],
  campaign?: CampaignContext,
  historyLength = 0
): string {
  const hasCampaign = !!(campaign?.worldScript);
  const isOpening = historyLength <= 1;

  const dndChunks = chunks.filter((c) => !c.source.startsWith("lore")).slice(0, 2);
  const loreChunks = hasCampaign ? [] : chunks.filter((c) => c.source.startsWith("lore"));

  const dndContext =
    dndChunks.length > 0
      ? dndChunks.map((c) => `[${c.source}]\n${c.text}`).join("\n\n---\n\n")
      : "(No D&D rules context retrieved.)";

  const loreContext =
    loreChunks.length > 0
      ? loreChunks.map((c) => `[${c.source}]\n${c.text}`).join("\n\n---\n\n")
      : hasCampaign
      ? "(Lore is embedded in the campaign notes above.)"
      : "(No lore context retrieved.)";

  const campaignBlock = hasCampaign
    ? `\n\n## DM Notes — Campaign & World (private, never dump directly to player)\n${formatWorldScript(campaign!.worldScript!, isOpening)}`
    : "";

  const characterBlock = campaign?.characterSheet
    ? `\n\n## Player Character\n${formatCharacterSheet(campaign.characterSheet)}`
    : "";

  const openingInstruction =
    hasCampaign && isOpening
      ? `\n\n⚠️ OPENING: Narrate the Opening Scene from the campaign notes. Do NOT ask the player to introduce themselves — address them directly as ${(() => { try { return JSON.parse(campaign!.characterSheet ?? "{}").name ?? "the adventurer"; } catch { return "the adventurer"; } })()}.`
      : "";

  return `You are an expert, immersive Dungeon Master running a D&D 5e campaign.

Your response has two parts — always in this order:
1. DM NARRATIVE: 2–4 paragraphs in English, second person, fully in character.
2. ENGLISH FEEDBACK: in Brazilian Portuguese, inside feedback tags (instructions come at the end of the player's message).

Rules:
- Never start your response with a feedback tag — narrative always comes first.
- Narrate in second person ("You see…", "You hear…").
- React to player choices with real consequences.
- For dice rolls, use the player's actual stats.
- Never list options — let the player decide freely.
- Always address the player by their character's name.${openingInstruction}${campaignBlock}${characterBlock}

## D&D 5e Rules
${dndContext}

## World Lore
${loreContext}`;
}
