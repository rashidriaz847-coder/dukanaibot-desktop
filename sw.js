// ═══════════════════════════════════════
//  DUKAAN AI BOT — SERVICE WORKER v16
//  Full Offline Support + Icon Fix
// ═══════════════════════════════════════

const CACHE_NAME = 'dukaan-v16';
const OFFLINE_PAGE = '/index.html';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js',
  'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
];

// ── INSTALL ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([OFFLINE_PAGE, '/icon-192.png', '/icon-512.png']).then(() => {
        return Promise.allSettled(
          PRECACHE_URLS.filter(u => u !== '/' && u !== '/index.html' && !u.endsWith('.png')).map(url =>
            fetch(url, { mode: 'cors' })
              .then(res => res.ok ? cache.put(url, res) : null)
              .catch(() => null)
          )
        );
      });
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: purana cache hata do ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Network-first for HTML (fresh data), cache-first for assets ──
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (url.hostname === 'api.anthropic.com') return;
  if (url.hostname === 'wa.me' || url.hostname === 'api.whatsapp.com') return;

  // HTML (main app): network-first so customer data always fresh
  if (req.destination === 'document' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(req)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
          }
          return response;
        })
        .catch(() => caches.match(OFFLINE_PAGE))
    );
    return;
  }

  // Assets: stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(req).then(cached => {
        const networkFetch = fetch(req)
          .then(response => {
            if (response && response.status === 200) {
              cache.put(req, response.clone());
            }
            return response;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(networkFetch);
          return cached;
        }

        return networkFetch.then(res => {
          if (res) return res;
          return new Response('', { status: 408, statusText: 'Offline' });
        });
      })
    )
  );
});

// ── PUSH NOTIFICATIONS ──
self.addEventListener('push', event => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'Dukaan AI Bot', {
        body: data.body || '',
        icon: data.icon || '/icon-192.png',
        badge: data.badge || '/icon-192.png',
        tag: data.tag || 'dukaan-notif',
        vibrate: [200, 100, 200],
        data: data.data || {}
      })
    );
  } catch(e) {}
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      if (clientList.length > 0) return clientList[0].focus();
      return clients.openWindow('/');
    })
  );
});
