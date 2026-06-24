'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export function SettingsNotifications() {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    setLoading(true);
    try {
      // Check if push is supported
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setSupported(false);
        setLoading(false);
        return;
      }

      // Check existing subscription
      const registration = await navigator.serviceWorker.ready;
      const existingSub = await registration.pushManager.getSubscription();
      setSubscribed(!!existingSub);
    } catch {
      setSupported(false);
    } finally {
      setLoading(false);
    }
  };

  const subscribe = async () => {
    setSubscribing(true);
    setError(null);
    setSuccess(null);

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Notification permission was denied. Enable it in your browser settings.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      // Get the VAPID public key from the server
      const vapidRes = await fetch('/api/push/vapid-public-key');
      if (!vapidRes.ok) {
        setError('Push notifications are not configured on the server yet.');
        return;
      }
      const { publicKey } = await vapidRes.json();

      // Subscribe to push
      const keyBuffer: BufferSource = urlBase64ToUint8Array(publicKey) as unknown as BufferSource;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBuffer,
      });

      // Send subscription to server
      const subJson = subscription.toJSON();
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          p256dhKey: subJson.keys?.p256dh,
          authKey: subJson.keys?.auth,
          userAgent: navigator.userAgent,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save subscription');
      }

      setSubscribed(true);
      setSuccess('Notifications enabled! You\'ll receive reminders for due and overdue care tasks.');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable notifications');
    } finally {
      setSubscribing(false);
    }
  };

  const unsubscribe = async () => {
    setSubscribing(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push service
        await subscription.unsubscribe();

        // Remove from server
        const endpoint = subscription.endpoint;
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, {
          method: 'DELETE',
        });
      }

      setSubscribed(false);
      setSuccess('Notifications disabled.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable notifications');
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-white/40" />
      </div>
    );
  }

  if (!supported) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center">
            <BellOff className="h-5 w-5 text-white/30" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
            <p className="text-xs text-white/40">
              Push notifications are not supported in your browser or environment.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
          subscribed ? 'bg-emerald-500/15' : 'bg-white/5'
        }`}>
          <Bell className={`h-5 w-5 ${subscribed ? 'text-emerald-400' : 'text-white/30'}`} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Notifications</h2>
          <p className="text-xs text-white/40">
            {subscribed
              ? 'You\'ll receive push notifications for due and overdue care tasks.'
              : 'Get notified when your plants need care.'}
          </p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 mb-4 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 mb-4 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p>{error}</p>
            {error.includes('VAPID') && (
              <p className="text-xs text-red-300/70 mt-1">
                Ask the app admin to set up VAPID keys in the server environment.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="rounded-xl bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Push Notifications</p>
              <p className="text-xs text-white/40 mt-0.5">
                {subscribed
                  ? 'You\'ll get notified about overdue and due care tasks.'
                  : 'Allow notifications to receive care reminders.'}
              </p>
            </div>
            {subscribed ? (
              <button
                onClick={unsubscribe}
                disabled={subscribing}
                className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/30 disabled:opacity-50 transition-all"
              >
                {subscribing ? 'Disabling...' : 'Disable'}
              </button>
            ) : (
              <button
                onClick={subscribe}
                disabled={subscribing}
                className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 transition-all"
              >
                {subscribing ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Enabling...
                  </span>
                ) : (
                  'Enable'
                )}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Check Frequency</p>
              <p className="text-xs text-white/40 mt-0.5">
                Checks for due and overdue tasks when you open the app, and via periodic background sync.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Convert a base64-encoded VAPID public key to a Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
