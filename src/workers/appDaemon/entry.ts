/**
 * App Daemon Worker entry — cadence-layered pure-read schedules.
 *
 * 6s  wallet: CoNET snapshot (or balances+bundle) + Base USDC EOA/AA
 * 30s side:   Discover/Coupon + mining + L0/referrer (if no dashboard) + main kinds
 * 90s unified: resolveUnifiedIncomeStats only (no OOG assemble)
 * 15s aa pending / 5min oracle
 */

import type {
	AppDaemonMainTickKind,
	AppDaemonSession,
	AppDaemonWorkerInbound,
	AppDaemonWorkerOutbound,
} from './protocol'
import {
	APP_DAEMON_ORACLE_FEED_MS,
	APP_DAEMON_SIDE_FEED_MS,
	APP_DAEMON_AA_PENDING_FEED_MS,
	APP_DAEMON_WALLET_FEED_MS,
	APP_DAEMON_UNIFIED_FEED_MS,
} from './protocol'
import { fetchWorkerConetBalancesPair } from './feeders/conetBalances'
import {
	fetchWorkerMiningDepinStats,
	fetchWorkerMiningNetworkStats,
} from './feeders/miningStats'
import { fetchWorkerOracleRates } from './feeders/oracleRates'
import { fetchWorkerL0StartKitQuota } from './feeders/l0StartKitQuota'
import { fetchWorkerValidatorWalletNodeProfile } from './feeders/validatorProfile'
import { fetchWorkerReferrerSummary } from './feeders/referrerSummary'
import { fetchWorkerDiscoverMerchantStats } from './feeders/discoverMerchantStats'
import { fetchWorkerCouponSocialStats } from './feeders/couponSocial'
import { fetchWorkerCouponOpenClaimStatuses } from './feeders/couponOpenClaim'
import { fetchWorkerUnifiedIncomeStats } from './feeders/unifiedIncome'
import {
	fetchWorkerWalletDashboardSnapshot,
	isWalletDashboardConfigured,
} from './feeders/walletDashboard'
import { fetchWorkerBaseUsdcPair } from './feeders/baseUsdc'

// eslint-disable-next-line no-restricted-globals
const ctx = self as unknown as {
	postMessage: (msg: AppDaemonWorkerOutbound) => void
	onmessage: ((ev: MessageEvent<AppDaemonWorkerInbound>) => void) | null
}

function post(msg: AppDaemonWorkerOutbound): void {
	ctx.postMessage(msg)
}

function ackOk(reqId: number, result?: unknown): void {
	post({ type: 'ack', reqId, ok: true, result })
}

function ackErr(reqId: number, error: string): void {
	post({ type: 'ack', reqId, ok: false, error })
}

let session: AppDaemonSession | null = null
let destroyed = false

let walletTimer: ReturnType<typeof setTimeout> | undefined
let walletRunning = false
let sideTimer: ReturnType<typeof setTimeout> | undefined
let sideRunning = false
let unifiedTimer: ReturnType<typeof setTimeout> | undefined
let unifiedRunning = false
let aaPendingTimer: ReturnType<typeof setTimeout> | undefined
let aaPendingRunning = false
let oracleTimer: ReturnType<typeof setTimeout> | undefined
let oracleRunning = false

/** When dashboard snapshot feeds L0/referrer on 6s, side tick skips those. */
let dashboardCoversHeavy = false

let nextMainTickId = 1
const pendingMainTicks = new Map<
	number,
	{ resolve: (ok: boolean) => void; kinds: AppDaemonMainTickKind[] }
>()

const discoverCards = new Set<string>()
const couponTargets: { cardAddress: string; tokenId: string; couponId?: string }[] = []
const genesisAccounts = new Set<string>()

function normalizeAddr(raw: string | undefined): string | null {
	const s = String(raw ?? '').trim().toLowerCase()
	if (!/^0x[0-9a-f]{40}$/.test(s)) return null
	return s
}

async function requestMainTick(kinds: AppDaemonMainTickKind[]): Promise<boolean> {
	if (!session || kinds.length === 0) return true
	const tickId = nextMainTickId++
	return await new Promise<boolean>((resolve) => {
		pendingMainTicks.set(tickId, { resolve, kinds })
		post({
			type: 'event:needMainTick',
			tickId,
			kinds,
			session: { ...session! },
		})
		setTimeout(() => {
			const p = pendingMainTicks.get(tickId)
			if (!p) return
			pendingMainTicks.delete(tickId)
			p.resolve(false)
		}, 120_000)
	})
}

