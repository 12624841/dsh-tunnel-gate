/**
 * Gate server tests: the full 16177 surface — pairing pages, code accept,
 * device gating, proxy dispatch, upgrade gating, and shutdown — against a
 * real loopback server with an ephemeral port.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createGateServer } from '../src/gate-server.js'
import { PairingService } from '../src/pairing.js'

/** Deterministic fake clock for the pairing service (codes are serial). */
function fakeClock() {
  let now = 1_000_000
  let serial = 0
  return {
    now: () => now,
    code: () => String(++serial).padStart(6, '0'),
    secret: () => 'a'.repeat(64),
    id: () => `device-${String(serial).padStart(4, '0')}`,
  }
}

/** One gate server against a fake upstream; returns helpers. */
async function makeGate({ buildPairAcceptUrl } = {}) {
  const seen = []
  const upstream = http.createServer((req, res) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      seen.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString('utf8') })
      res.writeHead(200, { 'content-type': 'text/plain', 'x-upstream': 'hit' })
      res.end(`upstream:${req.url}`)
    })
  })
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve))
  const pairing = new PairingService({
    windowMs: 60_000,
    maxDevices: 4,
    storeFile: '/dev/null/tunnel-gate-test-unused.json',
    clock: fakeClock(),
  })
  const gate = createGateServer({
    pairing,
    upstream: () => ({ host: '127.0.0.1', port: upstream.address().port }),
    buildPairAcceptUrl: buildPairAcceptUrl ?? ((origin) => `${origin}/?token=launch-token`),
  })
  await gate.start({ port: 0 })
  const base = `http://127.0.0.1:${gate.address().port}`
  return {
    gate,
    pairing,
    upstream,
    seen,
    base,
    cleanup: async () => {
      await gate.stop()
      upstream.closeAllConnections?.()
      await new Promise((resolve) => upstream.close(resolve))
    },
  }
}

/** Raw fetch that does not follow redirects (redirects are part of the contract). */
async function rawFetch(url, options = {}) {
  const response = await fetch(url, { ...options, redirect: 'manual' })
  const body = await response.text()
  return { status: response.status, headers: response.headers, setCookie: response.headers.getSetCookie?.() ?? [], body }
}

/** Extract the tg_device cookie value from a set-cookie header list. */
function deviceCookieOf(setCookieList) {
  const entry = setCookieList.find((cookie) => cookie.startsWith('tg_device='))
  return entry === undefined ? undefined : entry.slice('tg_device='.length).split(';')[0]
}

test('GET / without a device cookie redirects to the pairing page', async () => {
  const { base, cleanup } = await makeGate()
  try {
    const { status, headers } = await rawFetch(`${base}/`)
    assert.equal(status, 302)
    assert.equal(headers.get('location'), '/pair')
  } finally {
    await cleanup()
  }
})

test('GET /pair serves the code-input page', async () => {
  const { base, cleanup } = await makeGate()
  try {
    const { status, headers, body } = await rawFetch(`${base}/pair`)
    assert.equal(status, 200)
    assert.match(headers.get('content-type') ?? '', /text\/html/)
    assert.match(body, /pair-form|pairForm|6/)
    assert.match(body, /<input/)
  } finally {
    await cleanup()
  }
})

test('POST /pair with the current code pairs, sets the device cookie, and returns the accept redirect', async () => {
  const { base, pairing, cleanup } = await makeGate()
  try {
    const code = pairing.status().code
    const { status, setCookie, body } = await rawFetch(`${base}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 (iPhone) Safari' },
      body: JSON.stringify({ code }),
    })
    assert.equal(status, 200)
    const cookie = deviceCookieOf(setCookie)
    assert.match(cookie, /^device-\d{4}\./)
    assert.ok(setCookie.some((entry) => entry.includes('HttpOnly')))
    assert.ok(setCookie.some((entry) => entry.includes('SameSite=Lax')))
    const payload = JSON.parse(body)
    assert.equal(payload.ok, true)
    assert.equal(payload.next, `${base}/?token=launch-token`, 'redirect built from the request origin')
    assert.equal(pairing.size, 1)
  } finally {
    await cleanup()
  }
})

test('POST /pair with a wrong code refuses with invalid and leaks no cookie', async () => {
  const { base, pairing, cleanup } = await makeGate()
  try {
    pairing.status()
    const { status, setCookie, body } = await rawFetch(`${base}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: '999999' }),
    })
    assert.equal(status, 403)
    assert.deepEqual(JSON.parse(body), { ok: false, reason: 'invalid' })
    assert.equal(deviceCookieOf(setCookie), undefined)
  } finally {
    await cleanup()
  }
})

