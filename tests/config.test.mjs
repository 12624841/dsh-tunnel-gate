/**
 * Config helpers: hostname normalization accepts the shapes a user actually
 * types into the settings card.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeOrigin, normalizeBindHost } from '../src/config.js'

test('normalizeOrigin keeps an explicit origin with its scheme', () => {
  assert.equal(normalizeOrigin('https://dsh.example.com'), 'https://dsh.example.com')
  assert.equal(normalizeOrigin('http://dsh.example.com:8443/x'), 'http://dsh.example.com:8443')
})

test('normalizeOrigin defaults the scheme to https when absent', () => {
  assert.equal(normalizeOrigin('dsh.example.com'), 'https://dsh.example.com')
  assert.equal(normalizeOrigin('dsh.example.com:8443'), 'https://dsh.example.com:8443')
})

test('normalizeOrigin trims whitespace and a trailing slash, lowercases the host', () => {
  assert.equal(normalizeOrigin('  https://DSH.Example.COM/  '), 'https://dsh.example.com')
  assert.equal(normalizeOrigin('  dsh.example.com:8443  '), 'https://dsh.example.com:8443')
})

test('normalizeOrigin collapses garbage to the empty string', () => {
  assert.equal(normalizeOrigin(''), '')
  assert.equal(normalizeOrigin('   '), '')
  assert.equal(normalizeOrigin('not a host!!'), '')
  assert.equal(normalizeOrigin(undefined), '')
})

test('normalizeBindHost accepts loopback, wildcard, and LAN literals', () => {
  assert.equal(normalizeBindHost('127.0.0.1'), '127.0.0.1')
  assert.equal(normalizeBindHost('0.0.0.0'), '0.0.0.0')
  assert.equal(normalizeBindHost(' 192.0.2.22 '), '192.0.2.22')
  assert.equal(normalizeBindHost('10.0.0.5'), '10.0.0.5')
  assert.equal(normalizeBindHost('::'), '::')
  assert.equal(normalizeBindHost('[::1]'), '::1')
})

test('normalizeBindHost maps localhost to 127.0.0.1', () => {
  assert.equal(normalizeBindHost('localhost'), '127.0.0.1')
  assert.equal(normalizeBindHost('  localhost  '), '127.0.0.1')
})

test('normalizeBindHost falls back to 127.0.0.1 on garbage', () => {
  assert.equal(normalizeBindHost(''), '127.0.0.1')
  assert.equal(normalizeBindHost('999.1.1.1'), '127.0.0.1')
  assert.equal(normalizeBindHost('dsh.example.com'), '127.0.0.1', 'bind addresses are IPs, not hostnames')
  assert.equal(normalizeBindHost(undefined), '127.0.0.1')
})
