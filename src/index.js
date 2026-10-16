/**
 * tunnel-gate — host half. Mounts the whole capability:
 *
 * - the PairingService (rotating 6-digit code, device sessions, persistence)
 * - the gate server on 127.0.0.1:<gatePort> that cloudflared points at
 * - the TunnelManager (cloudflared named tunnel via TUNNEL_TOKEN, or an
 *   accountless quick tunnel)
 * - the panel API routes (`/api/tunnel-gate/*`) on the DSH webserver
 *
 * Live settings: every volatile config field is read through its live
 * reference on each `sync()`; the loader announces `loader/volatile-update`
 * after a settings-card save, and sync reconciles gate/tunnel state without
 * a remount (device sessions and the route registration survive).
 *
 * The plugin never touches DSH secrets: pair-accept redirects the device to
 * `ctx.connection.authenticatedUrl(origin)`, letting the harness mint its own
 * browser-auth cookie through the tunnel.
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { PairingService } from './pairing.js'
import { createGateServer } from './gate-server.js'
import { TunnelManager } from './tunnel.js'
import { createPanelRoutes } from './panel-routes.js'
import { normalizeOrigin, normalizeBindHost, DEFAULTS } from './config.js'
import { isLocalOrigin } from './loopback.js'
import { lanIPv4Addresses } from './lan.js'

/** Stable cordis plugin name — also the settings namespace (the entry id). */
export const name = 'tunnel-gate'

/** Services required before the surfaces can mount. */
export const inject = ['webServer', 'connection']

/** Prefixed console helpers. */
const log = (...args) => console.log('[tunnel-gate]', ...args)
const warn = (...args) => console.warn('[tunnel-gate]', ...args)

/** Re-exported so the loader derives the settings page from it. */
export { Config } from './config.js'

/**
 * Read one config value. Volatile fields arrive as live references — either
 * a callable or a ConfigRef object carrying `get()` (the shape the loader's
 * schema produces); the reference is read at call time so settings saves
 * land without a remount. Undefined falls back.
 */
function readField(field, fallback) {
  if (typeof field === 'function') {
    try {
      return field()
    } catch {
      return fallback
    }
  }
  if (typeof field === 'object' && field !== null && typeof field.get === 'function') {
    try {
      const value = field.get()
      return value === undefined ? fallback : value
    } catch {
      return fallback
    }
  }
  return field ?? fallback
}

