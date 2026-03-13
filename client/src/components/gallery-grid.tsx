'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useGenerations } from '@/hooks/use-generations';
import { useSSE } from '@/hooks/use-sse';
import { GenerationCard } from './generation-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { GenerationType, JobStatus } from '@/lib/constants';

const GALLERY_LIMIT = 12;

export function GalleryGrid() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const page = Number(searchParams.get('page')) || 1;

  const setPage = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newPage <= 1) {
        params.delete('page');
      } else {
        params.set('page', String(newPage));
      }
      const qs = params.toString();
      router.push(qs ? `?${qs}` : '', { scroll: false });
    },
    [searchParams, router],
  );

  const { result, loading, error, handleSSEEvent, refetch } = useGenerations({
    type: GenerationType.IMAGE,
    status: JobStatus.COMPLETED,
    limit: GALLERY_LIMIT,
    page,
  });

  useSSE((event) => {
    handleSSEEvent(event);
    if (event.status === JobStatus.COMPLETED) {
      refetch();
    }
  }, refetch);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="link" size="sm" onClick={refetch}>
          Try again
        </Button>
      </div>
    );
  }

  if (!result?.data.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
        <div>
          <p className="font-medium">No images yet</p>
          <p className="text-sm text-muted-foreground">
            Generate some images and they&apos;ll appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {result.data.map((gen) => (
          <GenerationCard key={gen.id} generation={gen} />
        ))}
      </div>

      {result.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {result.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= result.totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  );
}
