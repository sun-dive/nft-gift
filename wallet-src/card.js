// © BSV Association — Licensed under the Open BSV License Version 6 (see LICENSE).
// nft.gift — Immortalize a card (Phase 1) + gift it (Phase 2).
//
// Pure integration: it calls PharLap's V1 edition covenant + gift-voucher code
// as the SINGLE SOURCE OF TRUTH (imported from ../../PharLap/src, not copied),
// so the on-chain bytes are byte-identical to PharLap and the tokens
// interoperate — one BSV identity across apps. Nothing new is invented here.
//
// A card is a V1 replicable edition with all fees defaulted to 1 sat (fee-to-
// self = free; only the miner is paid). The N-payout covenant is the
// multiverse wall's future, not a card's — untouched.
import { PrivateKey, Hash, P2PKH, Transaction } from '@bsv/sdk'
import { activeKey, activeAddress } from './wallet.js'
import { WalletProvider } from '../../PharLap/src/walletProvider.ts'
import { createEdition, createGiftVouchers, buildEditionGenesisTx, toFundingInputs } from '../../PharLap/src/editionBuilder.ts'

const FEE_KB = 101                                   // matches PharLap: a 1-sat margin so txs land AT/ABOVE the official 100 sats/KB floor (not rounding a hair under → rejected). Not inflation.
const provider = () => new WalletProvider(activeAddress())
const own160 = key => Hash.hash160(key.toPublicKey().encode(true))
// V1 terms, everything at the 1-sat floor: the "publisher fee" is paid to YOURSELF, so it's free bar the miner.
const cardTerms = key => ({ publisherPubKeyHash: own160(key), publisherFeeSats: 1, holderFeeSats: 1, tokenSats: 1 })
const need = () => { const k = activeKey(); if (!k) throw new Error('Unlock your wallet first.'); return k }

const api = {
  /** Immortalize: mint the card as a replicable V1 edition owned by your wallet. A card is PRIVATE — there is
   *  no marketplace and no public cover; the whole front/inside/back SVG is the encrypted file. Only the miner
   *  is paid. `encrypt` stays a param (defaults on) so a deliberately-public card is still possible one day. */
  async immortalize({ title, svg, license, encrypt = true, confirmSpend } = {}) {
    const key = need()
    return createEdition(provider(), key, {
      tokenName: title || 'A card',
      terms: cardTerms(key),
      mintCount: 1,
      file: svg ? { mimeType: 'image/svg+xml', fileName: 'card.svg', bytes: svg } : undefined,
      encrypt: !!(svg && encrypt),
      license,
      feePerKb: FEE_KB,
      confirmSpend,
    })
  },

  /** Gift: fund `count` recoverable voucher keys (deterministic → clawback-able from your key alone).
   *  Each WIF becomes a claim link the recipient opens to claim their own copy. */
  async gift({ collectionId, count = 1, startIndex = 0, fundEachSats = 1500 } = {}) {
    need()
    const { fundingTxId, voucherWifs } = await createGiftVouchers(provider(), activeKey(),
      { tx1RefHex: collectionId, startIndex, count, fundEachSats, feePerKb: FEE_KB })
    return { fundingTxId, voucherWifs }
  },

  // ── offline helpers (no broadcast): fee preview + deterministic tests ──
  _buildGenesis: (funding, tx1Ref, opts = {}) =>
    buildEditionGenesisTx({ key: need(), funding, tx1Ref, terms: cardTerms(need()), feePerKb: FEE_KB, ...opts }),
  _lib: { PrivateKey, Hash, P2PKH, Transaction, WalletProvider, toFundingInputs },
}

window.nftCard = api
