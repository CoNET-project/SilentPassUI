/**
 * Beamio Chat SDK — public types.
 *
 * UI-agnostic. No React, no app-specific imports. Everything the SDK needs from
 * the host (private key material, RPC endpoints, node discovery, IPFS base URL,
 * local persistence) is injected through {@link BeamioChatConfig}.
 *
 * Routing rules (do not violate — see repo rules `conet-p2p-mailbox-routing-protocol`,
 * `beamio-conet-chat-protocol`, and `src/docs/gitbook/l0/si-developer-guide.md`):
 *  - Send business payloads encrypted to the recipient EOA *user* PGP, POSTed to an
 *    entry node A ≠ mailbox B.
 *  - New Chat listen SSE is encrypted to mailbox B route key, connected via entry
 *    C ≠ B, and uses `command: 'mailbox_listen'` with an opaque `instanceId`.
 *    Legacy clients may use `mining` with `listenKind: 'chat'`.
 *  - Delivery ACK is encrypted to the mailbox B route key.
 *  - Each POST wraps that inner armor to **that entry's** route public key (peel at
 *    the entry). Clients never set `X-CoNET-Hop-Sigs`.
 */
export const VOICE_MAX_FRAME_B64 = 12000;
export const VOICE_FRAME_TIMESTAMP_SKEW_SEC = 30;
export const VOICE_CALL_MAX_DURATION_MS = 15 * 60 * 1000;
//# sourceMappingURL=types.js.map