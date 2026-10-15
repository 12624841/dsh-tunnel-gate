/**
 * Tunnel manager: runs the cloudflared child process against the local gate.
 *
 * Two modes:
 * - `named` — an account tunnel (`cloudflared tunnel run`) whose public
 *   hostname is fixed by the Cloudflare dashboard. The tunnel token is a
 *   secret: it reaches the child through the TUNNEL_TOKEN environment
 *   variable, never argv. Readiness is probed through the tunnel itself
 *   (`GET /gate-ping` on the public hostname).
 * - `quick` — an ephemeral trycloudflare.com tunnel; the minted hostname is
 *   parsed from the child's output.
 *
 * The binary/spawn/probe seams are injectable: production resolves the
 * platform cloudflared binary (downloading it when missing), tests fake the
 * process. Child exit mid-run flips the state to `stopped` with the exit
 * code; `stop()` kills the child and is safe to call repeatedly.
 */
import { spawn as nodeSpawn } from 'node:child_process'
import { homedir } from 'node:os'

/** Command line for a named tunnel (the token rides the env, never argv). */
export function namedTunnelArgs() {
  return ['tunnel', '--no-autoupdate', '--protocol', 'http2', 'run']
}

/** Command line for an accountless quick tunnel aimed at the gate. */
export function quickTunnelArgs(gatePort) {
  return ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${String(gatePort)}`]
}

/** Defaults for the readiness probe loop. */
const PROBE_INTERVAL_MS = 2_000
const PROBE_TIMEOUT_MS = 90_000

/**
 * Default readiness probe: fetch the public URL's ping endpoint.
 * @param url - absolute public URL of the tunnel.
 * @returns the HTTP status.
 */
async function defaultProbe(url) {
  const response = await fetch(`${url}/gate-ping`, { signal: AbortSignal.timeout(4_000) })
  return response.status
}

/** The cloudflared state exposed to the panel. */
export class TunnelManager {
  #gatePort
  #ensureBinary
  #spawn
  #probe
  #probeIntervalMs
  #probeTimeoutMs
  #child = undefined
  #mode = 'off'
  #state = 'stopped'
  #publicUrl = undefined
  #error = undefined
  #probeAbort = new AbortController()
  #startSeq = 0

  /**
   * @param options.gatePort - local gate port the tunnel targets.
   * @param [options.ensureBinary] - `() => Promise<string>` absolute binary path (downloads when missing).
   * @param [options.spawn] - process factory seam (tests).
   * @param [options.probe] - readiness probe seam (tests).
   * @param [options.probeIntervalMs] - probe cadence.
   * @param [options.probeTimeoutMs] - readiness budget.
   */
  constructor({ gatePort, ensureBinary, spawn = nodeSpawn, probe = defaultProbe, probeIntervalMs = PROBE_INTERVAL_MS, probeTimeoutMs = PROBE_TIMEOUT_MS }) {
    this.#gatePort = gatePort
    this.#ensureBinary = ensureBinary ?? defaultEnsureBinary
    this.#spawn = spawn
    this.#probe = probe
    this.#probeIntervalMs = probeIntervalMs
    this.#probeTimeoutMs = probeTimeoutMs
  }

  /** Current status snapshot for the panel. */
  state() {
    return { mode: this.#mode, state: this.#state, publicUrl: this.#publicUrl, error: this.#error }
  }

  /**
   * Record an operator-facing failure without changing the run state — the
   * panel renders it so a failed start is visible beyond the host console.
   */
  note(message) {
    this.#error = message
  }

  /** Whether a child is currently owned. */
  get running() {
    return this.#child !== undefined
  }

  /** Kill any owned child and reset the state to stopped. */
  async stop() {
    this.#startSeq += 1
    this.#probeAbort.abort()
    this.#probeAbort = new AbortController()
    await this.#killChild()
    this.#mode = 'off'
    this.#state = 'stopped'
    this.#publicUrl = undefined
  }

  /**
   * Start (or restart) a named account tunnel.
   * @param token - the Cloudflare tunnel token.
   * @param hostname - the fixed public hostname (e.g. dsh.example.com).
   * @returns the running state snapshot.
   */
  async startNamed(token, hostname) {
    const binary = await this.#ensureBinary()
    const seq = this.#restart()
    this.#mode = 'named'
    this.#state = 'starting'
    // The settings store a full origin (scheme included); bare hosts default to https.
    this.#publicUrl = /^https?:\/\//i.test(hostname) ? hostname : `https://${hostname}`
    this.#error = undefined
    const child = this.#spawn([binary, ...namedTunnelArgs()], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, TUNNEL_TOKEN: token },
    })
    this.#child = child
    this.#watchChild(child, seq)
    // Readiness probe: a failure here usually means the CLOUDFLARE-side
    // origin config is wrong (the 1033 lesson) — cloudflared itself is
    // registered and healthy, so NEVER kill it over this. Surface the
    // warning and keep the connection alive.
    try {
      await this.#probeUntilReady(this.#publicUrl, seq)
    } catch (error) {
      if (seq !== this.#startSeq) throw new Error('superseded')
      this.#state = 'running'
      this.#error = `隧道已连接，但就绪探测未通过（${error instanceof Error ? error.message : String(error)}）——请检查 Cloudflare 控制台里该域名的回源地址是否指向 http://localhost:${String(this.#gatePort)}`
      return this.state()
    }
    if (seq !== this.#startSeq) throw new Error('superseded')
    this.#state = 'running'
    return this.state()
  }

  /**
   * Start (or restart) an accountless quick tunnel; the minted hostname
   * arrives on the child's output.
   * @returns the running state snapshot.
   */
  async startQuick() {
    const binary = await this.#ensureBinary()
    const seq = this.#restart()
    this.#mode = 'quick'
    this.#state = 'starting'
    this.#publicUrl = undefined
    this.#error = undefined
    const child = this.#spawn([binary, ...quickTunnelArgs(this.#gatePort)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    })
    this.#child = child
    this.#watchChild(child, seq)
    const url = await new Promise((resolve, reject) => {
      const onOutput = (chunk) => {
        const match = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i.exec(chunk.toString())
        if (match !== null) {
          cleanup()
          resolve(match[0])
        }
      }
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error('quick tunnel did not mint a hostname in time'))
      }, this.#probeTimeoutMs)
      const cleanup = () => {
        child.stdout.off('data', onOutput)
        child.stderr.off('data', onOutput)
        clearTimeout(timer)
      }
      child.stdout.on('data', onOutput)
      child.stderr.on('data', onOutput)
      child.on('exit', () => {
        cleanup()
        reject(new Error('cloudflared exited before minting a hostname'))
      })
    })
    if (seq !== this.#startSeq) throw new Error('superseded')
    this.#publicUrl = url
    this.#state = 'running'
    return this.state()
  }

  /** Kill the previous child and invalidate its watchers. */
  #restart() {
    this.#startSeq += 1
    this.#probeAbort.abort()
    this.#probeAbort = new AbortController()
    void this.#killChild()
    return this.#startSeq
  }

  /** Kill the owned child if any, awaiting its exit when it reports one. */
  async #killChild() {
    const child = this.#child
    this.#child = undefined
    if (child === undefined) return
    if (child.exitCode === null && !child.killed) {
      const exited = new Promise((resolve) => child.once('exit', resolve))
      child.kill('SIGTERM')
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 1_000))])
    }
  }

  /** Wire exit/crash watching for one owned child. */
  #watchChild(child, seq) {
    child.on('exit', (code) => {
      if (this.#child !== child || seq !== this.#startSeq) return
      this.#child = undefined
      this.#state = 'stopped'
      this.#error = `cloudflared exited (code ${String(code)})`
    })
  }

  /** Poll the probe until it answers 200 or the budget runs out. */
  async #probeUntilReady(url, seq) {
    const deadline = Date.now() + this.#probeTimeoutMs
    let lastError = 'readiness probe failed'
    while (Date.now() < deadline) {
      if (seq !== this.#startSeq) throw new Error('superseded')
      try {
        const status = await this.#probe(url)
        if (status === 200) return
        lastError = `readiness probe answered ${String(status)}`
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, this.#probeIntervalMs)
        this.#probeAbort.signal.addEventListener('abort', () => {
          clearTimeout(timer)
          resolve()
        }, { once: true })
      })
    }
    throw new Error(`tunnel readiness timeout: ${lastError}`)
  }
}

