/**
 * Main-thread thin client for App Daemon Worker.
 */

import type {
	AppDaemonWorkerInbound,
	AppDaemonWorkerInitPayload,
	AppDaemonWorkerOutbound,
	AppDaemonMainTickKind,
	AppDaemonSession,
	AppDaemonConetBalances,
	AppDaemonMiningNetworkStats,
	AppDaemonMiningDepinStats,
	AppDaemonCurrencyData,
	AppDaemonL0StartKitQuota,
	AppDaemonDiscoverMerchantStat,
	AppDaemonCouponSocialStat,
	AppDaemonCouponOpenClaimStat,
} from './protocol'

type Pending = {
	resolve: (v: unknown) => void
	reject: (e: Error) => void
}

export type AppDaemonWorkerClientHandlers = {
	onReady?: () => void
	onWalletBalances?: (ev: {
		eoa: string
		eoaBalances: AppDaemonConetBalances
		aaBalances?: AppDaemonConetBalances | null
	}) => void
	onMiningStats?: (ev: {
		network: AppDaemonMiningNetworkStats | null
		depin: AppDaemonMiningDepinStats | null
	}) => void
	onOracleRates?: (ev: { currencyData: AppDaemonCurrencyData }) => void
	onL0StartKit?: (ev: {
		eoa: string
		isL0: boolean
		quota: AppDaemonL0StartKitQuota | null
	}) => void
	onValidatorProfile?: (ev: { eoa: string; profile: unknown }) => void
	onReferrerSummary?: (ev: { eoa: string; summary: unknown }) => void
	onDiscoverMerchantStats?: (ev: { stats: AppDaemonDiscoverMerchantStat[] }) => void
	onCouponSocial?: (ev: { stats: AppDaemonCouponSocialStat[] }) => void
	onCouponOpenClaim?: (ev: { eoa: string; results: AppDaemonCouponOpenClaimStat[] }) => void
	onUnifiedIncome?: (ev: { eoa: string; stats: unknown }) => void
	onNeedMainTick?: (ev: {
		tickId: number
		kinds: AppDaemonMainTickKind[]
		session: AppDaemonSession
	}) => void
	onWalletTickDone?: (ev: { eoa: string }) => void
	onLog?: (level: 'info' | 'warn' | 'error', message: string) => void
}

export class AppDaemonWorkerClient {
	private worker: Worker | null = null
	private nextReqId = 1
	private pending = new Map<number, Pending>()
	private handlers: AppDaemonWorkerClientHandlers = {}
	private ready = false

	constructor(handlers?: AppDaemonWorkerClientHandlers) {
		if (handlers) this.handlers = handlers
	}

	setHandlers(handlers: AppDaemonWorkerClientHandlers): void {
		this.handlers = { ...this.handlers, ...handlers }
	}

	get isReady(): boolean {
		return this.ready
	}

	start(): void {
		if (this.worker) return
		this.worker = new Worker(new URL('./entry.ts', import.meta.url), {
			type: 'module',
		})
		this.worker.onmessage = (ev: MessageEvent<AppDaemonWorkerOutbound>) => {
			this.handleOutbound(ev.data)
		}
		this.worker.onerror = (err) => {
			this.handlers.onLog?.('error', err.message || 'AppDaemon worker error')
		}
	}

	stop(): void {
		if (!this.worker) return
		void this.request({ type: 'destroy', reqId: 0 }).catch(() => undefined)
		this.worker.terminate()
		this.worker = null
		this.ready = false
		for (const [, p] of this.pending) p.reject(new Error('worker_stopped'))
		this.pending.clear()
	}

	private handleOutbound(msg: AppDaemonWorkerOutbound): void {
		if (!msg || typeof msg !== 'object') return
		switch (msg.type) {
			case 'ready':
				this.ready = true
				this.handlers.onReady?.()
				break
			case 'ack': {
				const p = this.pending.get(msg.reqId)
				if (!p) break
				this.pending.delete(msg.reqId)
				if (msg.ok) p.resolve(msg.result)
				else p.reject(new Error(msg.error || 'ack_error'))
				break
			}
			case 'event:walletBalances':
				this.handlers.onWalletBalances?.(msg)
				break
			case 'event:miningStats':
				this.handlers.onMiningStats?.(msg)
				break
			case 'event:oracleRates':
				this.handlers.onOracleRates?.(msg)
				break
			case 'event:l0StartKit':
				this.handlers.onL0StartKit?.(msg)
				break
			case 'event:validatorProfile':
				this.handlers.onValidatorProfile?.(msg)
				break
			case 'event:referrerSummary':
				this.handlers.onReferrerSummary?.(msg)
				break
			case 'event:discoverMerchantStats':
				this.handlers.onDiscoverMerchantStats?.(msg)
				break
			case 'event:couponSocial':
				this.handlers.onCouponSocial?.(msg)
				break
			case 'event:couponOpenClaim':
				this.handlers.onCouponOpenClaim?.(msg)
				break
			case 'event:unifiedIncome':
				this.handlers.onUnifiedIncome?.(msg)
				break
			case 'event:needMainTick':
				this.handlers.onNeedMainTick?.(msg)
				break
			case 'event:walletTickDone':
				this.handlers.onWalletTickDone?.(msg)
				break
			case 'event:log':
				this.handlers.onLog?.(msg.level, msg.message)
				break
			default:
				break
		}
	}

	private request(msg: AppDaemonWorkerInbound): Promise<unknown> {
		this.start()
		if (!this.worker) return Promise.reject(new Error('worker_unavailable'))
		const reqId = msg.reqId > 0 ? msg.reqId : this.nextReqId++
		const payload = { ...msg, reqId } as AppDaemonWorkerInbound
		return new Promise((resolve, reject) => {
			this.pending.set(reqId, { resolve, reject })
			this.worker!.postMessage(payload)
		})
	}

	async init(payload: AppDaemonWorkerInitPayload): Promise<void> {
		await this.request({ type: 'init', reqId: 0, payload })
	}

	async setSession(session: AppDaemonSession | null): Promise<void> {
		await this.request({ type: 'setSession', reqId: 0, session })
	}

	async registerDiscoverCards(cardAddresses: string[]): Promise<void> {
		await this.request({ type: 'registerDiscoverCards', reqId: 0, cardAddresses })
	}

	async registerCouponTargets(
		targets: { cardAddress: string; tokenId: string; couponId?: string }[],
	): Promise<void> {
		await this.request({ type: 'registerCouponTargets', reqId: 0, targets })
	}

	async registerGenesisAccounts(accounts: string[]): Promise<void> {
		await this.request({ type: 'registerGenesisAccounts', reqId: 0, accounts })
	}

	async mainTickDone(tickId: number, kinds: AppDaemonMainTickKind[], ok: boolean): Promise<void> {
		await this.request({ type: 'mainTickDone', reqId: 0, tickId, kinds, ok })
	}

	async refreshNow(scope: 'wallet' | 'all' = 'wallet'): Promise<void> {
		await this.request({ type: 'refreshNow', reqId: 0, scope })
	}
}
