/**
 * Call-signal classification of a decrypted chat line. The same rules run in
 * `chat-sdk-ios` (`BeamioConetChatCallControl`) and `chat-sdk-android`
 * (`BeamioConetChatCallControl`); shared vectors: `spec/chat-daemon-vectors.v1.json`
 * (`callSignal`).
 *
 * Rules:
 *  1. `walk(value, depth)`: stop (no match) when `depth >= 8`.
 *  2. A string is trimmed. If it starts with `{` or `[` it is parsed as JSON
 *     (a parse error is no match). Otherwise, with all whitespace removed, it must
 *     be padded standard base64 (`A–Z a–z 0–9 + /`, `=` padding, length % 4 == 0);
 *     its UTF-8 text, trimmed, must start with `{` or `[` and is parsed as JSON.
 *     The parsed value is walked at `depth + 1`.
 *  3. An array: the first element (walked at `depth + 1`) that matches.
 *  4. An object whose `type` is a call-signal type: `callId` / `sessionId` are
 *     the trimmed string values (anything else counts as empty). Both empty: no
 *     match, and its children are not searched. Otherwise this is the match.
 *     A `voice_call_reject_v1` also carries `rejectReason`: `busy` when its
 *     `reason` is exactly "busy" (the callee is in another call; the caller plays
 *     a busy tone), otherwise `declined`.
 *  5. Any other object: walk `text` if it is a string, then every other key whose
 *     value is an object or array (all at `depth + 1`).
 *
 * The recovered signer, not any `from` field, identifies the peer (rule 15).
 */
export declare const CALL_SIGNAL_TYPES: {
    readonly voice_call_offer_v1: "offer";
    readonly voice_call_accept_v1: "accept";
    readonly voice_call_reject_v1: "reject";
    readonly voice_end_v1: "end";
    readonly voice_call_timeout_v1: "timeout";
    /**
     * Wake receipt: the callee's device is ringing. Sent by the callee to the
     * caller's mailbox (caller user-PGP, random entry, NoPush) as soon as an
     * offer rings. No receipt within 8 s tells the caller the callee's phone
     * may be blocking the wake-up push.
     */
    readonly voice_call_ringing_v1: "ringing";
};
export type CallSignalType = keyof typeof CALL_SIGNAL_TYPES;
/**
 * Wire kind of one signal. `cancel` is not on the wire: a daemon reports an
 * `end` that arrives before `accept` as `cancel` in `event:callSignal`.
 */
export type CallSignalKind = (typeof CALL_SIGNAL_TYPES)[CallSignalType] | 'cancel';
/** Types native daemons hand to the shell's call layer (capability `call.control`). */
export declare const CALL_CONTROL_TYPES: readonly CallSignalType[];
export interface CallSignalMatch {
    kind: Exclude<CallSignalKind, 'cancel'>;
    type: CallSignalType;
    callId: string;
    sessionId: string;
    /** Only for `voice_call_reject_v1` (rule 4). */
    rejectReason?: 'busy' | 'declined';
}
/** The call signal inside a decrypted chat line, or null. */
export declare function classifyCallSignal(line: string): CallSignalMatch | null;
/** Call control for the native call layer: an `end` or `timeout` signal, or null. */
export declare function parseCallControl(line: string): CallSignalMatch | null;
//# sourceMappingURL=call-signal.d.ts.map