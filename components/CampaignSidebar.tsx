"use client";

import { useEffect, useRef, useState } from "react";

export interface Campaign {
  id: string;
  name: string;
  model: string | null;
  initialized: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CampaignSidebarProps {
  campaigns: Campaign[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  open: boolean;
  onClose: () => void;
}

export default function CampaignSidebar({
  campaigns,
  currentId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  open,
  onClose,
}: CampaignSidebarProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId) renameRef.current?.focus();
  }, [renamingId]);

  function startRename(campaign: Campaign) {
    setRenamingId(campaign.id);
    setRenameValue(campaign.name);
  }

  function commitRename(id: string) {
    const trimmed = renameValue.trim();
    if (trimmed) onRename(id, trimmed);
    setRenamingId(null);
  }

  return (
    <>
      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-30
          flex flex-col w-64 bg-stone-950 border-r border-stone-800
          transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-stone-800">
          <span className="text-amber-200 font-semibold text-sm">Campanhas</span>
          <button
            onClick={onClose}
            className="md:hidden text-stone-500 hover:text-stone-300 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* New campaign button */}
        <div className="px-3 py-2">
          <button
            onClick={onCreate}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-stone-300 hover:bg-stone-800 border border-stone-700 hover:border-stone-600 transition-colors"
          >
            <span className="text-base">⚔️</span>
            Nova Campanha
          </button>
        </div>

        {/* Campaign list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
          {campaigns.length === 0 && (
            <p className="text-stone-600 text-xs px-2 py-4 text-center">
              Nenhuma campanha ainda.
            </p>
          )}
          {campaigns.map((c) => (
            <div
              key={c.id}
              className={`group relative flex items-center rounded-lg px-2 py-2 cursor-pointer transition-colors ${
                c.id === currentId
                  ? "bg-stone-800 text-amber-200"
                  : "text-stone-400 hover:bg-stone-900 hover:text-stone-200"
              }`}
              onClick={() => {
                if (renamingId !== c.id) {
                  onSelect(c.id);
                  onClose();
                }
              }}
            >
              {renamingId === c.id ? (
                <input
                  ref={renameRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(c.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-stone-700 text-stone-100 text-xs rounded px-1 py-0.5 outline-none min-w-0"
                />
              ) : (
                <span className="flex-1 text-xs truncate pr-1">{c.name}</span>
              )}

              {/* Action buttons — visible on hover or when active */}
              {renamingId !== c.id && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    title="Renomear"
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(c);
                    }}
                    className="text-stone-500 hover:text-stone-200 text-xs px-0.5"
                  >
                    ✏️
                  </button>
                  <button
                    title="Deletar"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Deletar "${c.name}"?`)) onDelete(c.id);
                    }}
                    className="text-stone-500 hover:text-red-400 text-xs px-0.5"
                  >
                    🗑️
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
