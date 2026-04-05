/**
 * Post–Wallet Ready screen: consumed once on Home mount.
 * `nfcSync`: triggers the same NFC pipeline as Home — claim step uses `postNfcLinkAppClaimWithKey`
 * (current wallet privateKey sent to backend `/api/nfcLinkAppClaimWithKey`).
 */
export const WALLET_READY_INTENT_KEY = 'beamio:walletReadyIntent'

export type WalletReadyIntent = 'activate' | 'nfcSync'
