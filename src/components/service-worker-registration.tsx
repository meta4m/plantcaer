'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker for PWA offline support.
 * This component doesn't render anything — it just performs the registration
 * as a side effect when mounted in the layout.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      // Register the service worker
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    }
  }, []);

  return null;
}
