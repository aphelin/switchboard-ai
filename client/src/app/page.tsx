import type { Metadata } from 'next';
import { HomeView } from '@/components/home-view';

export const metadata: Metadata = {
  title: 'Generate',
  description:
    'Queue an image or text generation with a priority, watch it run over a live stream, and pick the model it runs on.',
};

export default function HomePage() {
  return <HomeView />;
}
