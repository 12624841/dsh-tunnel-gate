/**
 * Panel route tests: the `/api/tunnel-gate/*` surface mounted on the DSH
 * webserver — loopback-trust enforcement, status snapshot, code rotation,
 * device revocation, and tunnel restart — exercised over real HTTP.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { PairingService } from '../src/pairing.js'
import { createPanelRoutes } from '../src/panel-routes.js'

function fakeClock() {
  let now = 1_000_000
  let serial = 0
  return {
    now: () => now,
    code: () => String(++serial).padStart(6, '0'),
    secret: () => 'a'.repeat(64),
    id: () => `device-${String(++serial).padStart(4, '0')}`,
  }
}

/** Wire the routes onto a real ephemeral server; return a request helper. */
async function makeApp({ host = `127.0.0.1`, trustedHosts = [], headers = {} } = {}) {
  const pairing = new PairingService({
    windowMs: 60_000,
    maxDevices: 4,
    storeFile: '/dev/null/tunnel-gate-test-unused.json',
    clock: fakeClock(),
  })
  let restarts = 0
  let gateRestarts = 0
  const routes = createPanelRoutes({
    pairing,
    tunnelState: () => ({ mode: 'named', state: 'running', publicUrl: 'https://dsh.example.com', error: undefined }),
    tunnelRestart: async () => {
      restarts += 1
    },
    gateRestart: async () => {
      gateRestarts += 1
    },
    gateInfo: () => ({ port: 16177, running: true, host: '127.0.0.1', lanUrls: [] }),
    configSnapshot: () => ({ publicHostname: 'https://dsh.example.com', gateHost: '127.0.0.1', autoTunnel: false, enabled: true }),
    publicBase: () => 'https://dsh.example.com',
    trustedHosts: () => trustedHosts,
  })
  const route = routes[0]
  assert.equal(route.kind, 'prefix')
  assert.equal(route.path, '/api/tunnel-gate')
  const server = http.createServer((req, res) => {
    req.headers.host = req.headers.host ?? `${host}:3080`
    for (const [key, value] of Object.entries(headers)) req.headers[key] = value
    void route.handler(req, res)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const call = async (pathAndQuery, { method = 'GET', body, extraHeaders = {} } = {}) => {
    const response = await fetch(`${base}${pathAndQuery}`, {
      method,
      headers: body === undefined ? extraHeaders : { 'content-type': 'application/json', ...extraHeaders },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await response.text()
    let payload = null
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
    return { status: response.status, payload }
  }
  // Raw request helper: can override Host (fetch forbids it as a forbidden header).
  const callRaw = (pathAndQuery, { method = 'GET', headers = {} } = {}) =>
    new Promise((resolve, reject) => {
      const request = http.request(`${base}${pathAndQuery}`, { method, headers }, (response) => {
        const chunks = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          let payload = null
          try {
            payload = JSON.parse(text)
          } catch {
            payload = text
          }
          resolve({ status: response.statusCode, payload })
        })
      })
      request.on('error', reject)
      request.end()
    })
  return { pairing, call, callRaw, restartCount: () => restarts, gateRestartCount: () => gateRestarts, close: () => server.closeAllConnections?.() ?? server.close() }
}

test('status answers the full snapshot for a loopback caller', async () => {
  const { call, close } = await makeApp()
  try {
    const { status, payload } = await call('/api/tunnel-gate/status')
    assert.equal(status, 200)
    assert.match(payload.code, /^\d{6}$/)
    assert.ok(Number.isFinite(payload.codeExpiresAt))
    assert.equal(payload.tunnel.mode, 'named')
    assert.equal(payload.tunnel.state, 'running')
    assert.equal(payload.tunnel.publicUrl, 'https://dsh.example.com')
    assert.equal(payload.publicUrl, 'https://dsh.example.com', 'the configured origin is always reported (click-test even when the tunnel is down)')
    assert.equal(payload.gate.port, 16177)
    assert.equal(payload.gate.running, true)
    assert.equal(payload.pairUrl, `https://dsh.example.com/pair?code=${payload.code}`)
    assert.deepEqual(payload.devices, [])
    assert.deepEqual(payload.config, {
      publicHostname: 'https://dsh.example.com',
      gateHost: '127.0.0.1',
      autoTunnel: false,
      enabled: true,
    }, 'the config snapshot rides the status so remote pages can echo it')
  } finally {
    close()
  }
})

test('a non-loopback Host is refused with 403 and reveals nothing', async () => {
  const { callRaw, close } = await makeApp()
  try {
    const { status, payload } = await callRaw('/api/tunnel-gate/status', { headers: { host: 'evil.example' } })
    assert.equal(status, 403)
    assert.deepEqual(payload, { ok: false, reason: 'untrusted' })
  } finally {
    close()
  }
})

test('a mismatched Origin on a loopback Host is refused like the harness fence', async () => {
  const { callRaw, close } = await makeApp()
  try {
    const { status } = await callRaw('/api/tunnel-gate/status', {
      headers: { host: '127.0.0.1', origin: 'https://evil.example' },
    })
    assert.equal(status, 403)
  } finally {
    close()
  }
})

test('a cross-site browser marker is refused like the harness fence refuses it', async () => {
  const app = await makeApp({ headers: { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' } })
  try {
    const { status } = await app.call('/api/tunnel-gate/status')
    assert.equal(status, 403)
  } finally {
    app.close()
  }
})

test('a trusted non-loopback Host is accepted', async () => {
  const app = await makeApp({ trustedHosts: ['dsh.example.com'] })
  try {
    const { status } = await app.callRaw('/api/tunnel-gate/status', { headers: { host: 'dsh.example.com' } })
    assert.equal(status, 200)
  } finally {
    app.close()
  }
})

test('rotate mints a fresh code window', async () => {
  const { call, close } = await makeApp()
  try {
    const before = (await call('/api/tunnel-gate/status')).payload
    const { status, payload } = await call('/api/tunnel-gate/rotate', { method: 'POST' })
    assert.equal(status, 200)
    assert.notEqual(payload.code, before.code)
    const after = (await call('/api/tunnel-gate/status')).payload
    assert.equal(after.code, payload.code)
  } finally {
    close()
  }
})

test('revoke removes a device from the roster', async () => {
  const { pairing, call, close } = await makeApp()
  try {
    pairing.accept(pairing.status().code, { userAgent: 'Test UA' })
    const [device] = (await call('/api/tunnel-gate/status')).payload.devices
    const { status, payload } = await call('/api/tunnel-gate/devices/revoke', { method: 'POST', body: { id: device.id } })
    assert.equal(status, 200)
    assert.equal(payload.ok, true)
    assert.deepEqual((await call('/api/tunnel-gate/status')).payload.devices, [])
  } finally {
    close()
  }
})

test('revoke of an unknown device answers 404', async () => {
  const { call, close } = await makeApp()
  try {
    const { status } = await call('/api/tunnel-gate/devices/revoke', { method: 'POST', body: { id: 'nope' } })
    assert.equal(status, 404)
  } finally {
    close()
  }
})

test('revoke-all reports how many sessions died', async () => {
  const { pairing, call, close } = await makeApp()
  try {
    pairing.accept(pairing.status().code, { userAgent: 'x' })
    pairing.accept(pairing.status().code, { userAgent: 'y' })
    const { status, payload } = await call('/api/tunnel-gate/devices/revoke-all', { method: 'POST' })
    assert.equal(status, 200)
    assert.equal(payload.revoked, 2)
  } finally {
    close()
  }
})

test('gate/restart invokes the gate seam and reports the live gate info', async () => {
  const { call, gateRestartCount, close } = await makeApp()
  try {
    const { status, payload } = await call('/api/tunnel-gate/gate/restart', { method: 'POST' })
    assert.equal(status, 200)
    assert.equal(payload.ok, true)
    assert.equal(payload.gate.port, 16177)
    assert.equal(gateRestartCount(), 1)
  } finally {
    close()
  }
})

test('tunnel/restart invokes the restart seam and reports it', async () => {
  const { call, restartCount, close } = await makeApp()
  try {
    const { status } = await call('/api/tunnel-gate/tunnel/restart', { method: 'POST' })
    assert.equal(status, 200)
    assert.equal(restartCount(), 1)
  } finally {
    close()
  }
})
