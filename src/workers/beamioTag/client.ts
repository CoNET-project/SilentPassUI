/**
 * Main-thread thin client for BeamioTag Worker (reqId/ack + events).
 */

import type {
	BeamioAddressProfileRecord,
	BeamioTagWorkerInbound,
	BeamioTagWorkerInitPayload,
	BeamioTagWorkerOutbound,
} from './protocol'

type Pending = {
	resolve: (v: unknown) => void
	reject: (e: Error) => void
}

export type BeamioTagWorkerClientHandlers = {
	onProfilesUpdated?: (ev: {
		partition: string
		patch: Record<string, BeamioAddressProfileRecord>
		snapshot: Record<string, BeamioAddressProfileRecord>
	}) => void
	onTickDone?: (ev: { fetched: number; remainingNeed: number }) => void
	onLog?: (level: 'info' | 'warn' | 'error', message: string) => void
	onReady?: () => void
}

export class BeamioTagWorkerClient {
	private worker: Worker | null = null
	private nextReqId = 1
	private pending = new Map<number, Pending>()
	private handlers: BeamioTagWorkerClientHandlers = {}
	private ready = false

	constructor(handlers?: BeamioTagWorkerClientHandlers) {
		if (handlers) this.handlers = handlers
	}

	setHandlers(handlers: BeamioTagWorkerClientHandlers): void {
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
		this.worker.onmessage = (ev: MessageEvent<BeamioTagWorkerOutbound>) => {
			this.handleOutbound(ev.data)
		}
		this.worker.onerror = (err) => {
			this.handlers.onLog?.('error', err.message || 'BeamioTag worker error')
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

	private handleOutbound(msg: BeamioTagWorkerOutbound): void {
		if (!msg || typeof msg !== 'object') return
		switch (msg.type) {
			case 'ready': {
				this.ready = true
				this.handlers.onReady?.()
				break
			}
			case 'ack': {
				const p = this.pending.get(msg.reqId)
				if (!p) break
				this.pending.delete(msg.reqId)
				if (msg.ok) p.resolve(msg.result)
				else p.reject(new Error(msg.error || 'ack_error'))
				break
			}
			case 'event:profilesUpdated':
				this.handlers.onProfilesUpdated?.({
					partition: msg.partition,
					patch: msg.patch,
					snapshot: msg.snapshot,
				})
				break
			case 'event:tickDone':
				this.handlers.onTickDone?.({ fetched: msg.fetched, remainingNeed: msg.remainingNeed })
				break
			case 'event:log':
				this.handlers.onLog?.(msg.level, msg.message)
				break
			default:
				break
		}
	}

	private post(msg: BeamioTagWorkerInbound): void {
		if (!this.worker) this.start()
		this.worker!.postMessage(msg)
	}

	/** Distributive Omit so union members keep their payload fields (CRA tsc). */
	request(
		msg: (BeamioTagWorkerInbound extends infer U
			? U extends BeamioTagWorkerInbound
				? Omit<U, 'reqId'> & { reqId?: number }
				: never
			: never),
	): Promise<unknown> {
		const reqId = msg.reqId && msg.reqId > 0 ? msg.reqId : this.nextReqId++
		return new Promise((resolve, reject) => {
			this.pending.set(reqId, { resolve, reject })
			this.post({ ...(msg as object), reqId } as BeamioTagWorkerInbound)
		})
	}

	async init(payload: BeamioTagWorkerInitPayload): Promise<unknown> {
		this.start()
		return this.request({ type: 'init', payload })
	}

	async setPartition(partition: string, legacyMap?: Record<string, BeamioAddressProfileRecord>): Promise<unknown> {
		return this.request({ type: 'setPartition', partition, legacyMap })
	}

	async lookup(address: string): Promise<BeamioAddressProfileRecord | null> {
		return (await this.request({ type: 'lookup', address })) as BeamioAddressProfileRecord | null
	}

	async lookupMany(addresses: string[]): Promise<Record<string, BeamioAddressProfileRecord>> {
		return (await this.request({ type: 'lookupMany', addresses })) as Record<string, BeamioAddressProfileRecord>
	}

	async searchLocal(query: string, limit?: number): Promise<BeamioAddressProfileRecord[]> {
		return (await this.request({ type: 'searchLocal', query, limit })) as BeamioAddressProfileRecord[]
	}

	async searchRemote(query: string): Promise<{
		results: Array<Record<string, unknown>>
		ingested: Record<string, BeamioAddressProfileRecord>
	}> {
		return (await this.request({ type: 'searchRemote', query })) as {
			results: Array<Record<string, unknown>>
			ingested: Record<string, BeamioAddressProfileRecord>
		}
	}

	async ensure(addresses: string[], maxPerTick?: number): Promise<unknown> {
		return this.request({ type: 'ensure', addresses, maxPerTick })
	}

	async setWarmTargets(addresses: string[]): Promise<unknown> {
		return this.request({ type: 'setWarmTargets', addresses })
	}

	async ingest(res: unknown, contextAddress?: string): Promise<Record<string, BeamioAddressProfileRecord>> {
		return (await this.request({ type: 'ingest', res, contextAddress })) as Record<
			string,
			BeamioAddressProfileRecord
		>
	}

	async mergeTrusted(
		incoming: Record<string, BeamioAddressProfileRecord | null | undefined>,
	): Promise<Record<string, BeamioAddressProfileRecord>> {
		return (await this.request({ type: 'mergeTrusted', incoming })) as Record<string, BeamioAddressProfileRecord>
	}

	async getSnapshot(): Promise<Record<string, BeamioAddressProfileRecord>> {
		return (await this.request({ type: 'getSnapshot' })) as Record<string, BeamioAddressProfileRecord>
	}
}
