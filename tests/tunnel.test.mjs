/**
 * Tunnel manager tests: cloudflared lifecycle with a fake spawn seam —
 * argv/env construction, readiness probing, crash and stop handling, and
 * quick-tunnel URL parsing. No real cloudflared binary involved.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { TunnelManager, namedTunnelArgs, quickTunnelArgs, pickCloudflaredBin } from '../src/tunnel.js'

/** A controllable fake child process. */
function fakeChild() {
  const child = new EventEmitter()
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.killed = false
  child.exitCode = null
  child.kill = () => {
    child.killed = true
    queueMicrotask(() => {
      child.exitCode = 0
      child.emit('exit', 0, null)
    })
    return true
  }
  child.crash = (code) => {
    queueMicrotask(() => {
      child.exitCode = code
      child.emit('exit', code, null)
    })
  }
  return child
}

/** A manager whose seams never touch the real binary or network. */
function makeManager({ probe = async () => 200, spawnOverrides = {} } = {}) {
  const children = []
  const calls = []
  const child = fakeChild()
  const manager = new TunnelManager({
    gatePort: 16177,
    ensureBinary: async () => '/fake/cloudflared',
    spawn: (args, options) => {
      calls.push({ args, options })
      const spawned = Object.assign(new EventEmitter(), {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        killed: false,
        exitCode: null,
        kill: () => {
          spawned.killed = true
          queueMicrotask(() => {
            spawned.exitCode = 0
            spawned.emit('exit', 0, null)
          })
          return true
        },
        ...spawnOverrides,
      })
      children.push(spawned)
      queueMicrotask(() => spawned.emit('spawn'))
      return spawned
    },
    probe,
    probeIntervalMs: 1,
    probeTimeoutMs: 50,
  })
  return { manager, children, calls, child }
}

test('namedTunnelArgs runs a named tunnel without any token material', () => {
  assert.deepEqual(namedTunnelArgs(), ['tunnel', '--no-autoupdate', '--protocol', 'http2', 'run'])
})

test('quickTunnelArgs points cloudflared at the local gate', () => {
  assert.deepEqual(quickTunnelArgs(16177), ['tunnel', '--no-autoupdate', '--url', 'http://127.0.0.1:16177'])
})

test('state is off before any start', () => {
  const { manager } = makeManager()
  assert.deepEqual(manager.state(), { mode: 'off', state: 'stopped', publicUrl: undefined, error: undefined })
})

test('startNamed passes the token via env, never argv, and probes to running', async () => {
  const { manager, calls } = makeManager()
  await manager.startNamed('secret-token', 'dsh.example.com')
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].args, ['/fake/cloudflared', ...namedTunnelArgs()])
  assert.equal(calls[0].options.env.TUNNEL_TOKEN, 'secret-token')
  assert.ok(!calls[0].args.join(' ').includes('secret-token'), 'the token must not appear in argv')
  assert.deepEqual(manager.state(), { mode: 'named', state: 'running', publicUrl: 'https://dsh.example.com', error: undefined })
})

test('note() surfaces operator-facing failures without changing the run state', () => {
  const { manager } = makeManager()
  assert.equal(manager.state().error, undefined)
  manager.note('启动失败: cloudflared binary missing')
  assert.equal(manager.state().state, 'stopped', 'the run state is unchanged')
  assert.match(manager.state().error ?? '', /启动失败/)
})

test('probe failure keeps the child alive and surfaces a warning (1033 lesson)', async () => {
  const children = []
  const capturing = new TunnelManager({
    gatePort: 16177,
    ensureBinary: async () => '/fake/cloudflared',
    spawn: () => {
      const spawned = fakeChild()
      children.push(spawned)
      queueMicrotask(() => spawned.emit('spawn'))
      return spawned
    },
    probe: async () => { throw new Error('unreachable') },
    probeIntervalMs: 1,
    probeTimeoutMs: 50,
  })
  await capturing.startNamed('token', 'dsh.example.com')
  // cloudflared itself registers with the edge fine — a wrong origin config
  // makes the probe fail. Killing it would strand the domain (error 1033).
  assert.equal(capturing.state().state, 'running')
  assert.match(capturing.state().error ?? '', /回源|probe|unreachable|dsh\.example\.com/i)
  assert.ok(children[0] && !children[0].killed, 'the child must NOT be killed on probe failure')
  await capturing.stop()
})

