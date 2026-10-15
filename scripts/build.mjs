/**
 * Build the browser half: bundle src/client/index.jsx into lib/client.js
 * using the exact artifact contract the dsh web shell's module loader
 * expects — a closure factory registered via `window.__ModuleLoader__.load`,
 * with platform modules (react, cordis, …) resolved through the loader's
 * injected `require` module table and everything else inlined.
 *
 * The wrapper mirrors dsh-web's shared/tsdown.client.ts byte-for-byte in
 * shape (banner / intro / footer around a CJS bundle).
 */
import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = (await import(join(root, 'package.json'), { with: { type: 'json' } })).default

/** The frozen platform module table the shell seeds the loader with. */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

mkdirSync(join(root, 'lib'), { recursive: true })

await build({
  entryPoints: [join(root, 'src/client/index.jsx')],
  outfile: join(root, 'lib/client.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  jsx: 'automatic',
  sourcemap: true,
  legalComments: 'none',
  external: PLATFORM_MODULES,
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  banner: {
    js: [
      `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => {`,
      `var module = { exports: {} }; var exports = module.exports;`,
    ].join('\n'),
  },
  footer: {
    js: 'return module.exports; } });',
  },
})

console.log(`[tunnel-gate] built lib/client.js (id: ${pkg.name})`)