function scheduleWallet(delay = APP_DAEMON_WALLET_FEED_MS): void {
	if (destroyed) return
	if (walletTimer !== undefined) clearTimeout(walletTimer)
	walletTimer = setTimeout(() => {
		void runWalletTick()
	}, delay)
}

function scheduleSide(delay = APP_DAEMON_SIDE_FEED_MS): void {
	if (destroyed) return
	if (sideTimer !== undefined) clearTimeout(sideTimer)
	sideTimer = setTimeout(() => {
		void runSideTick()
	}, delay)
}

function scheduleUnified(delay = APP_DAEMON_UNIFIED_FEED_MS): void {
	if (destroyed) return
	if (unifiedTimer !== undefined) clearTimeout(unifiedTimer)
	unifiedTimer = setTimeout(() => {
		void runUnifiedTick()
	}, delay)
}

function scheduleAaPending(delay = APP_DAEMON_AA_PENDING_FEED_MS): void {
	if (destroyed) return
	if (aaPendingTimer !== undefined) clearTimeout(aaPendingTimer)
	aaPendingTimer = setTimeout(() => {
		void runAaPendingTick()
	}, delay)
}

function scheduleOracle(delay = APP_DAEMON_ORACLE_FEED_MS): void {
	if (destroyed) return
	if (oracleTimer !== undefined) clearTimeout(oracleTimer)
	oracleTimer = setTimeout(() => {
		void runOracleTick()
	}, delay)
}

/**
 * 6s light tick: prefer 1× dashboard snapshot; else balances + resolveNodeBundle once.
 * Base USDC (EOA+AA) runs in parallel on Base Multicall3 — not CoNET eth_call budget.
 * Does NOT run unified income or Discover/Coupon.
 */
async function runWalletTick(): Promise<void> {
	if (destroyed || walletRunning) {
		scheduleWallet()
		return
	}
	if (!session?.eoa) {
		scheduleWallet()
		return
	}
	walletRunning = true
	const eoa = session.eoa
	const aa = session.aaAccount ? normalizeAddr(session.aaAccount) : null
	const baseUsdcP = fetchWorkerBaseUsdcPair(eoa, aa)
	try {
		if (isWalletDashboardConfigured()) {
			const dash = await fetchWorkerWalletDashboardSnapshot(eoa, aa)
			if (dash.ok) {
				dashboardCoversHeavy = true
				post({
					type: 'event:walletBalances',
					eoa,
					eoaBalances: dash.snap.eoaBalances,
					aaBalances: dash.snap.aaBalances,
				})
				if (dash.snap.profile) {
					post({ type: 'event:validatorProfile', eoa, profile: dash.snap.profile })
				}
				if (dash.snap.l0) {
					post({
						type: 'event:l0StartKit',
						eoa,
						isL0: dash.snap.l0.isL0,
						quota: dash.snap.l0.isL0 ? dash.snap.l0.quota : null,
					})
				}
				if (dash.snap.referrer) {
					post({ type: 'event:referrerSummary', eoa, summary: dash.snap.referrer })
				}
				/** My Brands / Recent Activity stay on 30s side tick — not every 6s. */
				post({ type: 'event:walletTickDone', eoa })
				return
			}
		}
		dashboardCoversHeavy = false

		const bal = await fetchWorkerConetBalancesPair(eoa, aa)
		if (bal.ok) {
			post({
				type: 'event:walletBalances',
				eoa,
				eoaBalances: bal.eoaBalances,
				aaBalances: bal.aaBalances,
			})
		}

		// Single resolveNodeBundle for profile — unified tick must not re-fetch on this cadence.
		const vProf = await fetchWorkerValidatorWalletNodeProfile(eoa)
		if (vProf.ok) {
			post({ type: 'event:validatorProfile', eoa, profile: vProf.profile })
		}

		post({ type: 'event:walletTickDone', eoa })
	} catch (e) {
		post({
			type: 'event:log',
			level: 'error',
			message: e instanceof Error ? e.message : 'wallet_tick_failed',
		})
	} finally {
		try {
			const base = await baseUsdcP
			if (!destroyed && base.ok) {
				post({
					type: 'event:baseUsdcBalances',
					eoa,
					eoaUsdc: base.eoaUsdc,
					...(base.aaUsdc !== undefined ? { aaUsdc: base.aaUsdc } : {}),
				})
			}
		} catch {
			/* Base USDC untrusted — keep last */
		}
		walletRunning = false
		scheduleWallet()
	}
}

