"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface PopupMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface SelectionChatProps {
  selectedText: string;
  mainHistory: Array<{ role: "user" | "assistant"; content: string }>;
  model: string;
  onClose: () => void;
}

export default function SelectionChat({
  selectedText,
  mainHistory,
  model,
  onClose,
}: SelectionChatProps) {
  const [messages, setMessages] = useState<PopupMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    // First message gets the selected text as context prefix (only sent to API, not shown)
    const isFirst = messages.length === 0;
    const apiUserContent = isFirst
      ? `[Quick aside — not part of the story. I want to ask about this excerpt from your last message: "${selectedText}"]\n\n${text}`
      : text;

    const userMsg: PopupMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };

    const assistantId = (Date.now() + 1).toString();
    const assistantPlaceholder: PopupMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setLoading(true);

    // Rebuild popup history for API (first user msg gets the context prefix)
    const popupHistory = messages.map((m, i) => ({
      role: m.role,
      content:
        m.role === "user" && i === 0
          ? `[Quick aside — not part of the story. I want to ask about this excerpt from your last message: "${selectedText}"]\n\n${m.content}`
          : m.content,
    }));

    const apiMessages = [
      ...mainHistory,
      ...popupHistory,
      { role: "user" as const, content: apiUserContent },
    ];

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, model, mode: "tutor" }),
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
            m.id === assistantId
              ? { ...m, content: accumulated, streaming: true }
              : m
          )
        );
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: accumulated, streaming: false }
            : m
        )
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "⚠️ Something went wrong.", streaming: false }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, selectedText, mainHistory, model]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading && input.trim()) sendMessage();
    }
    if (e.key === "Escape") onClose();
  }

  function handleTextareaInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const t = e.target as HTMLTextAreaElement;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 100) + "px";
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-stone-900 border border-amber-700/40 rounded-2xl shadow-2xl flex flex-col max-h-[70vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-stone-700/50 gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-amber-400 font-semibold uppercase tracking-wide mb-1.5">
              ❓ Pergunta rápida
            </p>
            <div className="bg-stone-800 border border-stone-700/50 rounded-lg px-3 py-2">
              <p className="text-xs text-stone-300 italic leading-relaxed line-clamp-3">
                &ldquo;{selectedText}&rdquo;
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 mt-0.5 text-stone-500 hover:text-stone-300 transition-colors text-base leading-none"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {messages.length === 0 && (
            <p className="text-stone-500 text-xs text-center py-6">
              Tire sua dúvida sobre o trecho acima
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`text-sm leading-relaxed whitespace-pre-wrap rounded-xl px-3 py-2.5 ${
                msg.role === "user"
                  ? "bg-blue-700/70 text-stone-100 ml-10"
                  : "bg-stone-800 text-stone-200 mr-10 border border-stone-700/50"
              }`}
            >
              {msg.content}
              {msg.streaming && (
                <span className="inline-block w-1.5 h-3.5 bg-emerald-400 ml-1 animate-pulse rounded-sm" />
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-3 pb-3 pt-2 border-t border-stone-700/50">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleTextareaInput}
              disabled={loading}
              placeholder="O que você quer saber?"
              rows={1}
              className="flex-1 resize-none rounded-xl bg-stone-800 border border-stone-600 text-stone-100 placeholder-stone-500 px-3 py-2 text-sm focus:outline-none focus:border-amber-500/70 transition-colors disabled:opacity-50 leading-relaxed"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="shrink-0 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:bg-stone-700 disabled:text-stone-500 text-white px-3 py-2 text-sm font-semibold transition-colors"
            >
              {loading ? (
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
              ) : (
                "→"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
