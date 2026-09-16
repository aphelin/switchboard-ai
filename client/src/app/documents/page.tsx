import type { Metadata } from 'next';
import { DocumentsView } from '@/components/documents/documents-view';

export const metadata: Metadata = {
  title: 'Documents',
  description: 'Upload documents to the knowledge base and test how hybrid retrieval (vector + keyword, fused with RRF) finds passages.',
};

export default function DocumentsPage() {
  return <DocumentsView />;
}
