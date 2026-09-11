const CACHE = 'comoda-app-shell-v2'
const IMAGE_CACHE = 'comoda-app-images-v1'
const APP_SHELL = ['/offline.html', '/manifest.webmanifest', '/comoda-purchaser-icon.svg']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys
      .filter(key => (key.startsWith('comoda-app-') || key.startsWith('comoda-purchaser-')) && ![CACHE, IMAGE_CACHE].includes(key))
      .map(key => caches.delete(key))
  )).then(() => self.clients.claim()))
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()))
      return response
    }).catch(async () => (await caches.match(request)) || caches.match('/offline.html')))
    return
  }

  if (request.destination === 'image' || url.pathname.startsWith('/storage/menu-items/')) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok || response.type === 'opaque') caches.open(IMAGE_CACHE).then(cache => cache.put(request, response.clone()))
      return response
    })))
    return
  }

  if (url.pathname.startsWith('/api/')) return

  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()))
      return response
    })))
  }
})

self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_MENU_IMAGES' || !Array.isArray(event.data.urls)) return

  event.waitUntil(caches.open(IMAGE_CACHE).then(cache => {
    const pending = [...new Set(event.data.urls)].filter(Boolean)
    const cacheNext = async () => {
      while (pending.length) {
        const url = pending.shift()
        try {
          const absoluteUrl = new URL(url, self.location.origin)
          const request = new Request(absoluteUrl.href, { mode: absoluteUrl.origin === self.location.origin ? 'same-origin' : 'no-cors' })
          if (await cache.match(request)) continue
          const response = await fetch(request)
          if (response.ok || response.type === 'opaque') await cache.put(request, response)
        } catch { /* Keep caching the remaining photos. */ }
      }
    }
    return Promise.all(Array.from({ length: Math.min(3, pending.length) }, cacheNext))
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(clients.matchAll({ type:'window', includeUncontrolled:true }).then(windows => {
    const existing = windows.find(client => new URL(client.url).pathname === '/inventory')
    return existing ? existing.focus() : clients.openWindow('/inventory')
  }))
})
