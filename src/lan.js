/**
 * LAN address discovery: which IPv4 addresses of this machine are reachable
 * from the intranet (non-internal), used to render the gate's LAN URL when
 * the gate binds beyond loopback.
 */
import { networkInterfaces } from 'node:os'

/**
 * List non-internal IPv4 addresses.
 * @param ifaces - the os.networkInterfaces() shape (injectable for tests).
 * @returns `[{ name, address }]` in interface order.
 */
export function lanIPv4Addresses(ifaces = networkInterfaces()) {
  const result = []
  for (const [name, addresses] of Object.entries(ifaces ?? {})) {
    for (const entry of addresses ?? []) {
      if (entry.family === 'IPv4' && entry.internal === false) {
        result.push({ name, address: entry.address })
      }
    }
  }
  return result
}
