/**
 * Dev-time peer-dep linking: the plugin's real runtime resolves
 * `@deepseek-ai/*` peers from the dsh profile tree; local test runs need the
 * same specifiers resolvable from the package directory. This script
 * symlinks the peers (plus react) out of a local dsh installation.
 *
 * Usage: node scripts/dev-link.mjs [path-to-dsh-installation]
 * (defaults to the global npm dsh install of the current node version)
 */
import { existsSync, mkdirSync, symlinkSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dshRoot = process.argv[2] ?? join(dirname(process.execPath), '..', 'lib', 'node_modules', '@deepseek-ai', 'dsh')

const peers = [
  ['@deepseek-ai/schemastery', join(dshRoot, 'node_modules', '@deepseek-ai', 'schemastery')],
  ['@deepseek-ai/cordis', join(dshRoot, 'node_modules', '@deepseek-ai', 'cordis')],
  ['react', join(dshRoot, 'node_modules', 'react')],
  ['react-dom', join(dshRoot, 'node_modules', 'react-dom')],
]

let linked = 0
for (const [name, target] of peers) {
  if (!existsSync(target)) {
    console.warn(`[tunnel-gate] skip ${name}: ${target} does not exist`)
    continue
  }
  const link = join(root, 'node_modules', name)
  mkdirSync(dirname(link), { recursive: true })
  try {
    unlinkSync(link)
  } catch {}
  symlinkSync(target, link, 'dir')
  linked += 1
}
console.log(`[tunnel-gate] linked ${String(linked)} peer(s) from ${dshRoot}`)
