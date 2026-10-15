/**
 * Panel routes: the `/api/tunnel-gate/*` surface the browser half talks to,
 * mounted on the DSH webserver via `ctx.webServer.register`. The harness's
 * own /api fence is enforced here per-request (the webserver route seat is
 * raw): loopback Host or an explicit trustedHosts authority, cross-site
 * browser markers refused, same-origin Origin required — the same semantics
 * as `isTrustedApiRequest`, spelled locally so the plugin carries no host
 * package dependency.
 */
import { isLoopbackHostname } from './loopback.js'

/** Canonical request authority from a Host header (lowercased host[:port]). */
function requestAuthority(headers) {
  const host = headers.host
  if (typeof host !== 'string') return undefined
  try {
    const url = new URL(`http://${host}`)
    return url.port === '' ? url.hostname : `${url.hostname}:${url.port}`
  } catch {
    return undefined
  }
}

/** Whether the authority matches one trustedHosts entry (exact host:port, or port-less host on any port). */
function isTrustedAuthority(authority, trustedHosts) {
  return trustedHosts.some((entry) => {
    let entryUrl
    try {
      entryUrl = new URL(`http://${entry}`)
    } catch {
      return false
    }
    const entryAuthority = entryUrl.port === '' ? entryUrl.hostname : `${entryUrl.hostname}:${entryUrl.port}`
    return entryAuthority === authority
  })
}

/**
 * The harness-fence-equivalent trust decision for one request.
 * @param req - the incoming request.
 * @param trustedHosts - extra authorities allowed besides loopback.
 * @returns true when the caller may read/control the gate.
 */
export function isTrustedPanelRequest(req, trustedHosts) {
  const authority = requestAuthority(req.headers)
  if (authority === undefined) return false
  let hostUrl
  try {
    hostUrl = new URL(`http://${req.headers.host}`)
  } catch {
    return false
  }
  const hostnameTrusted = isLoopbackHostname(hostUrl.hostname) || isTrustedAuthority(authority, trustedHosts)
  if (!hostnameTrusted) return false
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = req.headers.origin
  if (typeof origin !== 'string' || origin === '' || origin === 'null') return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

/** Answer with JSON. */
function json(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(body)
}

/** Read a small JSON body. */
function readJsonBody(req, limitBytes = 4096) {
  return new Promise((resolve) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limitBytes) {
        resolve(undefined)
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        resolve(undefined)
      }
    })
    req.on('error', () => resolve(undefined))
  })
}

/**
 * Build the route registrations for the panel API.
 * @param options.pairing - the PairingService.
 * @param options.tunnelState - `() => TunnelManager['state']()`.
 * @param options.tunnelRestart - `async () => void` restarting the tunnel from live config.
 * @param options.gateInfo - `() => { port, running, host, lanUrls }` of the gate server.
 * @param options.gateRestart - `async () => void` force-restarting the gate server from live config.
 * @param options.configSnapshot - `() => { publicHostname, gateHost, autoTunnel, enabled }` —
 *   the live config echo (no secrets) that remote pages render read-only.
 * @param options.publicBase - `() => string | undefined` normalized public origin.
 * @param options.trustedHosts - `() => string[]` extra trusted authorities.
 * @returns an array of webserver route registrations (one prefix route).
 */
export function createPanelRoutes({ pairing, tunnelState, tunnelRestart, gateInfo, gateRestart, configSnapshot, publicBase, trustedHosts }) {
  /** Full status snapshot: the one read the panel polls. */
  const statusPayload = () => {
    const snapshot = pairing.status()
    const liveBase = tunnelState().publicUrl ?? publicBase()
    return {
      ...snapshot,
      /** The configured fixed origin — reported even while the tunnel is down, so the panel can offer a click-test. */
      publicUrl: publicBase(),
      tunnel: tunnelState(),
      gate: gateInfo(),
      /** The live config echo (no secrets) — remote pages render it read-only. */
      config: configSnapshot(),
      pairUrl: liveBase === undefined ? undefined : `${liveBase.replace(/\/$/, '')}/pair?code=${snapshot.code}`,
    }
  }

  const handler = async (req, res) => {
    if (!isTrustedPanelRequest(req, trustedHosts())) {
      json(res, 403, { ok: false, reason: 'untrusted' })
      return
    }
    const pathname = (req.url ?? '').split('?')[0]
    const action = pathname.replace(/^\/api\/tunnel-gate\/?/, '')
    if (req.method === 'GET' && (action === '' || action === 'status')) {
      json(res, 200, statusPayload())
      return
    }
    if (req.method === 'POST' && action === 'rotate') {
      const window = pairing.rotate()
      json(res, 200, { ok: true, code: window.code, codeExpiresAt: window.expiresAt, pairUrl: statusPayload().pairUrl })
      return
    }
    if (req.method === 'POST' && action === 'devices/revoke') {
      const body = await readJsonBody(req)
      const id = body && typeof body.id === 'string' ? body.id : ''
      if (id === '' || !pairing.revoke(id)) {
        json(res, 404, { ok: false, reason: 'unknown_device' })
        return
      }
      json(res, 200, { ok: true })
      return
    }
    if (req.method === 'POST' && action === 'devices/revoke-all') {
      json(res, 200, { ok: true, revoked: pairing.revokeAll() })
      return
    }
    if (req.method === 'POST' && action === 'gate/restart') {
      try {
        await gateRestart()
        json(res, 200, { ok: true, gate: gateInfo() })
      } catch (error) {
        json(res, 500, { ok: false, reason: error instanceof Error ? error.message : String(error) })
      }
      return
    }
    if (req.method === 'POST' && action === 'tunnel/restart') {
      try {
        await tunnelRestart()
        json(res, 200, { ok: true, tunnel: tunnelState() })
      } catch (error) {
        json(res, 500, { ok: false, reason: error instanceof Error ? error.message : String(error) })
      }
      return
    }
    json(res, 404, { ok: false, reason: 'unknown_action' })
  }

  return [{ kind: 'prefix', path: '/api/tunnel-gate', handler }]
}
