import type { Metadata } from 'next';
import { Urbanist } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { AuthGate } from '@/components/auth/auth-gate';
import { Aurora } from '@/components/layout/aurora';
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site';
import './globals.css';

// Urbanist carries everything, display to readouts.
const urbanist = Urbanist({
  subsets: ['latin'],
  variable: '--font-urbanist',
  display: 'swap',
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: ['AI', 'RAG', 'agents', 'MCP', 'image generation', 'LLM observability', 'pgvector'],
  authors: [{ name: SITE_NAME }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: APP_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={urbanist.variable}>
      <body>
        <Aurora />
        {/* Everything paints above the ground layer. Nothing inside the gate mounts until a session exists. */}
        <div className="relative z-[1]">
          <AuthGate>{children}</AuthGate>
          <Toaster />
        </div>
      </body>
    </html>
  );
}
