'use client';

import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface AuthFormProps {
  mode: 'login' | 'signup';
  redirectTo?: string;
}

export function AuthForm({ mode, redirectTo }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Timeout fallback: show an error if API takes >15s
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      setLoading(false);
      setError('Request timed out. Please check your network connection and try again.');
    }, 15000);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (timedOut) return; // timeout already handled
        clearTimeout(timeoutId);
        if (error) throw error;
        router.push(redirectTo || '/');
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (timedOut) return;
        clearTimeout(timeoutId);
        if (error) throw error;
        router.push('/auth/login?check_email=true');
        router.refresh();
      }
    } catch (err) {
      if (timedOut) return;
      clearTimeout(timeoutId);
      console.error('Auth error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      if (!timedOut) {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-900 border border-red-500 px-4 py-3 text-sm text-red-200 font-medium">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-white mb-1.5">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full rounded-xl border border-white/30 bg-white/15 px-4 py-2.5 text-sm text-white placeholder:text-white/45 focus:border-emerald-400 focus:outline-none focus:ring-[3px] focus:ring-emerald-400/35 transition-all"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-semibold text-white mb-1.5">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="optional"
          className="w-full rounded-xl border border-white/30 bg-white/15 px-4 py-2.5 text-sm text-white placeholder:text-white/45 focus:border-emerald-400 focus:outline-none focus:ring-[3px] focus:ring-emerald-400/35 transition-all"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] cursor-pointer border-0"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            {mode === 'login' ? 'Signing in...' : 'Creating account...'}
          </span>
        ) : mode === 'login' ? (
          'Sign in'
        ) : (
          'Create account'
        )}
      </button>

      <p className="text-center text-sm text-white/50">
        {mode === 'login' ? (
          <>
            Don&apos;t have an account?{' '}
            <a href="/auth/signup" className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
              Sign up
            </a>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <a href="/auth/login" className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
              Sign in
            </a>
          </>
        )}
      </p>
    </form>
  );
}
