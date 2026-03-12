import { Suspense } from 'react';
import { GenerationHistory } from '@/components/generation-history';
import { Skeleton } from '@/components/ui/skeleton';

function HistoryLoading() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-48 rounded-lg" />
      ))}
    </div>
  );
}

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Generation History
        </h1>
        <p className="text-sm text-muted-foreground">
          View and manage all past generations.
        </p>
      </div>
      <Suspense fallback={<HistoryLoading />}>
        <GenerationHistory />
      </Suspense>
    </div>
  );
}
