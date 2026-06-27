'use client';

import { AuthForm } from '@/components/auth-form';
import { useState, useEffect } from 'react';
import { Lock, Mail, ChevronLeft } from 'lucide-react';
import PinEntry from '@/components/pin-entry';

export default function LoginPage() {
  const [mode, setMode] = useState<'choose' | 'pin' | 'email'>('choose');

  // Check if PIN is available
  const [pinAvailable, setPinAvailable] = useState(false);
  // Get redirect_to from URL
  const redirectTo = typeof window !== 'undefined'
    ? (() => {
        const raw = new URLSearchParams(window.location.search).get('redirect_to');
        return raw && raw.startsWith('/') ? raw : '/';
      })()
    : '/';

  useEffect(() => {
    fetch('/auth/pin/setup', { method: 'HEAD' })
      .then(res => setPinAvailable(res.ok || res.status === 200))
      .catch(() => setPinAvailable(false));
  }, []);

  if (mode === 'pin') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <button
            onClick={() => setMode('choose')}
            className="mb-4 flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-600 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <PinEntry redirectTo={redirectTo} />
        </div>
      </div>
    );
  }

  if (mode === 'email') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <button
            onClick={() => setMode('choose')}
            className="mb-4 flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-600 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            All sign-in options
          </button>
          <div className="glass-card rounded-2xl p-8">
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold text-stone-800">Welcome back</h1>
              <p className="mt-2 text-sm text-stone-500">Sign in to your plant journal</p>
            </div>
            <AuthForm mode="login" redirectTo={redirectTo} />
          </div>
        </div>
      </div>
    );
  }

  // Choose mode
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="glass-card rounded-2xl p-8">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-stone-800">Welcome back</h1>
            <p className="mt-2 text-sm text-stone-500">Sign in to your plant journal</p>
          </div>

          <div className="space-y-3">
            {pinAvailable && (
              <button
                onClick={() => setMode('pin')}
                className="w-full flex items-center gap-4 rounded-xl border border-stone-200/50 bg-amber-50/50 px-5 py-4 text-left hover:bg-stone-100/80 hover:border-emerald-400/50 transition-all group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 group-hover:bg-emerald-200 transition-colors">
                  <Lock className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-stone-800">Family PIN</p>
                  <p className="text-xs text-stone-400 mt-0.5">Sign in with your household PIN</p>
                </div>
              </button>
            )}

            <button
              onClick={() => setMode('email')}
              className="w-full flex items-center gap-4 rounded-xl border border-stone-200/50 bg-amber-50/50 px-5 py-4 text-left hover:bg-stone-100/80 hover:border-emerald-400/50 transition-all group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100/50 group-hover:bg-stone-200/50 transition-colors">
                <Mail className="h-5 w-5 text-stone-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-stone-800">Email</p>
                <p className="text-xs text-stone-400 mt-0.5">Sign in with your email and password</p>
              </div>
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-stone-500">
              Don&apos;t have an account?{' '}
              <a href="/auth/signup" className="text-emerald-600 hover:text-emerald-500 transition-colors font-medium">
                Sign up
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