/** Inner mount: assumes the single-instance guard passed. */
function applyImpl(ctx, config) {
  const envHome = process.env.DSH_HOME?.trim()
  const home = envHome !== undefined && envHome !== '' ? envHome : join(homedir(), '.dsh')
  const storeFile = join(home, 'tunnel-gate', 'devices.json')

  /** Live settings resolution — never captured, always re-read. */
  const resolve = () => ({
    enabled: readField(config?.enabled, true) !== false,
    gateHost: normalizeBindHost(readField(config?.gateHost, DEFAULTS.gateHost)),
    publicHostname: normalizeOrigin(readField(config?.publicHostname, '')),
    tunnelToken: readField(config?.tunnelToken, ''),
    gatePort: readField(config?.gatePort, 16177),
    autoTunnel: readField(config?.autoTunnel, false) === true,
    codeWindowMs: readField(config?.codeWindowMs, 60_000),
    maxDevices: readField(config?.maxDevices, 8),
    upstreamPort: readField(config?.upstreamPort, 3080),
  })

  /** The pairing service, rebuilt when its sizing settings change (sessions reload from disk). */
  let pairingKey = ''
  const pairingKeyOf = () => `${resolve().codeWindowMs}:${resolve().maxDevices}`
  let pairing = new PairingService({ windowMs: resolve().codeWindowMs, maxDevices: resolve().maxDevices, storeFile })
  pairingKey = pairingKeyOf()

  /** The local DSH web server, discovered live so webserver reloads are followed. */
  const upstream = () => ({
    host: '127.0.0.1',
    port: Number.isFinite(ctx.webServer?.port) ? ctx.webServer.port : resolve().upstreamPort,
  })

  /** The desktop's authenticated landing URL: the harness mints its own cookie. */
  const buildPairAcceptUrl = (origin) => {
    try {
      const url = ctx.connection?.authenticatedUrl?.(origin)
      if (typeof url === 'string' && url !== '') return url
    } catch (error) {
      warn('authenticatedUrl failed; falling back to the plain origin:', error?.message ?? error)
    }
    return `${origin}/`
  }

  const gate = createGateServer({ pairing, upstream, buildPairAcceptUrl })

  const tunnel = new TunnelManager({ gatePort: resolve().gatePort })

  const disposeRoute = ctx.webServer?.register(
    createPanelRoutes({
      pairing,
      tunnelState: () => tunnel.state(),
      tunnelRestart: () => startTunnel(true),
      gateInfo: () => {
        const cfg = resolve()
        const lanUrls = cfg.gateHost === '0.0.0.0'
          ? lanIPv4Addresses().map((entry) => `http://${entry.address}:${String(cfg.gatePort)}`)
          : isLocalOrigin(`http://${cfg.gateHost}`) === false && cfg.gateHost !== '127.0.0.1'
            ? [`http://${cfg.gateHost}:${String(cfg.gatePort)}`]
            : []
        return { port: cfg.gatePort, running: gateRunning(), host: cfg.gateHost, lanUrls }
      },
      gateRestart: () => restartGate(),
      configSnapshot: () => {
        const cfg = resolve()
        // No secrets here: the token never leaves the host.
        return { publicHostname: cfg.publicHostname, gateHost: cfg.gateHost, autoTunnel: cfg.autoTunnel, enabled: cfg.enabled }
      },
      publicBase: () => {
        const cfg = resolve()
        return cfg.publicHostname === '' ? undefined : cfg.publicHostname
      },
      trustedHosts: () => [],
    })[0],
  )

  let gateUp = false
  const gateRunning = () => gateUp
  let gateStartedPort = undefined
  let gateStartedHost = '0.0.0.0'

  async function startGate(port, host) {
    if (gateUp && gateStartedPort === port && gateStartedHost === host) return
    await gate.stop()
    gateUp = false
    await gate.start({ port, host })
    gateUp = true
    gateStartedPort = port
    gateStartedHost = host
    const realPort = gate.address()?.port ?? port
    log(`gate listening on http://${host === '0.0.0.0' ? '<LAN>' : host}:${String(realPort)} (point cloudflared here)`)
  }

  /** Force-restart the gate server with the live config (the panel's 重启 16177 button). */
  async function restartGate() {
    gateStartedPort = undefined
    gateStartedHost = undefined
    const cfg = resolve()
    await startGate(cfg.gatePort, cfg.gateHost)
    return { port: cfg.gatePort, running: gateRunning(), host: cfg.gateHost }
  }

  /**
   * Reconcile the tunnel with live config. `force` (the panel's 重启按钮)
   * restarts even when the desired shape is unchanged.
   */
  let lastTunnelKey = ''
  async function startTunnel(force = false) {
    const cfg = resolve()
    // A local/LAN origin is unreachable from Cloudflare's edge: skip cloudflared
    // entirely — the panel still shows the link for direct access.
    const local = isLocalOrigin(cfg.publicHostname)
    // autoTunnel 勾选 = 明确使用快速隧道（优先于 named）；named 需要域名 + Token 齐备。
    const mode = cfg.autoTunnel && !local ? 'quick' : !local && cfg.tunnelToken !== '' && cfg.publicHostname !== '' ? 'named' : 'off'
    const key = mode === 'named' ? `named:${cfg.publicHostname}` : mode
    if (!force && key === lastTunnelKey && tunnel.state().state === 'running') return tunnel.state()
    lastTunnelKey = key
    await tunnel.stop()
    if (mode === 'off') {
      if (local && cfg.tunnelToken !== '') log(`${cfg.publicHostname} 是本机/内网地址，跳过 cloudflared（链接照常可用）`)
      return tunnel.state()
    }
    log(`starting ${mode} tunnel${mode === 'named' ? ` for ${cfg.publicHostname}` : ''}`)
    try {
      const state = mode === 'named'
        ? await tunnel.startNamed(cfg.tunnelToken, cfg.publicHostname)
        : await tunnel.startQuick()
      tunnel.note(undefined)
      return state
    } catch (error) {
      // Surface the reason on the panel (state stays 'stopped').
      tunnel.note(`启动失败: ${error instanceof Error ? error.message : String(error)}`)
      return tunnel.state()
    }
  }

  /** One reconciliation pass over live settings. */
  let syncing = false
  let syncQueued = false
  async function sync() {
    if (syncing) {
      syncQueued = true
      return
    }
    syncing = true
    try {
      const cfg = resolve()
      const wantedPairingKey = pairingKeyOf()
      if (wantedPairingKey !== pairingKey) {
        pairingKey = wantedPairingKey
        pairing = new PairingService({ windowMs: cfg.codeWindowMs, maxDevices: cfg.maxDevices, storeFile })
        log(`pairing service rebuilt (windowMs=${String(cfg.codeWindowMs)}, maxDevices=${String(cfg.maxDevices)}); sessions reloaded from disk`)
      }
      if (cfg.enabled) {
        if (cfg.gatePort !== gateStartedPort || cfg.gateHost !== gateStartedHost || !gateUp) await startGate(cfg.gatePort, cfg.gateHost)
        await startTunnel(false).catch((error) => warn('tunnel start failed:', error?.message ?? error))
      } else {
        lastTunnelKey = ''
        await tunnel.stop()
        await gate.stop()
        gateUp = false
        gateStartedPort = undefined
        gateStartedHost = '0.0.0.0'
      }
    } finally {
      syncing = false
      if (syncQueued) {
        syncQueued = false
        void sync()
      }
    }
  }

  // Live settings edits: the loader announces committed volatile updates.
  try {
    ctx.on('loader/volatile-update', () => {
      void sync()
    })
  } catch {
    // A cohort without the event simply needs a restart for settings edits.
  }

  ctx.effect(() => () => {
    void gate.stop()
    void tunnel.stop()
    try {
      disposeRoute?.()
    } catch {}
    log('stopped')
  }, 'tunnel-gate: lifetime')

  void sync()
}

