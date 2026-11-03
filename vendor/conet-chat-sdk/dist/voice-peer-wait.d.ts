/**
 * The caller sends `voice_channel_ready_v3` before its own listen is up, so the
 * callee's first chunks can reach the relay before the caller's channel exists.
 * The relay keeps nothing and answers `target_voice_session_not_found`. Until the
 * first chunk of the call is accepted, such a chunk is posted again every 150 ms
 * for up to 3 s. After that the old rule holds: a late chunk is dropped.
 * Pure (inputs injected) for the test; the iOS and Android shells have the same rule.
 */
export declare const VOICE_PEER_CHANNEL_WAIT_MS = 3000;
export declare const VOICE_PEER_CHANNEL_RETRY_GAP_MS = 150;
export declare const VOICE_PEER_CHANNEL_NOT_FOUND = "target_voice_session_not_found";
export interface PeerWaitResult {
    ok: boolean;
    error?: string;
    tries: number;
}
export declare function postUntilPeerChannel(opts: {
    seenBefore: boolean;
    post: () => Promise<{
        ok: boolean;
        error?: string;
    }>;
    sleep: (ms: number) => Promise<void>;
    now: () => number;
    /** Stop waiting when the call ends. */
    alive?: () => boolean;
    waitMs?: number;
    gapMs?: number;
}): Promise<PeerWaitResult>;
//# sourceMappingURL=voice-peer-wait.d.ts.map