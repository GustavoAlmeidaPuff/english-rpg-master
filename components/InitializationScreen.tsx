"use client";

import { useEffect, useRef, useState } from "react";

interface LogEntry {
  type: "log" | "stream" | "error";
  text: string;
}

interface InitializationScreenProps {
  campaignId: string;
  model: string;
  onDone: (campaignName: string) => void;
  onError: () => void;
}

export default function InitializationScreen({
  campaignId,
  model,
  onDone,
  onError,
}: InitializationScreenProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [thinkingText, setThinkingText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const thinkingEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    thinkingEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thinkingText]);

  useEffect(() => {
    let aborted = false;

    async function run() {
      const res = await fetch(`/api/campaigns/${campaignId}/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });

      if (!res.body) {
        setError(true);
        onError();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!aborted) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "log") {
              setIsThinking(false);
              setThinkingText("");
              setLogs((prev) => [...prev, { type: "log", text: event.message }]);
            } else if (event.type === "thinking_start") {
              setIsThinking(true);
              setThinkingText("");
            } else if (event.type === "stream") {
              setThinkingText((prev) => prev + event.chunk);
            } else if (event.type === "thinking_end") {
              setIsThinking(false);
            } else if (event.type === "done") {
              setDone(true);
              setTimeout(() => onDone(event.campaignName ?? "Nova Campanha"), 1200);
            } else if (event.type === "error") {
              setLogs((prev) => [...prev, { type: "error", text: event.message }]);
              setError(true);
              setTimeout(onError, 3000);
            }
          } catch {
            // ignore parse errors on partial lines
          }
        }
      }
    }

    run().catch((err) => {
      if (!aborted) {
        console.error("[InitializationScreen]", err);
        setError(true);
        onError();
      }
    });

    return () => {
      aborted = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, model]);

  return (
    <div className="fixed inset-0 z-50 bg-stone-950 flex flex-col items-center justify-center p-6">
      {/* Animated rune */}
      <div className={`text-6xl mb-6 ${done ? "" : "animate-pulse"}`}>
        {error ? "💀" : done ? "✅" : "🔮"}
      </div>

      <h2 className="text-amber-200 text-2xl font-bold mb-2">
        {error
          ? "Algo deu errado..."
          : done
          ? "Campanha criada!"
          : "Forjando sua aventura..."}
      </h2>
      <p className="text-stone-400 text-sm mb-8 text-center max-w-md">
        {error
          ? "Verifique sua chave de API e tente novamente."
          : done
          ? "Entrando no mundo..."
          : "A IA está lendo o lore do mundo, criando o roteiro e forjando seu personagem. Aguarde..."}
      </p>

      {/* Log panel */}
      <div className="w-full max-w-2xl bg-stone-900 border border-stone-700 rounded-xl overflow-hidden">
        <div className="px-3 py-2 border-b border-stone-700 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-stone-500 text-xs ml-2 font-mono">dungeon-master init</span>
        </div>

        {/* Fixed log lines */}
        <div className="px-4 py-3 space-y-1 max-h-48 overflow-y-auto font-mono text-xs">
          {logs.map((entry, i) => (
            <div
              key={i}
              className={
                entry.type === "error"
                  ? "text-red-400"
                  : "text-emerald-400"
              }
            >
              {entry.text}
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>

        {/* Streaming AI thinking panel */}
        {(isThinking || thinkingText) && (
          <div className="border-t border-stone-700 px-4 py-3 max-h-56 overflow-y-auto">
            <p className="text-stone-500 text-xs font-mono mb-1 flex items-center gap-1">
              <span
                className={`w-1.5 h-1.5 rounded-full bg-amber-400 ${
                  isThinking ? "animate-pulse" : ""
                }`}
              />
              IA pensando...
            </p>
            <pre className="text-stone-400 text-xs font-mono whitespace-pre-wrap leading-relaxed">
              {thinkingText}
            </pre>
            <div ref={thinkingEndRef} />
          </div>
        )}
      </div>

      {!done && !error && (
        <p className="text-stone-600 text-xs mt-4">
          Modelos gratuitos podem levar até 2 minutos ⏳
        </p>
      )}
    </div>
  );
}
