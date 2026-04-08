"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ChatMessage, { Message } from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
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

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };

    // Add user message and a placeholder assistant message
    const assistantId = (Date.now() + 1).toString();
    const assistantPlaceholder: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setLoading(true);

    // Build history for API (exclude welcome message and streaming placeholder)
    const history = [...messages, userMsg]
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, model }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`API error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });

        // Update the streaming message in place
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: accumulated, streaming: true }
              : m
          )
        );
      }

      // Finalize — remove streaming flag
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: accumulated, streaming: false }
            : m
        )
      );
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
  }, [input, loading, messages, model]);

  function clearChat() {
    if (loading) {
      abortRef.current?.abort();
      setLoading(false);
    }
    setMessages([WELCOME_MESSAGE]);
    setInput("");
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-stone-950 via-tavern-900 to-stone-950">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-stone-700/50 bg-stone-900/60 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏰</span>
          <div>
            <h1 className="font-bold text-amber-200 text-base leading-none">
              RPG Master
            </h1>
            <p className="text-xs text-stone-400 mt-0.5">
              D&amp;D 5e · Practice English
            </p>
          </div>
        </div>
        <button
          onClick={clearChat}
          className="text-xs text-stone-400 hover:text-stone-200 transition-colors border border-stone-600 hover:border-stone-400 rounded px-2.5 py-1"
        >
          New Game
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
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
  );
}
