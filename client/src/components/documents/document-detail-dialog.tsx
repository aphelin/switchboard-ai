"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentStatusBadge } from "./document-status-badge";
import { getDocumentChunks } from "@/lib/api";
import type { DocumentChunk, DocumentSummary } from "@/lib/types";

interface DocumentDetailDialogProps {
  document: DocumentSummary | null;
  onClose: () => void;
}

/** Keyed by document id by the parent, so state resets for every document. */
function DocumentChunks({ documentId }: { documentId: string }) {
  const [chunks, setChunks] = useState<DocumentChunk[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDocumentChunks(documentId)
      .then((data) => {
        if (!cancelled) setChunks(data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load chunks");
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (chunks === null) {
    return (
      <>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </>
    );
  }
  if (chunks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No chunks yet. The document is still being indexed or failed.
      </p>
    );
  }

  return (
    <>
      {chunks.map((chunk) => (
        <div key={chunk.id} className="rounded-lg border p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Chunk #{chunk.index} &middot; ~{chunk.tokenCount} tokens
          </p>
          <p className="whitespace-pre-wrap text-xs leading-relaxed">{chunk.content}</p>
        </div>
      ))}
    </>
  );
}

export function DocumentDetailDialog({
  document,
  onClose,
}: DocumentDetailDialogProps) {
  return (
    <Dialog open={!!document} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <span className="truncate">{document?.title}</span>
          </DialogTitle>
        </DialogHeader>

        {document && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <DocumentStatusBadge status={document.status} />
              <span>{document.source ?? "pasted text"}</span>
              <span>{document.mimeType ?? "text/plain"}</span>
              <span>{document.chunkCount} chunks</span>
              <span>{new Date(document.createdAt).toLocaleString()}</span>
            </div>

            {document.error && (
              <p className="text-sm text-destructive">{document.error}</p>
            )}

            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              <DocumentChunks key={document.id} documentId={document.id} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
