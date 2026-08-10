/**
 * BeamioTag Worker ↔ host protocol (reqId/ack + events).
 * Worker is the global serverDB for @beamioTag profiles + merchant program cards.
 */

import type { BeamioAddressProfileRecord } from '../../utils/beamioAddressProfileRegistry'
import type { MerchantCardRecord } from '../../utils/merchantCardRegistry'

export type { BeamioAddressProfileRecord, MerchantCardRecord }

export const BEAMIO_TAG_PROFILE_STALE_MS = 7 * 24 * 60 * 60 * 1000
export const BEAMIO_TAG_FETCH_MAX_PER_TICK = 28
export const BEAMIO_TAG_BACKGROUND_TICK_MS = 60_000
export const BEAMIO_TAG_SEARCH_USERS_URL = 'https://beamio.app/api/search-users'

/** Merchant program cards — global store (not EOA-partitioned). Keep current product cadence. */
export const MERCHANT_CARD_STALE_MS = 5 * 60 * 1000
export const MERCHANT_CARD_FETCH_MAX_PER_TICK = 16
export const MERCHANT_CARD_BACKGROUND_TICK_MS = 5 * 60 * 1000
export const MERCHANT_CARD_API_BASE = 'https://beamio.app'
export const MERCHANT_CARD_RPC_URL = 'https://publicrpc.conet.network'

export type BeamioTagWorkerInitPayload = {
	partition: string
	/** One-time localStorage → IDB import (main thread reads LS; worker has no LS). */
	legacyMap?: Record<string, BeamioAddressProfileRecord>
	searchUsersUrl?: string
	/** Optional: also init merchant global store (legacy LS map). */
	merchantLegacyMap?: Record<string, MerchantCardRecord>
}

export type BeamioTagWorkerInbound =
	| { type: 'init'; reqId: number; payload: BeamioTagWorkerInitPayload }
	| { type: 'setPartition'; reqId: number; partition: string; legacyMap?: Record<string, BeamioAddressProfileRecord> }
	| { type: 'lookup'; reqId: number; address: string }
	| { type: 'lookupMany'; reqId: number; addresses: string[] }
	| { type: 'searchLocal'; reqId: number; query: string; limit?: number }
	| { type: 'searchRemote'; reqId: number; query: string }
	| { type: 'ensure'; reqId: number; addresses: string[]; maxPerTick?: number }
	| { type: 'warm'; reqId: number; addresses: string[]; maxPerTick?: number }
	| { type: 'ingest'; reqId: number; res: unknown; contextAddress?: string }
	| { type: 'mergeTrusted'; reqId: number; incoming: Record<string, BeamioAddressProfileRecord | null | undefined> }
	| { type: 'setWarmTargets'; reqId: number; addresses: string[] }
	| { type: 'getSnapshot'; reqId: number }
	| { type: 'destroy'; reqId: number }
	/** Merchant program card commands (parallel global store). */
	| { type: 'merchantInit'; reqId: number; legacyMap?: Record<string, MerchantCardRecord> }
	| { type: 'merchantLookup'; reqId: number; cardAddress: string }
	| { type: 'merchantLookupMany'; reqId: number; cardAddresses: string[] }
	| { type: 'merchantEnsure'; reqId: number; cardAddresses: string[]; maxPerTick?: number; forceRefresh?: boolean }
	| {
			type: 'merchantMergeTrusted'
			reqId: number
			incoming: Record<string, MerchantCardRecord | null | undefined>
	  }
	| { type: 'merchantSetWarmTargets'; reqId: number; cardAddresses: string[] }
	| { type: 'merchantGetSnapshot'; reqId: number }

export type BeamioTagWorkerOutbound =
	| { type: 'ready'; reqId: number }
	| { type: 'ack'; reqId: number; ok: true; result?: unknown }
	| { type: 'ack'; reqId: number; ok: false; error: string }
	| {
			type: 'event:profilesUpdated'
			partition: string
			patch: Record<string, BeamioAddressProfileRecord>
			/** Full map snapshot for this partition (host mirror). */
			snapshot: Record<string, BeamioAddressProfileRecord>
	  }
	| { type: 'event:tickDone'; fetched: number; remainingNeed: number }
	| {
			type: 'event:merchantCardsUpdated'
			patch: Record<string, MerchantCardRecord>
			snapshot: Record<string, MerchantCardRecord>
	  }
	| { type: 'event:merchantTickDone'; fetched: number; remainingNeed: number }
	| { type: 'event:log'; level: 'info' | 'warn' | 'error'; message: string }
