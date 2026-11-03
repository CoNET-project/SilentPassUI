import { Wallet } from 'ethers'

/**
 * The dial derived the same wallet five times per call. Memory only; only the
 * current key is kept. Kept apart from dialKeyCache so modules that only need
 * the wallet do not load openpgp.
 */
let walletMemo: { key: string; wallet: Wallet } | null = null

/** The wallet for `privateKey`, derived once. */
export function cachedWallet(privateKey: string): Wallet {
	if (walletMemo && walletMemo.key === privateKey) return walletMemo.wallet
	const wallet = new Wallet(privateKey)
	walletMemo = { key: privateKey, wallet }
	return wallet
}

/** Test hook. */
export function resetDialWalletCacheForTest(): void {
	walletMemo = null
}
