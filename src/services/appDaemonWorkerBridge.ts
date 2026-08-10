/**
 * App Daemon Worker bridge — global pure-read feeder schedule (not Tag/Merchant).
 */

import { AppDaemonWorkerClient } from '@/workers/appDaemon/client'
import type {
	AppDaemonConetBalances,
	AppDaemonCouponOpenClaimStat,
	AppDaemonCouponSocialStat,
	AppDaemonCurrencyData,
	AppDaemonDiscoverMerchantStat,
	AppDaemonL0StartKitQuota,
	AppDaemonMainTickKind,
	AppDaemonMiningDepinStats,
	AppDaemonMiningNetworkStats,
	AppDaemonSession,
} from '@/workers/appDaemon/protocol'
import { ethers } from 'ethers'

export type AppDaemonWalletBalancesListener = (ev: {
	eoa: string
	eoaBalances: AppDaemonConetBalances
	aaBalances?: AppDaemonConetBalances | null
}) => void

export type AppDaemonMiningStatsListener = (ev: {
	network: AppDaemonMiningNetworkStats | null
	depin: AppDaemonMiningDepinStats | null
}) => void

export type AppDaemonOracleRatesListener = (ev: { currencyData: AppDaemonCurrencyData }) => void

export type AppDaemonL0StartKitListener = (ev: {
	eoa: string
	isL0: boolean
	quota: AppDaemonL0StartKitQuota | null
}) => void

export type AppDaemonValidatorProfileListener = (ev: { eoa: string; profile: unknown }) => void

export type AppDaemonReferrerSummaryListener = (ev: { eoa: string; summary: unknown }) => void

export type AppDaemonDiscoverMerchantStatsListener = (ev: {
	stats: AppDaemonDiscoverMerchantStat[]
}) => void

export type AppDaemonCouponSocialListener = (ev: { stats: AppDaemonCouponSocialStat[] }) => void

export type AppDaemonCouponOpenClaimListener = (ev: {
	eoa: string
	results: AppDaemonCouponOpenClaimStat[]
}) => void

export type AppDaemonUnifiedIncomeListener = (ev: { eoa: string; stats: unknown }) => void

export type AppDaemonNeedMainTickListener = (ev: {
	tickId: number
	kinds: AppDaemonMainTickKind[]
	session: AppDaemonSession
}) => void | Promise<void>

let client: AppDaemonWorkerClient | null = null
let initPromise: Promise<void> | null = null
let activeSession: AppDaemonSession | null = null

const walletBalancesListeners = new Set<AppDaemonWalletBalancesListener>()
const miningStatsListeners = new Set<AppDaemonMiningStatsListener>()
const oracleRatesListeners = new Set<AppDaemonOracleRatesListener>()
const l0StartKitListeners = new Set<AppDaemonL0StartKitListener>()
const validatorProfileListeners = new Set<AppDaemonValidatorProfileListener>()
const referrerSummaryListeners = new Set<AppDaemonReferrerSummaryListener>()
const discoverMerchantStatsListeners = new Set<AppDaemonDiscoverMerchantStatsListener>()
const couponSocialListeners = new Set<AppDaemonCouponSocialListener>()
const couponOpenClaimListeners = new Set<AppDaemonCouponOpenClaimListener>()
const unifiedIncomeListeners = new Set<AppDaemonUnifiedIncomeListener>()
const needMainTickListeners = new Set<AppDaemonNeedMainTickListener>()

let mirrorEoaBalances: AppDaemonConetBalances | null = null
let mirrorAaBalances: AppDaemonConetBalances | null = null
let mirrorNetwork: AppDaemonMiningNetworkStats | null = null
let mirrorDepin: AppDaemonMiningDepinStats | null = null

function fanout<T>(set: Set<(ev: T) => void>, ev: T): void {
	for (const cb of set) {
		try {
			cb(ev)
		} catch {
			/* ignore */
		}
	}
}

function getClient(): AppDaemonWorkerClient {
	if (!client) {
		client = new AppDaemonWorkerClient({
			onWalletBalances: (ev) => {
				mirrorEoaBalances = ev.eoaBalances
				mirrorAaBalances = ev.aaBalances ?? null
				fanout(walletBalancesListeners, ev)
			},
			onMiningStats: (ev) => {
				if (ev.network) mirrorNetwork = ev.network
				if (ev.depin) mirrorDepin = ev.depin
				fanout(miningStatsListeners, ev)
			},
			onOracleRates: (ev) => fanout(oracleRatesListeners, ev),
			onL0StartKit: (ev) => fanout(l0StartKitListeners, ev),
			onValidatorProfile: (ev) => fanout(validatorProfileListeners, ev),
			onReferrerSummary: (ev) => fanout(referrerSummaryListeners, ev),
			onDiscoverMerchantStats: (ev) => fanout(discoverMerchantStatsListeners, ev),
			onCouponSocial: (ev) => fanout(couponSocialListeners, ev),
			onCouponOpenClaim: (ev) => fanout(couponOpenClaimListeners, ev),
			onUnifiedIncome: (ev) => fanout(unifiedIncomeListeners, ev),
			onNeedMainTick: (ev) => {
				void (async () => {
					let ok = true
					for (const cb of needMainTickListeners) {
						try {
							await cb(ev)
						} catch {
							ok = false
						}
					}
					try {
						await getClient().mainTickDone(ev.tickId, ev.kinds, ok)
					} catch {
						/* ignore */
					}
				})()
			},
			onLog: (level, message) => {
				if (level === 'error') console.error('[appDaemonWorker]', message)
				else if (level === 'warn') console.warn('[appDaemonWorker]', message)
			},
		})
		client.start()
	}
	return client
}

