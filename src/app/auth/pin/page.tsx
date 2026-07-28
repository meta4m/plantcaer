'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import PinEntry from '@/components/pin-entry';

export default function PinPage() {
  const router = useRouter();
  const redirectTo = typeof window !== 'undefined'
    ? (() => {
        const raw = new URLSearchParams(window.location.search).get('redirect_to');
        return raw && raw.startsWith('/') ? raw : '/';
      })()
    : '/';

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <button
          onClick={() => router.push('/auth/login' + (redirectTo !== '/' ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ''))}
          className="mb-4 flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          All sign-in options
        </button>
        <PinEntry redirectTo={redirectTo} />
      </div>
    </div>
  );
}
