/**
 * Pairing state machine: the rotating 6-digit code and the device-session
 * table.
 *
 * - Exactly one code window is live at a time; `currentWindow()` lazily
 *   rotates it (and clears per-window rate-limit state) when it expires.
 * - The code is a bearer credential for its whole window: six digits against
 *   a per-window failure budget per client key (see `accept`), so guessing is
 *   bounded and every window re-keyes the lockout.
 * - A paired device is a full-control credential: the cookie carries
 *   `id.secret`, the store keeps only `sha256(secret)`, and revocation is
 *   immediate — the next request through the gate is refused.
 * - A successful accept retires the shown code immediately (the window
 *   rotates), so a code can never pair twice.
 * - Sessions persist across `dsh web` restarts in `$DSH_HOME/tunnel-gate/`
 *   (0600, atomic replace), so a paired phone keeps its session.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** Online window: a device is online while its lastSeenAt is newer than this. */
export const OFFLINE_AFTER_MS = 25_000

/** Failed attempts one client key may burn per code window. */
export const MAX_ATTEMPTS_PER_WINDOW = 6

/** How many devices one code window may pair (limits a leaked code's value). */
export const MAX_ACCEPTS_PER_WINDOW = 4

/** Global failures (any client, any address) that trigger the cooldown. */
export const MAX_FAILURES_PER_COOLDOWN = 6

/** Cooldown after the failure budget: the whole gate refuses pairing attempts. */
export const COOLDOWN_MS = 30_000

/** Device-session lifetime (365 days; renewed by re-pairing). */
export const DEVICE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000

/** Throttle for lastSeenAt writes triggered by verify(). */
const TOUCH_THROTTLE_MS = 5_000

/** Real clock/entropy; tests inject a fake. */
const realClock = {
  now: () => Date.now(),
  code: () => String(randomInt(0, 1_000_000)).padStart(6, '0'),
  secret: () => randomBytes(32).toString('hex'),
  id: () => randomBytes(8).toString('hex'),
}

const sha256 = (value) => createHash('sha256').update(value).digest()

/**
 * Derive a short human-readable device name from the User-Agent.
 * @param userAgent - raw User-Agent header value.
 * @returns a display name like "iPhone · Safari" or "Unknown device".
 */
