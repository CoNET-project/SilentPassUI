/**
 * BeamioTag Worker ↔ host protocol (reqId/ack + events).
 * Worker is the global serverDB for @beamioTag address profiles.
 */

import type { BeamioAddressProfileRecord } from '../../utils/beamioAddressProfileRegistry'

export type { BeamioAddressProfileRecord }

export const BEAMIO_TAG_PROFILE_STALE_MS = 7 * 24 * 60 * 60 * 1000
export const BEAMIO_TAG_FETCH_MAX_PER_TICK = 28
export const BEAMIO_TAG_BACKGROUND_TICK_MS = 60_000
export const BEAMIO_TAG_SEARCH_USERS_URL = 'https://beamio.app/api/search-users'

export type BeamioTagWorkerInitPayload = {
	partition: string
	/** One-time localStorage → IDB import (main thread reads LS; worker has no LS). */
	legacyMap?: Record<string, BeamioAddressProfileRecord>
	searchUsersUrl?: string
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
	| { type: 'event:log'; level: 'info' | 'warn' | 'error'; message: string }
