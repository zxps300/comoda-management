const ACTIVE_ORIGIN_KEY = 'active_origin'
const TABLE_MIN = 1
const TABLE_MAX = 15
const TRY_CLOUDFLARE_HOST = /^[a-z0-9-]+\.trycloudflare\.com$/

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

function text(message, status = 200, extraHeaders = {}) {
  return new Response(message, {
    status,
    headers: {
      ...SECURITY_HEADERS,
      'Content-Type': 'text/plain; charset=utf-8',
      ...extraHeaders,
    },
  })
}

function base64Url(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

async function hmacForTable(secret, table) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`table:${table}`))
  return base64Url(new Uint8Array(signature)).slice(0, 22)
}

async function constantTimeEqual(left, right) {
  const encoder = new TextEncoder()
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ])
  const leftBytes = new Uint8Array(leftHash)
  const rightBytes = new Uint8Array(rightHash)
  let mismatch = leftBytes.length ^ rightBytes.length
  for (let index = 0; index < leftBytes.length; index += 1) {
    mismatch |= leftBytes[index] ^ rightBytes[index]
  }
  return mismatch === 0
}

function normalizeOrigin(value) {
  if (typeof value !== 'string' || value.length > 200) return null

  let parsed
  try {
    parsed = new URL(value)
  } catch {
    return null
  }

  if (
    parsed.protocol !== 'https:'
    || !TRY_CLOUDFLARE_HOST.test(parsed.hostname)
    || parsed.hostname === 'api.trycloudflare.com'
    || parsed.username
    || parsed.password
    || (parsed.port && parsed.port !== '443')
    || (parsed.pathname !== '/' && parsed.pathname !== '')
    || parsed.search
    || parsed.hash
  ) {
    return null
  }

  return parsed.origin
}

async function readState(env) {
  const raw = await env.ROUTES.get(ACTIVE_ORIGIN_KEY)
  if (!raw) return null

  try {
    const state = JSON.parse(raw)
    const origin = normalizeOrigin(state?.origin)
    if (!state?.enabled || !origin) return null
    return { origin, updatedAt: state.updatedAt || null }
  } catch {
    return null
  }
}

async function originIsHealthy(origin, fetcher) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetcher(`${origin}/up`, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': 'Comoda-QR-Router/1.0' },
        signal: AbortSignal.timeout(8000),
      })
      if (response.status >= 200 && response.status < 400) return true
    } catch {
      // A newly registered Quick Tunnel can briefly be unavailable at one
      // Cloudflare edge. Retry before presenting the reconnect screen.
    }
  }

  return false
}

function offlinePage() {
  const body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="refresh" content="10">
  <title>Comoda Menu</title>
  <style>
    :root{color-scheme:light}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f7f0e4;color:#3f2415;font-family:Inter,Segoe UI,sans-serif}.card{width:min(430px,100%);padding:34px 30px;text-align:center;background:#fffaf2;border:1px solid #dfc79e;border-radius:22px;box-shadow:0 18px 50px rgba(74,43,25,.12)}.mark{width:58px;height:58px;margin:0 auto 18px;display:grid;place-items:center;border-radius:18px;background:#6f3b1f;color:#fff;font-size:27px}h1{margin:0 0 10px;font-family:Georgia,serif;font-size:30px}p{margin:0;color:#765a46;line-height:1.55}.retry{margin-top:18px;font-size:13px;color:#a36b32}
  </style>
</head>
<body><main class="card"><div class="mark">C</div><h1>Comoda</h1><p>The digital menu is reconnecting. Please keep this page open or scan the QR code again shortly.</p><p class="retry">Trying again automatically in 10 seconds…</p></main></body>
</html>`

  return new Response(body, {
    status: 503,
    headers: {
      ...SECURITY_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Retry-After': '10',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    },
  })
}

async function authenticateUpdate(request, env) {
  if (!env.UPDATE_TOKEN) return false
  const header = request.headers.get('Authorization') || ''
  if (!header.startsWith('Bearer ')) return false
  return constantTimeEqual(header.slice(7), env.UPDATE_TOKEN)
}

async function handleOriginUpdate(request, env, fetcher) {
  if (request.method !== 'PUT') {
    return text('Method not allowed', 405, { Allow: 'PUT' })
  }
  if (!(await authenticateUpdate(request, env))) return text('Unauthorized', 401)

  const contentLength = Number(request.headers.get('Content-Length') || 0)
  if (contentLength > 2048) return text('Payload too large', 413)

  let payload
  try {
    payload = await request.json()
  } catch {
    return text('Invalid JSON', 400)
  }

  const origin = normalizeOrigin(payload?.origin)
  if (!origin) return text('Invalid tunnel origin', 422)
  if (!(await originIsHealthy(origin, fetcher))) return text('Tunnel is not healthy', 422)

  const state = {
    origin,
    enabled: true,
    updatedAt: new Date().toISOString(),
  }
  await env.ROUTES.put(ACTIVE_ORIGIN_KEY, JSON.stringify(state))
  return json({ success: true, updatedAt: state.updatedAt })
}

async function redirectToMenu(request, env, fetcher, table = null, signature = null) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return text('Method not allowed', 405, { Allow: 'GET, HEAD' })
  }

  if (table !== null) {
    if (!env.TABLE_LINK_SECRET) return offlinePage()
    const expected = await hmacForTable(env.TABLE_LINK_SECRET, table)
    if (!(await constantTimeEqual(signature || '', expected))) return text('QR code is not valid', 403)
  }

  const state = await readState(env)
  if (!state) return offlinePage()

  const destination = new URL('/menu.html', state.origin)
  if (table !== null) {
    destination.searchParams.set('table', String(table))
    destination.searchParams.set('qr', signature)
  }

  return new Response(null, {
    status: 302,
    headers: {
      ...SECURITY_HEADERS,
      Location: destination.toString(),
    },
  })
}

export async function handleRequest(request, env, options = {}) {
  const fetcher = options.fetcher || fetch
  const url = new URL(request.url)

  if (url.pathname === '/_system/origin') {
    return handleOriginUpdate(request, env, fetcher)
  }

  if (url.pathname === '/health') {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return text('Method not allowed', 405, { Allow: 'GET, HEAD' })
    }
    const state = await readState(env)
    return json({ configured: Boolean(state), updatedAt: state?.updatedAt || null })
  }

  if (url.pathname === '/' || url.pathname === '/menu') {
    return redirectToMenu(request, env, fetcher)
  }

  const match = url.pathname.match(/^\/t\/(\d{1,2})\/([A-Za-z0-9_-]{22})$/u)
  if (match) {
    const table = Number(match[1])
    if (Number.isInteger(table) && table >= TABLE_MIN && table <= TABLE_MAX) {
      return redirectToMenu(request, env, fetcher, table, match[2])
    }
  }

  return text('Not found', 404)
}

export { hmacForTable, normalizeOrigin }

export default {
  fetch(request, env) {
    return handleRequest(request, env)
  },
}
