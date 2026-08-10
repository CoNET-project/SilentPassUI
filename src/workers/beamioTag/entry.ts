/**
 * BeamioTag Worker entry — IndexedDB serverDB + Tag 60s + Merchant 5min ticks.
 */

import type { BeamioTagWorkerInbound, BeamioTagWorkerOutbound } from './protocol'
import {
	BEAMIO_TAG_BACKGROUND_TICK_MS,
	BEAMIO_TAG_FETCH_MAX_PER_TICK,
	MERCHANT_CARD_BACKGROUND_TICK_MS,
} from './protocol'
import { TagServerDb } from './tagServerDb'
import { searchLocalByTagPrefix } from './tagServerDb'
import { MerchantCardServerDb } from './merchantCardServerDb'

// eslint-disable-next-line no-restricted-globals
const ctx = self as unknown as {
	postMessage: (msg: BeamioTagWorkerOutbound) => void
	onmessage: ((ev: MessageEvent<BeamioTagWorkerInbound>) => void) | null
}

function post(msg: BeamioTagWorkerOutbound): void {
	ctx.postMessage(msg)
}

function ackOk(reqId: number, result?: unknown): void {
	post({ type: 'ack', reqId, ok: true, result })
}

function ackErr(reqId: number, error: string): void {
	post({ type: 'ack', reqId, ok: false, error })
}

const db = new TagServerDb((patch, snapshot) => {
	post({
		type: 'event:profilesUpdated',
		partition: db.partition,
		patch,
		snapshot,
	})
})

const merchantDb = new MerchantCardServerDb((patch, snapshot) => {
	post({
		type: 'event:merchantCardsUpdated',
		patch,
		snapshot,
	})
})

let tickTimer: ReturnType<typeof setTimeout> | undefined
let tickRunning = false
let merchantTickTimer: ReturnType<typeof setTimeout> | undefined
let merchantTickRunning = false
let destroyed = false
let merchantInitPromise: Promise<void> | null = null

function scheduleTick(delay = BEAMIO_TAG_BACKGROUND_TICK_MS): void {
	if (destroyed) return
	if (tickTimer !== undefined) clearTimeout(tickTimer)
	tickTimer = setTimeout(() => {
		void runTick()
	}, delay)
}

function scheduleMerchantTick(delay = MERCHANT_CARD_BACKGROUND_TICK_MS): void {
	if (destroyed) return
	if (merchantTickTimer !== undefined) clearTimeout(merchantTickTimer)
	merchantTickTimer = setTimeout(() => {
		void runMerchantTick()
	}, delay)
}

async function ensureMerchantReady(
	legacyMap?: Parameters<MerchantCardServerDb['init']>[0],
): Promise<void> {
	if (merchantDb.isReady) return
	if (!merchantInitPromise) {
		merchantInitPromise = merchantDb.init(legacyMap).finally(() => {
			merchantInitPromise = null
		})
	}
	await merchantInitPromise
}

async function runTick(): Promise<void> {
	if (destroyed || tickRunning) {
		scheduleTick()
		return
	}
	if (!db.partition || db.warmTargets.length === 0) {
		scheduleTick()
		return
	}
	tickRunning = true
	try {
		const r = await db.tickWarm()
		post({ type: 'event:tickDone', fetched: r.fetched, remainingNeed: r.remainingNeed })
	} catch (e) {
		post({
			type: 'event:log',
			level: 'warn',
			message: e instanceof Error ? e.message : String(e),
		})
	} finally {
		tickRunning = false
		scheduleTick()
	}
}

async function runMerchantTick(): Promise<void> {
	if (destroyed || merchantTickRunning) {
		scheduleMerchantTick()
		return
	}
	if (!merchantDb.isReady || merchantDb.warmTargets.length === 0) {
		scheduleMerchantTick()
		return
	}
	merchantTickRunning = true
	try {
		const r = await merchantDb.tickWarm()
		post({
			type: 'event:merchantTickDone',
			fetched: r.fetched,
			remainingNeed: r.remainingNeed,
		})
	} catch (e) {
		post({
			type: 'event:log',
			level: 'warn',
			message: e instanceof Error ? e.message : String(e),
		})
	} finally {
		merchantTickRunning = false
		scheduleMerchantTick()
	}
}

