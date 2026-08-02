// © BSV Association — Licensed under the Open BSV License Version 6 (see LICENSE).
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
  banner: { js: '/* nft.gift keepsake wallet — © 2026 sun-dive · Open BSV v6 (see LICENSE). Bundles @bsv/sdk (BRC-100 wallet SDK) © BSV Association, Open BSV; and qrcodegen © Project Nayuki, MIT. See NOTICE. Not our code; bundled + called, not ported. */' },
})
console.log('✓ built immortalize/wallet.bundle.js')
