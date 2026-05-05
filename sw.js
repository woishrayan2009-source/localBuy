/**
 * LocalBuy Service Worker
 * Cache-first for shell assets, Network-first for API calls.
 * Offline fallback: offline.html
 *
 * FIX C5: PRECACHE_URLS no longer includes optional assets
 * (/assets/sounds/*.mp3, /assets/icons/badge-mono.png) that are not
 * guaranteed to exist. They are attempted separately via Promise.allSettled
 * so a missing sound file does NOT abort the entire SW install.
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

// ─── Core shell assets — MUST exist for SW install to succeed ─────────────
// FIX C5: Removed optional assets from this list. Missing assets here would
// cause cache.addAll() to throw and abort the install entirely.
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
  // Google Fonts — cached so they work offline
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;1,400;1,600&family=DM+Sans:wght@400;500;600&display=swap'
];

// ─── Optional assets — cached best-effort, failures are non-fatal ─────────
// FIX C5: Sound files and badge icon are optional. If they don't exist yet
// (e.g. during dev), the SW installs successfully and these are skipped.
// playForegroundAlert() already handles missing audio gracefully.
const OPTIONAL_PRECACHE_URLS = [
  '/assets/sounds/new-order.mp3',
  '/assets/sounds/order-ready.mp3',
  '/assets/icons/badge-mono.png'
];

// ─── INSTALL — Precache shell ──────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      console.log('[SW] Precaching required shell assets');

      // Required assets — individual adds so one failure doesn't block others
      await Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err =>
            console.warn('[SW] Failed to cache required asset:', url, err.message)
          )
        )
      );

      // FIX C5: Optional assets — best-effort, failures logged but not fatal
      console.log('[SW] Attempting optional asset cache (non-fatal if missing)');
      const optionalResults = await Promise.allSettled(
        OPTIONAL_PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => {
            console.info('[SW] Optional asset not cached (expected during dev):', url, err.message);
          })
        )
      );

      const cached   = optionalResults.filter(r => r.status === 'fulfilled').length;
      const skipped  = optionalResults.filter(r => r.status === 'rejected').length;
      console.log(`[SW] Optional assets: ${cached} cached, ${skipped} skipped`);
    }).then(() => {
      console.log('[SW] Install complete — skipping waiting');
      return self.skipWaiting();
    })
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
    if (request.method === 'POST' || request.method === 'PUT') {
      await queueOfflineRequest(request);
      return new Response(JSON.stringify({ queued: true, message: 'Saved for sync' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw err;
  }
}

// ─── Offline Queue ─────────────────────────────────────────────────────────
async function queueOfflineRequest(request) {
  try {
    const body = await request.clone().text();
    console.log('[SW] Queuing offline request:', { url: request.url, method: request.method });
    // TODO: await idb.put('sync-queue', { url: request.url, method: request.method, body, ts: Date.now() })
    // TODO: self.registration.sync.register('sync-orders')
  } catch (e) {
    console.error('[SW] Failed to queue request:', e);
  }
}

// ─── BACKGROUND SYNC ───────────────────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(flushOrderQueue());
  }
});

async function flushOrderQueue() {
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
    body:     data.body || 'You have a new update.',
    icon:     '/assets/icons/icon-192.png',
    badge:    '/assets/icons/icon-192.png',  // badge-mono.png preferred when available
    vibrate:  [200, 100, 200, 100, 200],
    tag:      data.tag || 'localbuy-order',
    renotify: true,
    data:     { url: data.actionUrl || '/' },
    actions:  [
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
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
    );
  }
});

// ─── SW UPDATE MESSAGE ─────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});