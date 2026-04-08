"use client";

import { useState } from "react";

interface EnglishFeedbackProps {
  feedback: string;
}

export default function EnglishFeedback({ feedback }: EnglishFeedbackProps) {
  const [open, setOpen] = useState(false);

  if (!feedback.trim()) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium"
      >
        <span className="text-sm">{open ? "📖" : "📚"}</span>
        <span>Feedback de Inglês</span>
        <span className="text-amber-600">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-amber-700/50 bg-amber-950/40 p-4 text-sm text-amber-100 animate-fade-in">
          <div className="mb-2 flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
            <span>🎓</span> Análise do seu inglês
          </div>
          <div
            className="prose prose-sm prose-invert prose-amber max-w-none leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formatFeedback(feedback) }}
          />
        </div>
      )}
    </div>
  );
}

/** Convert basic markdown-ish formatting to HTML for the feedback panel */
function formatFeedback(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="bg-amber-900/50 px-1 rounded text-amber-200">$1</code>')
    .replace(/\n/g, "<br/>");
}
