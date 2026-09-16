import type { Metadata } from 'next';
import { Landing } from '@/components/landing/landing';
import { SITE_DESCRIPTION } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Welcome',
  description: SITE_DESCRIPTION,
};

export default function WelcomePage() {
  return <Landing />;
}
