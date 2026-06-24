'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, Eye, EyeOff } from 'lucide-react';

interface PinEntryProps {
  /** Where to redirect after successful PIN auth */
  redirectTo?: string;
}

export default function PinEntry({ redirectTo }: PinEntryProps) {
  const router = useRouter();
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
    if (pin.length < 6) {
      setPin((p) => p + digit);
      setError(null);
    }
  };

  const handleBackspace = () => {
    setPin((p) => p.slice(0, -1));
    setError(null);
  };

  return (
    <div className="glass-card rounded-2xl p-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20">
          <Lock className="h-6 w-6 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Enter PIN</h1>
        <p className="mt-2 text-sm text-white/50">
          Enter the household PIN to access Plantcaer
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 text-center">
            {error}
          </div>
        )}

        {/* PIN dots */}
        <div className="flex justify-center gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`h-3.5 w-3.5 rounded-full transition-all duration-150 ${
                pin.length > i
                  ? 'bg-emerald-400 scale-110'
                  : 'bg-white/20'
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
              setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
              setError(null);
            }}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg tracking-[0.5em] text-white focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all"
            placeholder="••••••"
            maxLength={6}
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
          />
          <button
            type="button"
            onClick={() => setShowPin(!showPin)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
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
              disabled={pin.length >= 6}
              className="h-14 rounded-xl bg-white/5 text-lg font-medium text-white hover:bg-white/10 active:bg-white/15 active:scale-95 transition-all disabled:opacity-30"
            >
              {d}
            </button>
          ))}
          <div />
          <button
            type="button"
            onClick={() => handleDigitClick('0')}
            disabled={pin.length >= 6}
            className="h-14 rounded-xl bg-white/5 text-lg font-medium text-white hover:bg-white/10 active:bg-white/15 active:scale-95 transition-all disabled:opacity-30"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 rounded-xl bg-white/5 text-sm text-white/50 hover:bg-white/10 active:scale-95 transition-all"
          >
            ⌫
          </button>
        </div>

        <button
          type="submit"
          disabled={pin.length < 4 || loading}
          className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
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
