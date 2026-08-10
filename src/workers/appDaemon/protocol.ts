/**
 * App Daemon Worker ↔ host protocol.
 * Owns all pure-read dashboard feeder schedules (6s / 15s / 30s / 5min).
 * BeamioTag + MerchantCard stay on the separate Tag Worker.
 * No private keys / mnemonics in this protocol.
 */

/** Light wallet tick: balances + profile / dashboard snapshot */
export const APP_DAEMON_WALLET_FEED_MS = 6_000
export const APP_DAEMON_AA_PENDING_FEED_MS = 15_000
/** Side + heavy: Discover/Coupon + mining/L0/referrer (when no dashboard) */
export const APP_DAEMON_SIDE_FEED_MS = 30_000
/** Heaviest unified income — never on 6s cadence */
export const APP_DAEMON_UNIFIED_FEED_MS = 90_000
export const APP_DAEMON_ORACLE_FEED_MS = 5 * 60 * 1000

export const APP_DAEMON_CONET_RPC = 'https://publicrpc.conet.network'
export const APP_DAEMON_PUBLIC_RPC = 'https://publicrpc.conet.network'
export const APP_DAEMON_BASE_RPC = 'https://base-rpc.conet.network'

/**
 * Multicall3 — Base uses canonical CREATE2; CoNET filled after deploy
 * (see deployments/conet-Multicall3.json). Empty → Worker falls back to batched eth_call.
 */
export const APP_DAEMON_BASE_MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11'
/** CoNET Multicall3 — deployments/conet-Multicall3.json */
export const APP_DAEMON_CONET_MULTICALL3 = '0x4e73d76E7fC6b6Aa471dca7238107246BF4c8145'

/**
 * BeamioConsumerWalletDashboard proxy — single eth_call snapshot for 6s tick.
 * deployments/conet-BeamioConsumerWalletDashboard.json
 */
export const APP_DAEMON_WALLET_DASHBOARD = '0x28370397A2b0C504e93754288ABb4F47EAaf168f'

/** Session identity only — never send privateKeyArmor / mnemonic. */
export type AppDaemonSession = {
	eoa: string
	aaAccount?: string
}

export type AppDaemonConetBalances = {
	usdc: string
	cnet: string
	gb: string
}

export type AppDaemonMiningNetworkStats = {
	stakedValidators: number
	stakedValidatorsFormatted: string
	supplyIncreaseCnet: number
	supplyIncreaseFormatted: string
}

export type AppDaemonMiningDepinStats = {
	depinNodeCount: number
	depinNodeCountFormatted: string
	totalGbIssued: number
	totalGbIssuedFormatted: string
}

export type AppDaemonCurrencyData = {
	CAD: number
	USD: number
	JPY: number
	CNY: number
	USDC: number
	HKD: number
	SGD: number
	EUR: number
	TWD: number
}

export type AppDaemonL0StartKitQuota = {
	eoa: string
	starterKetRemaining: string
	paidBunitRemaining: string
	issuedCodeCount: string
	claimedCodeCount: string
	fetchedAt: number
}

export type AppDaemonDiscoverMerchantStat = {
	cardAddress: string
	likeCount: number | null
	refClickChain: number | null
	refClickDb: number | null
}

export type AppDaemonCouponSocialStat = {
	cardAddress: string
	tokenId: string
	likeCount: number | null
	shareClickCount: number | null
	maxSupply: string | null
	remainingSupply: string | null
}

export type AppDaemonCouponOpenClaimStat = {
	cardAddress: string
	tokenId: string
	couponId?: string
	status: 'claimed' | 'redeemed'
}

/**
 * Kinds still executed on main (not yet Worker-portable, or need LS/events).
 * Pure-read kinds that Worker now owns are omitted (incl. unifiedIncome).
 */
export type AppDaemonMainTickKind =
	| 'myBrands'
	| 'recentActivity'
	| 'genesisIncome'
	| 'aaV2Pending'
	| 'aaInstitutionalAssets'

export type AppDaemonWorkerInitPayload = {
	session: AppDaemonSession | null
}

export type AppDaemonWorkerInbound =
	| { type: 'init'; reqId: number; payload: AppDaemonWorkerInitPayload }
	| { type: 'setSession'; reqId: number; session: AppDaemonSession | null }
	| { type: 'registerDiscoverCards'; reqId: number; cardAddresses: string[] }
	| { type: 'registerCouponTargets'; reqId: number; targets: { cardAddress: string; tokenId: string; couponId?: string }[] }
	| { type: 'registerGenesisAccounts'; reqId: number; accounts: string[] }
	| { type: 'mainTickDone'; reqId: number; tickId: number; kinds: AppDaemonMainTickKind[]; ok: boolean }
	| { type: 'refreshNow'; reqId: number; scope?: 'wallet' | 'all' }
	| { type: 'destroy'; reqId: number }

export type AppDaemonWorkerOutbound =
	| { type: 'ready'; reqId: number }
	| { type: 'ack'; reqId: number; ok: true; result?: unknown }
	| { type: 'ack'; reqId: number; ok: false; error: string }
	| {
			type: 'event:walletBalances'
			eoa: string
			eoaBalances: AppDaemonConetBalances
			aaBalances?: AppDaemonConetBalances | null
	  }
	| {
			type: 'event:miningStats'
			/** null = this half untrusted this tick — main must retain last trusted */
			network: AppDaemonMiningNetworkStats | null
			depin: AppDaemonMiningDepinStats | null
	  }
	| {
			type: 'event:oracleRates'
			currencyData: AppDaemonCurrencyData
	  }
	| {
			type: 'event:l0StartKit'
			eoa: string
			/** null when trusted non-L0 */
			quota: AppDaemonL0StartKitQuota | null
			isL0: boolean
	  }
	| {
			type: 'event:validatorProfile'
			eoa: string
			profile: unknown
	  }
	| {
			type: 'event:referrerSummary'
			eoa: string
			summary: unknown
	  }
	| {
			type: 'event:discoverMerchantStats'
			stats: AppDaemonDiscoverMerchantStat[]
	  }
	| {
			type: 'event:couponSocial'
			stats: AppDaemonCouponSocialStat[]
	  }
	| {
			type: 'event:couponOpenClaim'
			eoa: string
			results: AppDaemonCouponOpenClaimStat[]
	  }
	| {
			type: 'event:unifiedIncome'
			eoa: string
			/** Trusted UnifiedIncomeStats snapshot */
			stats: unknown
	  }
	| {
			type: 'event:needMainTick'
			tickId: number
			kinds: AppDaemonMainTickKind[]
			session: AppDaemonSession
	  }
	| { type: 'event:walletTickDone'; eoa: string }
	| { type: 'event:log'; level: 'info' | 'warn' | 'error'; message: string }
