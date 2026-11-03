/**
 * The caller sends `voice_channel_ready_v3` before its own listen is up, so the
 * callee's first chunks can reach the relay before the caller's channel exists.
 * The relay keeps nothing and answers `target_voice_session_not_found`. Until the
 * first chunk of the call is accepted, such a chunk is posted again every 150 ms
 * for up to 3 s. After that the old rule holds: a late chunk is dropped.
 * Pure (inputs injected) for the test; the iOS and Android shells have the same rule.
 */
export const VOICE_PEER_CHANNEL_WAIT_MS = 3000;
export const VOICE_PEER_CHANNEL_RETRY_GAP_MS = 150;
export const VOICE_PEER_CHANNEL_NOT_FOUND = 'target_voice_session_not_found';
export async function postUntilPeerChannel(opts) {
    let result = await opts.post();
    let tries = 1;
    if (opts.seenBefore)
        return { ...result, tries };
    const deadline = opts.now() + (opts.waitMs ?? VOICE_PEER_CHANNEL_WAIT_MS);
    while (!result.ok &&
        result.error === VOICE_PEER_CHANNEL_NOT_FOUND &&
        opts.now() < deadline &&
        (opts.alive?.() ?? true)) {
        await opts.sleep(opts.gapMs ?? VOICE_PEER_CHANNEL_RETRY_GAP_MS);
        result = await opts.post();
        tries++;
    }
    return { ...result, tries };
}
//# sourceMappingURL=voice-peer-wait.js.map