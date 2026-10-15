/**
 * Plugin config: the schema doubles as the settings-page model — every
 * `volatile()` field is live-editable from the browser settings card; the
 * loader commits the new value into the field's live reference and announces
 * `loader/volatile-update` on this fiber, so the gate server, the tunnel and
 * the device sessions survive a settings save.
 *
 * Non-volatile fields (`gatePort`) need a remount to take effect because they
 * shape the mount itself.
 */
import z from '@deepseek-ai/schemastery'

/** Defaults for every resolvable field, kept beside the schema. */
export const DEFAULTS = Object.freeze({
  enabled: true,
  publicHostname: '',
  tunnelToken: '',
  gateHost: '127.0.0.1',
  gatePort: 16177,
  autoTunnel: false,
  codeWindowMs: 60_000,
  maxDevices: 8,
  upstreamPort: 3080,
})

/**
 * Normalize a user-typed public origin. Accepts a full URL
 * (`https://dsh.example.com`, `http://…:8443/some/path`) or a bare host
 * (`dsh.example.com`, `host:8443` — the scheme defaults to https). Returns
 * the scheme-prefixed origin without path or trailing slash; '' when nothing
 * usable remains.
 * @param value - raw settings input.
 * @returns the normalized origin (with scheme), or ''.
 */
export function normalizeOrigin(value) {
  if (typeof value !== 'string') return ''
  const raw = value.trim()
  if (raw === '') return ''
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
    if (url.hostname === '') return ''
    url.hash = ''
    url.pathname = '/'
    url.search = ''
    return url.origin
  } catch {
    return ''
  }
}

/**
 * Normalize a user-typed gate bind address: an IP literal (IPv4/IPv6),
 * `0.0.0.0` (all interfaces), `*`, or `localhost` (→ 127.0.0.1). Anything
 * else falls back to `127.0.0.1` — bind addresses are IPs, not hostnames.
 * @param value - raw settings input.
 * @returns the normalized bind address.
 */
export function normalizeBindHost(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (raw === '') return '127.0.0.1'
  if (raw === '*' || raw === 'any') return '0.0.0.0'
  if (raw === 'localhost') return '127.0.0.1'
  const host = raw.startsWith('[') && raw.endsWith(']') ? raw.slice(1, -1) : raw
  return netIsIP(host) !== 0 ? host : '127.0.0.1'
}

/** net.isIP without importing at module top (kept beside the other helpers). */
function netIsIP(value) {
  const ipv4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
  if (ipv4.test(value)) return 4
  const ipv6 = /^[0-9a-f:]+$/i
  return value.includes(':') && ipv6.test(value) ? 6 : 0
}

/** The schemastery schema — IS the entry's settings page. */
export const Config = z
  .object({
    /** Master switch: stops the gate server and the tunnel when false. */
    enabled: z.boolean().default(DEFAULTS.enabled).volatile(),
    /** Gate bind address: 127.0.0.1 (default), 0.0.0.0, or a LAN IP. */
    gateHost: z.string().default('127.0.0.1').volatile(),
    /** LAN access: bind the gate to 0.0.0.0 so intranet devices can pair directly. */
    lanAccess: z.boolean().default(false).volatile(),
    /** Fixed public hostname of the Cloudflare tunnel, e.g. dsh.example.com. */
    publicHostname: z.string().volatile(),
    /** Cloudflare named-tunnel token (Zero Trust → Tunnels → tunnel token). */
    tunnelToken: z.string().role('secret').volatile(),
    /** Loopback port of the gate server cloudflared points at. */
    gatePort: z.number().step(1).min(1024).max(65535).default(DEFAULTS.gatePort),
    /** When true (and no token set), run an ephemeral trycloudflare quick tunnel instead. */
    autoTunnel: z.boolean().default(DEFAULTS.autoTunnel).volatile(),
    /** Lifetime of one 6-digit code window. */
    codeWindowMs: z.number().step(1).min(30_000).max(300_000).default(DEFAULTS.codeWindowMs).volatile(),
    /** Hard cap on paired device sessions (oldest evicted when full). */
    maxDevices: z.number().step(1).min(1).max(32).default(DEFAULTS.maxDevices).volatile(),
    /** Upstream DSH web-server port override; discovered from ctx.webServer when unset. */
    upstreamPort: z.number().step(1).min(1).max(65535).default(DEFAULTS.upstreamPort),
  })
  .description('tunnel-gate')
