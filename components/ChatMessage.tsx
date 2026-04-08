"use client";

import EnglishFeedback from "./EnglishFeedback";

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

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

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
    <div className="flex gap-3 animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-900 border border-emerald-700 flex items-center justify-center text-lg select-none mt-1">
        🎲
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-emerald-500 font-semibold mb-1 tracking-wide uppercase">
          Dungeon Master
        </p>
        <div className="rounded-2xl rounded-tl-sm bg-stone-800/80 border border-stone-700/50 px-4 py-3 text-stone-200 text-sm leading-relaxed whitespace-pre-wrap">
          {dmText}
          {message.streaming && (
            <span className="inline-block w-2 h-4 bg-emerald-400 ml-1 animate-pulse rounded-sm" />
          )}
        </div>
        {!message.streaming && <EnglishFeedback feedback={feedback} />}
      </div>
    </div>
  );
}
