const SHELL_CACHE = 'comoda-menu-shell-v2'
const DATA_CACHE = 'comoda-menu-data-v2'
const IMAGE_CACHE = 'comoda-menu-images-v1'
const SHELL_FILES = ['/menu.html', '/fonts/fonts.css']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  const currentCaches = new Set([SHELL_CACHE, DATA_CACHE, IMAGE_CACHE])
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('comoda-menu-') && !currentCaches.has(key)).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

async function cacheResponse(cacheName, request, response) {
  if (response && (response.ok || response.type === 'opaque')) {
    const cache = await caches.open(cacheName)
    await cache.put(request, response.clone())
  }
  return response
}

async function networkFirst(request, cacheName, fallbackRequest = null) {
  try {
    const response = await fetch(request)
    return await cacheResponse(cacheName, request, response)
  } catch {
    return (await caches.match(request))
      || (fallbackRequest ? await caches.match(fallbackRequest) : null)
      || Response.error()
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached

  const response = await fetch(request)
  return cacheResponse(cacheName, request, response)
}

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE, '/menu.html'))
    return
  }

  if (url.pathname === '/api/menu') {
    event.respondWith(networkFirst(request, DATA_CACHE))
    return
  }

  if (request.destination === 'image' || url.pathname.startsWith('/storage/menu-items/')) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE))
    return
  }

  if (url.origin === self.location.origin && (request.destination === 'style' || request.destination === 'font')) {
    event.respondWith(cacheFirst(request, SHELL_CACHE))
  }
})

self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_MENU_IMAGES' || !Array.isArray(event.data.urls)) return

  const urls = [...new Set(event.data.urls)].filter(Boolean)
  event.waitUntil(
    caches.open(IMAGE_CACHE).then(cache => {
      const pending = [...urls]
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
    })
  )
})
