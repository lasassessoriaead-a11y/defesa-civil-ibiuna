/* Service Worker for Defesa Civil Municipal PWA */
const CACHE_VERSION = 'defesa-civil-v2'
const STATIC_CACHE = `defesa-civil-static-${CACHE_VERSION}`
const RUNTIME_CACHE = `defesa-civil-runtime-${CACHE_VERSION}`

// Core static assets to precache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/pwa-icon.svg',
  '/pwa-icon-maskable.svg',
  '/favicon.ico',
  '/painel',
  '/ocorrencias',
  '/oficios',
  '/autorizacoes',
  '/relatorios',
]

// Install event: Precache application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Precache failed during install:', err)
      }),
  )
})

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(
              (name) =>
                name.startsWith('defesa-civil-') && name !== STATIC_CACHE && name !== RUNTIME_CACHE,
            )
            .map((name) => caches.delete(name)),
        )
      })
      .then(() => self.clients.claim()),
  )
})

// Fetch event: Strategy depends on request type
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  // Skip PocketBase backend API calls and realtime SSE connections
  // We want PocketBase API to run live online without stale caching
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/realtime')) {
    return
  }

  // Handle SPA navigation requests: Network-first with /index.html cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone()
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return response
        })
        .catch(async () => {
          // Offline fallback: return cached page or index.html shell
          const cachedResponse = await caches.match(request)
          if (cachedResponse) {
            return cachedResponse
          }
          const indexFallback = await caches.match('/index.html')
          if (indexFallback) {
            return indexFallback
          }
          return caches.match('/')
        }),
    )
    return
  }

  // Static assets (scripts, styles, images, fonts)
  // Stale-While-Revalidate or Cache-First with network fallback
  const isStaticAsset =
    (url.origin === self.location.origin &&
      (url.pathname.startsWith('/assets/') ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.ico') ||
        url.pathname.endsWith('.woff2'))) ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('tile.openstreetmap.org')

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Fetch update in background to refresh cache
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(STATIC_CACHE).then((cache) => cache.put(request, networkResponse))
              }
            })
            .catch(() => {
              /* ignore background fetch failures */
            })
          return cachedResponse
        }

        // Not in cache: fetch from network and store
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone()
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseClone))
            }
            return networkResponse
          })
          .catch(() => {
            return new Response('', { status: 408, statusText: 'Request Timeout' })
          })
      }),
    )
    return
  }

  // Google Fonts / External CDN assets
  if (url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        return (
          cachedResponse ||
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone()
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseClone))
            }
            return networkResponse
          })
        )
      }),
    )
    return
  }

  // Default: Network with runtime cache fallback
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          url.origin === self.location.origin
        ) {
          const responseClone = networkResponse.clone()
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseClone))
        }
        return networkResponse
      })
      .catch(() => {
        return caches.match(request)
      }),
  )
})
