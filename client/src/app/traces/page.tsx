import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TracesView } from '@/components/traces/traces-view';
import { PageHeading } from '@/components/layout/page-heading';
import { Pane } from '@/components/tui/pane';
import { GhostRows } from '@/components/tui/ghost';

export const metadata: Metadata = {
  title: 'Traces',
  description: 'Every model call with tokens, estimated cost, latency and outcome, grouped by conversation or generation.',
};

function TracesLoading() {
  return (
    <>
      <PageHeading title="Traces" sub="Every model call the app makes, with tokens, estimated cost and latency." />
      <div className="flex flex-col gap-6">
        <Pane title="Totals" legend="Loading" tight><GhostRows rows={2} /></Pane>
        <Pane title="Calls" legend="Loading"><GhostRows rows={6} /></Pane>
      </div>
    </>
  );
}

export default function TracesPage() {
  return (
    <Suspense fallback={<TracesLoading />}>
      <TracesView />
    </Suspense>
  );
}