test('a crashed child flips the state to stopped with the exit code', async () => {
  const children = []
  const capturing = new TunnelManager({
    gatePort: 16177,
    ensureBinary: async () => '/fake/cloudflared',
    spawn: () => {
      const spawned = fakeChild()
      children.push(spawned)
      queueMicrotask(() => spawned.emit('spawn'))
      return spawned
    },
    probe: async () => 200,
    probeIntervalMs: 1,
    probeTimeoutMs: 50,
  })
  await capturing.startNamed('token', 'dsh.example.com')
  assert.equal(capturing.state().state, 'running')
  children[0].crash(3)
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(capturing.state().state, 'stopped')
  assert.match(capturing.state().error ?? '', /3/)
  await capturing.stop()
})

test('startNamed honors a full origin (scheme included) and defaults bare hosts', async () => {
  const children = []
  const capturing = new TunnelManager({
    gatePort: 16177,
    ensureBinary: async () => '/fake/cloudflared',
    spawn: () => {
      const spawned = fakeChild()
      children.push(spawned)
      queueMicrotask(() => spawned.emit('spawn'))
      return spawned
    },
    probe: async () => 200,
    probeIntervalMs: 1,
    probeTimeoutMs: 50,
  })
  await capturing.startNamed('token', 'http://dsh.example.com:8443')
  assert.equal(capturing.state().publicUrl, 'http://dsh.example.com:8443', 'the given scheme and port are kept')
  await capturing.stop()
  await capturing.startNamed('token', 'dsh.example.com')
  assert.equal(capturing.state().publicUrl, 'https://dsh.example.com', 'bare hosts default to https')
  await capturing.stop()
})

test('stop kills the child and reports stopped', async () => {
  const { manager, children } = makeManager()
  await manager.startNamed('token', 'dsh.example.com')
  await manager.stop()
  assert.equal(children[0].killed, true)
  assert.equal(manager.state().state, 'stopped')
})

test('startQuick parses the trycloudflare URL from the child output', async () => {
  const { manager, children } = makeManager()
  const started = manager.startQuick()
  queueMicrotask(() => {
    children[0].stderr.emit('data', Buffer.from('2026-10-15 INF +------------------------------------------------------------\n'))
    children[0].stderr.emit('data', Buffer.from('2026-10-15 INF |  https://random-words-here.trycloudflare.com                 |\n'))
  })
  await started
  assert.deepEqual(manager.state(), {
    mode: 'quick',
    state: 'running',
    publicUrl: 'https://random-words-here.trycloudflare.com',
    error: undefined,
  })
  await manager.stop()
})

test('starting again while running restarts the old child first', async () => {
  const { manager, children } = makeManager()
  await manager.startNamed('token-a', 'a.example.com')
  await manager.startNamed('token-b', 'b.example.com')
  assert.equal(children.length, 2)
  assert.equal(children[0].killed, true, 'the previous child was killed')
  assert.equal(manager.state().publicUrl, 'https://b.example.com')
  await manager.stop()
})




test('pickCloudflaredBin tries a self-installed cloudflared (which hit) before the pocket fallback', () => {
  const exists = (p) => p === '/opt/homebrew/bin/cloudflared'
  assert.equal(
    pickCloudflaredBin('/npm/missing', '/pocket/missing', exists, ['/opt/homebrew/bin/cloudflared']),
    '/opt/homebrew/bin/cloudflared',
    '自行安装（brew/手动）的 cloudflared 直接可用',
  )
  assert.equal(
    pickCloudflaredBin('/npm/missing', '/pocket/missing', exists, []),
    '/npm/missing',
    '没有 which 结果时保持原顺序（返回 npm bin 交给 install 下载）',
  )
})

test('pickCloudflaredBin prefers existing candidates and falls back in order', () => {
  const exists = (p) => p === '/fallback/cloudflared' || p === '/npm/alt'
  assert.equal(pickCloudflaredBin('/npm/bin', '/fallback/cloudflared', exists), '/fallback/cloudflared')
  assert.equal(pickCloudflaredBin('/npm/alt', '/fallback/cloudflared', exists), '/npm/alt', 'npm bin 候选先于 fallback')
  assert.equal(pickCloudflaredBin(['/npm/a', '/npm/alt'], '/fallback/cloudflared', exists), '/npm/alt', '数组形式的 bin 逐个尝试')
  assert.equal(pickCloudflaredBin('/npm/missing', '/fallback/missing', exists), '/npm/missing', '都不存在时返回 npm bin 交给 install()')
})
