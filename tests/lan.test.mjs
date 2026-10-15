/**
 * LAN address discovery: the panel shows the reachable intranet URL when the
 * gate binds beyond loopback. Filtering is pure and unit-tested; the default
 * source is os.networkInterfaces().
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { lanIPv4Addresses } from '../src/lan.js'

test('lanIPv4Addresses keeps non-internal IPv4 addresses with their interface name', () => {
  const ifaces = {
    lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }, { address: '::1', family: 'IPv6', internal: true }],
    en0: [{ address: '192.0.2.22', family: 'IPv4', internal: false }, { address: 'fe80::1', family: 'IPv6', internal: false }],
    utun0: [{ address: '10.8.0.2', family: 'IPv4', internal: false }],
  }
  assert.deepEqual(lanIPv4Addresses(ifaces), [
    { name: 'en0', address: '192.0.2.22' },
    { name: 'utun0', address: '10.8.0.2' },
  ])
})

test('lanIPv4Addresses returns an empty list for loopback-only machines', () => {
  const ifaces = { lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }] }
  assert.deepEqual(lanIPv4Addresses(ifaces), [])
})
