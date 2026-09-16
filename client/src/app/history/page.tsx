import type { Metadata } from 'next';
import { Suspense } from 'react';
import { GenerationHistory } from '@/components/generation-history';
import { PageHeading } from '@/components/layout/page-heading';
import { Pane } from '@/components/tui/pane';
import { GhostRows } from '@/components/tui/ghost';

export const metadata: Metadata = {
  title: 'History',
  description: 'Every past image and text generation with its status, model and priority; retry or cancel from here.',
};

function HistoryLoading() {
  return (
    <>
      <PageHeading title="History" sub="Every generation with its status, model and priority." />
      <Pane title="All generations" legend="Loading"><GhostRows rows={6} /></Pane>
    </>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<HistoryLoading />}>
      <GenerationHistory />
    </Suspense>
  );
}