/**
 * 30s side: Discover/Coupon + mining; L0/referrer only when dashboard not covering them.
 */
async function runSideTick(): Promise<void> {
	if (destroyed || sideRunning) {
		scheduleSide()
		return
	}
	sideRunning = true
	try {
		const [net, depin] = await Promise.all([
			fetchWorkerMiningNetworkStats(),
			fetchWorkerMiningDepinStats(),
		])
		if (net.ok || depin.ok) {
			post({
				type: 'event:miningStats',
				network: net.ok ? net.stats : null,
				depin: depin.ok ? depin.stats : null,
			})
		}

		if (session?.eoa && !dashboardCoversHeavy) {
			const eoa = session.eoa
			const [l0, ref] = await Promise.all([
				fetchWorkerL0StartKitQuota(eoa),
				fetchWorkerReferrerSummary(eoa),
			])
			if (l0.ok) {
				post({
					type: 'event:l0StartKit',
					eoa,
					isL0: l0.isL0,
					quota: l0.isL0 ? l0.quota : null,
				})
			}
			if (ref.ok) {
				post({ type: 'event:referrerSummary', eoa, summary: ref.summary })
			}
		}

		if (discoverCards.size > 0) {
			const stats = await fetchWorkerDiscoverMerchantStats([...discoverCards])
			if (stats.length > 0) {
				post({ type: 'event:discoverMerchantStats', stats })
			}
		}

		if (couponTargets.length > 0) {
			const social = await fetchWorkerCouponSocialStats(couponTargets)
			if (social.length > 0) {
				post({ type: 'event:couponSocial', stats: social })
			}
			if (session?.eoa) {
				const claims = await fetchWorkerCouponOpenClaimStatuses(session.eoa, couponTargets)
				if (claims.length > 0) {
					post({ type: 'event:couponOpenClaim', eoa: session.eoa, results: claims })
				}
			}
		}

		const kinds: AppDaemonMainTickKind[] = []
		if (session?.eoa) {
			kinds.push('myBrands', 'recentActivity')
		}
		if (genesisAccounts.size > 0 || session?.eoa) kinds.push('genesisIncome')
		kinds.push('aaInstitutionalAssets')
		if (kinds.length && session?.eoa) {
			await requestMainTick(kinds)
		}
	} finally {
		sideRunning = false
		scheduleSide()
	}
}

/** 90s unified income — never on 6s; OOG assemble disabled in feeder. */
async function runUnifiedTick(): Promise<void> {
	if (destroyed || unifiedRunning) {
		scheduleUnified()
		return
	}
	if (!session?.eoa) {
		scheduleUnified()
		return
	}
	unifiedRunning = true
	const eoa = session.eoa
	try {
		const unified = await fetchWorkerUnifiedIncomeStats(eoa)
		if (unified.ok) {
			post({ type: 'event:unifiedIncome', eoa, stats: unified.stats })
		}
	} catch (e) {
		post({
			type: 'event:log',
			level: 'warn',
			message: e instanceof Error ? e.message : 'unified_tick_failed',
		})
	} finally {
		unifiedRunning = false
		scheduleUnified()
	}
}

async function runAaPendingTick(): Promise<void> {
	if (destroyed || aaPendingRunning) {
		scheduleAaPending()
		return
	}
	aaPendingRunning = true
	try {
		if (session?.eoa) {
			await requestMainTick(['aaV2Pending'])
		}
	} finally {
		aaPendingRunning = false
		scheduleAaPending()
	}
}

async function runOracleTick(): Promise<void> {
	if (destroyed || oracleRunning) {
		scheduleOracle()
		return
	}
	oracleRunning = true
	try {
		const res = await fetchWorkerOracleRates()
		if (res.ok) {
			post({ type: 'event:oracleRates', currencyData: res.currencyData })
		}
	} finally {
		oracleRunning = false
		scheduleOracle()
	}
}

