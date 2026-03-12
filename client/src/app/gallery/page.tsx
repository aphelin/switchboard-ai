import { Suspense } from 'react';
import { GalleryGrid } from '@/components/gallery-grid';
import { Skeleton } from '@/components/ui/skeleton';

function GalleryLoading() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-lg" />
      ))}
    </div>
  );
}

export default function GalleryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gallery</h1>
        <p className="text-sm text-muted-foreground">
          Browse all completed image generations.
        </p>
      </div>
      <Suspense fallback={<GalleryLoading />}>
        <GalleryGrid />
      </Suspense>
    </div>
  );
}
