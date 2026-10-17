/**
 * Pairing state machine tests: code windows, rate limiting, device sessions,
 * persistence. Runs on the node:test runner with an injected fake clock — no
 * timers, no sleeps.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PairingService, deviceNameOf, MAX_FAILURES_PER_COOLDOWN, COOLDOWN_MS } from '../src/pairing.js'

test('six global failures trigger a 30-second cooldown for everyone', () => {
  const { service, clock, cleanup } = makeService()
  try {
    const code = service.status().code
    for (let i = 0; i < MAX_FAILURES_PER_COOLDOWN; i += 1) {
      service.accept('000000', { userAgent: `bot-${i}` })
    }
    // Even the CORRECT code is refused during the cooldown.
    const locked = service.accept(code, { userAgent: 'victim' })
    assert.equal(locked.ok, false)
    assert.equal(locked.reason, 'cooldown')
    const status = service.status()
    assert.equal(status.cooldownUntil, clock.now() + COOLDOWN_MS, 'the whole gate is cooling down')
  } finally {
    cleanup()
  }
})

test('the cooldown expires into a fresh window with a new code', () => {
  const { service, clock, cleanup } = makeService()
  try {
    service.status()
    for (let i = 0; i < MAX_FAILURES_PER_COOLDOWN; i += 1) {
      service.accept('000000', { userAgent: 'bot' })
    }
    clock.advance(COOLDOWN_MS + 1)
    const status = service.status()
    assert.equal(status.cooldownUntil, undefined, 'the cooldown is over')
    // The post-cooldown code is a FRESH window: every attempt made during the
    // cooldown is void — the attacker is back to zero knowledge.
    const retry = service.accept(status.code, { userAgent: 'user' })
    assert.equal(retry.ok, true)
  } finally {
    cleanup()
  }
})

/** A fake clock: deterministic now, deterministic serial codes/secrets/ids. */
function fakeClock() {
  let now = 1_000_000
  let serial = 0
  return {
    now: () => now,
    advance: (ms) => {
      now += ms
    },
    code: () => String(++serial).padStart(6, '0'),
    secret: () => 'a'.repeat(64),
    id: () => `device-${String(serial).padStart(4, '0')}`,
  }
}

/** One service against a throwaway store file. */
function makeService({ windowMs = 60_000, maxDevices = 8 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'tunnel-gate-test-'))
  const storeFile = join(dir, 'devices.json')
  const clock = fakeClock()
  const service = new PairingService({ windowMs, maxDevices, storeFile, clock })
  return {
    service,
    clock,
    storeFile,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  }
}

test('status exposes a six-digit code with its window bounds', () => {
  const { service, clock, cleanup } = makeService({ windowMs: 60_000 })
  try {
    const status = service.status()
    assert.match(status.code, /^\d{6}$/)
    assert.equal(status.codeExpiresAt - status.codeStartedAt, 60_000)
    assert.equal(status.codeExpiresAt, clock.now() + 60_000)
  } finally {
    cleanup()
  }
})

test('the code rotates to a fresh window after expiry', () => {
  const { service, clock, cleanup } = makeService({ windowMs: 60_000 })
  try {
    const first = service.status()
    clock.advance(60_001)
    const second = service.status()
    assert.ok(second.codeStartedAt > first.codeStartedAt)
    assert.equal(second.codeExpiresAt, clock.now() + 60_000)
  } finally {
    cleanup()
  }
})

test('accept with a wrong code fails as invalid and burns one attempt', () => {
  const { service, cleanup } = makeService()
  try {
    const result = service.accept('000000', { userAgent: 'test' })
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'invalid')
    const second = service.accept('000000', { userAgent: 'test' })
    assert.equal(second.ok, false)
  } finally {
    cleanup()
  }
})

test('accept records the client IP; verify updates it when the device changes network', () => {
  const { service, clock, cleanup } = makeService()
  try {
    const { cookie } = service.accept(service.status().code, {
      clientKey: '203.0.113.7', clientIp: '203.0.113.7', userAgent: 'test',
    })
    assert.equal(service.status().devices[0].ip, '203.0.113.7', 'the pairing IP is recorded')

    clock.advance(10_000)
    // 同一设备换了网络（新 IP）：verify 时更新 lastIp
    service.verify(cookie, '198.51.100.9')
    assert.equal(service.status().devices[0].ip, '198.51.100.9', 'lastIp follows the latest network')
  } finally {
    cleanup()
  }
})

test('accept without a client IP stores unknown rather than crashing', () => {
  const { service, cleanup } = makeService()
  try {
    service.accept(service.status().code, { clientKey: 'x', userAgent: 'test' })
    assert.equal(service.status().devices[0].ip, 'unknown')
  } finally {
    cleanup()
  }
})

