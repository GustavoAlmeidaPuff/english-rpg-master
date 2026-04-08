"use client";

import { POPULAR_MODELS } from "@/lib/models";

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}

export default function ModelSelector({
  value,
  onChange,
  disabled,
}: ModelSelectorProps) {
  const isCustom = !POPULAR_MODELS.find((m) => m.id === value);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-stone-400 hidden sm:block">Model:</span>
      <select
        disabled={disabled}
        value={isCustom ? "__custom__" : value}
        onChange={(e) => {
          if (e.target.value !== "__custom__") onChange(e.target.value);
        }}
        className="rounded bg-stone-800 border border-stone-600 text-stone-200 text-xs px-2 py-1 focus:outline-none focus:border-amber-500 disabled:opacity-50 max-w-[160px]"
      >
        {POPULAR_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
        {isCustom && (
          <option value="__custom__">{value} (custom)</option>
        )}
        <option value="__custom__">Custom…</option>
      </select>

      {isCustom && (
        <input
          disabled={disabled}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="org/model-name"
          className="rounded bg-stone-800 border border-stone-600 text-stone-200 text-xs px-2 py-1 focus:outline-none focus:border-amber-500 w-48 disabled:opacity-50"
        />
      )}
    </div>
  );
}
