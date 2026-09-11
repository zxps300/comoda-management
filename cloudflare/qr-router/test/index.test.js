import assert from 'node:assert/strict'
import test from 'node:test'
import worker, { handleRequest, hmacForTable, normalizeOrigin } from '../src/index.js'

class MemoryKv {
  constructor(entries = {}) {
    this.entries = new Map(Object.entries(entries))
  }

  async get(key) {
    return this.entries.get(key) ?? null
  }

  async put(key, value) {
    this.entries.set(key, value)
  }
}

const healthyFetch = async () => new Response('ok', { status: 200 })

function state(origin = 'https://quiet-sun.trycloudflare.com') {
  return JSON.stringify({ origin, enabled: true, updatedAt: '2026-08-30T00:00:00.000Z' })
}

test('normalizes only root trycloudflare HTTPS origins', () => {
  assert.equal(normalizeOrigin('https://quiet-sun.trycloudflare.com'), 'https://quiet-sun.trycloudflare.com')
  assert.equal(normalizeOrigin('http://quiet-sun.trycloudflare.com'), null)
  assert.equal(normalizeOrigin('https://api.trycloudflare.com'), null)
  assert.equal(normalizeOrigin('https://example.com'), null)
  assert.equal(normalizeOrigin('https://quiet-sun.trycloudflare.com/path'), null)
})

test('redirects a valid signed table QR to the current tunnel', async () => {
  const secret = 'table-secret-for-tests'
  const signature = await hmacForTable(secret, 4)
  const env = {
    ROUTES: new MemoryKv({ active_origin: state() }),
    TABLE_LINK_SECRET: secret,
  }

  const response = await handleRequest(
    new Request(`https://comoda.example/t/4/${signature}`),
    env,
    { fetcher: healthyFetch },
  )

  assert.equal(response.status, 302)
  assert.equal(
    response.headers.get('Location'),
    `https://quiet-sun.trycloudflare.com/menu.html?table=4&qr=${signature}`,
  )
  assert.equal(response.headers.get('Cache-Control'), 'no-store, max-age=0')
})

test('rejects guessed table links', async () => {
  const env = {
    ROUTES: new MemoryKv({ active_origin: state() }),
    TABLE_LINK_SECRET: 'table-secret-for-tests',
  }
  const response = await handleRequest(
    new Request('https://comoda.example/t/4/AAAAAAAAAAAAAAAAAAAAAA'),
    env,
    { fetcher: healthyFetch },
  )
  assert.equal(response.status, 403)
})

test('returns a retrying offline page when no tunnel is published', async () => {
  const response = await worker.fetch(
    new Request('https://comoda.example/menu'),
    { ROUTES: new MemoryKv() },
  )
  assert.equal(response.status, 503)
  assert.equal(response.headers.get('Retry-After'), '10')
  assert.match(await response.text(), /reconnecting/i)
})

test('updates the origin only with the correct token and healthy target', async () => {
  const routes = new MemoryKv()
  const env = { ROUTES: routes, UPDATE_TOKEN: 'update-secret' }
  const request = new Request('https://comoda.example/_system/origin', {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer update-secret',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ origin: 'https://fresh-river.trycloudflare.com' }),
  })

  const response = await handleRequest(request, env, { fetcher: healthyFetch })
  assert.equal(response.status, 200)
  const saved = JSON.parse(await routes.get('active_origin'))
  assert.equal(saved.origin, 'https://fresh-river.trycloudflare.com')
  assert.equal(saved.enabled, true)
})

test('retries a transient tunnel health failure while publishing an origin', async () => {
  let attempts = 0
  const fetcher = async () => {
    attempts += 1
    return new Response(attempts === 1 ? 'warming up' : 'ok', {
      status: attempts === 1 ? 530 : 200,
    })
  }
  const env = {
    ROUTES: new MemoryKv(),
    UPDATE_TOKEN: 'update-secret',
  }

  const response = await handleRequest(
    new Request('https://comoda.example/_system/origin', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer update-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ origin: 'https://fresh-river.trycloudflare.com' }),
    }),
    env,
    { fetcher },
  )

  assert.equal(response.status, 200)
  assert.equal(attempts, 2)
})

test('does not change the saved origin after an unauthorized update', async () => {
  const original = state('https://old-river.trycloudflare.com')
  const routes = new MemoryKv({ active_origin: original })
  const env = { ROUTES: routes, UPDATE_TOKEN: 'update-secret' }
  const request = new Request('https://comoda.example/_system/origin', {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer wrong-secret',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ origin: 'https://fresh-river.trycloudflare.com' }),
  })

  const response = await handleRequest(request, env, { fetcher: healthyFetch })
  assert.equal(response.status, 401)
  assert.equal(await routes.get('active_origin'), original)
})
