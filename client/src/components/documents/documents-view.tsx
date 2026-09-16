"use client";

import { useCallback, useEffect, useState } from "react";
import { DocumentUpload } from "./document-upload";
import { DocumentList } from "./document-list";
import { DocumentDetailDialog } from "./document-detail-dialog";
import { RetrievalTester } from "./retrieval-tester";
import { PageHeading } from "@/components/layout/page-heading";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { useDocumentEvents } from "@/hooks/use-document-events";
import { getDocuments } from "@/lib/api";
import { DocumentStatus } from "@/lib/constants";
import type { DocumentSseEvent, DocumentSummary } from "@/lib/types";

const DOCUMENT_LIMIT = 50;
const PENDING_POLL_INTERVAL_MS = 3000;

/** Window 3: the knowledge base on the left, the retrieval tester on the right. */
export function DocumentsView() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DocumentSummary | null>(null);

  const refetch = useCallback(async () => {
    try { const result = await getDocuments({ limit: DOCUMENT_LIMIT }); setDocuments(result.data); }
    catch { /* keep the previous list */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  useDocumentEvents(useCallback((event: DocumentSseEvent) => {
    setDocuments((prev) => {
      const known = prev.some((doc) => doc.id === event.documentId);
      if (!known) { refetch(); return prev; }
      return prev.map((doc) => doc.id === event.documentId ? { ...doc, status: event.status, chunkCount: event.chunkCount ?? doc.chunkCount, error: event.error ?? null } : doc);
    });
  }, [refetch]));

  const hasPending = documents.some((doc) => doc.status === DocumentStatus.PENDING || doc.status === DocumentStatus.PROCESSING);
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(refetch, PENDING_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasPending, refetch]);

  const handleCreated = useCallback((document: DocumentSummary) => {
    setDocuments((prev) => [document, ...prev.filter((d) => d.id !== document.id)]);
  }, []);

  const chunkTotal = documents.reduce((sum, d) => sum + d.chunkCount, 0);

  return (
    <>
      <PageHeading
        title="Documents"
        sub="The indexer splits each file into chunks, embeds them and stores them in pgvector. The agent searches them and cites what it used."
        aside={!loading && documents.length > 0 ? <span className="chip chip-sm pointer-events-none">{documents.length} document{documents.length === 1 ? "" : "s"} · {chunkTotal} chunks</span> : undefined}
      />
      <Stagger className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <StaggerItem className="flex min-w-0 flex-col gap-6">
          <DocumentUpload onCreated={handleCreated} />
          <DocumentList documents={documents} loading={loading} onChanged={refetch} onOpen={setSelected} />
        </StaggerItem>
        <StaggerItem className="min-w-0 lg:sticky lg:top-24">
          <RetrievalTester />
        </StaggerItem>
      </Stagger>
      <DocumentDetailDialog document={selected} onClose={() => setSelected(null)} />
    </>
  );
}
