import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { Navbar } from '@/components/layout/navbar';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { SseProvider } from '@/hooks/use-sse';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'Mini AI Toolkit',
    template: '%s | Mini AI Toolkit',
  },
  description:
    'Generate AI images and text through a prompt-based interface with async job processing and priority queuing.',
  keywords: ['AI', 'image generation', 'text generation', 'Pollinations', 'prompt'],
  authors: [{ name: 'Mini AI Toolkit' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: APP_URL,
    siteName: 'Mini AI Toolkit',
    title: 'Mini AI Toolkit',
    description:
      'Generate AI images and text through a prompt-based interface with async job processing and priority queuing.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mini AI Toolkit',
    description:
      'Generate AI images and text through a prompt-based interface with async job processing and priority queuing.',
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
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <SseProvider>
            <Navbar />
            <main className="mx-auto min-h-[calc(100vh-3.5rem)] max-w-5xl px-4 py-6">
              {children}
            </main>
            <Toaster />
          </SseProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
