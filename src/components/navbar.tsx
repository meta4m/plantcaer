'use client';

import { createClient } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UI_ICONS } from '@/lib/icons';

export function Navbar() {
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);
    };
    getUser();
  }, [supabase]);

  const handleSignOut = async () => {
    // Clear both PIN cookie and Supabase session
    const hasPinCookie = document.cookie.includes('plantcaer_pin');

    if (hasPinCookie) {
      await fetch('/auth/pin/verify', {
        method: 'DELETE',
      });
    }

    await supabase.auth.signOut();
    setUser(null);
    router.push('/auth/login');
    router.refresh();
  };

  // Don't show navbar on auth pages
  if (pathname.startsWith('/auth')) return null;

  const navLinks = [
    { href: '/', label: 'Dashboard' },
    { href: '/plants', label: 'Plants' },
    { href: '/care', label: 'Care' },
    { href: '/plants/qr-print', label: 'Stickers' },
  ];

  return (
    <nav className="sticky top-4 z-50 mx-4">
      <div className="mx-auto max-w-6xl">
        <div className="navbar-glass rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2">
                <UI_ICONS.plants size={22} className="text-[var(--color-forest)]" aria-hidden="true" />
                <span className="text-lg font-bold text-stone-800">plantcaer</span>
              </Link>
              <div className="hidden sm:flex items-center gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      pathname === link.href
                        ? 'bg-[var(--color-forest)]/12 text-[var(--color-forest)]'
                        : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100/50'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {user && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 rounded-lg border border-stone-200/50 bg-amber-50/50 px-3 py-1.5 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-100/80 transition-all"
                >
                  <span className="h-6 w-6 rounded-full bg-[var(--color-forest)]/15 flex items-center justify-center text-xs text-[var(--color-forest)]">
                    {user.email?.[0]?.toUpperCase() || '?'}
                  </span>
                  <span className="hidden sm:inline">{user.email}</span>
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 z-50 w-48 glass-card rounded-xl py-1 shadow-xl">
                      <Link
                        href="/settings"
                        onClick={() => setMenuOpen(false)}
                        className="block w-full px-4 py-2 text-left text-sm text-stone-500 hover:text-stone-800 hover:bg-stone-100/50 transition-colors"
                      >
                        Settings
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="w-full px-4 py-2 text-left text-sm text-stone-500 hover:text-stone-800 hover:bg-stone-100/50 transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
