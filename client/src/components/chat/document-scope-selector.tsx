"use client";

import { useState } from "react";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { DocumentSummary } from "@/lib/types";

interface DocumentScopeSelectorProps {
  documents: DocumentSummary[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

/** Restricts which documents the assistant may search (empty = all). */
export function DocumentScopeSelector({
  documents,
  selected,
  onChange,
}: DocumentScopeSelectorProps) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronUp : ChevronDown;
  const label =
    selected.length === 0
      ? `All documents (${documents.length})`
      : `${selected.length} of ${documents.length} documents`;

  const toggle = (id: string, checked: boolean) => {
    onChange(checked ? [...selected, id] : selected.filter((x) => x !== id));
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen((v) => !v)}
        data-testid="scope-toggle"
      >
        <FileText className="h-3.5 w-3.5" />
        <span className="max-w-[180px] truncate">Scope: {label}</span>
        <Chevron className="h-3.5 w-3.5" />
      </Button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-lg border bg-popover p-2 text-sm shadow-md">
          {documents.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">
              No indexed documents yet. Add some on the Documents page.
            </p>
          ) : (
            <>
              <ul className="max-h-56 space-y-1 overflow-y-auto">
                {documents.map((document) => {
                  const checked = selected.includes(document.id);
                  return (
                    <li key={document.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => toggle(document.id, value === true)}
                        />
                        <span className="min-w-0 flex-1 truncate">{document.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {document.chunkCount}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-1 flex justify-between border-t pt-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => onChange([])}
                  disabled={selected.length === 0}
                >
                  Use all
                </Button>
                <Button type="button" variant="ghost" size="xs" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
