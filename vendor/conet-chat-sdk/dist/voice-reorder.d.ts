import type { VoiceFrame } from './types.js';
export type VoiceFrameDirection = 'inbound' | 'outbound' | 'uplink' | 'downlink';
export interface VoiceFrameChunk extends VoiceFrame {
    direction?: VoiceFrameDirection;
    frameId?: string;
    chunkIndex?: number;
    chunkCount?: number;
    /** Optional media hint; video may use a longer jitter window. */
    mediaKind?: 'audio' | 'video' | string;
}
export interface VoiceGapEvent {
    type: 'voice_gap_v1';
    sessionId: string;
    direction: VoiceFrameDirection;
    missingSeq: number[];
    missingChunks?: number[];
    reason: 'timeout' | 'buffer_overflow' | 'conflict' | 'skip_ahead';
}
export interface VoiceConflictEvent {
    type: 'voice_conflict_v1';
    sessionId: string;
    direction: VoiceFrameDirection;
    seq: number;
    frameId?: string;
}
export type VoiceReorderEvent = {
    type: 'frame';
    frame: VoiceFrameChunk;
} | {
    type: 'gap';
    gap: VoiceGapEvent;
} | {
    type: 'conflict';
    conflict: VoiceConflictEvent;
};
export interface VoiceFrameReorderOptions {
    /**
     * Jitter / reorder wait for missing `nextSeq` when a later seq is already buffered.
     * Starting value (default 400ms). Set 0 only for tests that force immediate timeout via `tick`.
     */
    reorderDelayMs?: number;
    /**
     * Adaptive upper bound (default 1000ms). A frame that arrives after its gap was
     * skipped adds `lateStepMs`; 10 s without one takes `decayStepMs` back, never
     * below `reorderDelayMs`. Equal to `reorderDelayMs` = fixed wait.
     */
    maxReorderDelayMs?: number;
    lateStepMs?: number;
    decayStepMs?: number;
    decayIntervalMs?: number;
    /** Extra wait for incomplete video chunk groups at nextSeq (default 200ms). */
    videoReorderDelayMs?: number;
    maxPendingChunks?: number;
    maxPendingPayloadUnits?: number;
    onEvent?: (event: VoiceReorderEvent) => void;
}
/**
 * Default voice jitter window. Frames reach us through a different random entry
 * each, 25–35 % out of order and up to ~0.3 s apart (2026-11-05 measurements);
 * the old 120ms dropped 6–37 % of audio as "late".
 */
export declare const DEFAULT_VOICE_REORDER_DELAY_MS = 400;
/** Adaptive ceiling for the voice wait. */
export declare const DEFAULT_VOICE_REORDER_MAX_DELAY_MS = 1000;
/** Default wait for incomplete video fragment groups at nextSeq. */
export declare const DEFAULT_VIDEO_REORDER_DELAY_MS = 200;
export declare class VoiceFrameReorderBuffer {
    private readonly streams;
    /** Split-seq video already delivered, per session (duplicate guard). */
    private readonly videoSeen;
    private readonly reorderDelayMs;
    private readonly maxReorderDelayMs;
    private readonly lateStepMs;
    private readonly decayStepMs;
    private readonly decayIntervalMs;
    private readonly videoReorderDelayMs;
    private readonly maxPendingChunks;
    private readonly maxPendingPayloadUnits;
    private readonly onEvent?;
    constructor(options?: VoiceFrameReorderOptions);
    push(frame: VoiceFrameChunk, now?: number): VoiceFrameChunk[];
    tick(now?: number): VoiceFrameChunk[];
    /**
     * Split-seq video bypasses the audio stream state: deliver at once (the UI
     * orders frames by the capture time inside the payload), drop duplicates.
     */
    private passVideo;
    clear(sessionId?: string): void;
    private createState;
    private rememberDelivered;
    /**
     * Missing `nextSeq` while a later seq (or incomplete video group) is buffered:
     * wait the jitter window, then timeout-skip. Do **not** skip_ahead immediately —
     * that caused mid-call voice pauses when chunks arrived late/out-of-order.
     */
    private afterPendingGap;
    private nextSeqIsIncompleteVideo;
    private drain;
    private skipGap;
    private scheduleTimeout;
    /** Current adaptive audio wait (ms) for a session's inbound stream; for diagnostics and tests. */
    currentWaitMs(sessionId: string, direction?: VoiceFrameDirection): number;
    /** Frames that arrived after their gap was skipped, per stream. */
    lateCount(sessionId: string, direction?: VoiceFrameDirection): number;
    private noteLate;
    private decayIfStable;
    private emit;
}
//# sourceMappingURL=voice-reorder.d.ts.map