// Bundle the keepsake wallet into one self-contained file for the immortalize/ page.
// The editor stays build-free; ONLY this page loads the BSV SDK.
//   npm run build:wallet      (or: node build-wallet.mjs)
import { build } from 'esbuild'

await build({
  entryPoints: ['wallet-src/index.js'],
  outfile: 'immortalize/wallet.bundle.js',
  bundle: true,
  format: 'iife',
  minify: true,
  target: 'es2020',   // BSV SDK uses BigInt literals (0n) — needs es2020+
  legalComments: 'none',
})
console.log('✓ built immortalize/wallet.bundle.js')
