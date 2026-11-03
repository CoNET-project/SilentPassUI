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
export const CALL_SIGNAL_TYPES = {
    voice_call_offer_v1: 'offer',
    voice_call_accept_v1: 'accept',
    voice_call_reject_v1: 'reject',
    voice_end_v1: 'end',
    voice_call_timeout_v1: 'timeout',
    /**
     * Wake receipt: the callee's device is ringing. Sent by the callee to the
     * caller's mailbox (caller user-PGP, random entry, NoPush) as soon as an
     * offer rings. No receipt within 8 s tells the caller the callee's phone
     * may be blocking the wake-up push.
     */
    voice_call_ringing_v1: 'ringing',
};
/** Types native daemons hand to the shell's call layer (capability `call.control`). */
export const CALL_CONTROL_TYPES = ['voice_end_v1', 'voice_call_timeout_v1'];
const MAX_DEPTH = 8;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
function decodeBase64Utf8(text) {
    const compact = text.replace(/\s+/g, '');
    if (!compact || compact.length % 4 !== 0 || !BASE64_RE.test(compact))
        return null;
    try {
        const binary = atob(compact);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++)
            bytes[i] = binary.charCodeAt(i);
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    }
    catch {
        return null;
    }
}
function parseJsonText(text) {
    const t = text.trim();
    if (!t.startsWith('{') && !t.startsWith('['))
        return undefined;
    try {
        return JSON.parse(t);
    }
    catch {
        return undefined;
    }
}
function parseString(raw) {
    const t = raw.trim();
    if (t.startsWith('{') || t.startsWith('['))
        return parseJsonText(t);
    const decoded = decodeBase64Utf8(t);
    return decoded == null ? undefined : parseJsonText(decoded);
}
function trimmedString(v) {
    return typeof v === 'string' ? v.trim() : '';
}
function walk(value, depth) {
    if (depth >= MAX_DEPTH || value == null)
        return null;
    if (typeof value === 'string') {
        const parsed = parseString(value);
        return parsed === undefined ? null : walk(parsed, depth + 1);
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const hit = walk(item, depth + 1);
            if (hit)
                return hit;
        }
        return null;
    }
    if (typeof value !== 'object')
        return null;
    const obj = value;
    const type = obj.type;
    if (typeof type === 'string' && Object.prototype.hasOwnProperty.call(CALL_SIGNAL_TYPES, type)) {
        const callId = trimmedString(obj.callId);
        const sessionId = trimmedString(obj.sessionId);
        if (!callId && !sessionId)
            return null;
        const t = type;
        if (t === 'voice_call_reject_v1') {
            const rejectReason = obj.reason === 'busy' ? 'busy' : 'declined';
            return { kind: CALL_SIGNAL_TYPES[t], type: t, callId, sessionId, rejectReason };
        }
        return { kind: CALL_SIGNAL_TYPES[t], type: t, callId, sessionId };
    }
    if (typeof obj.text === 'string') {
        const hit = walk(obj.text, depth + 1);
        if (hit)
            return hit;
    }
    for (const [k, v] of Object.entries(obj)) {
        if (k === 'text' || v == null || typeof v !== 'object')
            continue;
        const hit = walk(v, depth + 1);
        if (hit)
            return hit;
    }
    return null;
}
/** The call signal inside a decrypted chat line, or null. */
export function classifyCallSignal(line) {
    return walk(line, 0);
}
/** Call control for the native call layer: an `end` or `timeout` signal, or null. */
export function parseCallControl(line) {
    const hit = classifyCallSignal(line);
    return hit && CALL_CONTROL_TYPES.includes(hit.type) ? hit : null;
}
//# sourceMappingURL=call-signal.js.map