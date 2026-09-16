"use client";

import { useState } from "react";
import { RefreshCw, Trash2, Eye, FileText } from "lucide-react";
import { Pane } from "@/components/tui/pane";
import { GhostRows } from "@/components/tui/ghost";
import { DocumentStatusBadge } from "./document-status-badge";
import { deleteDocument, reindexDocument } from "@/lib/api";
import { DocumentStatus } from "@/lib/constants";
import { formatStamp } from "@/lib/format";
import type { DocumentSummary } from "@/lib/types";
import { toast } from "sonner";

interface DocumentListProps {
  documents: DocumentSummary[];
  loading: boolean;
  onChanged: () => void;
  onOpen: (document: DocumentSummary) => void;
}

/** The indexed documents, one row each, with view / re-index / delete. */
export function DocumentList({ documents, loading, onChanged, onOpen }: DocumentListProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleDelete = async (document: DocumentSummary) => {
    setBusyId(document.id);
    try { await deleteDocument(document.id); toast.success(`Deleted "${document.title}"`); onChanged(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
    finally { setBusyId(null); }
  };
  const handleReindex = async (document: DocumentSummary) => {
    setBusyId(document.id);
    try { await reindexDocument(document.id); toast.success(`Re-indexing "${document.title}"`); onChanged(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Re-index failed"); }
    finally { setBusyId(null); }
  };

  return (
    <Pane title="Documents" legend={loading ? "Loading" : documents.length > 0 ? `${documents.length}` : "Empty"} flush className="pb-3">
      <div className="px-3 pt-3">
        {loading ? (
          <div className="px-3"><GhostRows rows={3} /></div>
        ) : documents.length === 0 ? (
          <div className="px-3"><GhostRows rows={3} label="No documents yet. Upload a file or paste text." /></div>
        ) : (
          <ul className="flex flex-col" data-testid="document-list">
            {documents.map((document) => (
              <li key={document.id} className="flex items-center gap-2.5 rounded-[20px] px-2 py-2.5 transition-colors hover:bg-white/8 sm:gap-3.5 sm:px-3">
                <span className="cover flex size-10 shrink-0 items-center justify-center rounded-2xl sm:size-12" data-cover="documents">
                  <FileText className="size-5 text-white/70" />
                </span>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(document)} title="View chunks">
                  <p className="truncate text-[15px] font-semibold">{document.title}</p>
                  <p className="truncate text-xs text-dim">
                    {document.source ?? "Pasted text"} · {document.chunkCount} chunk{document.chunkCount === 1 ? "" : "s"} · {formatStamp(document.createdAt)}
                  </p>
                  {/* On phones the status sits under the title, so the title keeps the row's width. */}
                  <DocumentStatusBadge status={document.status} className="mt-1 text-xs sm:hidden" />
                  {document.status === DocumentStatus.FAILED && document.error && <p className="line-clamp-2 text-xs text-err">{document.error}</p>}
                </button>
                <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                  <DocumentStatusBadge status={document.status} className="mr-2 hidden text-[13px] sm:inline-flex" />
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" title="View chunks" aria-label={`View chunks of ${document.title}`} onClick={() => onOpen(document)}><Eye /></button>
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" title="Re-index" aria-label={`Re-index ${document.title}`} disabled={busyId === document.id || document.status === DocumentStatus.PROCESSING} onClick={() => handleReindex(document)}><RefreshCw /></button>
                  <button type="button" className="btn btn-ghost btn-icon btn-sm hover:text-err" title="Delete" aria-label={`Delete ${document.title}`} disabled={busyId === document.id} onClick={() => handleDelete(document)}><Trash2 /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Pane>
  );
}