test('POST /pair locks into a 429 cooldown once the global failure budget burns', async () => {
  const pairing = new PairingService({
    windowMs: 60_000,
    maxDevices: 4,
    storeFile: '/dev/null/tunnel-gate-test-unused.json',
    clock: fakeClock(),
  })
  const gate = createGateServer({
    pairing,
    upstream: () => ({ host: '127.0.0.1', port: 1 }),
    buildPairAcceptUrl: (origin) => `${origin}/?token=x`,
  })
  await gate.start({ port: 0 })
  const base = `http://127.0.0.1:${gate.address().port}`
  try {
    for (let i = 0; i < 5; i += 1) {
      const attempt = await rawFetch(`${base}/pair`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: '999999' }),
      })
      assert.equal(attempt.status, 403, `failure ${i + 1} is a 403`)
    }
    // The 6th failure IS the budget: it starts the cooldown.
    const sixth = await rawFetch(`${base}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: '999999' }),
    })
    assert.equal(sixth.status, 429)
    assert.deepEqual(JSON.parse(sixth.body), { ok: false, reason: 'cooldown' })
    // The budget is burnt: even the CORRECT code now meets the cooldown wall.
    const locked = await rawFetch(`${base}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: pairing.status().code }),
    })
    assert.equal(locked.status, 429)
    assert.deepEqual(JSON.parse(locked.body), { ok: false, reason: 'cooldown' })
  } finally {
    await gate.stop()
  }
})

