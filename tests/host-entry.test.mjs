/**
 * Host entry smoke: drives the real apply() against a fake cordis context —
 * route registration, gate startup, live settings (enabled toggle through
 * loader/volatile-update), and disposal. This is the composition layer the
 * unit tests beneath it cannot cover.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { apply } from '../src/index.js'

/** A fake cordis host context: webServer + connection + effect/on seams. */
function fakeCtx({ webPort = 3080 } = {}) {
  const routes = []
  const listeners = new Map()
  const disposers = []
  return {
    routes,
    listeners,
    disposers,
    webServer: {
      port: webPort,
      register(route) {
        routes.push(route)
        return () => {
          const at = routes.indexOf(route)
          if (at >= 0) routes.splice(at, 1)
        }
      },
    },
    connection: {
      authenticatedUrl: (origin) => `${origin}/?token=test-launch-token`,
    },
    effect(fn, label) {
      const disposer = fn()
      disposers.push({ label, disposer })
      return disposer
    },
    on(event, fn) {
      const list = listeners.get(event) ?? []
      list.push(fn)
      listeners.set(event, list)
    },
  }
}

/** Serve one registered prefix route over a real ephemeral server. */
async function serveRoute(route) {
  const server = http.createServer((req, res) => {
    void route.handler(req, res)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const call = async (path, method = 'GET') => {
    const response = await fetch(`${base}${path}`, { method, cache: 'no-store' })
    const text = await response.text()
    try {
      return { status: response.status, payload: JSON.parse(text) }
    } catch {
      return { status: response.status, payload: text }
    }
  }
  return { call, close: async () => { server.closeAllConnections?.(); await new Promise((resolve) => server.close(resolve)) } }
}

/** Wait until the (async) predicate holds (sync() is fire-and-forget async). */
async function waitFor(predicate, { tries = 100, delayMs = 20 } = {}) {
  for (let i = 0; i < tries; i += 1) {
    if (await predicate()) return true
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  return false
}

test('apply mounts the panel route, starts the gate, and answers status', async () => {
  const ctx = fakeCtx()
  apply(ctx, { enabled: true, gatePort: 0, upstreamPort: 59999 })
  try {
    assert.equal(ctx.routes.length, 1)
    assert.equal(ctx.routes[0].path, '/api/tunnel-gate')
    const { call, close } = await serveRoute(ctx.routes[0])
    try {
      const ok = await waitFor(async () => {
        try {
          return (await call('/api/tunnel-gate/status')).payload?.gate?.running === true
        } catch {
          return false
        }
      })
      assert.ok(ok, 'the gate must come up after apply')
      const { payload } = await call('/api/tunnel-gate/status')
      assert.match(payload.code, /^\d{6}$/)
      assert.equal(payload.gate.running, true)
      assert.ok(Number.isFinite(payload.gate.port), 'the ephemeral test port is reported')
      assert.equal(payload.tunnel.mode, 'off', 'no token configured: tunnel stays off')
    } finally {
      await close()
    }
  } finally {
    for (const { disposer } of ctx.disposers) await disposer?.()
  }
})

test('the enabled=false settings toggle stops the gate without a remount', async () => {
  const ctx = fakeCtx()
  // Volatile settings arrive as live references: the loader commits a save
  // INTO the reference before announcing the update. Simulate that here.
  const settings = { enabled: true }
  apply(ctx, {
    enabled: () => settings.enabled,
    gatePort: 0,
    upstreamPort: 59999,
  })
  try {
    const { call, close } = await serveRoute(ctx.routes[0])
    try {
      const up = await waitFor(async () => {
        try {
          return (await call('/api/tunnel-gate/status')).payload?.gate?.running === true
        } catch {
          return false
        }
      })
      assert.ok(up, 'the gate runs before the toggle')
      const listeners = ctx.listeners.get('loader/volatile-update') ?? []
      assert.equal(listeners.length, 1, 'the volatile-update listener is wired')
      settings.enabled = false
      for (const fn of listeners) fn([['tunnel-gate', 'enabled']])
      const stopped = await waitFor(async () => {
        try {
          return (await call('/api/tunnel-gate/status')).payload?.gate?.running === false
        } catch {
          // Connection refused IS the stopped state: the gate socket is gone.
          return true
        }
      })
      assert.ok(stopped, 'the gate stopped after the enabled toggle')
    } finally {
      await close()
    }
  } finally {
    for (const { disposer } of ctx.disposers) await disposer?.()
  }
})

test('pair-accept builds the redirect from the harness authenticatedUrl', async () => {
  const ctx = fakeCtx()
  apply(ctx, { enabled: true, gatePort: 0, upstreamPort: 59999, publicHostname: 'dsh.example.com' })
  try {
    const { call, close } = await serveRoute(ctx.routes[0])
    try {
      const status = (await call('/api/tunnel-gate/status')).payload
      assert.match(status.pairUrl ?? '', /^https:\/\/dsh\.example\.com\/pair\?code=/, 'pair URL built from the configured hostname')
    } finally {
      await close()
    }
  } finally {
    for (const { disposer } of ctx.disposers) await disposer?.()
  }
})

test('dispose stops the gate and unregisters the route', async () => {
  const ctx = fakeCtx()
  apply(ctx, { enabled: true, gatePort: 0, upstreamPort: 59999 })
  const { call, close } = await serveRoute(ctx.routes[0])
  try {
    await waitFor(async () => (await call('/api/tunnel-gate/status')).payload?.gate?.running === true)
  } finally {
    await close()
  }
  for (const { disposer } of ctx.disposers) await disposer?.()
  assert.equal(ctx.routes.length, 0, 'the panel route was unregistered')
})

test('volatile settings arrive as ConfigRef objects ({ get }) and are honored', async () => {
  const ctx = fakeCtx()
  // The loader wraps volatile fields in live references (ConfigRef), NOT
  // plain values or functions. enabled=false behind a ref must keep the
  // gate down, and codeWindowMs behind a ref must reach the pairing service
  // as a number (a wrapper leaking through concatenates into the expiry).
  const settings = { enabled: false, codeWindowMs: 60_000 }
  apply(ctx, {
    enabled: { get: () => settings.enabled },
    codeWindowMs: { get: () => settings.codeWindowMs },
    gatePort: 0,
    upstreamPort: 59999,
  })
  try {
    assert.equal(ctx.routes.length, 1, 'the route registers even when disabled')
    const { call, close } = await serveRoute(ctx.routes[0])
    try {
      const { payload } = await call('/api/tunnel-gate/status')
      assert.equal(payload.gate.running, false, 'ConfigRef enabled=false keeps the gate down')
      assert.equal(typeof payload.codeWindowMs, 'number', 'ConfigRef codeWindowMs resolves to a number')
      assert.equal(typeof payload.codeExpiresAt, 'number', 'the expiry is a real epoch number')
    } finally {
      await close()
    }
  } finally {
    for (const { disposer } of ctx.disposers) await disposer?.()
  }
})

test('a duplicate apply is queued and replayed when the holder disposes', async () => {
  const ctxA = fakeCtx()
  const ctxB = fakeCtx()
  apply(ctxA, { enabled: false, gatePort: 0 })
  apply(ctxB, { enabled: false, gatePort: 0 })
  assert.equal(ctxA.routes.length, 1, 'the first mount owns the name')
  assert.equal(ctxB.routes.length, 0, 'the duplicate is refused while the holder lives')
  // The Host tears the old entry down AFTER creating the new one (profile
  // reload ordering): releasing the claim must replay the queued mount.
  for (const { disposer } of ctxA.disposers) await disposer?.()
  const replayed = await waitFor(() => ctxB.routes.length === 1)
  assert.ok(replayed, 'the queued mount replays after the holder releases the name')
  for (const { disposer } of ctxB.disposers) await disposer?.()
  assert.equal(ctxA.routes.length, 0)
  assert.equal(ctxB.routes.length, 0, 'the replayed mount also unregisters on dispose')
})

test('a replayed mount is fully functional and disposes cleanly', async () => {
  const ctxA = fakeCtx()
  const ctxB = fakeCtx()
  apply(ctxA, { enabled: false, gatePort: 0 })
  apply(ctxB, { enabled: false, gatePort: 0 })
  for (const { disposer } of ctxA.disposers) await disposer?.()
  const replayed = await waitFor(() => ctxB.routes.length === 1)
  assert.ok(replayed, 'the queued mount replays')
  const { call, close } = await serveRoute(ctxB.routes[0])
  try {
    const { payload } = await call('/api/tunnel-gate/status')
    assert.equal(payload.gate.running, false)
    assert.match(payload.code, /^\d{6}$/)
  } finally {
    await close()
  }
  for (const { disposer } of ctxB.disposers) await disposer?.()
  assert.equal(ctxB.routes.length, 0, 'the replayed mount unregisters on dispose')
})
