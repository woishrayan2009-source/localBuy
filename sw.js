/**
 * LocalBuy Service Worker
 * Cache-first for shell assets, Network-first for API calls.
 * Offline fallback: offline.html
 *
 * Strategy overview:
 *  - INSTALL  → precache all shell assets
 *  - ACTIVATE → clean up stale caches
 *  - FETCH    → cache-first for navigation/assets, network-first for /api/*
 *  - PUSH     → show notification with actions
 *  - SYNC     → flush queued offline orders
 */

const CACHE_NAME    = 'localbuy-shell-v1';
const RUNTIME_CACHE = 'localbuy-runtime-v1';

// ─── Shell assets to precache on install ───────────────────────────────────
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/customer.html',
  '/shopkeeper.html',
  '/offline.html',
  '/css/main.css',
  '/css/animations.css',
  '/css/customer.css',
  '/css/shopkeeper.css',
  '/js/app.js',
  '/js/customer.js',
  '/js/shopkeeper.js',
  '/js/i18n.js',
  '/js/notifications.js',
  '/js/upi.js',
  '/js/geo.js',
  '/js/db-bridge.js',
  '/js/sw-register.js',
  '/assets/manifest.json',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon-maskable.png',
  '/assets/sounds/new-order.mp3',
  '/assets/sounds/order-ready.mp3',
  // Google Fonts — cached so they work offline
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;1,400;1,600&family=DM+Sans:wght@400;500;600&display=swap'
];

// ─── INSTALL — Precache shell ──────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Precaching shell assets');
      // addAll fails if any URL fails — use individual adds to be resilient
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Failed to cache:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE — Clean stale caches ─────────────────────────────────────────
self.addEventListener('activate', event => {
  const allowedCaches = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => !allowedCaches.includes(key))
            .map(key => {
              console.log('[SW] Deleting stale cache:', key);
              return caches.delete(key);
            })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH — Route requests ────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // RULE: Never cache /api/* routes — always network-first
  // NOTE: SW must not cache API responses per security spec (section 11)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithQueue(request));
    return;
  }

  // RULE: Navigation requests → cache-first, offline.html fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request)
          .then(response => {
            // Cache successful navigation responses at runtime
            if (response.ok) {
              const clone = response.clone();
              caches.open(RUNTIME_CACHE).then(c => c.put(request, clone));
            }
            return response;
          })
          .catch(() => caches.match('/offline.html'));
      })
    );
    return;
  }

  // RULE: All other requests (CSS, JS, images, fonts) → cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok && !url.pathname.startsWith('/api/')) {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(request, clone));
        }
        return response;
      }).catch(() => {
        // For image failures, could return a placeholder
        // For everything else, just fail gracefully
        return new Response('', { status: 408, statusText: 'Offline' });
      });
    })
  );
});

// ─── Network-first with offline queue (for /api/* calls) ──────────────────
async function networkFirstWithQueue(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (err) {
    // Only queue POST/PUT requests (mutations, not reads)
    if (request.method === 'POST' || request.method === 'PUT') {
      await queueOfflineRequest(request);
      // Return a synthetic "queued" response
      return new Response(JSON.stringify({ queued: true, message: 'Saved for sync' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    // For GET failures, just fail
    throw err;
  }
}

// ─── Offline Queue — save to IndexedDB ────────────────────────────────────
async function queueOfflineRequest(request) {
  // TODO: Replace with real IndexedDB implementation
  // This stub just logs the intent.
  // Real implementation:
  // 1. Open IndexedDB 'localbuy-sync-queue' objectStore
  // 2. Store { url, method, body, timestamp }
  // 3. Register background sync tag
  try {
    const body = await request.clone().text();
    console.log('[SW] Queuing offline request:', { url: request.url, method: request.method, body });
    // TODO: await idb.put('sync-queue', { url: request.url, method: request.method, body, ts: Date.now() })
    // TODO: self.registration.sync.register('sync-orders')
  } catch (e) {
    console.error('[SW] Failed to queue request:', e);
  }
}

// ─── BACKGROUND SYNC — Flush queued orders ────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(flushOrderQueue());
  }
});

async function flushOrderQueue() {
  // TODO: Replace stub with real implementation:
  // 1. Open IndexedDB sync-queue
  // 2. Iterate all queued items
  // 3. POST each to /api/orders
  // 4. On success, remove from queue
  // 5. On failure (still offline), leave in queue for next sync
  console.log('[SW] Background sync: flushing order queue');
  // TODO: const queue = await idb.getAll('sync-queue')
  // TODO: for (const item of queue) { await fetch(item.url, { method: item.method, body: item.body }) }
}

// ─── PUSH — Show notification ──────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: '🛒 LocalBuy', body: event.data.text() };
  }

  const options = {
    body:    data.body || 'You have a new update.',
    icon:    '/assets/icons/icon-192.png',
    badge:   '/assets/icons/icon-192.png',      // TODO: Replace with badge-mono.png (monochrome)
    vibrate: [200, 100, 200, 100, 200],
    tag:     data.tag || 'localbuy-order',
    renotify: true,
    data:    { url: data.actionUrl || '/' },
    actions: [
      { action: 'view',    title: data.actionLabel || 'View Order' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '🛒 LocalBuy', options)
  );
});

// ─── NOTIFICATION CLICK ────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'view') {
    const targetUrl = event.notification.data.url || '/customer.html';
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        // Focus existing window if open
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
    );
  }
});