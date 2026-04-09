"use client";

import { useRef, useEffect } from "react";
import ModelSelector from "./ModelSelector";

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  model: string;
  onModelChange: (m: string) => void;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
}

export default function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled,
  model,
  onModelChange,
  inputRef,
}: ChatInputProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef ?? internalRef;

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSubmit();
    }
  }

  return (
    <div className="border-t border-stone-700/50 bg-stone-900/80 backdrop-blur px-4 py-3">
      {/* Model selector row */}
      <div className="flex items-center justify-between mb-2">
        <ModelSelector value={model} onChange={onModelChange} disabled={disabled} />
        <span className="text-xs text-stone-500 hidden sm:block">
          Enter to send · Shift+Enter for new line
        </span>
      </div>

      {/* Input row */}
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="What do you do? (write in English to practice!)"
          rows={1}
          className="flex-1 resize-none rounded-xl bg-stone-800 border border-stone-600 text-stone-100 placeholder-stone-500 px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/70 transition-colors disabled:opacity-50 leading-relaxed"
        />
        <button
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          className="flex-shrink-0 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:bg-stone-700 disabled:text-stone-500 text-white px-4 py-2.5 text-sm font-semibold transition-colors"
        >
          {disabled ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ...
            </span>
          ) : (
            "Send ⚔️"
          )}
        </button>
      </div>
    </div>
  );
}
