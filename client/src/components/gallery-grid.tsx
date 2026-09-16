'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useGenerations } from '@/hooks/use-generations';
import { useSSE } from '@/hooks/use-sse';
import { GenerationCard, GenerationDetailDialog } from './generation-card';
import { PageHeading } from '@/components/layout/page-heading';
import { GhostRows } from '@/components/tui/ghost';
import { Pager } from '@/components/tui/pager';
import { Stagger, StaggerItem } from '@/components/motion/reveal';
import { deleteGeneration } from '@/lib/api';
import { GenerationType, JobStatus } from '@/lib/constants';
import type { Generation } from '@/lib/types';

const GALLERY_LIMIT = 12;

/** Window 1: completed images as a wall of glass tiles; a tile opens a viewer that browses the page. */
export function GalleryGrid() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const page = Number(searchParams.get('page')) || 1;
  const [open, setOpen] = useState<Generation | null>(null);

  const setPage = useCallback((newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage <= 1) params.delete('page'); else params.set('page', String(newPage));
    const qs = params.toString();
    router.push(qs ? `?${qs}` : '', { scroll: false });
  }, [searchParams, router]);

  const { result, loading, error, handleSSEEvent, refetch, removeLocal } = useGenerations({ type: GenerationType.IMAGE, status: JobStatus.COMPLETED, limit: GALLERY_LIMIT, page });

  useSSE((event) => {
    handleSSEEvent(event);
    if (event.status === JobStatus.COMPLETED) refetch();
  }, refetch);

  const items = result?.data ?? [];

  // After a delete the viewer moves to the next image (or the previous one at the end) instead of closing.
  const handleDelete = async (generation: Generation) => {
    const index = items.findIndex((item) => item.id === generation.id);
    const neighbour = items[index + 1] ?? items[index - 1] ?? null;
    try {
      await deleteGeneration(generation.id);
      removeLocal(generation.id);
      setOpen(neighbour);
      toast.success('Image deleted');
      if (items.length === 1 && page > 1) setPage(page - 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <>
      <PageHeading
        title="Gallery"
        sub="Every finished image, newest first."
        aside={result ? <span className="chip chip-sm pointer-events-none">{result.total} image{result.total === 1 ? '' : 's'}</span> : undefined}
      />
      {loading && !result ? (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="shimmer aspect-[4/5] rounded-[26px]" />)}
        </div>
      ) : error ? (
        <div className="glass flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-err">{error}</p>
          <button type="button" className="btn btn-sm" onClick={refetch}>Try again</button>
        </div>
      ) : !items.length ? (
        <div className="glass p-8"><GhostRows rows={4} label="No images yet. Generate one in the first window." /></div>
      ) : (
        <>
          <Stagger className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((gen) => (
              <StaggerItem key={gen.id}><GenerationCard generation={gen} onOpen={setOpen} /></StaggerItem>
            ))}
          </Stagger>
          {result && <Pager page={page} totalPages={result.totalPages} onPage={setPage} className="pt-8" />}
        </>
      )}
      <GenerationDetailDialog generation={open} onClose={() => setOpen(null)} items={items} onNavigate={setOpen} onDelete={handleDelete} />
    </>
  );
}
