'use client';

import { AuthForm } from '@/components/auth-form';
import { useState, useEffect } from 'react';
import { Lock, Mail, ChevronLeft } from 'lucide-react';
import PinEntry from '@/components/pin-entry';

export default function SignupPage() {
  const [mode, setMode] = useState<'choose' | 'pin' | 'email'>('choose');
  const [pinAvailable, setPinAvailable] = useState(false);

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
            className="mb-4 flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <PinEntry />
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
            className="mb-4 flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            All options
          </button>
          <div className="glass-card rounded-2xl p-8">
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold text-white">Create account</h1>
              <p className="mt-2 text-sm text-white/70">Start tracking your plants</p>
            </div>
            <AuthForm mode="signup" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="glass-card rounded-2xl p-8">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-white">Get started</h1>
            <p className="mt-2 text-sm text-white/50">Start tracking your plants</p>
          </div>

          <div className="space-y-3">
            {pinAvailable && (
              <button
                onClick={() => setMode('pin')}
                className="w-full flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-left hover:bg-white/10 hover:border-emerald-400/30 transition-all group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 group-hover:bg-emerald-500/25 transition-colors">
                  <Lock className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Family PIN</p>
                  <p className="text-xs text-white/40 mt-0.5">Enter your household PIN</p>
                </div>
              </button>
            )}

            <button
              onClick={() => setMode('email')}
              className="w-full flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-left hover:bg-white/10 hover:border-white/20 transition-all group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors">
                <Mail className="h-5 w-5 text-white/60" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Email</p>
                <p className="text-xs text-white/40 mt-0.5">Create an account with email and password</p>
              </div>
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-white/50">
              Already have an account?{' '}
              <a href="/auth/login" className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
