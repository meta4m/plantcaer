'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, CheckCircle2, AlertCircle, Trash2, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase';

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [pinConfigured, setPinConfigured] = useState(false);
  const [isHouseholdUser, setIsHouseholdUser] = useState(false);
  const [loading, setLoading] = useState(true);

  // PIN setup form
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }
      setUserEmail(user.email || null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        const res = await fetch('/auth/pin/setup', { headers });
        const data = await res.json();
        setPinConfigured(data.configured);
        setIsHouseholdUser(data.isHouseholdUser);
      } catch {
        setPinConfigured(false);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [supabase, router]);

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

    if (newPin.length < 4 || newPin.length > 10) {
      setSaveError('PIN must be between 4 and 10 digits');
      return;
    }

    if (!/^\d+$/.test(newPin)) {
      setSaveError('PIN must contain only digits');
      return;
    }

    if (newPin !== confirmPin) {
      setSaveError('PINs do not match');
      return;
    }

    setSaving(true);
    try {
      // Get access token from Supabase client session
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const res = await fetch('/auth/pin/setup', {
        method: 'POST',
        headers,
        body: JSON.stringify({ pin: newPin }),
      });

      let errorMsg = 'Failed to set PIN';
      try {
        const data = await res.json();
        errorMsg = data.error || errorMsg;
      } catch {
        errorMsg = 'Server error (invalid response)';
      }

      if (!res.ok) {
        setSaveError(errorMsg);
        return;
      }

      setSaveSuccess(true);
      setPinConfigured(true);
      setIsHouseholdUser(true);
      setNewPin('');
      setConfirmPin('');

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePin = async () => {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const headers: Record<string, string> = {};
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const res = await fetch('/auth/pin/setup', {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) {
        let errorMsg = 'Failed to remove PIN';
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch {
          errorMsg = 'Server error (invalid response)';
        }
        setSaveError(errorMsg);
        return;
      }

      setPinConfigured(false);
      setShowDeleteConfirm(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Network error. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-white/50">Manage your account and household settings</p>
      </div>

      {/* Account info */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Account</h2>
        {userEmail && (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-300 font-medium">
              {userEmail[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{userEmail}</p>
              <p className="text-xs text-white/40">Signed in</p>
            </div>
          </div>
        )}
      </div>

      {/* Family PIN settings */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <Lock className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Family PIN</h2>
            <p className="text-xs text-white/40">
              {pinConfigured
                ? 'A household PIN is configured. Family members can use it to sign in.'
                : 'Set a shared PIN so family members can access the app without creating accounts.'}
            </p>
          </div>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 mb-4 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            {pinConfigured ? 'PIN updated successfully!' : 'PIN removed successfully!'}
          </div>
        )}

        {saveError && (
          <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 mb-4 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>{saveError}</p>
          </div>
        )}

        <form onSubmit={handleSetPin} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="new-pin" className="block text-sm font-medium text-white/70 mb-1.5">
                {pinConfigured ? 'New PIN' : 'Family PIN'}
              </label>
              <div className="relative">
                <input
                  id="new-pin"
                  type={showPin ? 'text' : 'password'}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                  placeholder="4-10 digits"
                  maxLength={10}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pr-10 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirm-pin" className="block text-sm font-medium text-white/70 mb-1.5">
                Confirm PIN
              </label>
              <input
                id="confirm-pin"
                type={showPin ? 'text' : 'password'}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                placeholder="Repeat PIN"
                maxLength={10}
                inputMode="numeric"
                pattern="[0-9]*"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving || !newPin || !confirmPin}
              className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </span>
              ) : pinConfigured ? (
                'Update PIN'
              ) : (
                'Set PIN'
              )}
            </button>

            {pinConfigured && isHouseholdUser && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-xl border border-red-500/30 px-5 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-all"
              >
                <Trash2 className="h-4 w-4 inline-block mr-1.5" />
                Remove PIN
              </button>
            )}
          </div>
        </form>

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4">
            <p className="text-sm text-red-300 mb-3">
              Are you sure? This will remove the family PIN. Family members will need to sign up with email to continue accessing the app.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDeletePin}
                disabled={deleting}
                className="rounded-lg bg-red-500 px-4 py-2 text-xs font-semibold text-white hover:bg-red-400 disabled:opacity-50 transition-all"
              >
                {deleting ? 'Removing...' : 'Yes, remove PIN'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg border border-white/10 px-4 py-2 text-xs text-white/50 hover:text-white hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