test('accept with the right code pairs a device, returns its cookie, and retires the code', () => {
  const { service, cleanup } = makeService()
  try {
    const code = service.status().code
    const result = service.accept(code, { userAgent: 'Mozilla/5.0 (iPhone) Safari' })
    assert.equal(result.ok, true)
    assert.match(result.cookie, /^device-0001\./)
    // One device in the roster, named from the UA.
    const status = service.status()
    assert.equal(status.devices.length, 1)
    assert.match(status.devices[0].name, /iPhone/)
  } finally {
    cleanup()
  }
})

test('a paired cookie verifies to its device and updates lastSeenAt', () => {
  const { service, clock, cleanup } = makeService()
  try {
    const code = service.status().code
    const { cookie } = service.accept(code, { userAgent: 'test' })
    clock.advance(10_000)
    const device = service.verify(cookie)
    assert.ok(device, 'cookie must verify')
    assert.equal(device.id, 'device-0001')
    assert.equal(device.lastSeenAt, clock.now())
  } finally {
    cleanup()
  }
})

test('a tampered cookie is refused', () => {
  const { service, cleanup } = makeService()
  try {
    const code = service.status().code
    const { cookie } = service.accept(code, { userAgent: 'test' })
    const [id, secret] = cookie.split('.')
    assert.equal(service.verify(`${id}.${secret.slice(0, -2)}ff`), undefined)
    assert.equal(service.verify(`${id.slice(0, -2)}ff.${secret}`), undefined)
    assert.equal(service.verify('nonsense'), undefined)
    assert.equal(service.verify(undefined), undefined)
  } finally {
    cleanup()
  }
})

test('revoke kills the session immediately', () => {
  const { service, cleanup } = makeService()
  try {
    const { cookie } = service.accept(service.status().code, { userAgent: 'test' })
    const device = service.verify(cookie)
    assert.equal(service.revoke(device.id), true)
    assert.equal(service.verify(cookie), undefined)
  } finally {
    cleanup()
  }
})

test('revokeAll clears every session and returns the count', () => {
  const { service, cleanup } = makeService({ maxDevices: 4 })
  try {
    service.accept(service.status().code, { userAgent: 'test' })
    service.accept(service.status().code, { userAgent: 'test' })
    assert.equal(service.revokeAll(), 2)
    assert.equal(service.size, 0)
  } finally {
    cleanup()
  }
})

test('sessions persist across a service restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tunnel-gate-test-'))
  const storeFile = join(dir, 'devices.json')
  try {
    const first = new PairingService({ windowMs: 60_000, maxDevices: 8, storeFile, clock: fakeClock() })
    const { cookie } = first.accept(first.status().code, { userAgent: 'test' })
    const second = new PairingService({ windowMs: 60_000, maxDevices: 8, storeFile, clock: fakeClock() })
    const device = second.verify(cookie)
    assert.ok(device, 'the cookie must survive the restart')
    assert.equal(device.id, 'device-0001')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a corrupt store file is an empty table, not a crash', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tunnel-gate-test-'))
  const storeFile = join(dir, 'devices.json')
  try {
    writeStore(storeFile, '{not json')
    const service = new PairingService({ windowMs: 60_000, maxDevices: 8, storeFile, clock: fakeClock() })
    assert.equal(service.size, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the device table evicts the least-recently-seen device when full', () => {
  const { service, clock, cleanup } = makeService({ maxDevices: 2 })
  try {
    const first = service.accept(service.status().code, { userAgent: 'first' })
    clock.advance(5_000)
    const second = service.accept(service.status().code, { userAgent: 'second' })
    clock.advance(5_000)
    // Touch the first device so it becomes the most recently seen.
    service.verify(first.cookie)
    clock.advance(5_000)
    const third = service.accept(service.status().code, { userAgent: 'third' })
    assert.equal(third.ok, true)
    assert.equal(service.verify(second.cookie), undefined, 'the untouched older device is evicted')
    assert.ok(service.verify(first.cookie), 'the touched device survives')
    assert.ok(service.verify(third.cookie), 'the newest device survives')
  } finally {
    cleanup()
  }
})

test('rotate() retires the current code immediately', () => {
  const { service, cleanup } = makeService()
  try {
    const before = service.status()
    const after = service.rotate()
    assert.notEqual(after.code, before.code)
    // The old code no longer pairs.
    const result = service.accept(before.code, { userAgent: 'test' })
    assert.equal(result.ok, false)
  } finally {
    cleanup()
  }
})

test('deviceNameOf derives readable names', () => {
  assert.equal(deviceNameOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'), 'iPhone · Safari')
  assert.equal(deviceNameOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'), 'Windows PC · Chrome')
  assert.equal(deviceNameOf('curl/8.4.0'), 'Unknown device')
  assert.equal(deviceNameOf(undefined), 'Unknown device')
})

/** Write a store file with arbitrary content (test helper). */
function writeStore(file, content) {
  writeFileSync(file, content)
}
