"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import EnglishFeedback from "./EnglishFeedback";
import { useSpeech } from "@/hooks/useSpeech";

export interface Message {
  id: string;
  role: "user" | "assistant";
  /** Full raw content including <feedback>...</feedback> */
  content: string;
  /** Whether this message is still streaming */
  streaming?: boolean;
}

/** Split DM content from feedback section */
export function parseAssistantContent(content: string): {
  dmText: string;
  feedback: string;
} {
  const feedbackMatch = content.match(/<feedback>([\s\S]*?)(<\/feedback>|$)/i);
  if (!feedbackMatch) return { dmText: content, feedback: "" };

  const feedbackStart = content.indexOf(feedbackMatch[0]);
  const dmText = content.slice(0, feedbackStart).trim();
  const feedback = feedbackMatch[1].trim();
  return { dmText, feedback };
}

interface PopupState {
  x: number;
  y: number;
  text: string;
}

interface ChatMessageProps {
  message: Message;
  onAskAbout?: (selectedText: string) => void;
  autoSpeak?: boolean;
}

export default function ChatMessage({ message, onAskAbout, autoSpeak }: ChatMessageProps) {
  const isUser = message.role === "user";
  const [popup, setPopup] = useState<PopupState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { speak, stop, isSpeaking, isLoading, isSupported } = useSpeech();

  const handleMouseUp = useCallback(() => {
    if (!onAskAbout || message.streaming) return;

    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!text || text.length < 2) {
      setPopup(null);
      return;
    }

    if (!selection?.rangeCount) return;

    const range = selection.getRangeAt(0);

    // Only show popup if selection is inside our container
    if (
      containerRef.current &&
      containerRef.current.contains(range.commonAncestorContainer)
    ) {
      const rect = range.getBoundingClientRect();
      setPopup({
        x: rect.left + rect.width / 2,
        y: rect.top,
        text,
      });
    } else {
      setPopup(null);
    }
  }, [onAskAbout, message.streaming]);

  // Close popup when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if ((e.target as Element).closest("[data-ask-popup]")) return;
      setPopup(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { dmText: autoSpeakText } = isUser
    ? { dmText: "" }
    : parseAssistantContent(message.content);

  useEffect(() => {
    if (!isUser && !message.streaming && autoSpeak && autoSpeakText) {
      speak(autoSpeakText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.streaming]);

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[80%]">
          <div className="rounded-2xl rounded-tr-sm bg-blue-700/80 px-4 py-3 text-stone-100 text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  const { dmText, feedback } = parseAssistantContent(message.content);

  return (
    <>
      {popup && (
        <div
          data-ask-popup
          style={{
            position: "fixed",
            left: popup.x,
            top: popup.y,
            transform: "translate(-50%, calc(-100% - 8px))",
            zIndex: 50,
          }}
        >
          {/* Arrow */}
          <div className="flex flex-col items-center">
            <div className="bg-amber-800 border border-amber-600 rounded-lg px-3 py-1.5 shadow-xl flex items-center gap-2">
              <button
                data-ask-popup
                onClick={() => {
                  onAskAbout?.(popup.text);
                  setPopup(null);
                  window.getSelection()?.removeAllRanges();
                }}
                className="text-xs text-amber-200 hover:text-white font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <span>❓</span>
                <span>Perguntar sobre isso</span>
              </button>
            </div>
            {/* Triangle pointer */}
            <div
              data-ask-popup
              style={{
                width: 0,
                height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: "6px solid #92400e",
              }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-3 animate-fade-in">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-900 border border-emerald-700 flex items-center justify-center text-lg select-none mt-1">
          🎲
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-emerald-500 font-semibold tracking-wide uppercase">
              Dungeon Master
            </p>
            {!message.streaming && isSupported && (
              <button
                onClick={() => (isSpeaking ? stop() : speak(dmText))}
                disabled={isLoading}
                title={isLoading ? "Gerando áudio..." : isSpeaking ? "Parar" : "Ouvir"}
                className="text-stone-400 hover:text-emerald-400 transition-colors text-base leading-none disabled:opacity-50 disabled:cursor-wait"
              >
                {isLoading ? "⏳" : isSpeaking ? "⏹" : "🔊"}
              </button>
            )}
          </div>
          <div
            ref={containerRef}
            onMouseUp={handleMouseUp}
            className="rounded-2xl rounded-tl-sm bg-stone-800/80 border border-stone-700/50 px-4 py-3 text-stone-200 text-sm leading-relaxed whitespace-pre-wrap"
          >
            {dmText}
            {message.streaming && (
              <span className="inline-block w-2 h-4 bg-emerald-400 ml-1 animate-pulse rounded-sm" />
            )}
          </div>
          {!message.streaming && <EnglishFeedback feedback={feedback} />}
        </div>
      </div>
    </>
  );
}