ctx.onmessage = (ev: MessageEvent<BeamioTagWorkerInbound>) => {
	const msg = ev.data
	if (!msg || typeof msg !== 'object' || !('type' in msg)) return

	void (async () => {
		try {
			switch (msg.type) {
				case 'init': {
					destroyed = false
					if (msg.payload.searchUsersUrl) db.searchUsersUrl = msg.payload.searchUsersUrl
					await db.loadPartition(msg.payload.partition, msg.payload.legacyMap)
					await ensureMerchantReady(msg.payload.merchantLegacyMap)
					post({ type: 'ready', reqId: 0 })
					ackOk(msg.reqId, {
						partition: db.partition,
						size: Object.keys(db.map).length,
						merchantSize: Object.keys(merchantDb.map).length,
					})
					scheduleTick(2_000)
					scheduleMerchantTick(5_000)
					break
				}
				case 'setPartition': {
					await db.loadPartition(msg.partition, msg.legacyMap)
					ackOk(msg.reqId, { partition: db.partition, size: Object.keys(db.map).length })
					post({
						type: 'event:profilesUpdated',
						partition: db.partition,
						patch: {},
						snapshot: { ...db.map },
					})
					scheduleTick(2_000)
					break
				}
				case 'lookup': {
					ackOk(msg.reqId, db.lookup(msg.address) ?? null)
					break
				}
				case 'lookupMany': {
					ackOk(msg.reqId, db.lookupMany(msg.addresses))
					break
				}
				case 'searchLocal': {
					ackOk(msg.reqId, searchLocalByTagPrefix(db.map, msg.query, msg.limit ?? 20))
					break
				}
				case 'searchRemote': {
					const r = await db.searchRemote(msg.query)
					ackOk(msg.reqId, r)
					break
				}
				case 'ensure':
				case 'warm': {
					const r = await db.ensureAddresses(msg.addresses, msg.maxPerTick ?? BEAMIO_TAG_FETCH_MAX_PER_TICK)
					ackOk(msg.reqId, r)
					break
				}
				case 'ingest': {
					const patch = db.ingest(msg.res, msg.contextAddress)
					ackOk(msg.reqId, patch)
					break
				}
				case 'mergeTrusted': {
					const patch = db.applyTrusted(msg.incoming)
					ackOk(msg.reqId, patch)
					break
				}
				case 'setWarmTargets': {
					db.setWarmTargets(msg.addresses)
					ackOk(msg.reqId, { count: db.warmTargets.length })
					scheduleTick(500)
					break
				}
				case 'getSnapshot': {
					ackOk(msg.reqId, { ...db.map })
					break
				}
				case 'merchantInit': {
					await ensureMerchantReady(msg.legacyMap)
					post({
						type: 'event:merchantCardsUpdated',
						patch: {},
						snapshot: { ...merchantDb.map },
					})
					ackOk(msg.reqId, { size: Object.keys(merchantDb.map).length })
					scheduleMerchantTick(2_000)
					break
				}
				case 'merchantLookup': {
					await ensureMerchantReady()
					ackOk(msg.reqId, merchantDb.lookup(msg.cardAddress) ?? null)
					break
				}
				case 'merchantLookupMany': {
					await ensureMerchantReady()
					ackOk(msg.reqId, merchantDb.lookupMany(msg.cardAddresses))
					break
				}
				case 'merchantEnsure': {
					await ensureMerchantReady()
					const r = await merchantDb.ensureCards(msg.cardAddresses, {
						maxPerTick: msg.maxPerTick,
						forceRefresh: msg.forceRefresh,
					})
					ackOk(msg.reqId, r)
					break
				}
				case 'merchantMergeTrusted': {
					await ensureMerchantReady()
					const patch = merchantDb.applyTrusted(msg.incoming)
					ackOk(msg.reqId, patch)
					break
				}
				case 'merchantSetWarmTargets': {
					await ensureMerchantReady()
					merchantDb.setWarmTargets(msg.cardAddresses)
					ackOk(msg.reqId, { count: merchantDb.warmTargets.length })
					scheduleMerchantTick(500)
					break
				}
				case 'merchantGetSnapshot': {
					await ensureMerchantReady()
					ackOk(msg.reqId, { ...merchantDb.map })
					break
				}
				case 'destroy': {
					destroyed = true
					if (tickTimer !== undefined) clearTimeout(tickTimer)
					tickTimer = undefined
					if (merchantTickTimer !== undefined) clearTimeout(merchantTickTimer)
					merchantTickTimer = undefined
					ackOk(msg.reqId)
					break
				}
				default:
					ackErr((msg as { reqId: number }).reqId, 'unknown_command')
			}
		} catch (e) {
			ackErr(msg.reqId, e instanceof Error ? e.message : String(e))
		}
	})()
}
