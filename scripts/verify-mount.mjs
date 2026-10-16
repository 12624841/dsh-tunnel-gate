import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://127.0.0.1:3080/', pretendToBeVisual: true })
globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.MouseEvent = dom.window.MouseEvent
globalThis.Element = dom.window.Element
globalThis.SVGElement = dom.window.SVGElement
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0)
globalThis.fetch = () => Promise.resolve({ ok: true, json: async () => ({ code: '111111', codeExpiresAt: Date.now() + 50000, devices: [], tunnel: {}, gate: {}, config: {}, pairUrl: 'https://x/pair?code=1' }) })

const { createRequire } = await import('node:module')
const tableRequire = createRequire(new URL('./package.json', import.meta.url).pathname)
const holders = {}
window.__ModuleLoader__ = { load: ({ factory }) => { holders.exports = factory(tableRequire) } }
await import('./lib/client.js')
const moduleExports = holders.exports

const settingsForm = {
  getSnapshot: () => { throw new Error('snapshot exploded') },
  subscribe: () => () => {},
  set: () => Promise.resolve(true),
}
process.on('uncaughtException', (e) => { console.log('UNCAUGHT:', e.message, '|', (e.stack||'').split('\n')[1]); })
let registered
const ctx = {
  locale: { register: () => () => {}, bind: () => undefined },
  configForms: { get: () => settingsForm },
  slots: { inject: (h, s) => s(), register: (o, C) => { registered = { o, C }; return () => {} } },
  effect: (fn) => fn(),
  get: () => undefined,
}
moduleExports.apply(ctx)
const react = tableRequire('react')
const origCreate = react.createElement
react.createElement = (...args) => {
  if (args[0] === undefined) console.log('CREATE-UNDEFINED STACK:', new Error().stack.split('\n').slice(1, 5).join('\n'))
  return origCreate(...args)
}
const client = tableRequire('react-dom/client')
const root = client.createRoot(document.getElementById('root'))
root.render(react.createElement(registered.C, { wide: true }))
await new Promise(r => setTimeout(r, 100))
document.querySelector('[data-tunnel-gate-trigger]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
await new Promise(r => setTimeout(r, 150))
const panel = document.querySelector('[data-tunnel-gate-panel]')
console.log('PANEL TEXT:', JSON.stringify(panel?.textContent?.slice(0, 260)))
console.log('BUTTONS:', [...(panel?.querySelectorAll('button') ?? [])].map(b => b.textContent))
process.exit(0)
