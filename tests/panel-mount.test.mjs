/**
 * Mount harness against the SHIPPED artifact: loads lib/client.js exactly the
 * way the shell does (window.__ModuleLoader__.load + a require table), renders
 * the real FooterEntry inside jsdom, clicks the trigger, and asserts the
 * panel appears AND the trigger survives — regression harness for the
 * "globe vanishes on click" report.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'



const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://127.0.0.1:3080/',
  pretendToBeVisual: true,
})
globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.MouseEvent = dom.window.MouseEvent
globalThis.Element = dom.window.Element
globalThis.SVGElement = dom.window.SVGElement
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0)

const STATUS = {
  code: '522972',
  codeStartedAt: Date.now() - 1000,
  codeExpiresAt: Date.now() + 59_000,
  codeWindowMs: 60_000,
  devices: [],
  tunnel: { mode: 'named', state: 'running', publicUrl: 'https://dsh.example.com' },
  gate: { port: 16177, running: true, host: '127.0.0.1', lanUrls: [] },
  publicUrl: 'https://dsh.example.com',
  pairUrl: 'https://dsh.example.com/pair?code=522972',
  config: { publicHostname: 'https://dsh.example.com', gateHost: '127.0.0.1', autoTunnel: false, enabled: true },
}

globalThis.fetch = (url, options) => {
  void options
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => (String(url).includes('status') ? STATUS : { ok: true }),
  })
}

/** The loader require table: react/react-dom resolve from this package's devDependencies. */
const { createRequire } = await import('node:module')
const rootDir = new URL('..', import.meta.url).pathname
const tableRequire = createRequire(rootDir + 'package.json')

/** Evaluate the shipped bundle the way the shell does; return its exports. */
const moduleExports = await (async () => {
  const holders = {}
  window.__ModuleLoader__ = {
    load({ factory }) {
      holders.exports = factory((name) => tableRequire(name))
    },
  }
  await import('../lib/client.js')
  return holders.exports
})()

const react = tableRequire('react')
const reactDomClient = tableRequire('react-dom/client')

const { createElement } = react
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

test('clicking the trigger opens the panel and the trigger survives', async () => {
  const settingsForm = {
    getSnapshot: () => ({
      status: 'ready',
      writable: true,
      value: { publicHostname: 'https://dsh.example.com', gateHost: '127.0.0.1', autoTunnel: false, enabled: true },
    }),
    subscribe: () => () => {},
    set: () => Promise.resolve(true),
  }

  /** The fake client context: capture the sidebar slot registration. */
  let registered = undefined
  const ctx = {
    locale: { register: () => () => {}, bind: () => undefined },
    configForms: { get: () => settingsForm },
    slots: {
      inject: (hole, setup) => setup(),
      register: (options, Component) => {
        registered = { options, Component }
        return () => {}
      },
    },
    effect: (fn) => fn(),
    get: () => undefined,
  }
  moduleExports.apply(ctx)
  assert.ok(registered?.Component, 'the footer entry registered into the sidebar seat')

  const root = reactDomClient.createRoot(document.getElementById('root'))
  root.render(createElement(registered.Component, { wide: true }))
  await sleep(30)
  const trigger = document.querySelector('[data-tunnel-gate-trigger]')
  assert.ok(trigger, 'the trigger renders')

  trigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  await sleep(120)
  const panel = document.querySelector('[data-tunnel-gate-panel]')
  assert.ok(panel, 'the panel portal appears on click')
  assert.ok(document.querySelector('[data-tunnel-gate-trigger]'), 'the trigger is still there after opening')
  assert.match(panel.textContent, /522972/, 'the pairing code renders')
  assert.ok(panel.querySelector('svg'), 'the QR renders (svg)')

  trigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  await sleep(60)
  assert.equal(document.querySelector('[data-tunnel-gate-panel]'), null, 'the panel closes on the second click')
  assert.ok(document.querySelector('[data-tunnel-gate-trigger]'), 'the trigger survives closing')

  root.unmount()
})

test('disabled state keeps the globe and offers one-click re-enable', async () => {
  const settingsForm = {
    getSnapshot: () => ({
      status: 'ready',
      writable: true,
      value: { publicHostname: '', gateHost: '127.0.0.1', autoTunnel: false, enabled: false },
    }),
    subscribe: () => () => {},
    set: (field, value) => {
      settingsForm.lastSet = { field, value }
      return Promise.resolve(true)
    },
    lastSet: undefined,
  }

  let registered = undefined
  const ctx = {
    locale: { register: () => () => {}, bind: () => undefined },
    configForms: { get: () => settingsForm },
    slots: {
      inject: (hole, setup) => setup(),
      register: (options, Component) => {
        registered = { options, Component }
        return () => {}
      },
    },
    effect: (fn) => fn(),
    get: () => undefined,
  }
  moduleExports.apply(ctx)

  const root = reactDomClient.createRoot(document.getElementById('root'))
  root.render(createElement(registered.Component, { wide: true }))
  await sleep(30)
  // The globe must STAY even when remote access is disabled — otherwise the
  // toggle removes its own entry point (dead end).
  const trigger = document.querySelector('[data-tunnel-gate-trigger]')
  assert.ok(trigger, 'the globe stays visible while remote access is off')

  trigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  await sleep(120)
  const panel = document.querySelector('[data-tunnel-gate-panel]')
  assert.ok(panel, 'the panel opens while disabled')
  const enableBtn = [...panel.querySelectorAll('button')].find((b) => /重新启用|re-enable/i.test(b.textContent))
  assert.ok(enableBtn, 'a one-click re-enable control is offered')

  enableBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  await sleep(60)
  assert.deepEqual(settingsForm.lastSet, { field: 'enabled', value: true }, 're-enable writes enabled=true')

  root.unmount()
})




