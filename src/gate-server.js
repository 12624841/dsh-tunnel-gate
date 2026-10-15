/**
 * The gate server: a loopback-only HTTP server (default port 16177) that
 * cloudflared points at. Every request passes the pairing gate first:
 *
 * - unpaired callers see the pairing page (`/pair`) or are redirected to it;
 * - a correct 6-digit code mints a device cookie and returns the desktop's
 *   authenticated landing URL (the host-provided `buildPairAcceptUrl`, which
 *   carries DSH's own `?token=` launch credential);
 * - paired callers are reverse-proxied to the local DSH web server (HTTP and
 *   WebSocket upgrades alike);
 * - `/gate-ping` answers without pairing so the tunnel manager (and the
 *   Cloudflare dashboard health check) can probe the chain.
 */
import http from 'node:http'
import { forwardRequest, forwardUpgrade } from './proxy.js'
import { pairingPage } from './pages.js'

/** The device cookie name (exported for tests and documentation). */
export const DEVICE_COOKIE = 'tg_device'

/** Device cookie lifetime in seconds (365 days). */
const DEVICE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60

/** Read one cookie value from a Cookie header. */
function readCookie(header, name) {
  if (typeof header !== 'string') return undefined
  for (const segment of header.split(';')) {
    const at = segment.indexOf('=')
    if (at === -1) continue
    if (segment.slice(0, at).trim() === name) return segment.slice(at + 1).trim()
  }
  return undefined
}

/** The public origin the caller used (honors the tunnel's forwarded proto). */
function originOf(req) {
  const forwarded = req.headers['x-forwarded-proto']
  const proto = typeof forwarded === 'string' && forwarded !== '' ? forwarded.split(',')[0].trim() : 'http'
  return `${proto}://${req.headers.host ?? 'localhost'}`
}

/** Whether the caller's chain is https (drives the cookie Secure flag). */
function isHttpsOrigin(req) {
  return originOf(req).startsWith('https://')
}

/** Serialize the device cookie. */
function deviceCookie(value, secure) {
  const parts = [
    `${DEVICE_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${String(DEVICE_COOKIE_MAX_AGE_SECONDS)}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

/** Read a JSON request body (capped). */
function readJsonBody(req, limitBytes = 4096) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limitBytes) {
        reject(new Error('body too large'))
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
    req.on('error', reject)
  })
}

/** Answer with a JSON payload. */
function json(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders,
  })
  res.end(body)
}

/** Redirect helper. */
function redirect(res, location) {
  res.writeHead(302, { location, 'cache-control': 'no-store' })
  res.end()
}

/**
 * Create the gate server (not yet listening).
 * @param options.pairing - the PairingService.
 * @param options.upstream - `() => { host, port }` of the local DSH web server.
 * @param options.buildPairAcceptUrl - `(origin) => authenticated landing URL` after pairing.
 * @param [options.sleep] - delay seam for the brute-force brake (tests).
 * @returns `{ start, stop, address }`.
 */
export function createGateServer({ pairing, upstream, buildPairAcceptUrl }) {
  let server = undefined
  const connections = new Set()

  /** True when the request carries a live device credential. */
  const paired = (req) => pairing.verify(readCookie(req.headers.cookie, DEVICE_COOKIE)) !== undefined

  /** Route one normal request. */
  const handle = (req, res) => {
    const pathname = (req.url ?? '/').split('?')[0]
    if (pathname === '/gate-ping') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
      res.end('ok')
      return
    }
    if (pathname === '/pair') {
      if (req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
        res.end(pairingPage())
        return
      }
      if (req.method === 'POST') {
        void readJsonBody(req)
          .then(async (body) => {
            const code = body && typeof body.code === 'string' ? body.code : ''
            const result = pairing.accept(code, { userAgent: req.headers['user-agent'] })
            if (!result.ok) {
              json(res, result.reason === 'cooldown' || result.reason === 'rate_limited' ? 429 : 403, { ok: false, reason: result.reason })
              return
            }
            json(res, 200, { ok: true, next: buildPairAcceptUrl(originOf(req)) }, {
              'set-cookie': deviceCookie(result.cookie, isHttpsOrigin(req)),
            })
          })
          .catch(() => json(res, 400, { ok: false, reason: 'bad_request' }))
        return
      }
      res.writeHead(405, { allow: 'GET, POST' })
      res.end()
      return
    }
    // Everything else is the gated proxy.
    if (!paired(req)) {
      redirect(res, '/pair')
      return
    }
    forwardRequest(req, res, upstream())
  }

  /** Route one upgrade request. */
  const handleUpgrade = (req, socket, head) => {
    if (!paired(req)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nconnection: close\r\ncontent-length: 0\r\n\r\n')
      socket.destroy()
      return
    }
    forwardUpgrade(req, socket, head, upstream())
  }

  return {
    /**
     * Listen. `port: 0` picks an ephemeral port (tests); `host` is the bind
     * address — `127.0.0.1` (default, loopback-only: just cloudflared) or
     * `0.0.0.0` (LAN access; the pairing code stays the door).
     */
    start({ port, host = '127.0.0.1' }) {
      if (server !== undefined) return Promise.resolve()
      server = http.createServer(handle)
      server.on('upgrade', handleUpgrade)
      server.on('connection', (conn) => {
        connections.add(conn)
        conn.on('close', () => connections.delete(conn))
      })
      return new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, host, () => {
          server.removeListener('error', reject)
          resolve()
        })
      })
    },

    /** Stop listening and drop every live connection (upgrades included). */
    stop() {
      const current = server
      if (current === undefined) return Promise.resolve()
      server = undefined
      for (const conn of connections) conn.destroy()
      connections.clear()
      return new Promise((resolve) => current.close(() => resolve()))
    },

    /** The listening address, or undefined while stopped. */
    address() {
      return server?.address() ?? undefined
    },
  }
}
