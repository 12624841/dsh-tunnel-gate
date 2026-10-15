/**
 * Reverse proxy engine tests: header rewriting, request/response piping, and
 * WebSocket upgrade tunneling — exercised against real loopback HTTP servers
 * spun up per test (node core only, no ws package).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import crypto from 'node:crypto'
import { forwardRequest, forwardUpgrade, upstreamHeaders } from '../src/proxy.js'

/** Bind an ephemeral loopback port and return { server, port, close }. */
async function listen(handler, onUpgrade) {
  const server = http.createServer(handler)
  if (onUpgrade !== undefined) server.on('upgrade', onUpgrade)
  // Upgraded sockets leave the server's connection tracking, so close() would
  // wait forever on them; track every raw connection and force-destroy on close.
  const connections = new Set()
  server.on('connection', (conn) => {
    connections.add(conn)
    conn.on('close', () => connections.delete(conn))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return {
    server,
    port: server.address().port,
    close: async () => {
      for (const conn of connections) conn.destroy()
      await new Promise((resolve) => server.close(resolve))
    },
  }
}

test('upstreamHeaders rewrites host/origin/referer to the upstream authority', () => {
  const headers = upstreamHeaders(
    {
      headers: {
        host: 'dsh.example.com',
        origin: 'https://dsh.example.com',
        referer: 'https://dsh.example.com/some/path?x=1',
        'content-type': 'text/plain',
      },
    },
    { host: '127.0.0.1', port: 3080 },
  )
  assert.equal(headers.host, '127.0.0.1:3080')
  assert.equal(headers.origin, 'https://127.0.0.1:3080')
  assert.equal(headers.referer, 'https://127.0.0.1:3080/some/path?x=1')
  assert.equal(headers['content-type'], 'text/plain')
})

test('upstreamHeaders strips hop-by-hop and upgrade headers', () => {
  const headers = upstreamHeaders(
    {
      headers: {
        host: 'x',
        connection: 'keep-alive',
        'keep-alive': 'timeout=5',
        'transfer-encoding': 'chunked',
        upgrade: 'websocket',
        cookie: 'tg_device=a.b',
      },
    },
    { host: '127.0.0.1', port: 3080 },
  )
  assert.equal(headers.connection, undefined)
  assert.equal(headers['keep-alive'], undefined)
  assert.equal(headers['transfer-encoding'], undefined)
  assert.equal(headers.upgrade, undefined)
  assert.equal(headers.cookie, 'tg_device=a.b', 'cookies forward untouched')
})

test('upstreamHeaders tolerates a null-origin and a malformed referer', () => {
  const headers = upstreamHeaders(
    { headers: { host: 'x', origin: 'null', referer: '::garbage::' } },
    { host: '127.0.0.1', port: 3080 },
  )
  assert.equal(headers.origin, 'null', 'null origin passes through untouched')
  assert.equal(headers.referer, undefined, 'an unparsable referer is dropped')
})

test('forwardRequest pipes status, headers, and body from the upstream', async () => {
  const upstream = await listen((req, res) => {
    res.writeHead(201, { 'content-type': 'application/json', 'x-upstream': 'yes' })
    res.end(JSON.stringify({ ok: true }))
  })
  const gate = await listen((req, res) => {
    forwardRequest(req, res, { host: '127.0.0.1', port: upstream.port })
  })
  try {
    const response = await fetch(`http://127.0.0.1:${gate.port}/anything`)
    assert.equal(response.status, 201)
    assert.equal(response.headers.get('x-upstream'), 'yes')
    assert.deepEqual(await response.json(), { ok: true })
  } finally {
    await gate.close()
    await upstream.close()
  }
})

test('forwardRequest streams a request body through to the upstream', async () => {
  const upstream = await listen((req, res) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end(`echo:${Buffer.concat(chunks).toString('utf8')}`)
    })
  })
  const gate = await listen((req, res) => {
    forwardRequest(req, res, { host: '127.0.0.1', port: upstream.port })
  })
  try {
    const response = await fetch(`http://127.0.0.1:${gate.port}/echo`, {
      method: 'POST',
      body: 'payload-bytes',
      headers: { 'content-type': 'text/plain' },
    })
    assert.equal(await response.text(), 'echo:payload-bytes')
  } finally {
    await gate.close()
    await upstream.close()
  }
})

test('forwardRequest answers 502 when the upstream is unreachable', async () => {
  const dead = await listen(() => {})
  const deadPort = dead.port
  await dead.close()
  const gate = await listen((req, res) => {
    forwardRequest(req, res, { host: '127.0.0.1', port: deadPort })
  })
  try {
    const response = await fetch(`http://127.0.0.1:${gate.port}/x`)
    assert.equal(response.status, 502)
    assert.match(await response.text(), /unreachable/)
  } finally {
    await gate.close()
  }
})

test('forwardUpgrade tunnels the 101 handshake and relays raw bytes both ways', async () => {
  const secret = crypto.randomBytes(8).toString('hex')
  const upstream = await listen(
    () => {},
    // Raw upgrade responder: accept everything, then uppercase-echo one line.
    (req, socket) => {
      socket.write('HTTP/1.1 101 Switching Protocols\r\nupgrade: websocket\r\nconnection: Upgrade\r\n\r\n')
      socket.once('data', (chunk) => socket.write(chunk.toString().toUpperCase()))
    },
  )
  const gate = await listen(
    () => {},
    (req, socket, head) => {
      forwardUpgrade(req, socket, head, { host: '127.0.0.1', port: upstream.port })
    },
  )
  try {
    const client = http.request({
      host: '127.0.0.1',
      port: gate.port,
      path: '/api/remote.mux',
      headers: {
        host: `127.0.0.1:${gate.port}`,
        connection: 'Upgrade',
        upgrade: 'websocket',
        'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'sec-websocket-version': '13',
      },
    })
    const [upgradeRes, upstreamSocket] = await new Promise((resolve, reject) => {
      client.on('upgrade', (res, socket) => resolve([res, socket]))
      client.on('response', (res) => reject(new Error(`expected upgrade, got ${res.statusCode}`)))
      client.on('error', reject)
      client.end()
    })
    assert.equal(upgradeRes.statusCode, 101)
    upstreamSocket.write(secret)
    const echoed = await new Promise((resolve) => upstreamSocket.once('data', resolve))
    assert.equal(echoed.toString(), secret.toUpperCase())
    upstreamSocket.destroy()
  } finally {
    await gate.close()
    await upstream.close()
  }
})

test('forwardUpgrade replays a plain rejection when the upstream refuses the upgrade', async () => {
  const upstream = await listen(
    (req, res) => {
      res.writeHead(404)
      res.end('no upgrades here')
    },
    undefined,
  )
  const gate = await listen(
    () => {},
    (req, socket, head) => {
      forwardUpgrade(req, socket, head, { host: '127.0.0.1', port: upstream.port })
    },
  )
  try {
    const client = http.request({
      host: '127.0.0.1',
      port: gate.port,
      path: '/api/remote.mux',
      headers: { connection: 'Upgrade', upgrade: 'websocket', host: 'x' },
    })
    const status = await new Promise((resolve, reject) => {
      client.on('response', (res) => {
        res.resume()
        resolve(res.statusCode)
      })
      client.on('upgrade', () => reject(new Error('must not upgrade')))
      client.on('error', reject)
      client.end()
    })
    assert.equal(status, 404)
  } finally {
    await gate.close()
    await upstream.close()
  }
})
