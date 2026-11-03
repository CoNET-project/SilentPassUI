/**
 * Mailbox listen stream sealing (client side of CoNET-SI `mailboxStream.ts`).
 *
 * `mailbox_listen` carries a fresh `streamKey` (32 random bytes, base64) inside
 * the command encrypted to our own mailbox B. B seals every SSE frame with it:
 * `data: base64(iv[12] ‖ AES-256-GCM ciphertext ‖ tag[16])`, plaintext = the
 * frame JSON padded with spaces to a multiple of 256 bytes. The entry relaying
 * the stream sees no recipient key ID, wallet or frame type.
 * The key lives in memory for one listen only and is never logged.
 */
const toBase64 = (bytes) => {
    let s = '';
    for (let i = 0; i < bytes.length; i++)
        s += String.fromCharCode(bytes[i]);
    return btoa(s);
};
// Return type left to inference: an ArrayBuffer-backed array on every TS version.
const fromBase64 = (b64) => {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++)
        out[i] = s.charCodeAt(i);
    return out;
};
export async function createMailboxStreamKey() {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
    return { base64: toBase64(raw), key };
}
/** True when an SSE `data:` value looks like a sealed frame (not plain JSON / armor). */
export function isSealedMailboxFrame(payload) {
    return payload.length >= 40 && /^[A-Za-z0-9+/]+={0,2}$/.test(payload);
}
/** Opened frame text (trimmed JSON), or null when it does not open with this key. */
export async function openMailboxStreamFrame(key, payload) {
    try {
        const blob = fromBase64(payload);
        if (blob.length < 12 + 16 + 1)
            return null;
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: blob.subarray(0, 12) }, key, blob.subarray(12));
        return new TextDecoder().decode(plain).trim();
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=mailbox-stream.js.map