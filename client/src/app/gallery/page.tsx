import type { Metadata } from 'next';
import { Suspense } from 'react';
import { GalleryGrid } from '@/components/gallery-grid';
import { PageHeading } from '@/components/layout/page-heading';

export const metadata: Metadata = {
  title: 'Gallery',
  description: 'Every completed image generation, newest first.',
};

function GalleryLoading() {
  return (
    <>
      <PageHeading title="Gallery" sub="Every finished image, newest first." />
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="shimmer aspect-[4/5] rounded-[26px]" />)}
      </div>
    </>
  );
}

export default function GalleryPage() {
  return (
    <Suspense fallback={<GalleryLoading />}>
      <GalleryGrid />
    </Suspense>
  );
}
