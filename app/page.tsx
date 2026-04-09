"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ChatMessage, { Message } from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import SelectionChat from "@/components/SelectionChat";
import CampaignSidebar, { Campaign } from "@/components/CampaignSidebar";
import InitializationScreen from "@/components/InitializationScreen";
import CharacterSheet from "@/components/CharacterSheet";
import { DEFAULT_MODEL } from "@/lib/models";

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: `Welcome, adventurer! ⚔️

I am your Dungeon Master. The world around you breathes with ancient magic and untold dangers. Your story begins now.

Before we start, tell me — who are you? Describe your character (name, race, class, and a bit of your backstory), or simply tell me where you are and what you're doing. The adventure awaits!

*[Feel free to write in English — I'll give you feedback on your writing after each exchange to help you improve!]*

<feedback>
Bem-vindo! 🎉

Ainda não há nada para analisar — você ainda não escreveu nada em inglês. Assim que você mandar sua primeira mensagem, vou comentar sobre o seu inglês aqui neste painel.

**💡 Dica para começar:** Tente se apresentar em inglês! Por exemplo:
*"My name is [nome]. I am a [raça] [classe]. I am standing at the gates of a mysterious city..."*

Não tenha medo de errar — é errando que se aprende! 🚀
</feedback>`,
};

const INIT_MESSAGE: Message = {
  id: "init-waiting",
  role: "assistant",
  content: `*The world is being forged...*

Your story is almost ready. Send your first message to begin — the Dungeon Master will open the scene and introduce you to the world.

<feedback>
Sua campanha foi criada! A IA já conhece o roteiro completo, os NPCs e a ficha do seu personagem.

**▶️ Para começar:** Escreva qualquer coisa em inglês para dar início à aventura. O DM vai te colocar diretamente na cena de abertura!

*Dica: você pode apertar o botão "📜 Ficha" no cabeçalho para ver os atributos e história do seu personagem.*
</feedback>`,
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [loading, setLoading] = useState(false);
  const [selectionPopup, setSelectionPopup] = useState<{ text: string } | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);

  // Campaign state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [currentCampaignId, setCurrentCampaignId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Initialization flow
  const [initializingCampaignId, setInitializingCampaignId] = useState<string | null>(null);

  // Character sheet
  const [characterSheet, setCharacterSheet] = useState<object | null>(null);
  const [showCharacterSheet, setShowCharacterSheet] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Campaign helpers ────────────────────────────────────────────────────────

  async function fetchCampaigns(): Promise<Campaign[]> {
    const res = await fetch("/api/campaigns");
    return res.json();
  }

  async function loadCampaignMessages(id: string) {
    const res = await fetch(`/api/campaigns/${id}/messages`);
    const dbMessages: { id: string; role: string; content: string }[] = await res.json();
    if (dbMessages.length === 0) {
      setMessages([WELCOME_MESSAGE]);
    } else {
      setMessages(dbMessages.map((m) => ({ ...m, role: m.role as "user" | "assistant" })));
    }
  }

  async function fetchCharacterSheet(id: string): Promise<object | null> {
    try {
      const res = await fetch(`/api/campaigns/${id}/character`);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  // On mount: load campaigns, auto-create if none
  useEffect(() => {
    (async () => {
      let list = await fetchCampaigns();
      if (list.length === 0) {
        const res = await fetch("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const created: Campaign = await res.json();
        // Auto-initialize the first campaign
        list = [created];
        setCampaigns(list);
        setCurrentCampaignId(created.id);
        setInitializingCampaignId(created.id);
        return;
      }
      setCampaigns(list);
      setCurrentCampaignId(list[0].id);
      await loadCampaignMessages(list[0].id);
      if (list[0].initialized) {
        const sheet = await fetchCharacterSheet(list[0].id);
        setCharacterSheet(sheet);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectCampaign = useCallback(
    async (id: string) => {
      if (id === currentCampaignId) return;
      abortRef.current?.abort();
      setLoading(false);
      setCurrentCampaignId(id);
      setCharacterSheet(null);
      await loadCampaignMessages(id);
      const camp = campaigns.find((c) => c.id === id);
      if (camp?.initialized) {
        const sheet = await fetchCharacterSheet(id);
        setCharacterSheet(sheet);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentCampaignId, campaigns]
  );

  const handleCreateCampaign = useCallback(async () => {
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const created: Campaign = await res.json();
    setCampaigns((prev) => [created, ...prev]);
    setCurrentCampaignId(created.id);
    setCharacterSheet(null);
    setMessages([WELCOME_MESSAGE]);
    setSidebarOpen(false);
    // Trigger initialization
    setInitializingCampaignId(created.id);
  }, []);

  const handleInitDone = useCallback(
    async (campaignName: string) => {
      setInitializingCampaignId(null);
      // Refresh campaign list to get the new name + initialized=true
      const list = await fetchCampaigns();
      setCampaigns(list);
      // Load character sheet
      if (initializingCampaignId) {
        const sheet = await fetchCharacterSheet(initializingCampaignId);
        setCharacterSheet(sheet);
      }
      setMessages([INIT_MESSAGE]);
      void campaignName;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initializingCampaignId]
  );

  const handleInitError = useCallback(() => {
    setInitializingCampaignId(null);
    setMessages([WELCOME_MESSAGE]);
  }, []);

  const handleDeleteCampaign = useCallback(
    async (id: string) => {
      await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      setCampaigns((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (id === currentCampaignId) {
          if (next.length > 0) {
            setCurrentCampaignId(next[0].id);
            loadCampaignMessages(next[0].id);
            setCharacterSheet(null);
          } else {
            fetch("/api/campaigns", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            })
              .then((r) => r.json())
              .then((created: Campaign) => {
                setCampaigns([created]);
                setCurrentCampaignId(created.id);
                setMessages([WELCOME_MESSAGE]);
                setCharacterSheet(null);
                setInitializingCampaignId(created.id);
              });
          }
        }
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentCampaignId]
  );

  const handleRenameCampaign = useCallback(async (id: string, name: string) => {
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  }, []);

  // ── Chat ────────────────────────────────────────────────────────────────────

  const handleAskAbout = useCallback((text: string) => {
    setSelectionPopup({ text });
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };

    const assistantId = (Date.now() + 1).toString();
    const assistantPlaceholder: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setLoading(true);

    const history = [...messages, userMsg]
      .filter((m) => m.id !== "welcome" && m.id !== "init-waiting")
      .map((m) => ({ role: m.role, content: m.content }));

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, model, campaignId: currentCampaignId }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error(`API error: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: accumulated, streaming: true } : m
          )
        );
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: accumulated, streaming: false } : m
        )
      );

      fetchCampaigns().then(setCampaigns);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content:
                  "⚠️ Something went wrong. Please check your API key and try again.\n\n<feedback>Erro ao conectar com a API. Verifique se o OPENROUTER_API_KEY está configurado corretamente no arquivo .env.local.</feedback>",
                streaming: false,
              }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, model, currentCampaignId]);

  const mainHistoryForPopup = messages
    .filter((m) => m.id !== "welcome" && m.id !== "init-waiting" && !m.streaming)
    .map((m) => ({ role: m.role, content: m.content }));

  const currentCampaign = campaigns.find((c) => c.id === currentCampaignId);

  return (
    <div className="flex h-full bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950">
      {/* Initialization overlay */}
      {initializingCampaignId && (
        <InitializationScreen
          campaignId={initializingCampaignId}
          model={model}
          onDone={handleInitDone}
          onError={handleInitError}
        />
      )}

      {/* Character sheet modal */}
      {showCharacterSheet && characterSheet && (
        <CharacterSheet
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data={characterSheet as any}
          onClose={() => setShowCharacterSheet(false)}
        />
      )}

      {/* Sidebar */}
      <CampaignSidebar
        campaigns={campaigns}
        currentId={currentCampaignId}
        onSelect={handleSelectCampaign}
        onCreate={handleCreateCampaign}
        onDelete={handleDeleteCampaign}
        onRename={handleRenameCampaign}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-stone-700/50 bg-stone-900/60 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-stone-400 hover:text-stone-200 text-xl leading-none"
              title="Campanhas"
            >
              ☰
            </button>
            <span className="text-2xl">🏰</span>
            <div>
              <h1 className="font-bold text-amber-200 text-base leading-none">
                {currentCampaign?.name ?? "RPG Master"}
              </h1>
              <p className="text-xs text-stone-400 mt-0.5">D&amp;D 5e · Practice English</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Ver Ficha button — only when campaign is initialized and has a character */}
            {characterSheet && (
              <button
                onClick={() => setShowCharacterSheet(true)}
                className="text-xs border border-amber-700 text-amber-400 hover:bg-amber-900/30 rounded px-2.5 py-1 transition-colors"
                title="Ver ficha do personagem"
              >
                📜 Ficha
              </button>
            )}
            <button
              onClick={() => setAutoSpeak((v) => !v)}
              title={autoSpeak ? "Desativar narração automática" : "Ativar narração automática"}
              className={`text-xs transition-colors border rounded px-2.5 py-1 ${
                autoSpeak
                  ? "text-emerald-400 border-emerald-700 hover:border-emerald-500"
                  : "text-stone-400 border-stone-600 hover:text-stone-200 hover:border-stone-400"
              }`}
            >
              {autoSpeak ? "🔊 Auto" : "🔇 Auto"}
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onAskAbout={msg.role === "assistant" ? handleAskAbout : undefined}
              autoSpeak={msg.role === "assistant" && autoSpeak}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0">
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={sendMessage}
            disabled={loading}
            model={model}
            onModelChange={setModel}
          />
        </div>
      </div>

      {selectionPopup && (
        <SelectionChat
          selectedText={selectionPopup.text}
          mainHistory={mainHistoryForPopup}
          model={model}
          onClose={() => setSelectionPopup(null)}
        />
      )}
    </div>
  );
}
