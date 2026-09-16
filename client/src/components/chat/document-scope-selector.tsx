"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, FileX, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { DocumentSummary } from "@/lib/types";

/** all: every ready document · selected: only the ticked ones · none: the agent gets no search tools. */
export type DocumentScope = "all" | "selected" | "none";

interface DocumentScopeSelectorProps {
  documents: DocumentSummary[];
  scope: DocumentScope;
  selected: string[];
  onChange: (scope: DocumentScope, ids: string[]) => void;
}

const MODES: Array<{ value: DocumentScope; label: string; hint: string }> = [
  { value: "all", label: "All", hint: "Every ready document. The agent decides when a question needs a search." },
  { value: "selected", label: "Pick", hint: "Only the documents you tick below." },
  { value: "none", label: "None", hint: "Search is switched off. The agent answers without your documents." },
];

/** Decides what the agent may search in this conversation. */
export function DocumentScopeSelector({ documents, scope, selected, onChange }: DocumentScopeSelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const label =
    scope === "none" ? "No documents"
    : scope === "selected" ? `${selected.length} of ${documents.length} documents`
    : `All documents (${documents.length})`;
  const mode = MODES.find((m) => m.value === scope) ?? MODES[0];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); }
    function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  // Ticking a document while "All" is on switches to picking, starting from that one.
  const toggle = (id: string, checked: boolean) => {
    const base = scope === "selected" ? selected : [];
    onChange("selected", checked ? [...base, id] : base.filter((x) => x !== id));
  };

  return (
    <div className="relative" ref={rootRef}>
      <button type="button" className={cn("chip chip-sm", scope === "none" && "text-dim")} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="dialog" data-testid="scope-toggle">
        {scope === "none" ? <FileX /> : <FileText />}
        <span className="max-w-[22ch] truncate">{label}</span>
        <ChevronDown className={cn("transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="popup absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2.5rem)] origin-top-right animate-[reveal-row_160ms_cubic-bezier(0.16,1,0.3,1)_both] p-2 text-[15px]" role="dialog" aria-label="Documents the agent may search">
          <p className="px-2 pt-1 pb-2 text-xs font-bold text-dim">What the agent may search</p>
          <div className="grid grid-cols-3 gap-1 rounded-[14px] bg-white/[0.05] p-1" role="radiogroup" aria-label="Document scope">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={scope === m.value}
                className="chip chip-sm justify-center border-transparent"
                data-active={scope === m.value ? "" : undefined}
                onClick={() => onChange(m.value, m.value === "selected" ? selected : [])}
                data-testid={`scope-${m.value}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="px-2 pt-2 pb-1 text-xs leading-5 text-ink-2">{mode.hint}</p>

          {scope !== "none" && (
            documents.length === 0 ? (
              <p className="px-2 py-2 text-sm text-dim">No indexed documents yet. Add some in Documents.</p>
            ) : (
              <ul className="mt-1 max-h-64 overflow-y-auto border-t border-line pt-1">
                {documents.map((document) => {
                  const checked = scope === "selected" && selected.includes(document.id);
                  return (
                    <li key={document.id}>
                      <label className="flex h-10 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-white/8">
                        <Checkbox checked={checked} onCheckedChange={(value) => toggle(document.id, value === true)} />
                        <span className={cn("min-w-0 flex-1 truncate", scope === "all" && "text-ink-2")}>{document.title}</span>
                        <span className="num-tab text-xs text-dim" title="Chunks">{document.chunkCount}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )
          )}
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-line px-1 pt-2">
            <span className="text-xs text-dim">{scope === "selected" && selected.length === 0 ? "Nothing is ticked, so the agent gets no documents." : ""}</span>
            <button type="button" className="btn btn-primary btn-xs" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
