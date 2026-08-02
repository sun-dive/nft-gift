// © BSV Association — Licensed under the Open BSV License Version 6 (see LICENSE).
// nft.gift — the keepsake wallet (Phase 0: foundation).
//
// Self-custody, never custodial: the key is generated on YOUR device, encrypted
// at rest with your PIN (WebCrypto), and never leaves the browser. We can't see
// it or touch it. The 12-word recovery phrase is the only way back in.
//
// Keygen mirrors PharLap EXACTLY (same BIP-39 + derivation path) so the same
// phrase restores the same wallet across every app — one BSV identity.
//
// Bundled to wallet.bundle.js (esbuild) and exposed as window.nftWallet.
import { Mnemonic, HD } from '@bsv/sdk'
import { qrSvg, bsvPaymentUri } from './qr'

const PATH = "m/44'/236'/0'/0/0"          // coin type 236 = BSV — SAME path as PharLap → one identity across apps
const STORE = 'nftGift.wallet.v1'
const WOC = 'https://api.whatsonchain.com/v1/bsv/main'
const SS_REF = 'efe9f9694b4f'              // SimpleSwap partner exchange ref (same single code as PharLap) — swap any crypto → BSV, no signup

// ── keys ──────────────────────────────────────────────────────────────────
const norm = p => String(p).trim().replace(/\s+/g, ' ')
function keyFromPhrase(phrase, pass = '') {
  const m = norm(phrase)
  if (!Mnemonic.isValid(m)) throw new Error("That doesn't look like a valid 12-word recovery phrase.")
  return HD.fromSeed(Mnemonic.fromString(m).toSeed(pass)).derive(PATH).privKey
}
const freshPhrase = () => Mnemonic.fromRandom(128).toString()   // 128 bits = 12 words

// ── vault: PBKDF2(PIN) → AES-GCM over the phrase (only the public address is stored in clear) ──
const enc = new TextEncoder(), dec = new TextDecoder()
const b64 = u => btoa(String.fromCharCode(...new Uint8Array(u)))
const ub64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0))
async function aesKey(pin, salt) {
  const km = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' },
    km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
async function seal(phrase, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(pin, salt), enc.encode(phrase))
  return { salt: b64(salt), iv: b64(iv), ct: b64(ct) }
}
async function open(vault, pin) {   // throws (AES-GCM auth fail) on the wrong PIN
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub64(vault.iv) }, await aesKey(pin, ub64(vault.salt)), ub64(vault.ct))
  return dec.decode(pt)
}

// ── persistence ──
const read = () => { try { return JSON.parse(localStorage.getItem(STORE)) } catch (_) { return null } }
const write = o => localStorage.setItem(STORE, JSON.stringify(o))

let _key = null   // in-memory PrivateKey while unlocked; Phase 1 (mint) will read it here — it never leaves this module

const api = {
  isSetup: () => !!read(),
  isUnlocked: () => !!_key,
  address: () => { const s = read(); return s ? s.address : null },
  backedUp: () => { const s = read(); return !!(s && s.backedUp) },
  markBackedUp: () => { const s = read(); if (s) { s.backedUp = true; write(s) } },
  forget: () => { localStorage.removeItem(STORE); _key = null },   // remove wallet from this device (phrase still restores it)

  newPhrase: () => freshPhrase(),                                  // show BEFORE committing, so the user can write it down

  // commit a phrase under a PIN (used by both create & restore); derives + stores + unlocks
  async commit(phrase, pin, backedUp = false) {
    const key = keyFromPhrase(phrase)
    write({ v: 1, address: key.toAddress(), vault: await seal(norm(phrase), pin), backedUp })
    _key = key
    return { address: key.toAddress() }
  },
  restore(phrase, pin) { return this.commit(phrase, pin, true) },  // restoring implies it's already backed up

  async unlock(pin) {
    const s = read(); if (!s) throw new Error('No wallet on this device yet.')
    _key = keyFromPhrase(await open(s.vault, pin))
    return { address: s.address }
  },
  lock() { _key = null },
  revealPhrase(pin) { const s = read(); if (!s) throw new Error('No wallet on this device yet.'); return open(s.vault, pin) },

  async balance() {                                                // sats: { confirmed, unconfirmed, total } — or null if offline
    const s = read(); if (!s) return null
    try {
      const r = await fetch(`${WOC}/address/${s.address}/balance`); if (!r.ok) throw 0
      const j = await r.json(); const c = j.confirmed | 0, u = j.unconfirmed | 0
      return { confirmed: c, unconfirmed: u, total: c + u }
    } catch (_) { return null }
  },

  buyUrl: () => SS_REF ? `https://simpleswap.io/?ref=${encodeURIComponent(SS_REF)}&from=btc-btc&to=bsv-bsv&amount=0.001`
                       : 'https://simpleswap.io/?from=btc-btc&to=bsv-bsv&amount=0.001',
  qrSvg: (text, opts) => qrSvg(text, opts),
  paymentUri: (addr, sats) => bsvPaymentUri(addr, sats),
}

// shared with the card module (same bundle) so minting signs with the in-memory key — the key still never leaves the bundle
export const activeKey = () => _key
export const activeAddress = () => { const s = read(); return s ? s.address : null }

window.nftWallet = api