/**
 * Pick the cloudflared binary: the npm package's bin (a string or a list of
 * candidates) first, then a known on-disk fallback (dsh-pocket ships one).
 * @param pkgBin - the `cloudflared` npm package's bin export.
 * @param fallbackBin - absolute path of a known existing binary.
 * @param exists - existence predicate (injected for tests).
 * @returns the first existing candidate, else the npm bin's first entry.
 */
export function pickCloudflaredBin(pkgBin, fallbackBin, exists = (p) => typeof p === 'string' && p.length > 0, whichCandidates = []) {
  const candidates = [...(Array.isArray(pkgBin) ? pkgBin : [pkgBin]), ...whichCandidates, fallbackBin]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate !== '' && exists(candidate)) return candidate
  }
  return Array.isArray(pkgBin) ? pkgBin[0] : pkgBin
}

/**
 * Default binary seam: resolve the platform cloudflared binary through the
 * `cloudflared` npm package, downloading it when the postinstall was skipped.
 * A previously downloaded binary (e.g. under $DSH_HOME/dsh-pocket/bin) wins
 * over a fresh download.
 * @returns the absolute binary path.
 */
async function defaultEnsureBinary() {
  const { existsSync } = await import('node:fs')
  const { join } = await import('node:path')
  const cloudflared = await import('cloudflared')
  const fallback = join(dshPocketBin(), 'cloudflared')
  // A self-installed cloudflared (brew / manual) on PATH is used as-is.
  let whichHits = []
  try {
    const { execFileSync } = await import('node:child_process')
    whichHits = [execFileSync('/usr/bin/which', ['cloudflared'], { encoding: 'utf8' }).trim()]
  } catch {}
  const bin = pickCloudflaredBin(cloudflared.bin, fallback, existsSync, whichHits)
  if (!existsSync(bin)) {
    try {
      await cloudflared.install()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`cloudflared 二进制下载失败（${message}）。可从任一可用机器拷贝一份到 ${fallback} 后重试`)
    }
  }
  return bin
}

/** The dsh-pocket bin directory (a known cloudflared download location). */
function dshPocketBin() {
  const home = process.env.DSH_HOME?.trim().replace(/\/$/, '') || homedir()
  return `${home}/.dsh/dsh-pocket/bin`
}
