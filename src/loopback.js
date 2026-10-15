/**
 * Browser-safe loopback classification, shared by the panel trust check and
 * the gate server. Mirrors the harness's own predicate: `localhost`, the
 * IPv6 loopback literal, and any IPv4 address in 127/8.
 */

/**
 * Whether a hostname names the local loopback authority.
 * @param hostname - WHATWG URL hostname (IPv6 literals keep their brackets).
 * @returns true for localhost, [::1], and 127.x.x.x.
 */
export function isLoopbackHostname(hostname) {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4 && parts[0] === '127' && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/**
 * Whether a request's peer address is loopback.
 * @param remoteAddress - socket remote address.
 * @returns true for ::1 and 127.x.x.x (IPv4-mapped forms normalized).
 */
export function isLoopbackAddress(remoteAddress) {
  if (typeof remoteAddress !== 'string') return false
  if (remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1') return true
  return isLoopbackHostname(remoteAddress)
}

/**
 * Whether an origin points at this machine or a private LAN — loopback or
 * RFC1918 private addresses. Cloudflare cannot route such origins, so the
 * tunnel manager skips cloudflared for them while the panel still shows the
 * link for direct access.
 * @param value - an origin URL or bare host[:port].
 * @returns true for localhost/127/8, ::1, 10/8, 172.16/12, 192.168/16.
 */
export function isLocalOrigin(value) {
  if (typeof value !== 'string' || value.trim() === '') return false
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`)
    const host = url.hostname
    if (isLoopbackHostname(host)) return true
    return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
  } catch {
    return false
  }
}
