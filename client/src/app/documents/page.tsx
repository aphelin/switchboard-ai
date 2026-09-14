import type { Metadata } from 'next';
import { DocumentsView } from '@/components/documents/documents-view';

export const metadata: Metadata = {
  title: 'Documents',
  description:
    'Upload documents to the knowledge base and test how retrieval (RAG) finds relevant passages.',
  openGraph: {
    title: 'Documents | Mini AI Toolkit',
    description:
      'Upload documents to the knowledge base and test how retrieval (RAG) finds relevant passages.',
  },
};

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground">
          Files are split into chunks, embedded and stored in pgvector. The chat
          assistant searches them to answer questions with citations.
        </p>
      </div>
      <DocumentsView />
    </div>
  );
}
