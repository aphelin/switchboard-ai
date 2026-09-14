"use client";

import { useCallback, useEffect, useState } from "react";
import { DocumentUpload } from "./document-upload";
import { DocumentList } from "./document-list";
import { DocumentDetailDialog } from "./document-detail-dialog";
import { RetrievalTester } from "./retrieval-tester";
import { useDocumentEvents } from "@/hooks/use-document-events";
import { getDocuments } from "@/lib/api";
import { DocumentStatus } from "@/lib/constants";
import type { DocumentSseEvent, DocumentSummary } from "@/lib/types";

const DOCUMENT_LIMIT = 50;
const PENDING_POLL_INTERVAL_MS = 3000;

export function DocumentsView() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DocumentSummary | null>(null);

  const refetch = useCallback(async () => {
    try {
      const result = await getDocuments({ limit: DOCUMENT_LIMIT });
      setDocuments(result.data);
    } catch {
      // keep the previous list; a toast here would be noisy on reconnects
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Live ingestion status: PENDING -> PROCESSING -> READY / FAILED.
  useDocumentEvents(
    useCallback(
      (event: DocumentSseEvent) => {
        setDocuments((prev) => {
          const known = prev.some((doc) => doc.id === event.documentId);
          if (!known) {
            refetch();
            return prev;
          }
          return prev.map((doc) =>
            doc.id === event.documentId
              ? {
                  ...doc,
                  status: event.status,
                  chunkCount: event.chunkCount ?? doc.chunkCount,
                  error: event.error ?? null,
                }
              : doc,
          );
        });
      },
      [refetch],
    ),
  );

  // Polling fallback while jobs are in flight: covers a missed SSE event (e.g. a
  // reconnect, or a job processed by another worker process).
  const hasPending = documents.some(
    (doc) => doc.status === DocumentStatus.PENDING || doc.status === DocumentStatus.PROCESSING,
  );
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(refetch, PENDING_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasPending, refetch]);

  const handleCreated = useCallback((document: DocumentSummary) => {
    setDocuments((prev) => [document, ...prev.filter((d) => d.id !== document.id)]);
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="min-w-0 space-y-6 lg:col-span-3">
        <DocumentUpload onCreated={handleCreated} />
        <DocumentList
          documents={documents}
          loading={loading}
          onChanged={refetch}
          onOpen={setSelected}
        />
      </div>
      <div className="min-w-0 lg:col-span-2">
        <div className="lg:sticky lg:top-20">
          <RetrievalTester />
        </div>
      </div>

      <DocumentDetailDialog document={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