test('POST /pair flags the cookie Secure when the request arrived over https (tunnel)', async () => {
  const { base, pairing, cleanup } = await makeGate()
  try {
    const code = pairing.status().code
    const { setCookie } = await rawFetch(`${base}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-proto': 'https' },
      body: JSON.stringify({ code }),
    })
    assert.ok(setCookie.some((entry) => entry.includes('Secure')))
  } finally {
    await cleanup()
  }
})

test('a paired device is proxied to the upstream with the Host rewritten to the loopback authority', async () => {
  const { base, pairing, seen, cleanup } = await makeGate()
  try {
    const { cookie } = pairing.accept(pairing.status().code, { userAgent: 'test' })
    const response = await fetch(`${base}/some/path?q=1`, { headers: { cookie: `tg_device=${cookie}` } })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'upstream:/some/path?q=1')
    assert.equal(seen.length, 1)
    assert.equal(seen[0].headers.host, `127.0.0.1:${seen[0].headers.host.split(':')[1]}`)
    assert.match(seen[0].headers.host, /^127\.0\.0\.1:\d+$/, 'upstream Host is the loopback authority')
  } finally {
    await cleanup()
  }
})

test('an invalid device cookie is sent back to pairing', async () => {
  const { base, cleanup } = await makeGate()
  try {
    const { status, headers } = await rawFetch(`${base}/`, { headers: { cookie: 'tg_device=bogus.value' } })
    assert.equal(status, 302)
    assert.equal(headers.get('location'), '/pair')
  } finally {
    await cleanup()
  }
})

test('gate-ping answers without pairing (tunnel health check)', async () => {
  const { base, cleanup } = await makeGate()
  try {
    const { status, body } = await rawFetch(`${base}/gate-ping`)
    assert.equal(status, 200)
    assert.equal(body, 'ok')
  } finally {
    await cleanup()
  }
})

test('an upgrade without a device cookie is refused outright', async () => {
  const { base, cleanup } = await makeGate()
  try {
    const client = http.request(`${base}/api/remote.mux`.replace('http://', 'http://'), {
      headers: { connection: 'Upgrade', upgrade: 'websocket', host: base.replaceAll('http://', '') },
    })
    const outcome = await new Promise((resolve) => {
      client.on('response', (res) => resolve({ kind: 'response', status: res.statusCode }))
      client.on('error', (error) => resolve({ kind: 'error', message: error.message }))
      client.end()
    })
    assert.equal(outcome.kind, 'response')
    assert.equal(outcome.status, 401)
  } finally {
    await cleanup()
  }
})

test('a paired upgrade is tunneled to the upstream', async () => {
  const pairing = new PairingService({
    windowMs: 60_000,
    maxDevices: 4,
    storeFile: '/dev/null/tunnel-gate-test-unused.json',
    clock: fakeClock(),
  })
  const tnl = []
  const upstream = http.createServer(() => {})
  const hostSeen = new Promise((resolve) => {
    upstream.on('upgrade', (req, socket) => {
      tnl.push(socket)
      resolve(req.headers.host)
      socket.write('HTTP/1.1 101 Switching Protocols\r\nupgrade: websocket\r\nconnection: Upgrade\r\n\r\n')
    })
  })
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve))
  const gate = createGateServer({
    pairing,
    upstream: () => ({ host: '127.0.0.1', port: upstream.address().port }),
    buildPairAcceptUrl: (origin) => `${origin}/?token=x`,
  })
  await gate.start({ port: 0 })
  const base = `http://127.0.0.1:${gate.address().port}`
  try {
    const { cookie } = pairing.accept(pairing.status().code, { userAgent: 'test' })
    const client = http.request(`${base}/api/remote.mux`, {
      headers: {
        connection: 'Upgrade',
        upgrade: 'websocket',
        cookie: `tg_device=${cookie}`,
        host: base.replaceAll('http://', ''),
      },
    })
    const [status, host] = await new Promise((resolve, reject) => {
      client.on('upgrade', (res) => {
        hostSeen.then((h) => resolve([res.statusCode, h])).catch(reject)
      })
      client.on('response', (res) => reject(new Error(`plain response ${res.statusCode}`)))
      client.on('error', reject)
      client.end()
    })
    assert.equal(status, 101)
    assert.match(host, /^127\.0\.0\.1:\d+$/, 'the upstream sees the rewritten loopback Host')
  } finally {
    await gate.stop()
    for (const socket of tnl) socket.destroy()
    upstream.closeAllConnections?.()
    await new Promise((resolve) => upstream.close(resolve))
  }
})

test('start({ host }) binds the gate beyond loopback when asked (LAN access)', async () => {
  const pairing = new PairingService({
    windowMs: 60_000,
    maxDevices: 4,
    storeFile: '/dev/null/tunnel-gate-test-unused.json',
    clock: fakeClock(),
  })
  const gate = createGateServer({
    pairing,
    upstream: () => ({ host: '127.0.0.1', port: 1 }),
    buildPairAcceptUrl: (origin) => `${origin}/?token=x`,
  })
  await gate.start({ port: 0, host: '0.0.0.0' })
  try {
    assert.equal(gate.address().address, '0.0.0.0', 'the gate listens on all interfaces')
    const base = `http://127.0.0.1:${gate.address().port}`
    const response = await fetch(`${base}/gate-ping`)
    assert.equal(response.status, 200)
  } finally {
    await gate.stop()
  }
})

test('stop() shuts down even while an upgraded socket is open', async () => {
  const { gate, pairing, cleanup } = await makeGate()
  try {
    const { cookie } = pairing.accept(pairing.status().code, { userAgent: 'test' })
    // Open an upgrade attempt; the plain-200 upstream refuses it, but the gate
    // owns the raw socket either way, and stop() must not hang on it.
    const client = http.request(`${base0(gate)}/x`, {
      headers: { connection: 'Upgrade', upgrade: 'websocket', cookie: `tg_device=${cookie}` },
    })
    client.on('error', () => {})
    client.end()
    await new Promise((resolve) => setTimeout(resolve, 50))
    const stopped = gate.stop()
    await Promise.race([stopped, new Promise((_, reject) => setTimeout(() => reject(new Error('stop() hung')), 2_000))])
  } finally {
    await cleanup()
  }
})

/** Loopback base URL of a started gate. */
function base0(gate) {
  return `http://127.0.0.1:${gate.address().port}`
}
