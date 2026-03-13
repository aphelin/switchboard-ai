'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Sparkles, Image, Clock, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const links = [
  { href: '/', label: 'Generate', icon: Sparkles },
  { href: '/gallery', label: 'Gallery', icon: Image },
  { href: '/history', label: 'History', icon: Clock },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
        <Link href="/" className="mr-6 flex items-center gap-2 font-semibold">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">Mini AI Toolkit</span>
        </Link>

        <nav className="hidden md:flex md:items-center md:gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <Button
                variant={pathname === href ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  'gap-2',
                  pathname === href && 'bg-secondary font-medium',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            </Link>
          ))}
        </nav>

        <div className="ml-auto md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <X className="size-6" />
            ) : (
              <Menu className="size-6" />
            )}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 top-14 z-40 bg-background/80 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <nav className="absolute left-0 right-0 top-14 z-50 border-b bg-background px-4 pb-4 pt-2 shadow-lg md:hidden">
            {links.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setMobileOpen(false)}>
                <Button
                  variant={pathname === href ? 'secondary' : 'ghost'}
                  className="w-full justify-start gap-3 text-base py-3 h-auto"
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Button>
              </Link>
            ))}
          </nav>
        </>
      )}
    </header>
  );
}
