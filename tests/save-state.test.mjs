/**
 * Settings-card save logic: an unavailable form or any failed write is a
 * HARD FAILURE — the card must never claim success without verified writes
 * (the host only persists when the profile entry is writable).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { SAVE_STATE, saveOutcome, savePlan, settingsAccess } from '../src/client/save-state.js'

test('saveOutcome is saved only when every attempted write succeeded', () => {
  assert.equal(saveOutcome([true, true]), SAVE_STATE.saved)
  assert.equal(saveOutcome([true, false]), SAVE_STATE.failed)
  assert.equal(saveOutcome([false]), SAVE_STATE.failed)
})

test('saveOutcome ignores skipped fields and fails when nothing was attempted', () => {
  assert.equal(saveOutcome(['skipped', 'skipped', true]), SAVE_STATE.saved)
  assert.equal(saveOutcome(['skipped', false]), SAVE_STATE.failed)
  assert.equal(saveOutcome([]), SAVE_STATE.failed, 'an empty attempt is a failure, not a silent success')
})

test('savePlan with no form produces no writes (the card renders failure)', () => {
  assert.deepEqual(savePlan(undefined, { publicHostname: 'x', tunnelToken: 'y', autoTunnel: true }), [])
})

test('savePlan attempts filled fields plus the autoTunnel flag', () => {
  const writes = savePlan({}, { publicHostname: ' dsh.example.com ', tunnelToken: ' tok ', autoTunnel: true, gateHost: '' })
  assert.deepEqual(writes, [
    { field: 'publicHostname', value: 'dsh.example.com' },
    { field: 'tunnelToken', value: 'tok' },
    { field: 'autoTunnel', value: true },
  ])
})

test('savePlan skips empty hostname/token but always writes autoTunnel', () => {
  const writes = savePlan({}, { publicHostname: '', tunnelToken: '', autoTunnel: false })
  assert.deepEqual(writes, [{ field: 'autoTunnel', value: false }])
})

test('savePlan includes the gate bind host when filled', () => {
  const writes = savePlan({}, { publicHostname: '', tunnelToken: '', autoTunnel: false, gateHost: ' 0.0.0.0 ' })
  assert.deepEqual(writes, [
    { field: 'autoTunnel', value: false },
    { field: 'gateHost', value: '0.0.0.0' },
  ])
})

/** A ConfigForm double with the given snapshot. */
function formOf(snapshot) {
  return { getSnapshot: () => snapshot, set: () => Promise.resolve(true) }
}

test('settingsAccess: no form is unavailable', () => {
  assert.equal(settingsAccess(undefined, '127.0.0.1').mode, 'unavailable')
})

test('settingsAccess: a loading form stays loading', () => {
  const access = settingsAccess(formOf({ status: 'loading', writable: false }), '127.0.0.1')
  assert.equal(access.mode, 'loading')
})

test('settingsAccess: a non-loopback page is read-only and echoes the saved values', () => {
  const snapshot = {
    status: 'ready',
    writable: true,
    value: { publicHostname: 'https://remote.example.com', gateHost: '0.0.0.0', autoTunnel: false, enabled: true },
  }
  const access = settingsAccess(formOf(snapshot), '192.0.2.22')
  assert.equal(access.mode, 'readonly')
  assert.equal(access.value.publicHostname, 'https://remote.example.com')
})

test('settingsAccess: a non-loopback page is read-only even while the form is still loading', () => {
  // The config plane is local-only: a remote page's snapshot NEVER reaches
  // 'ready'. That must read as readonly (with empty echo), not eternal loading.
  const access = settingsAccess(formOf({ status: 'loading', writable: false }), '192.0.2.22')
  assert.equal(access.mode, 'readonly')
  assert.deepEqual(access.value, {})
})

test('settingsAccess: a tunnel-domain page is read-only too', () => {
  const snapshot = { status: 'ready', writable: true, value: { publicHostname: '' } }
  assert.equal(settingsAccess(formOf(snapshot), 'remote.example.com').mode, 'readonly')
})

test('settingsAccess: an unwritable form on a local page is read-only', () => {
  const snapshot = { status: 'ready', writable: false, value: { publicHostname: 'https://x' } }
  const access = settingsAccess(formOf(snapshot), 'localhost')
  assert.equal(access.mode, 'readonly')
})

test('settingsAccess: a writable form on a loopback page is editable', () => {
  const snapshot = {
    status: 'ready',
    writable: true,
    value: { publicHostname: 'https://remote.example.com', gateHost: '127.0.0.1', autoTunnel: true, enabled: false },
  }
  const access = settingsAccess(formOf(snapshot), '127.0.0.1')
  assert.equal(access.mode, 'editable')
  assert.equal(access.value.gateHost, '127.0.0.1')
})

test('settingsAccess: the desktop shell (file://, dsh-app://) is LOCAL and editable', () => {
  const snapshot = {
    status: 'ready',
    writable: true,
    value: { publicHostname: '', gateHost: '127.0.0.1', enabled: true },
  }
  assert.equal(settingsAccess(formOf(snapshot), { hostname: '', protocol: 'file:' }).mode, 'editable')
  assert.equal(settingsAccess(formOf(snapshot), { hostname: 'dsh-app', protocol: 'dsh-app:' }).mode, 'editable')
})

test('settingsAccess: LAN and tunnel pages stay read-only (object form)', () => {
  const snapshot = { status: 'ready', writable: true, value: {} }
  assert.equal(settingsAccess(formOf(snapshot), { hostname: '192.0.2.22', protocol: 'http:' }).mode, 'readonly')
  assert.equal(settingsAccess(formOf(snapshot), { hostname: 'remote.example.com', protocol: 'https:' }).mode, 'readonly')
})
