/**
 * Loopback / LAN classification tests: the predicates the panel trust check,
 * the gate, and the tunnel decision share.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { isLoopbackHostname, isLoopbackAddress, isLocalOrigin } from '../src/loopback.js'

test('isLoopbackHostname accepts localhost, [::1], and 127/8', () => {
  assert.equal(isLoopbackHostname('localhost'), true)
  assert.equal(isLoopbackHostname('[::1]'), true)
  assert.equal(isLoopbackHostname('127.0.0.1'), true)
  assert.equal(isLoopbackHostname('127.8.8.8'), true)
  assert.equal(isLoopbackHostname('dsh.example.com'), false)
  assert.equal(isLoopbackHostname('192.0.2.22'), false)
})

test('isLoopbackAddress normalizes IPv4-mapped forms', () => {
  assert.equal(isLoopbackAddress('::1'), true)
  assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true)
  assert.equal(isLoopbackAddress('127.0.0.1'), true)
  assert.equal(isLoopbackAddress('192.0.2.22'), false)
  assert.equal(isLoopbackAddress(undefined), false)
})

test('isLocalOrigin detects loopback and private-LAN origins', () => {
  assert.equal(isLocalOrigin('http://localhost:16177'), true)
  assert.equal(isLocalOrigin('http://127.0.0.1:3080'), true)
  assert.equal(isLocalOrigin('https://192.168.55.22:3080'), true)
  assert.equal(isLocalOrigin('http://10.0.0.5'), true)
  assert.equal(isLocalOrigin('http://172.16.0.9'), true)
  assert.equal(isLocalOrigin('localhost'), true, 'scheme-less input defaults to https and still classifies')
  assert.equal(isLocalOrigin('https://remote.example.com'), false)
  assert.equal(isLocalOrigin(''), false)
  assert.equal(isLocalOrigin(undefined), false)
})
