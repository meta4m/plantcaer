// Plantcaer Service Worker — v2
// Cache-first for static assets, network-first for API calls
// Handles push notifications and periodic background checks

const CACHE_NAME = 'plantcaer-v2';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
];

// Install event — pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event — cache-first for static, network-first for API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and Supabase connections
  if (request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;
  if (url.hostname.includes('supabase.in')) return;

  // API calls — network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Next.js static assets (_next) — cache first
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Static files (icons, fonts, etc.) — cache first
  if (url.pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|woff2?|css|js)$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navigation requests — network first, serve cached page as fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Everything else — network first
  event.respondWith(networkFirst(request));
});

// ─── Push Notification Event ───────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'Plantcaer';
    const options = {
      body: data.body || '',
      icon: data.icon || '/icon-192.svg',
      badge: data.badge || '/icon-192.svg',
      data: data.data || {},
      tag: data.tag || 'default',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      silent: false,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    // If it's not JSON, show raw text
    event.waitUntil(
      self.registration.showNotification('Plantcaer', {
        body: event.data.text(),
        icon: '/icon-192.svg',
      })
    );
  }
});

// ─── Notification Click Event ──────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/care/calendar';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window tab is already open, focus it
      for (const client of windowClients) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ─── Periodic Background Sync ──────────────────────────────

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'plantcaer-care-check') {
    event.waitUntil(checkCareTasks());
  }
});

async function checkCareTasks() {
  try {
    const response = await fetch('/api/push/check', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();

    if (data.notified) {
      // The push was already handled by the server via web push
      console.log('[SW] Care notification sent:', data);
    }
  } catch (err) {
    console.error('[SW] Failed to check care tasks:', err);
  }
}

// Cache-first strategy
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

// Network-first strategy
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      return caches.match('/');
    }
    return new Response('Offline', { status: 503 });
  }
}
