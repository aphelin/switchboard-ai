"use client";

import { useState } from "react";
import { FileText, RefreshCw, Trash2, Eye, Files } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentStatusBadge } from "./document-status-badge";
import { deleteDocument, reindexDocument } from "@/lib/api";
import { DocumentStatus } from "@/lib/constants";
import type { DocumentSummary } from "@/lib/types";
import { toast } from "sonner";

interface DocumentListProps {
  documents: DocumentSummary[];
  loading: boolean;
  onChanged: () => void;
  onOpen: (document: DocumentSummary) => void;
}

export function DocumentList({
  documents,
  loading,
  onChanged,
  onOpen,
}: DocumentListProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleDelete = async (document: DocumentSummary) => {
    setBusyId(document.id);
    try {
      await deleteDocument(document.id);
      toast.success(`Deleted "${document.title}"`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleReindex = async (document: DocumentSummary) => {
    setBusyId(document.id);
    try {
      await reindexDocument(document.id);
      toast.success(`Re-indexing "${document.title}"`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Re-index failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Files className="h-5 w-5" />
          Documents
          {documents.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary">
              {documents.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">No documents yet</p>
            <p className="text-sm text-muted-foreground">
              Upload a file or paste text to build the knowledge base.
            </p>
          </div>
        ) : (
          <ul className="space-y-2" data-testid="document-list">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onOpen(document)}
                >
                  <p className="truncate text-sm font-medium">{document.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {document.source ?? "pasted text"} &middot;{" "}
                    {document.chunkCount} chunk{document.chunkCount === 1 ? "" : "s"}{" "}
                    &middot; {new Date(document.createdAt).toLocaleString()}
                  </p>
                  {document.status === DocumentStatus.FAILED && document.error && (
                    <p className="mt-1 line-clamp-2 text-xs text-destructive">
                      {document.error}
                    </p>
                  )}
                </button>
                <div className="flex shrink-0 items-center gap-1.5">
                  <DocumentStatusBadge status={document.status} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="View chunks"
                    onClick={() => onOpen(document)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Re-index"
                    disabled={
                      busyId === document.id ||
                      document.status === DocumentStatus.PROCESSING
                    }
                    onClick={() => handleReindex(document)}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    title="Delete"
                    disabled={busyId === document.id}
                    onClick={() => handleDelete(document)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
