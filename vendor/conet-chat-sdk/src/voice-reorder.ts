import type { VoiceFrame } from './types.js'

export type VoiceFrameDirection = 'inbound' | 'outbound' | 'uplink' | 'downlink'
export interface VoiceFrameChunk extends VoiceFrame {
	direction?: VoiceFrameDirection
	frameId?: string
	chunkIndex?: number
	chunkCount?: number
	/** Optional media hint; video may use a longer jitter window. */
	mediaKind?: 'audio' | 'video' | string
}
export interface VoiceGapEvent {
	type: 'voice_gap_v1'
	sessionId: string
	direction: VoiceFrameDirection
	missingSeq: number[]
	missingChunks?: number[]
	reason: 'timeout' | 'buffer_overflow' | 'conflict' | 'skip_ahead'
}
export interface VoiceConflictEvent {
	type: 'voice_conflict_v1'
	sessionId: string
	direction: VoiceFrameDirection
	seq: number
	frameId?: string
}
export type VoiceReorderEvent =
	| { type: 'frame'; frame: VoiceFrameChunk }
	| { type: 'gap'; gap: VoiceGapEvent }
	| { type: 'conflict'; conflict: VoiceConflictEvent }
export interface VoiceFrameReorderOptions {
	/**
	 * Jitter / reorder wait for missing `nextSeq` when a later seq is already buffered.
	 * Default ~120ms (voice). Set 0 only for tests that force immediate timeout via `tick`.
	 */
	reorderDelayMs?: number
	/** Extra wait for incomplete video chunk groups at nextSeq (default 200ms). */
	videoReorderDelayMs?: number
	maxPendingChunks?: number
	maxPendingPayloadUnits?: number
	onEvent?: (event: VoiceReorderEvent) => void
}
interface StreamState {
	nextSeq: number | null
	pending: Map<number, VoiceFrameChunk>
	pendingPayloadUnits: number
	timer: ReturnType<typeof setTimeout> | null
	gapStartedAt: number | null
	/** Active wait budget for the current gap (audio vs video). */
	gapWaitMs: number
	/** Recently delivered seq → signature (conflict if late duplicate differs). */
	recentDelivered: Map<number, string>
}
/** Default voice jitter window (~1.5× 80ms PCM frames). */
export const DEFAULT_VOICE_REORDER_DELAY_MS = 120
/** Default wait for incomplete video fragment groups at nextSeq. */
export const DEFAULT_VIDEO_REORDER_DELAY_MS = 200
const DEFAULT_MAX_PENDING_CHUNKS = 96
const DEFAULT_MAX_PENDING_PAYLOAD_UNITS = 1_024 * 1_024
/** Bound memory for late-duplicate conflict checks after drain. */
const RECENT_DELIVERED_MAX = 64
function normalizeDirection(frame: VoiceFrameChunk): VoiceFrameDirection { return frame.direction || 'inbound' }
function streamKey(frame: VoiceFrameChunk): string { return `${frame.sessionId}:${normalizeDirection(frame)}` }
function frameSignature(frame: VoiceFrameChunk): string {
	return `${frame.payload}:${frame.frameId || ''}:${frame.chunkIndex ?? ''}:${frame.chunkCount ?? ''}`
}
function validChunkShape(frame: VoiceFrameChunk): boolean {
	const hasIndex = frame.chunkIndex !== undefined || frame.chunkCount !== undefined
	if (!hasIndex) return true
	return Number.isSafeInteger(frame.chunkIndex) && Number.isSafeInteger(frame.chunkCount)
		&& (frame.chunkIndex as number) >= 0 && (frame.chunkCount as number) > 0
		&& (frame.chunkIndex as number) < (frame.chunkCount as number)
}
function isVideoFragment(frame: VoiceFrameChunk): boolean {
	if (frame.mediaKind === 'video') return true
	return Boolean(frame.frameId && frame.chunkCount && frame.chunkCount > 1)
}
function reassemble(group: VoiceFrameChunk[]): VoiceFrameChunk {
	const ordered = group.slice().sort((a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0))
	return {
		...ordered[0],
		seq: ordered[ordered.length - 1].seq,
		payload: ordered.map((frame) => frame.payload).join(''),
		chunkIndex: undefined,
		chunkCount: undefined,
	}
}
export class VoiceFrameReorderBuffer {
	private readonly streams = new Map<string, StreamState>()
	private readonly reorderDelayMs: number
	private readonly videoReorderDelayMs: number
	private readonly maxPendingChunks: number
	private readonly maxPendingPayloadUnits: number
	private readonly onEvent?: (event: VoiceReorderEvent) => void
	constructor(options: VoiceFrameReorderOptions = {}) {
		this.reorderDelayMs = options.reorderDelayMs ?? DEFAULT_VOICE_REORDER_DELAY_MS
		this.videoReorderDelayMs = options.videoReorderDelayMs ?? DEFAULT_VIDEO_REORDER_DELAY_MS
		this.maxPendingChunks = options.maxPendingChunks ?? DEFAULT_MAX_PENDING_CHUNKS
		this.maxPendingPayloadUnits = options.maxPendingPayloadUnits ?? DEFAULT_MAX_PENDING_PAYLOAD_UNITS
		this.onEvent = options.onEvent
	}
	push(frame: VoiceFrameChunk, now = Date.now()): VoiceFrameChunk[] {
		if (frame.type !== 'voice_frame_v1' || !frame.sessionId || !Number.isSafeInteger(frame.seq)
			|| frame.seq < 0 || typeof frame.payload !== 'string' || !validChunkShape(frame)) return []
		const key = streamKey(frame)
		const state = this.streams.get(key) ?? this.createState(key)
		if (state.nextSeq === null) state.nextSeq = frame.seq
		const existing = state.pending.get(frame.seq)
		if (existing) {
			if (frameSignature(existing) === frameSignature(frame)) return []
			this.emit({ type: 'conflict', conflict: { type: 'voice_conflict_v1', sessionId: frame.sessionId, direction: normalizeDirection(frame), seq: frame.seq, frameId: frame.frameId } })
			return []
		}
		const priorDelivered = state.recentDelivered.get(frame.seq)
		if (priorDelivered !== undefined) {
			if (priorDelivered === frameSignature(frame)) return []
			this.emit({ type: 'conflict', conflict: { type: 'voice_conflict_v1', sessionId: frame.sessionId, direction: normalizeDirection(frame), seq: frame.seq, frameId: frame.frameId } })
			return []
		}
		// Control frames (accept / reject / hangup) reuse seq=0 on the ring
		// sessionId. After Accept advances nextSeq past 0, a later Hang Up with
		// seq=0 must still reach the UI — do not treat it as stale media.
		if (frame.seq === 0 && state.nextSeq !== null && state.nextSeq > 0) {
			this.emit({ type: 'frame', frame })
			return [frame]
		}
		if (frame.seq < state.nextSeq) return []
		if (state.pending.size >= this.maxPendingChunks || state.pendingPayloadUnits + frame.payload.length > this.maxPendingPayloadUnits) {
			// Advance past the stalled gap so live audio does not freeze on overflow.
			this.emit({ type: 'gap', gap: { type: 'voice_gap_v1', sessionId: frame.sessionId, direction: normalizeDirection(frame), missingSeq: [state.nextSeq], reason: 'buffer_overflow' } })
			const advanced = this.skipGap(state, 'buffer_overflow')
			if (state.pending.size >= this.maxPendingChunks || state.pendingPayloadUnits + frame.payload.length > this.maxPendingPayloadUnits) {
				return advanced
			}
			state.pending.set(frame.seq, frame)
			state.pendingPayloadUnits += frame.payload.length
			const after = this.drain(state)
			if (state.pending.size && !after.length) {
				return [...advanced, ...this.afterPendingGap(key, state, now, frame)]
			}
			return [...advanced, ...after]
		}
		state.pending.set(frame.seq, frame)
		state.pendingPayloadUnits += frame.payload.length
		const delivered = this.drain(state)
		if (state.pending.size && !delivered.length) {
			return this.afterPendingGap(key, state, now, frame)
		}
		return delivered
	}
	tick(now = Date.now()): VoiceFrameChunk[] {
		const delivered: VoiceFrameChunk[] = []
		for (const [, state] of this.streams) {
			if (state.gapStartedAt !== null && now - state.gapStartedAt >= state.gapWaitMs) {
				delivered.push(...this.skipGap(state, 'timeout'))
			}
		}
		return delivered
	}
	clear(sessionId?: string): void {
		for (const [key, state] of this.streams) {
			if (sessionId && !key.startsWith(`${sessionId}:`)) continue
			if (state.timer !== null) clearTimeout(state.timer)
			this.streams.delete(key)
		}
	}
	private createState(key: string): StreamState {
		const state: StreamState = {
			nextSeq: null,
			pending: new Map(),
			pendingPayloadUnits: 0,
			timer: null,
			gapStartedAt: null,
			gapWaitMs: this.reorderDelayMs,
			recentDelivered: new Map(),
		}
		this.streams.set(key, state)
		return state
	}
	private rememberDelivered(state: StreamState, frame: VoiceFrameChunk): void {
		state.recentDelivered.set(frame.seq, frameSignature(frame))
		while (state.recentDelivered.size > RECENT_DELIVERED_MAX) {
			const oldest = state.recentDelivered.keys().next().value
			if (oldest === undefined) break
			state.recentDelivered.delete(oldest)
		}
	}
	/**
	 * Missing `nextSeq` while a later seq (or incomplete video group) is buffered:
	 * wait the jitter window, then timeout-skip. Do **not** skip_ahead immediately —
	 * that caused mid-call voice pauses when chunks arrived late/out-of-order.
	 */
	private afterPendingGap(
		key: string,
		state: StreamState,
		now: number,
		sample: VoiceFrameChunk,
	): VoiceFrameChunk[] {
		const waitMs = isVideoFragment(sample) || this.nextSeqIsIncompleteVideo(state)
			? this.videoReorderDelayMs
			: this.reorderDelayMs
		if (state.gapStartedAt === null) {
			state.gapStartedAt = now
			state.gapWaitMs = waitMs
		} else if (waitMs > state.gapWaitMs) {
			// Promote to the longer video budget if a fragment shows up mid-wait.
			state.gapWaitMs = waitMs
			if (state.timer !== null) {
				clearTimeout(state.timer)
				state.timer = null
			}
		}
		this.scheduleTimeout(key, state)
		return []
	}
	private nextSeqIsIncompleteVideo(state: StreamState): boolean {
		if (state.nextSeq === null) return false
		const first = state.pending.get(state.nextSeq)
		return Boolean(first && isVideoFragment(first))
	}
	private drain(state: StreamState): VoiceFrameChunk[] {
		const delivered: VoiceFrameChunk[] = []
		while (state.nextSeq !== null) {
			const first = state.pending.get(state.nextSeq)
			if (!first) break
			const expectedChunks = first.chunkCount
			if (expectedChunks && first.frameId) {
				const group = [...state.pending.values()].filter((frame) => frame.frameId === first.frameId && frame.chunkCount === expectedChunks)
				if (group.length !== expectedChunks || group.some((frame, index) => frame.chunkIndex !== index)) break
				const lastSeq = Math.max(...group.map((frame) => frame.seq))
				for (const frame of group) { state.pending.delete(frame.seq); state.pendingPayloadUnits -= frame.payload.length }
				state.nextSeq = lastSeq + 1
				delivered.push(reassemble(group))
				continue
			}
			state.pending.delete(state.nextSeq)
			state.pendingPayloadUnits -= first.payload.length
			state.nextSeq += 1
			delivered.push(first)
		}
		if (!state.pending.size) {
			state.gapStartedAt = null
			state.gapWaitMs = this.reorderDelayMs
			if (state.timer !== null) clearTimeout(state.timer)
			state.timer = null
		}
		for (const frame of delivered) {
			this.rememberDelivered(state, frame)
			this.emit({ type: 'frame', frame })
		}
		return delivered
	}
	private skipGap(state: StreamState, reason: VoiceGapEvent['reason'] = 'timeout'): VoiceFrameChunk[] {
		if (state.nextSeq === null || !state.pending.size) return []
		const firstPendingSeq = Math.min(...state.pending.keys())
		const first = state.pending.get(state.nextSeq)
		const missingSeq: number[] = []
		const missingChunks: number[] = []
		if (first && first.frameId && first.chunkCount) {
			const seen = new Set([...state.pending.values()].filter((frame) => frame.frameId === first.frameId).map((frame) => frame.chunkIndex as number))
			for (let index = 0; index < first.chunkCount; index += 1) if (!seen.has(index)) missingChunks.push(index)
			const groupSeq = [...state.pending.values()].filter((frame) => frame.frameId === first.frameId).map((frame) => frame.seq)
			state.nextSeq = Math.max(...groupSeq) + 1
		} else {
			for (let seq = state.nextSeq; seq < firstPendingSeq; seq += 1) missingSeq.push(seq)
			state.nextSeq = firstPendingSeq
		}
		const sample = [...state.pending.values()][0]
		this.emit({
			type: 'gap',
			gap: {
				type: 'voice_gap_v1',
				sessionId: sample.sessionId,
				direction: normalizeDirection(sample),
				missingSeq,
				...(missingChunks.length ? { missingChunks } : {}),
				reason: reason === 'buffer_overflow' ? 'buffer_overflow' : reason,
			},
		})
		state.gapStartedAt = null
		state.gapWaitMs = this.reorderDelayMs
		if (state.timer !== null) clearTimeout(state.timer)
		state.timer = null
		return this.drain(state)
	}
	private scheduleTimeout(_key: string, state: StreamState): void {
		if (state.timer !== null) return
		const wait = Math.max(0, state.gapWaitMs)
		state.timer = setTimeout(() => {
			state.timer = null
			this.skipGap(state, 'timeout')
		}, wait)
	}
	private emit(event: VoiceReorderEvent): void { this.onEvent?.(event) }
}
