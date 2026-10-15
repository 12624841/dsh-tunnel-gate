/**
 * Reverse proxy engine: forwards paired gate traffic to the local DSH web
 * server (HTTP + WebSocket upgrades), rewriting the identity headers so the
 * upstream's loopback fence and its authority-bound browser-auth cookie both
 * pass untouched:
 *
 * - `Host` is rewritten to `127.0.0.1:<upstream>` — the /api trust fence
 *   (isTrustedApiRequest) accepts loopback authorities.
 * - `Origin` / `Referer` are rewritten to the same authority — the fence
 *   requires Origin to match Host.
 * - Every other header (cookies, accept-encoding, sec-fetch-*) forwards
 *   verbatim; bodies and compressed streams pipe through byte-for-byte.
 *
 * Cookie consistency: the DSH browser-auth cookie is minted (via the
 * `?token=` landing) while Host already reads `127.0.0.1:<upstream>`, so its
 * payload authority matches the rewritten Host on every later request even
 * though the browser stores it under the tunnel hostname.
 */
import http from 'node:http'

/**
 * Build the upstream request headers for one proxied request.
 * @param req - the incoming gate request (or upgrade request).
 * @param upstream - `{ host, port }` of the DSH web server.
 * @returns a fresh headers object safe to hand to http.request.
 */
export function upstreamHeaders(req, upstream) {
  const authority = `${upstream.host}:${String(upstream.port)}`
  const headers = { ...req.headers }
  delete headers['connection']
  delete headers['keep-alive']
  delete headers['transfer-encoding']
  delete headers.te
  delete headers.trailer
  delete headers['proxy-authorization']
  delete headers['proxy-authenticate']
  delete headers.upgrade
  headers.host = authority
  const origin = headers.origin
  if (typeof origin === 'string' && origin !== '' && origin !== 'null') {
    try {
      headers.origin = `${new URL(origin).protocol}//${authority}`
    } catch {
      delete headers.origin
    }
  }
  const referer = headers.referer
  if (typeof referer === 'string' && referer !== '') {
    try {
      const url = new URL(referer)
      headers.referer = `${url.protocol}//${authority}${url.pathname}${url.search}`
    } catch {
      delete headers.referer
    }
  }
  return headers
}

/** Serialize an upstream response head back onto a raw socket (upgrades). */
function writeRawHead(socket, status, statusMessage, headers) {
  const lines = [`HTTP/1.1 ${status} ${statusMessage ?? ''}`.trimEnd()]
  for (const [key, value] of Object.entries(headers)) {
    for (const item of Array.isArray(value) ? value : [value]) lines.push(`${key}: ${String(item)}`)
  }
  socket.write(`${lines.join('\r\n')}\r\n\r\n`)
}

/**
 * Forward one plain HTTP request to the upstream and pipe the response back.
 * Ends `res` with 502 on upstream failure.
 * @param req - incoming request.
 * @param res - response to answer.
 * @param upstream - `{ host, port }`.
 * @returns the upstream ClientRequest (abort wiring / tests).
 */
export function forwardRequest(req, res, upstream) {
  const upstreamReq = http.request(
    {
      host: upstream.host,
      port: upstream.port,
      method: req.method,
      path: req.url,
      headers: upstreamHeaders(req, upstream),
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers)
      upstreamRes.pipe(res)
      upstreamRes.on('error', () => res.destroy())
    },
  )
  upstreamReq.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
    }
    res.end('tunnel-gate: the local DSH web server is unreachable.\n')
  })
  req.pipe(upstreamReq)
  return upstreamReq
}

/**
 * Tunnel one WebSocket upgrade: open the same upgrade upstream, replay its
 * 101 head, then pipe both raw sockets. The caller must have validated the
 * device credential before calling.
 * @param req - the upgrade request.
 * @param socket - the gate-side socket.
 * @param head - the first packet (may be empty).
 * @param upstream - `{ host, port }`.
 */
export function forwardUpgrade(req, socket, head, upstream) {
  const headers = upstreamHeaders(req, upstream)
  headers.connection = 'Upgrade'
  headers.upgrade = req.headers.upgrade
  const upstreamReq = http.request({
    host: upstream.host,
    port: upstream.port,
    method: req.method,
    path: req.url,
    headers,
  })
  upstreamReq.on('upgrade', (upstreamRes, upstreamSocket, upstreamHead) => {
    writeRawHead(socket, upstreamRes.statusCode ?? 101, upstreamRes.statusMessage, upstreamRes.headers)
    if (upstreamHead?.length > 0) socket.write(upstreamHead)
    if (head.length > 0) upstreamSocket.write(head)
    const closeBoth = () => {
      socket.destroy()
      upstreamSocket.destroy()
    }
    upstreamSocket.pipe(socket)
    socket.pipe(upstreamSocket)
    upstreamSocket.on('error', closeBoth)
    socket.on('error', closeBoth)
    upstreamSocket.on('close', closeBoth)
    socket.on('close', closeBoth)
  })
  upstreamReq.on('response', (upstreamRes) => {
    // Upstream refused the upgrade (401/403): replay its plain response.
    writeRawHead(socket, upstreamRes.statusCode ?? 400, upstreamRes.statusMessage, upstreamRes.headers)
    upstreamRes.pipe(socket)
  })
  upstreamReq.on('error', () => socket.destroy())
  upstreamReq.end(head.length > 0 ? head : undefined)
}
