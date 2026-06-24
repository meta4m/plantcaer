'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Sparkles, Bell, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { SettingsAiConfig } from '@/components/settings-ai-config';
import { SettingsNotifications } from '@/components/settings-notifications';

/** Hash a PIN using Web Crypto API (browser-compatible SHA-256) */
async function hashPinClient(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const TABS = [
  { id: 'pin', label: 'Family PIN', icon: Lock },
  { id: 'ai', label: 'AI Provider', icon: Sparkles },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>}>
      <SettingsPageContent />
    </Suspense>
  );
}

function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const initialTab = searchParams.get('tab') === 'notifications' ? 'notifications' : searchParams.get('tab') === 'ai' ? 'ai' : 'pin';
  const [activeTab, setActiveTab] = useState(initialTab);

  // PIN state
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [pinConfigured, setPinConfigured] = useState(false);
  const [isHouseholdUser, setIsHouseholdUser] = useState(false);
  const [settingsRowId, setSettingsRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // PIN form
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState(false);

  // PIN delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingPin, setDeletingPin] = useState(false);

  const switchTab = (tabId: string) => {
    setActiveTab(tabId);
    router.replace(`/settings?tab=${tabId}`, { scroll: false });
  };

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }
      setUserId(user.id);
      setUserEmail(user.email || null);

      try {
        const { data: settings } = await supabase
          .from('household_settings')
          .select('id, pin_hash, household_user_id')
          .maybeSingle();

        if (settings) {
          setSettingsRowId(settings.id);
          setPinConfigured(!!settings.pin_hash);
          setIsHouseholdUser(settings.household_user_id === user.id);
        } else {
          setPinConfigured(false);
          setIsHouseholdUser(false);
        }
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
    setPinError(null);
    setPinSuccess(false);

    if (!newPin) {
      setPinError('PIN is required');
      return;
    }

    if (!/^\d+$/.test(newPin)) {
      setPinError('PIN must contain only digits');
      return;
    }

    if (newPin !== confirmPin) {
      setPinError('PINs do not match');
      return;
    }

    setSavingPin(true);
    try {
      const hash = await hashPinClient(newPin);

      if (settingsRowId) {
        const { error } = await supabase
          .from('household_settings')
          .update({
            pin_hash: hash,
            pin_salt: '',
            household_user_id: userId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', settingsRowId);

        if (error) {
          setPinError(error.message);
          return;
        }
      } else {
        const { error } = await supabase
          .from('household_settings')
          .insert({
            pin_hash: hash,
            pin_salt: '',
            household_user_id: userId,
            display_name: 'My Household',
          });

        if (error) {
          setPinError(error.message);
          return;
        }

        const { data: newSettings } = await supabase
          .from('household_settings')
          .select('id')
          .maybeSingle();

        if (newSettings) {
          setSettingsRowId(newSettings.id);
        }
      }

      setPinSuccess(true);
      setPinConfigured(true);
      setIsHouseholdUser(true);
      setNewPin('');
      setConfirmPin('');
      setTimeout(() => setPinSuccess(false), 3000);
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Failed to set PIN');
    } finally {
      setSavingPin(false);
    }
  };

  const handleDeletePin = async () => {
    setDeletingPin(true);
    try {
      if (settingsRowId) {
        const { error } = await supabase
          .from('household_settings')
          .update({
            pin_hash: null,
            pin_salt: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', settingsRowId);

        if (error) {
          setPinError(error.message);
          return;
        }
      }

      setPinConfigured(false);
      setShowDeleteConfirm(false);
      setPinSuccess(true);
      setTimeout(() => setPinSuccess(false), 3000);
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Failed to remove PIN');
    } finally {
      setDeletingPin(false);
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-white/50">Manage your account and app configuration</p>
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

      {/* Tab navigation */}
      <div className="flex gap-1 rounded-xl bg-white/5 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-emerald-500/20 text-emerald-300 shadow-sm'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'pin' && (
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

          {pinSuccess && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 mb-4 text-sm text-emerald-300">
              <span>✓</span>
              {pinConfigured ? 'PIN updated successfully!' : 'PIN removed successfully!'}
            </div>
          )}

          {pinError && (
            <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 mb-4 text-sm text-red-400">
              <span className="mt-0.5 shrink-0">!</span>
              <p>{pinError}</p>
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
                    onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Enter PIN"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pr-10 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPin ? '🙈' : '👁️'}
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
                  onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Repeat PIN"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={savingPin || !newPin || !confirmPin}
                className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {savingPin ? (
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
                  Remove PIN
                </button>
              )}
            </div>
          </form>

          {showDeleteConfirm && (
            <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4">
              <p className="text-sm text-red-300 mb-3">
                Are you sure? This will remove the family PIN.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeletePin}
                  disabled={deletingPin}
                  className="rounded-lg bg-red-500 px-4 py-2 text-xs font-semibold text-white hover:bg-red-400 disabled:opacity-50 transition-all"
                >
                  {deletingPin ? 'Removing...' : 'Yes, remove PIN'}
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
      )}

      {activeTab === 'ai' && (
        <div className="glass-card rounded-2xl p-6">
          <SettingsAiConfig />
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="glass-card rounded-2xl p-6">
          <SettingsNotifications />
        </div>
      )}
    </div>
  );
}