export function deviceNameOf(userAgent) {
  const ua = typeof userAgent === 'string' ? userAgent : ''
  const family = (() => {
    if (/iPhone/i.test(ua)) return 'iPhone'
    if (/iPad/i.test(ua)) return 'iPad'
    if (/Android/i.test(ua)) return 'Android'
    if (/Macintosh/i.test(ua)) return 'Mac'
    if (/Windows/i.test(ua)) return 'Windows PC'
    if (/Linux/i.test(ua)) return 'Linux'
    return 'Unknown device'
  })()
  const browser = (() => {
    if (/Edg\//i.test(ua)) return 'Edge'
    if (/OPR\//i.test(ua)) return 'Opera'
    if (/Firefox\//i.test(ua)) return 'Firefox'
    if (/Chrome\//i.test(ua)) return 'Chrome'
    if (/Safari\//i.test(ua)) return 'Safari'
    return undefined
  })()
  return browser === undefined ? family : `${family} · ${browser}`
}

/**
 * The pairing service. One instance per plugin mount; all methods are sync
 * (in-memory tables, tiny local persistence file).
 */
export class PairingService {
  #windowMs
  #maxDevices
  #storeFile
  #clock
  #window = undefined
  #acceptsThisWindow = 0
  /** Global failures this window (any client, any address). */
  #fails = 0
  /** Epoch ms while the whole gate refuses pairing attempts; 0 when idle. */
  #cooldownUntil = 0
  #devices = new Map()

  /**
   * @param options.windowMs - code window lifetime in ms.
   * @param options.maxDevices - device table cap.
   * @param options.storeFile - absolute path of the persistence file.
   * @param [options.clock] - injectable clock/entropy seam (tests).
   */
  constructor({ windowMs, maxDevices, storeFile, clock = realClock }) {
    this.#windowMs = windowMs
    this.#maxDevices = maxDevices
    this.#storeFile = storeFile
    this.#clock = clock
    this.#load()
  }

  /** Absolute path of the persistence file. */
  get storeFile() {
    return this.#storeFile
  }

  /** Device-session count. */
  get size() {
    return this.#devices.size
  }

  /** Read the persisted device table; a missing or corrupt file is an empty table. */
  #load() {
    try {
      if (!existsSync(this.#storeFile)) return
      const raw = JSON.parse(readFileSync(this.#storeFile, 'utf8'))
      if (raw?.version !== 1 || !Array.isArray(raw.devices)) return
      const now = this.#clock.now()
      for (const row of raw.devices) {
        if (typeof row?.id !== 'string' || typeof row?.secretHash !== 'string') continue
        if (typeof row.expiresAt !== 'number' || row.expiresAt <= now) continue
        this.#devices.set(row.id, {
          id: row.id,
          secretHash: row.secretHash,
          name: typeof row.name === 'string' ? row.name : 'Unknown device',
          createdAt: typeof row.createdAt === 'number' ? row.createdAt : now,
          lastSeenAt: typeof row.lastSeenAt === 'number' ? row.lastSeenAt : now,
          expiresAt: row.expiresAt,
        })
      }
    } catch {
      // Corrupt store: start empty, never crash the host over a state file.
    }
  }

  /** Atomically persist the device table (0600 temp file + rename). */
  #persist() {
    try {
      mkdirSync(dirname(this.#storeFile), { recursive: true })
      const temp = `${this.#storeFile}.${process.pid}.tmp`
      const payload = JSON.stringify({
        version: 1,
        devices: [...this.#devices.values()].map((device) => ({
          id: device.id,
          secretHash: device.secretHash,
          name: device.name,
          createdAt: device.createdAt,
          lastSeenAt: device.lastSeenAt,
          expiresAt: device.expiresAt,
        })),
      })
      writeFileSync(temp, payload, { mode: 0o600 })
      renameSync(temp, this.#storeFile)
    } catch {
      // Persistence is best-effort: an unwritable home must not break pairing.
    }
  }

  /** Start the cooldown and void the current code (a fresh one follows). */
  #beginCooldown(now) {
    this.#cooldownUntil = now + COOLDOWN_MS
    this.#window = undefined
  }

  /** Lazily rotate the code window; resets the per-window attempt counters. */
  currentWindow() {
    const now = this.#clock.now()
    if (this.#window === undefined || this.#window.expiresAt <= now) {
      this.#window = { code: this.#clock.code(), startedAt: now, expiresAt: now + this.#windowMs }
      this.#fails = 0
      this.#acceptsThisWindow = 0
    }
    return this.#window
  }

  /** Force a fresh window (the panel's 刷新 button). */
  rotate() {
    this.#window = undefined
    return this.currentWindow()
  }

  /**
   * Snapshot for the local panel: everything the desktop needs, nothing a
   * remote caller may learn.
   */
  status() {
    const now = this.#clock.now()
    const window = this.currentWindow()
    return {
      code: window.code,
      codeStartedAt: window.startedAt,
      codeExpiresAt: window.expiresAt,
      codeWindowMs: this.#windowMs,
      cooldownUntil: this.#cooldownUntil > now ? this.#cooldownUntil : undefined,
      devices: [...this.#devices.values()]
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((device) => ({
          id: device.id,
          name: device.name,
          createdAt: device.createdAt,
          lastSeenAt: device.lastSeenAt,
          online: now - device.lastSeenAt < OFFLINE_AFTER_MS,
        })),
    }
  }

  /**
   * Attempt one pairing. One global failure counter (any client, any
   * address): MAX_FAILURES_PER_COOLDOWN failures start a COOLDOWN_MS window
   * during which every pairing attempt is refused — and the code rotates, so
   * everything the attacker learned is void.
   * @param code - the submitted 6-digit code.
   * @param options.userAgent - User-Agent header for the device display name.
   * @returns `{ ok: true, cookie }` or `{ ok: false, reason }`.
   */
  accept(code, { userAgent }) {
    const now = this.#clock.now()
    if (this.#cooldownUntil !== 0) {
      if (now < this.#cooldownUntil) return { ok: false, reason: 'cooldown' }
      // The cooldown just expired: clean counters — every attempt the attacker
      // made is void. The window itself was rotated fresh when the cooldown
      // began and stays (it is younger than the cooldown).
      this.#cooldownUntil = 0
      this.#fails = 0
      this.#acceptsThisWindow = 0
    }
    if (this.#fails >= MAX_FAILURES_PER_COOLDOWN) {
      this.#beginCooldown(now)
      return { ok: false, reason: 'cooldown' }
    }
    const window = this.currentWindow()
    const submitted = typeof code === 'string' ? code.trim() : ''
    if (submitted !== window.code) {
      this.#fails += 1
      if (this.#fails >= MAX_FAILURES_PER_COOLDOWN) {
        this.#beginCooldown(now)
        return { ok: false, reason: 'cooldown' }
      }
      return { ok: false, reason: 'invalid' }
    }
    if (this.#acceptsThisWindow >= MAX_ACCEPTS_PER_WINDOW) return { ok: false, reason: 'rate_limited' }
    this.#acceptsThisWindow += 1
    // Evict the least-recently-seen session when the table is full.
    if (this.#devices.size >= this.#maxDevices) {
      const oldest = [...this.#devices.values()].sort((a, b) => a.lastSeenAt - b.lastSeenAt)[0]
      if (oldest !== undefined) this.#devices.delete(oldest.id)
    }
    const secret = this.#clock.secret()
    const device = {
      id: this.#clock.id(),
      secretHash: sha256(secret).toString('hex'),
      name: deviceNameOf(userAgent),
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + DEVICE_MAX_AGE_MS,
    }
    this.#devices.set(device.id, device)
    this.#persist()
    // The window's purpose is served: retire the shown code immediately.
    this.#window = undefined
    return { ok: true, cookie: `${device.id}.${secret}` }
  }

  /**
   * Verify a device cookie value; touches lastSeenAt on success (throttled).
   * @param cookieValue - the `id.secret` cookie payload.
   * @returns the device record, or undefined.
   */
  verify(cookieValue) {
    if (typeof cookieValue !== 'string') return undefined
    const dot = cookieValue.indexOf('.')
    if (dot <= 0) return undefined
    const id = cookieValue.slice(0, dot)
    const secret = cookieValue.slice(dot + 1)
    const device = this.#devices.get(id)
    if (device === undefined) return undefined
    const now = this.#clock.now()
    if (device.expiresAt <= now) {
      this.#devices.delete(id)
      this.#persist()
      return undefined
    }
    const presented = sha256(secret)
    const stored = Buffer.from(device.secretHash, 'hex')
    if (presented.byteLength !== stored.byteLength || !timingSafeEqual(presented, stored)) return undefined
    if (now - device.lastSeenAt > TOUCH_THROTTLE_MS) {
      device.lastSeenAt = now
      this.#persist()
    }
    return device
  }

  /** Revoke one device session. */
  revoke(id) {
    const existed = this.#devices.delete(id)
    if (existed) this.#persist()
    return existed
  }

  /** Revoke every device session; returns how many were live. */
  revokeAll() {
    const count = this.#devices.size
    this.#devices.clear()
    if (count > 0) this.#persist()
    return count
  }
}
