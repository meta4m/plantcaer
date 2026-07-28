'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Leaf, Calendar, Heart, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Returns true when the current pathname should mark this item active. */
  isActive: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'Home',
    icon: LayoutDashboard,
    isActive: (p) => p === '/',
  },
  {
    href: '/plants',
    label: 'Plants',
    icon: Leaf,
    // /plants and /plant/[slug], but not the sub-routes owned by other tabs
    isActive: (p) =>
      (p === '/plants' || p.startsWith('/plant/')) && !p.startsWith('/plants/qr-print'),
  },
  {
    href: '/care',
    label: 'Care',
    icon: Calendar,
    isActive: (p) => p.startsWith('/care'),
  },
  {
    href: '/plants/qr-print',
    label: 'Stickers',
    icon: Heart,
    isActive: (p) => p.startsWith('/plants/qr-print'),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  // Match Navbar behaviour: no chrome on auth pages
  if (pathname.startsWith('/auth')) return null;

  // Split so the FAB sits in the middle
  const leftItems = NAV_ITEMS.slice(0, 2);
  const rightItems = NAV_ITEMS.slice(2);

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bottom-nav-surface"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {leftItems.map((item) => (
          <NavTab key={item.href} item={item} pathname={pathname} />
        ))}

        <li className="flex flex-1 items-center justify-center">
          <Link
            href="/plants/new"
            aria-label="Add plant"
            className="-translate-y-1 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-forest)] text-white shadow-lg shadow-[rgba(61,122,90,0.35)] transition-colors hover:bg-[var(--color-forest-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-forest)]"
          >
            <Plus className="h-7 w-7" aria-hidden="true" />
          </Link>
        </li>

        {rightItems.map((item) => (
          <NavTab key={item.href} item={item} pathname={pathname} />
        ))}
      </ul>
    </nav>
  );
}

function NavTab({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = item.isActive(pathname);
  const Icon = item.icon;

  return (
    <li className="flex flex-1">
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={`flex min-h-[56px] w-full min-w-[48px] flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-forest)] ${
          active
            ? 'text-[var(--color-forest)]'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
        }`}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
        <span>{item.label}</span>
      </Link>
    </li>
  );
}
