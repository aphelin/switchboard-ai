import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TracesView } from '@/components/traces/traces-view';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Traces',
  description:
    'Every LLM call with tokens, estimated cost, latency and outcome, grouped by conversation or generation.',
  openGraph: {
    title: 'Traces | Mini AI Toolkit',
    description:
      'Every LLM call with tokens, estimated cost, latency and outcome, grouped by conversation or generation.',
  },
};

function TracesLoading() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export default function TracesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Traces</h1>
        <p className="text-sm text-muted-foreground">
          Every model call the app makes, with token usage, estimated cost and
          latency. Filter by a conversation or generation id to follow one request.
        </p>
      </div>
      <Suspense fallback={<TracesLoading />}>
        <TracesView />
      </Suspense>
    </div>
  );
}