function toSession(eoa: string | undefined, aaAccount?: string | undefined): AppDaemonSession | null {
	const raw = String(eoa ?? '').trim()
	if (!raw || !ethers.isAddress(raw)) return null
	const aa = String(aaAccount ?? '').trim()
	return {
		eoa: ethers.getAddress(raw).toLowerCase(),
		aaAccount: aa && ethers.isAddress(aa) ? ethers.getAddress(aa).toLowerCase() : undefined,
	}
}

export async function initAppDaemonWorker(session: AppDaemonSession | null): Promise<void> {
	if (!initPromise) {
		initPromise = (async () => {
			const c = getClient()
			activeSession = session
			await c.init({ session })
		})().catch((e) => {
			initPromise = null
			throw e
		})
	}
	await initPromise
}

export async function setAppDaemonSession(
	eoa: string | undefined,
	aaAccount?: string | undefined,
): Promise<void> {
	const session = toSession(eoa, aaAccount)
	activeSession = session
	await initAppDaemonWorker(session)
	await getClient().setSession(session)
}

export function onAppDaemonWalletBalances(cb: AppDaemonWalletBalancesListener): () => void {
	walletBalancesListeners.add(cb)
	return () => walletBalancesListeners.delete(cb)
}

export function onAppDaemonMiningStats(cb: AppDaemonMiningStatsListener): () => void {
	miningStatsListeners.add(cb)
	return () => miningStatsListeners.delete(cb)
}

export function onAppDaemonOracleRates(cb: AppDaemonOracleRatesListener): () => void {
	oracleRatesListeners.add(cb)
	return () => oracleRatesListeners.delete(cb)
}

export function onAppDaemonL0StartKit(cb: AppDaemonL0StartKitListener): () => void {
	l0StartKitListeners.add(cb)
	return () => l0StartKitListeners.delete(cb)
}

export function onAppDaemonValidatorProfile(cb: AppDaemonValidatorProfileListener): () => void {
	validatorProfileListeners.add(cb)
	return () => validatorProfileListeners.delete(cb)
}

export function onAppDaemonReferrerSummary(cb: AppDaemonReferrerSummaryListener): () => void {
	referrerSummaryListeners.add(cb)
	return () => referrerSummaryListeners.delete(cb)
}

export function onAppDaemonDiscoverMerchantStats(
	cb: AppDaemonDiscoverMerchantStatsListener,
): () => void {
	discoverMerchantStatsListeners.add(cb)
	return () => discoverMerchantStatsListeners.delete(cb)
}

export function onAppDaemonCouponSocial(cb: AppDaemonCouponSocialListener): () => void {
	couponSocialListeners.add(cb)
	return () => couponSocialListeners.delete(cb)
}

export function onAppDaemonCouponOpenClaim(cb: AppDaemonCouponOpenClaimListener): () => void {
	couponOpenClaimListeners.add(cb)
	return () => couponOpenClaimListeners.delete(cb)
}

export function onAppDaemonUnifiedIncome(cb: AppDaemonUnifiedIncomeListener): () => void {
	unifiedIncomeListeners.add(cb)
	return () => unifiedIncomeListeners.delete(cb)
}

export function onAppDaemonNeedMainTick(cb: AppDaemonNeedMainTickListener): () => void {
	needMainTickListeners.add(cb)
	return () => needMainTickListeners.delete(cb)
}

export function getAppDaemonMirrorConetBalances(): {
	eoa: AppDaemonConetBalances | null
	aa: AppDaemonConetBalances | null
} {
	return { eoa: mirrorEoaBalances, aa: mirrorAaBalances }
}

export function getAppDaemonMirrorMiningStats(): {
	network: AppDaemonMiningNetworkStats | null
	depin: AppDaemonMiningDepinStats | null
} {
	return { network: mirrorNetwork, depin: mirrorDepin }
}

export async function registerAppDaemonDiscoverCards(cardAddresses: string[]): Promise<void> {
	await initAppDaemonWorker(activeSession)
	await getClient().registerDiscoverCards(cardAddresses)
}

export async function registerAppDaemonCouponTargets(
	targets: { cardAddress: string; tokenId: string; couponId?: string }[],
): Promise<void> {
	await initAppDaemonWorker(activeSession)
	await getClient().registerCouponTargets(targets)
}

export async function registerAppDaemonGenesisAccounts(accounts: string[]): Promise<void> {
	await initAppDaemonWorker(activeSession)
	await getClient().registerGenesisAccounts(accounts)
}

export async function refreshAppDaemonNow(scope: 'wallet' | 'all' = 'wallet'): Promise<void> {
	await initAppDaemonWorker(activeSession)
	await getClient().refreshNow(scope)
}

export function getAppDaemonActiveSession(): AppDaemonSession | null {
	return activeSession
}