function startSchedulers(): void {
	scheduleWallet(0)
	/** Side (My Brands / Recent Activity / Discover) starts immediately once, then every 30s. */
	scheduleSide(0)
	scheduleUnified(APP_DAEMON_UNIFIED_FEED_MS)
	scheduleAaPending(APP_DAEMON_AA_PENDING_FEED_MS)
	scheduleOracle(0)
}

function stopSchedulers(): void {
	if (walletTimer !== undefined) clearTimeout(walletTimer)
	if (sideTimer !== undefined) clearTimeout(sideTimer)
	if (unifiedTimer !== undefined) clearTimeout(unifiedTimer)
	if (aaPendingTimer !== undefined) clearTimeout(aaPendingTimer)
	if (oracleTimer !== undefined) clearTimeout(oracleTimer)
	walletTimer = sideTimer = unifiedTimer = aaPendingTimer = oracleTimer = undefined
}

ctx.onmessage = (ev: MessageEvent<AppDaemonWorkerInbound>) => {
	const msg = ev.data
	if (!msg || typeof msg !== 'object') return
	void (async () => {
		try {
			switch (msg.type) {
				case 'init': {
					destroyed = false
					session = msg.payload.session
						? {
								eoa: normalizeAddr(msg.payload.session.eoa) ?? '',
								aaAccount: msg.payload.session.aaAccount
									? normalizeAddr(msg.payload.session.aaAccount) ?? undefined
									: undefined,
							}
						: null
					if (session && !session.eoa) session = null
					startSchedulers()
					post({ type: 'ready', reqId: msg.reqId })
					ackOk(msg.reqId)
					break
				}
				case 'setSession': {
					const next = msg.session
						? {
								eoa: normalizeAddr(msg.session.eoa) ?? '',
								aaAccount: msg.session.aaAccount
									? normalizeAddr(msg.session.aaAccount) ?? undefined
									: undefined,
							}
						: null
					session = next && next.eoa ? next : null
					dashboardCoversHeavy = false
					ackOk(msg.reqId)
					if (session) {
						scheduleWallet(0)
						scheduleUnified(0)
					}
					break
				}
				case 'registerDiscoverCards': {
					for (const a of msg.cardAddresses) {
						const k = normalizeAddr(a)
						if (k) discoverCards.add(k)
					}
					ackOk(msg.reqId)
					if (discoverCards.size > 0) scheduleSide(0)
					break
				}
				case 'registerCouponTargets': {
					for (const t of msg.targets) {
						const card = normalizeAddr(t.cardAddress)
						if (!card) continue
						const tokenId = String(t.tokenId ?? '').trim()
						if (!tokenId) continue
						const exists = couponTargets.some(
							(x) => x.cardAddress === card && x.tokenId === tokenId,
						)
						if (!exists) {
							couponTargets.push({
								cardAddress: card,
								tokenId,
								couponId: t.couponId,
							})
						}
					}
					ackOk(msg.reqId)
					if (couponTargets.length > 0) scheduleSide(0)
					break
				}
				case 'registerGenesisAccounts': {
					for (const a of msg.accounts) {
						const k = normalizeAddr(a)
						if (k) genesisAccounts.add(k)
					}
					ackOk(msg.reqId)
					if (genesisAccounts.size > 0) scheduleSide(0)
					break
				}
				case 'mainTickDone': {
					const p = pendingMainTicks.get(msg.tickId)
					if (p) {
						pendingMainTicks.delete(msg.tickId)
						p.resolve(msg.ok)
					}
					ackOk(msg.reqId)
					break
				}
				case 'refreshNow': {
					ackOk(msg.reqId)
					if (msg.scope === 'all') {
						scheduleWallet(0)
						scheduleSide(0)
						scheduleUnified(0)
						scheduleAaPending(0)
						scheduleOracle(0)
					} else {
						/** wallet refresh also kicks side so My Brands / Recent Activity update. */
						scheduleWallet(0)
						scheduleSide(0)
						scheduleUnified(0)
					}
					break
				}
				case 'destroy': {
					destroyed = true
					stopSchedulers()
					for (const [, p] of pendingMainTicks) p.resolve(false)
					pendingMainTicks.clear()
					ackOk(msg.reqId)
					break
				}
				default:
					ackErr((msg as { reqId: number }).reqId, 'unknown_type')
			}
		} catch (e) {
			ackErr(msg.reqId, e instanceof Error ? e.message : 'handler_error')
		}
	})()
}

post({ type: 'ready', reqId: 0 })
