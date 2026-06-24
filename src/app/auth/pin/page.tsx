'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import PinEntry from '@/components/pin-entry';

export default function PinPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <button
          onClick={() => router.push('/auth/login')}
          className="mb-4 flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          All sign-in options
        </button>
        <PinEntry />
      </div>
    </div>
  );
}
