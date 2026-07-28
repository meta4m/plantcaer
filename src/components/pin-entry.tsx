'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase';

interface PinEntryProps {
  /** Where to redirect after successful PIN auth */
  redirectTo?: string;
}

export default function PinEntry({ redirectTo }: PinEntryProps) {
  const router = useRouter();
  const supabase = createClient();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/auth/pin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() }),
      });

      const data = await res.json();

      if (data.success) {
        // If server returned session tokens, set them on the client-side Supabase client
        if (data.session?.access_token && data.session?.refresh_token) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
        }

        router.push(redirectTo || '/');
        router.refresh();
      } else {
        setAttempts((a) => a + 1);
        if (attempts >= 2) {
          setError('Too many attempts. Please try again later.');
          setTimeout(() => setAttempts(0), 30000);
        } else {
          setError('Incorrect PIN. Please try again.');
        }
        setPin('');
      }
    } catch {
      setError('Failed to verify PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDigitClick = (digit: string) => {
    setPin((p) => p + digit);
    setError(null);
  };

  const handleBackspace = () => {
    setPin((p) => p.slice(0, -1));
    setError(null);
  };

  return (
    <div className="glass-card rounded-2xl p-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
          <Lock className="h-6 w-6 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-stone-800">Enter PIN</h1>
        <p className="mt-2 text-sm text-stone-500">
          Enter the household PIN to access Plantcaer
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200/50 px-4 py-3 text-sm text-red-600 text-center">
            {error}
          </div>
        )}

        {/* PIN dots — dynamic based on pin length */}
        <div className="flex justify-center gap-3">
          {Array.from({ length: pin.length || 4 }).map((_, i) => (
            <div
              key={i}
              className={`h-3.5 w-3.5 rounded-full transition-all duration-150 ${
                pin.length > i
                  ? 'bg-emerald-500 scale-110'
                  : 'bg-stone-300'
              }`}
            />
          ))}
        </div>

        {/* Hidden input for fallback */}
        <div className="relative">
          <input
            type={showPin ? 'text' : 'password'}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/[^0-9]/g, ''));
              setError(null);
            }}
            className="w-full rounded-xl border border-stone-200/50 bg-white/80 px-4 py-3 text-center text-lg tracking-[0.5em] text-stone-900 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            placeholder="Enter PIN"
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
          />
          <button
            type="button"
            onClick={() => setShowPin(!showPin)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
          >
            {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Num pad */}
        <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigitClick(String(d))}
              className="h-14 rounded-xl bg-stone-100/50 text-lg font-medium text-stone-800 hover:bg-stone-200/50 active:bg-stone-200/80 active:scale-95 transition-all"
            >
              {d}
            </button>
          ))}
          <div />
          <button
            type="button"
            onClick={() => handleDigitClick('0')}
            className="h-14 rounded-xl bg-white/5 text-lg font-medium text-white hover:bg-white/10 active:bg-white/15 active:scale-95 transition-all disabled:opacity-30"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 rounded-xl bg-stone-100/50 text-sm text-stone-500 hover:bg-stone-200/50 active:scale-95 transition-all"
          >
            ⌫
          </button>
        </div>

        <button
          type="submit"
          disabled={!pin || loading}
          className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying...
            </span>
          ) : (
            'Unlock'
          )}
        </button>
      </form>
    </div>
  );
}