/** Cross-instance mount claims: package names currently mounted. */
const MOUNTED = Symbol.for('dsh-tunnel-gate.mounted')
/** Mounts refused while a holder lived, replayed the moment the name frees up. */
const WAITERS = Symbol.for('dsh-tunnel-gate.mounted.waiters')

/**
 * Replay one queued mount whose holder released the name. Re-enters the
 * guard (the claim is free by now), so a replay racing a newer holder is
 * re-queued instead of double-mounting.
 */
function replayQueued(mountName) {
  const claims = globalThis[MOUNTED]
  if (claims?.has(mountName)) return
  const queue = globalThis[WAITERS]?.get(mountName)
  const entry = queue?.shift()
  if (entry === undefined) return
  if (entry.done) {
    // The waiting fiber was torn down while queued; try the next waiter.
    replayQueued(mountName)
    return
  }
  apply(entry.ctx, entry.config)
}

/**
 * Wrap a plugin apply with the single-instance guard. The Host reloads a
 * profile by creating the new loader entry BEFORE the old one disposes, so a
 * plain refusal would lose the plugin on every reload: the refused mount is
 * QUEUED here and replayed the moment the holder releases the name — if the
 * waiting context is still alive then.
 * @param mountName - the guard key (the plugin name).
 * @param fn - the inner apply.
 * @returns the guarded apply.
 */
function mountOnce(mountName, fn) {
  return (ctx, config) => {
    const claims = (globalThis[MOUNTED] ??= new Set())
    if (claims.has(mountName)) {
      warn('already mounted; the duplicate mount is queued until the holder releases the name')
      const waitQueues = (globalThis[WAITERS] ??= new Map())
      const queue = waitQueues.get(mountName) ?? []
      waitQueues.set(mountName, queue)
      const entry = { ctx, config, done: false }
      queue.push(entry)
      // Drop the entry if the waiting context is disposed before its turn.
      try {
        ctx.effect(() => () => {
          entry.done = true
        }, 'tunnel-gate: queued mount watch')
      } catch {}
      // A holder that already released between check and queue replays now.
      queueMicrotask(() => replayQueued(mountName))
      return
    }
    claims.add(mountName)
    ctx.effect(() => () => {
      claims.delete(mountName)
      replayQueued(mountName)
    }, 'tunnel-gate: mount claim')
    fn(ctx, config)
  }
}

/**
 * The cordis plugin apply, guarded against duplicate mounts (profile reloads
 * create the new loader entry before the old one disposes).
 * @param ctx - host plugin context (webServer + connection injected).
 * @param config - schema-parsed config (volatile fields are live references).
 */
export const apply = mountOnce(name, applyImpl)
