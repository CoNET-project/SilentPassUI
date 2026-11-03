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
export interface MailboxStreamKey {
    /** Base64 for the `mailbox_listen.streamKey` field. */
    base64: string;
    key: CryptoKey;
}
export declare function createMailboxStreamKey(): Promise<MailboxStreamKey>;
/** True when an SSE `data:` value looks like a sealed frame (not plain JSON / armor). */
export declare function isSealedMailboxFrame(payload: string): boolean;
/** Opened frame text (trimmed JSON), or null when it does not open with this key. */
export declare function openMailboxStreamFrame(key: CryptoKey, payload: string): Promise<string | null>;
//# sourceMappingURL=mailbox-stream.d.ts.map