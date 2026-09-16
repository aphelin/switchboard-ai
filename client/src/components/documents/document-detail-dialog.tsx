"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLastDefined } from "@/hooks/use-last-defined";
import { GhostRows } from "@/components/tui/ghost";
import { DocumentStatusBadge } from "./document-status-badge";
import { getDocument, getDocumentChunks } from "@/lib/api";
import { formatStamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DocumentChunk, DocumentSummary } from "@/lib/types";

/** A full summary (from the documents list) or just an id and title (from a chat citation). */
export type DocumentRef = Pick<DocumentSummary, "id" | "title"> & Partial<Omit<DocumentSummary, "id" | "title">>;

interface DocumentDetailDialogProps {
  document: DocumentRef | null;
  /** Chunk index to scroll to and mark, e.g. the passage a reply cited. */
  focusChunk?: number | null;
  onClose: () => void;
}

function DocumentChunks({ documentId, focusChunk }: { documentId: string; focusChunk?: number | null }) {
  const [chunks, setChunks] = useState<DocumentChunk[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const focusRef = useCallback((node: HTMLLIElement | null) => { node?.scrollIntoView({ block: "center" }); }, []);

  useEffect(() => {
    let cancelled = false;
    getDocumentChunks(documentId)
      .then((data) => { if (!cancelled) setChunks(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load chunks"); });
    return () => { cancelled = true; };
  }, [documentId]);

  if (error) return <p className="text-err">{error}</p>;
  if (chunks === null) return <GhostRows rows={4} />;
  if (chunks.length === 0) return <GhostRows rows={3} label="No chunks yet. The document is still indexing or failed." />;

  return (
    <ol className="flex flex-col gap-3">
      {chunks.map((chunk) => {
        const focused = chunk.index === focusChunk;
        return (
          <li
            key={chunk.id}
            ref={focused ? focusRef : undefined}
            className={cn("glass-inner min-w-0 px-4 py-3", focused && "border-accent/45 bg-accent/[0.07] shadow-[0_0_0_3px_rgba(134,236,191,0.1)]")}
            data-focused={focused ? "" : undefined}
          >
            <p className="mb-1 flex flex-wrap items-center gap-2 text-xs font-bold text-dim">
              Chunk {chunk.index} · ~{chunk.tokenCount} tokens
              {focused && <span className="tag tag-accent h-5 px-1.5 text-[11px]">Cited passage</span>}
            </p>
            <p className="text-sm leading-6 whitespace-pre-wrap text-ink-2 [overflow-wrap:anywhere]">{chunk.content}</p>
          </li>
        );
      })}
    </ol>
  );
}

/** Status, source and size. Loaded on demand when the dialog was opened from a citation. */
function DocumentMeta({ document }: { document: DocumentRef }) {
  const complete = document.status !== undefined;
  const [loaded, setLoaded] = useState<DocumentSummary | null>(null);

  useEffect(() => {
    if (complete) return;
    let cancelled = false;
    getDocument(document.id).then((data) => { if (!cancelled) setLoaded(data); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [document.id, complete]);

  const meta = complete ? (document as DocumentSummary) : loaded;
  if (!meta) return <p className="h-7" aria-hidden="true" />;
  return (
    <>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-dim">
        <DocumentStatusBadge status={meta.status} />
        <span>{meta.source ?? "Pasted text"}</span>
        <span>{meta.mimeType ?? "text/plain"}</span>
        <span>{meta.chunkCount} chunks</span>
        <span>{formatStamp(meta.createdAt)}</span>
      </p>
      {meta.error && <p className="text-err">{meta.error}</p>}
    </>
  );
}

export function DocumentDetailDialog({ document, focusChunk, onClose }: DocumentDetailDialogProps) {
  const shown = useLastDefined(document);
  return (
    <Dialog open={!!document} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle><FileText /><span className="min-w-0 truncate" title={shown?.title}>{shown?.title}</span></DialogTitle>
        </DialogHeader>
        {shown && (
          <div className="flex min-w-0 flex-col gap-3">
            <DocumentMeta key={shown.id} document={shown} />
            <div className="max-h-[60vh] min-w-0 overflow-y-auto pr-1">
              <DocumentChunks key={shown.id} documentId={shown.id} focusChunk={focusChunk} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
