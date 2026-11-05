import { VOICE_VIDEO_SEQ_BASE } from './types.js';
/**
 * Default voice jitter window. Frames reach us through a different random entry
 * each, 25–35 % out of order and up to ~0.3 s apart (2026-11-05 measurements);
 * the old 120ms dropped 6–37 % of audio as "late".
 */
export const DEFAULT_VOICE_REORDER_DELAY_MS = 400;
/** Adaptive ceiling for the voice wait. */
export const DEFAULT_VOICE_REORDER_MAX_DELAY_MS = 1000;
const DEFAULT_LATE_STEP_MS = 100;
const DEFAULT_DECAY_STEP_MS = 50;
const DEFAULT_DECAY_INTERVAL_MS = 10000;
const SKIPPED_MEMORY = 128;
/** Default wait for incomplete video fragment groups at nextSeq. */
export const DEFAULT_VIDEO_REORDER_DELAY_MS = 200;
const DEFAULT_MAX_PENDING_CHUNKS = 96;
const DEFAULT_MAX_PENDING_PAYLOAD_UNITS = 1024 * 1024;
/** Bound memory for late-duplicate conflict checks after drain. */
const RECENT_DELIVERED_MAX = 64;
function normalizeDirection(frame) { return frame.direction || 'inbound'; }
function streamKey(frame) { return `${frame.sessionId}:${normalizeDirection(frame)}`; }
function frameSignature(frame) {
    return `${frame.payload}:${frame.frameId || ''}:${frame.chunkIndex ?? ''}:${frame.chunkCount ?? ''}`;
}
function validChunkShape(frame) {
    const hasIndex = frame.chunkIndex !== undefined || frame.chunkCount !== undefined;
    if (!hasIndex)
        return true;
    return Number.isSafeInteger(frame.chunkIndex) && Number.isSafeInteger(frame.chunkCount)
        && frame.chunkIndex >= 0 && frame.chunkCount > 0
        && frame.chunkIndex < frame.chunkCount;
}
function isVideoFragment(frame) {
    if (frame.mediaKind === 'video')
        return true;
    return Boolean(frame.frameId && frame.chunkCount && frame.chunkCount > 1);
}
function reassemble(group) {
    const ordered = group.slice().sort((a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0));
    return {
        ...ordered[0],
        seq: ordered[ordered.length - 1].seq,
        payload: ordered.map((frame) => frame.payload).join(''),
        chunkIndex: undefined,
        chunkCount: undefined,
    };
}
export class VoiceFrameReorderBuffer {
    constructor(options = {}) {
        this.streams = new Map();
        /** Split-seq video already delivered, per session (duplicate guard). */
        this.videoSeen = new Map();
        this.reorderDelayMs = options.reorderDelayMs ?? DEFAULT_VOICE_REORDER_DELAY_MS;
        this.maxReorderDelayMs = Math.max(this.reorderDelayMs, options.maxReorderDelayMs ?? DEFAULT_VOICE_REORDER_MAX_DELAY_MS);
        this.lateStepMs = options.lateStepMs ?? DEFAULT_LATE_STEP_MS;
        this.decayStepMs = options.decayStepMs ?? DEFAULT_DECAY_STEP_MS;
        this.decayIntervalMs = options.decayIntervalMs ?? DEFAULT_DECAY_INTERVAL_MS;
        this.videoReorderDelayMs = options.videoReorderDelayMs ?? DEFAULT_VIDEO_REORDER_DELAY_MS;
        this.maxPendingChunks = options.maxPendingChunks ?? DEFAULT_MAX_PENDING_CHUNKS;
        this.maxPendingPayloadUnits = options.maxPendingPayloadUnits ?? DEFAULT_MAX_PENDING_PAYLOAD_UNITS;
        this.onEvent = options.onEvent;
    }
    push(frame, now = Date.now()) {
        if (frame.type !== 'voice_frame_v1' || !frame.sessionId || !Number.isSafeInteger(frame.seq)
            || frame.seq < 0 || typeof frame.payload !== 'string' || !validChunkShape(frame))
            return [];
        if (frame.seq >= VOICE_VIDEO_SEQ_BASE)
            return this.passVideo(frame);
        const key = streamKey(frame);
        const state = this.streams.get(key) ?? this.createState(key);
        if (state.nextSeq === null)
            state.nextSeq = frame.seq;
        const existing = state.pending.get(frame.seq);
        if (existing) {
            if (frameSignature(existing) === frameSignature(frame))
                return [];
            this.emit({ type: 'conflict', conflict: { type: 'voice_conflict_v1', sessionId: frame.sessionId, direction: normalizeDirection(frame), seq: frame.seq, frameId: frame.frameId } });
            return [];
        }
        const priorDelivered = state.recentDelivered.get(frame.seq);
        if (priorDelivered !== undefined) {
            if (priorDelivered === frameSignature(frame))
                return [];
            this.emit({ type: 'conflict', conflict: { type: 'voice_conflict_v1', sessionId: frame.sessionId, direction: normalizeDirection(frame), seq: frame.seq, frameId: frame.frameId } });
            return [];
        }
        // Control frames (accept / reject / hangup) reuse seq=0 on the ring
        // sessionId. After Accept advances nextSeq past 0, a later Hang Up with
        // seq=0 must still reach the UI — do not treat it as stale media.
        if (frame.seq === 0 && state.nextSeq !== null && state.nextSeq > 0) {
            this.emit({ type: 'frame', frame });
            return [frame];
        }
        if (frame.seq < state.nextSeq) {
            if (state.skipped.delete(frame.seq))
                this.noteLate(state, now);
            return [];
        }
        this.decayIfStable(state, now);
        if (state.pending.size >= this.maxPendingChunks || state.pendingPayloadUnits + frame.payload.length > this.maxPendingPayloadUnits) {
            // Advance past the stalled gap so live audio does not freeze on overflow.
            this.emit({ type: 'gap', gap: { type: 'voice_gap_v1', sessionId: frame.sessionId, direction: normalizeDirection(frame), missingSeq: [state.nextSeq], reason: 'buffer_overflow' } });
            const advanced = this.skipGap(state, 'buffer_overflow');
            if (state.pending.size >= this.maxPendingChunks || state.pendingPayloadUnits + frame.payload.length > this.maxPendingPayloadUnits) {
                return advanced;
            }
            state.pending.set(frame.seq, frame);
            state.pendingPayloadUnits += frame.payload.length;
            const after = this.drain(state);
            if (state.pending.size && !after.length) {
                return [...advanced, ...this.afterPendingGap(key, state, now, frame)];
            }
            return [...advanced, ...after];
        }
        state.pending.set(frame.seq, frame);
        state.pendingPayloadUnits += frame.payload.length;
        const delivered = this.drain(state);
        if (state.pending.size && !delivered.length) {
            return this.afterPendingGap(key, state, now, frame);
        }
        return delivered;
    }
    tick(now = Date.now()) {
        const delivered = [];
        for (const [, state] of this.streams) {
            if (state.gapStartedAt !== null && now - state.gapStartedAt >= state.gapWaitMs) {
                delivered.push(...this.skipGap(state, 'timeout'));
            }
        }
        return delivered;
    }
    /**
     * Split-seq video bypasses the audio stream state: deliver at once (the UI
     * orders frames by the capture time inside the payload), drop duplicates.
     */
    passVideo(frame) {
        const key = streamKey(frame);
        let seen = this.videoSeen.get(key);
        if (!seen) {
            seen = new Set();
            this.videoSeen.set(key, seen);
        }
        if (seen.has(frame.seq))
            return [];
        seen.add(frame.seq);
        if (seen.size > 256) {
            const floor = frame.seq - 128;
            for (const s of seen)
                if (s < floor)
                    seen.delete(s);
        }
        this.emit({ type: 'frame', frame });
        return [frame];
    }
    clear(sessionId) {
        for (const key of this.videoSeen.keys()) {
            if (!sessionId || key.startsWith(`${sessionId}:`))
                this.videoSeen.delete(key);
        }
        for (const [key, state] of this.streams) {
            if (sessionId && !key.startsWith(`${sessionId}:`))
                continue;
            if (state.timer !== null)
                clearTimeout(state.timer);
            this.streams.delete(key);
        }
    }
    createState(key) {
        const state = {
            nextSeq: null,
            pending: new Map(),
            pendingPayloadUnits: 0,
            timer: null,
            gapStartedAt: null,
            gapWaitMs: this.reorderDelayMs,
            recentDelivered: new Map(),
            waitMs: this.reorderDelayMs,
            skipped: new Set(),
            lastGrowAt: 0,
            lastDecayAt: 0,
            late: 0,
        };
        this.streams.set(key, state);
        return state;
    }
    rememberDelivered(state, frame) {
        state.recentDelivered.set(frame.seq, frameSignature(frame));
        while (state.recentDelivered.size > RECENT_DELIVERED_MAX) {
            const oldest = state.recentDelivered.keys().next().value;
            if (oldest === undefined)
                break;
            state.recentDelivered.delete(oldest);
        }
    }
    /**
     * Missing `nextSeq` while a later seq (or incomplete video group) is buffered:
     * wait the jitter window, then timeout-skip. Do **not** skip_ahead immediately —
     * that caused mid-call voice pauses when chunks arrived late/out-of-order.
     */
    afterPendingGap(key, state, now, sample) {
        const waitMs = isVideoFragment(sample) || this.nextSeqIsIncompleteVideo(state)
            ? Math.max(this.videoReorderDelayMs, state.waitMs)
            : state.waitMs;
        if (state.gapStartedAt === null) {
            state.gapStartedAt = now;
            state.gapWaitMs = waitMs;
        }
        else if (waitMs > state.gapWaitMs) {
            // Promote to the longer video budget if a fragment shows up mid-wait.
            state.gapWaitMs = waitMs;
            if (state.timer !== null) {
                clearTimeout(state.timer);
                state.timer = null;
            }
        }
        this.scheduleTimeout(key, state);
        return [];
    }
    nextSeqIsIncompleteVideo(state) {
        if (state.nextSeq === null)
            return false;
        const first = state.pending.get(state.nextSeq);
        return Boolean(first && isVideoFragment(first));
    }
    drain(state) {
        const delivered = [];
        while (state.nextSeq !== null) {
            const first = state.pending.get(state.nextSeq);
            if (!first)
                break;
            const expectedChunks = first.chunkCount;
            if (expectedChunks && first.frameId) {
                const group = [...state.pending.values()].filter((frame) => frame.frameId === first.frameId && frame.chunkCount === expectedChunks);
                if (group.length !== expectedChunks || group.some((frame, index) => frame.chunkIndex !== index))
                    break;
                const lastSeq = Math.max(...group.map((frame) => frame.seq));
                for (const frame of group) {
                    state.pending.delete(frame.seq);
                    state.pendingPayloadUnits -= frame.payload.length;
                }
                state.nextSeq = lastSeq + 1;
                delivered.push(reassemble(group));
                continue;
            }
            state.pending.delete(state.nextSeq);
            state.pendingPayloadUnits -= first.payload.length;
            state.nextSeq += 1;
            delivered.push(first);
        }
        if (!state.pending.size) {
            state.gapStartedAt = null;
            state.gapWaitMs = state.waitMs;
            if (state.timer !== null)
                clearTimeout(state.timer);
            state.timer = null;
        }
        for (const frame of delivered) {
            this.rememberDelivered(state, frame);
            this.emit({ type: 'frame', frame });
        }
        return delivered;
    }
    skipGap(state, reason = 'timeout') {
        if (state.nextSeq === null || !state.pending.size)
            return [];
        const firstPendingSeq = Math.min(...state.pending.keys());
        const first = state.pending.get(state.nextSeq);
        const missingSeq = [];
        const missingChunks = [];
        if (first && first.frameId && first.chunkCount) {
            const seen = new Set([...state.pending.values()].filter((frame) => frame.frameId === first.frameId).map((frame) => frame.chunkIndex));
            for (let index = 0; index < first.chunkCount; index += 1)
                if (!seen.has(index))
                    missingChunks.push(index);
            const groupSeq = [...state.pending.values()].filter((frame) => frame.frameId === first.frameId).map((frame) => frame.seq);
            state.nextSeq = Math.max(...groupSeq) + 1;
        }
        else {
            for (let seq = state.nextSeq; seq < firstPendingSeq; seq += 1)
                missingSeq.push(seq);
            state.nextSeq = firstPendingSeq;
            for (const seq of missingSeq)
                state.skipped.add(seq);
            while (state.skipped.size > SKIPPED_MEMORY) {
                const oldest = state.skipped.values().next().value;
                if (oldest === undefined)
                    break;
                state.skipped.delete(oldest);
            }
        }
        const sample = [...state.pending.values()][0];
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
        });
        state.gapStartedAt = null;
        state.gapWaitMs = state.waitMs;
        if (state.timer !== null)
            clearTimeout(state.timer);
        state.timer = null;
        return this.drain(state);
    }
    scheduleTimeout(_key, state) {
        if (state.timer !== null)
            return;
        const wait = Math.max(0, state.gapWaitMs);
        state.timer = setTimeout(() => {
            state.timer = null;
            this.skipGap(state, 'timeout');
        }, wait);
    }
    /** Current adaptive audio wait (ms) for a session's inbound stream; for diagnostics and tests. */
    currentWaitMs(sessionId, direction = 'inbound') {
        return this.streams.get(`${sessionId}:${direction}`)?.waitMs ?? this.reorderDelayMs;
    }
    /** Frames that arrived after their gap was skipped, per stream. */
    lateCount(sessionId, direction = 'inbound') {
        return this.streams.get(`${sessionId}:${direction}`)?.late ?? 0;
    }
    noteLate(state, now) {
        state.late += 1;
        const next = Math.min(this.maxReorderDelayMs, state.waitMs + this.lateStepMs);
        state.waitMs = next;
        state.lastGrowAt = now;
        state.lastDecayAt = now;
    }
    decayIfStable(state, now) {
        if (state.waitMs <= this.reorderDelayMs)
            return;
        if (now - state.lastGrowAt < this.decayIntervalMs || now - state.lastDecayAt < this.decayIntervalMs)
            return;
        state.lastDecayAt = now;
        state.waitMs = Math.max(this.reorderDelayMs, state.waitMs - this.decayStepMs);
    }
    emit(event) { this.onEvent?.(event); }
}
//# sourceMappingURL=voice-reorder.js.map