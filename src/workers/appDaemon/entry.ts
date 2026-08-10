/**
 * App Daemon Worker entry — owns pure-read feeder schedules.
 * Worker-portable ticks run here; remaining kinds request main via needMainTick.
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
} from './protocol'
import { fetchWorkerConetBalances } from './feeders/conetBalances'
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
let aaPendingTimer: ReturnType<typeof setTimeout> | undefined
let aaPendingRunning = false
let oracleTimer: ReturnType<typeof setTimeout> | undefined
let oracleRunning = false

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
	try {
		const eoaBal = await fetchWorkerConetBalances(eoa)
		if (eoaBal.ok) {
			let aaBalances = null as typeof eoaBal.balances | null
			const aa = session.aaAccount ? normalizeAddr(session.aaAccount) : null
			if (aa) {
				const aaBal = await fetchWorkerConetBalances(aa)
				if (aaBal.ok) aaBalances = aaBal.balances
			}
			post({
				type: 'event:walletBalances',
				eoa,
				eoaBalances: eoaBal.balances,
				aaBalances,
			})
		}

		const [net, depin] = await Promise.all([
			fetchWorkerMiningNetworkStats(),
			fetchWorkerMiningDepinStats(),
		])
		// Only emit trusted dimensions — never invent 0 for a failed half.
		if (net.ok || depin.ok) {
			post({
				type: 'event:miningStats',
				network: net.ok ? net.stats : null,
				depin: depin.ok ? depin.stats : null,
			})
		}

		const l0 = await fetchWorkerL0StartKitQuota(eoa)
		if (l0.ok) {
			post({
				type: 'event:l0StartKit',
				eoa,
				isL0: l0.isL0,
				quota: l0.isL0 ? l0.quota : null,
			})
		}

		const [vProf, ref, unified] = await Promise.all([
			fetchWorkerValidatorWalletNodeProfile(eoa),
			fetchWorkerReferrerSummary(eoa),
			fetchWorkerUnifiedIncomeStats(eoa),
		])
		if (vProf.ok) {
			post({ type: 'event:validatorProfile', eoa, profile: vProf.profile })
		}
		if (ref.ok) {
			post({ type: 'event:referrerSummary', eoa, summary: ref.summary })
		}
		if (unified.ok) {
			post({ type: 'event:unifiedIncome', eoa, stats: unified.stats })
		}

		await requestMainTick(['myBrands', 'recentActivity'])

		post({ type: 'event:walletTickDone', eoa })
	} catch (e) {
		post({
			type: 'event:log',
			level: 'error',
			message: e instanceof Error ? e.message : 'wallet_tick_failed',
		})
	} finally {
		walletRunning = false
		scheduleWallet()
	}
}

async function runSideTick(): Promise<void> {
	if (destroyed || sideRunning) {
		scheduleSide()
		return
	}
	sideRunning = true
	try {
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
	scheduleSide(APP_DAEMON_SIDE_FEED_MS)
	scheduleAaPending(APP_DAEMON_AA_PENDING_FEED_MS)
	scheduleOracle(0)
}

function stopSchedulers(): void {
	if (walletTimer !== undefined) clearTimeout(walletTimer)
	if (sideTimer !== undefined) clearTimeout(sideTimer)
	if (aaPendingTimer !== undefined) clearTimeout(aaPendingTimer)
	if (oracleTimer !== undefined) clearTimeout(oracleTimer)
	walletTimer = sideTimer = aaPendingTimer = oracleTimer = undefined
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
					ackOk(msg.reqId)
					if (session) scheduleWallet(0)
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
						scheduleAaPending(0)
						scheduleOracle(0)
					} else {
						scheduleWallet(0)
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
