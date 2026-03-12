import type { Metadata } from 'next';
import { HomeView } from '@/components/home-view';

export const metadata: Metadata = {
  title: 'Mini AI Toolkit',
  description:
    'Generate AI images and text through a prompt-based interface with async job processing and priority queuing.',
  openGraph: {
    title: 'Mini AI Toolkit — AI Image & Text Generator',
    description:
      'Generate AI images and text through a prompt-based interface with async job processing and priority queuing.',
  },
};

export default function HomePage() {
  return <HomeView />;
}
