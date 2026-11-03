/**
 * ChatDaemon protocol v1 — the single source for the chat daemon's commands
 * and events.
 *
 * Three implementations speak it:
 *  - browser: the TS Web Worker in this package (`worker/entry.ts`, `postMessage`);
 *  - iOS: `chat-sdk-ios` `BeamioConetChatModule` (`CashTreesIOS.chatModuleCommand`);
 *  - Android: `chat-sdk-android` `BeamioConetChatModule` (`CashTreesAndroid.chatModuleCommand`).
 *
 * Rules for changing it:
 *  - Change this file first, then run `npm run spec:schema` (writes
 *    `spec/chat-daemon-protocol.v1.schema.json`) and update the shared test
 *    vectors in `spec/chat-daemon-vectors.v1.json`. Swift and Kotlin follow.
 *  - A new optional field or command is not a version bump: advertise it as a
 *    capability in `hello`. Bump {@link CHAT_DAEMON_PROTOCOL_VERSION} only when an
 *    existing command or event changes meaning.
 *  - Every command carries a privacy entry in {@link COMMAND_PRIVACY}: whether it
 *    carries a wallet signature, whether it goes through an entry node, and what
 *    nodes can read. Check it against rules 13–23 of
 *    `.cursor/rules/beamio-conet-chat-protocol.mdc` before merging.
 *
 * Wire framing (all three use the same JSON objects):
 *  - page → daemon: a {@link ChatDaemonCommand}. iOS wraps it as
 *    `{ action: 'chatModuleCommand', command }`; Android passes `JSON.stringify(command)`.
 *  - daemon → page: a {@link ChatDaemonOutbound}. Native shells wrap it as
 *    `{ action: 'chatModuleEvent', event }` in a `cashtreesios` / `cashtreesandroid`
 *    CustomEvent. Native may also send {@link NativeSignRequest}.
 *  - `reqId`: commands that expect an answer carry a positive integer `reqId`
 *    and get exactly one `ack` (or `ready` for `init`). `reqId: -1` means
 *    fire-and-forget. A daemon answers an unknown command that carries a
 *    positive `reqId` with `ack { ok: false, error: 'unknown_command' }`; daemons
 *    older than v1 stay silent, so callers time out (see `hello`).
 */
// ---------------------------------------------------------------------------
// Version + capabilities
// ---------------------------------------------------------------------------
/** Protocol version this file describes. */
export const CHAT_DAEMON_PROTOCOL_VERSION = 1;
/** Version of this package (the TS Worker daemon). Kept equal to package.json. */
export const CHAT_SDK_VERSION = '0.2.0';
/**
 * Capabilities a daemon can advertise in `hello`. Callers decide by capability,
 * never by "does this method exist".
 */
export const CHAT_DAEMON_CAPABILITIES = [
    /** `provisionIdentity` / `clearIdentity`: keys kept in Keychain (ThisDeviceOnly, AfterFirstUnlock) / Keystore. */
    'identity.provision',
    /** The daemon signs with its stored wallet key; it sends `chatModuleSignRequest` only when it has none. */
    'signing.local',
    /**
     * The daemon decides when the mailbox listen is up: a page `pause` is deferred
     * while a call rings or is up, and the native call layer has `wake(reason)` /
     * `release(reason)` (see {@link NativeDaemonEntry}).
     */
    'lifecycle.daemon',
    /** `init.deferAck` + `ackInbound`: the mailbox ACK waits until the page stored the message; unconfirmed messages are kept and replayed. */
    'inbound.deferAck',
    /** History v2: streamed `event:historyBuffer`, `historyRead` answers an array, `historyAppend` is idempotent per `sendId`. */
    'history.v2',
    /** The daemon recognises call control (`voice_end_v1`, `voice_call_timeout_v1`) inside chat and hands it to the native call layer. */
    'call.control',
    /** `voiceListen.channelKey` opens voice channel v2 inside this daemon. */
    'voice.channelV2',
    /** `voiceListen` / `voiceUnlisten` / `voiceFrame` are owned by the shell's native voice module; the daemon only acknowledges them. */
    'voice.delegated',
    /** `sendGroup` / `issueGroupRoster` / `issueGroupTombstone` follow group V1 (`conet_group_*_v1`, one armor per member). */
    'group.v1',
    /** `queryPresence` and `queryNativeWake`. */
    'presence.query',
    /** `mailboxCommand` and `ownMailboxCommand`. */
    'mailbox.command',
    /**
     * `send` (and group sends) wrap every recipient user-PGP armor to the
     * recipient's mailbox route key, so the entry never sees the recipient key
     * ID; no mailbox route, no send. One entry at a time, the next only after a
     * clear failure. The `send` result `sent` is true only after a 2xx.
     */
    'send.mailboxWrap',
];
/**
 * Privacy annotation for every command. Checked against rules 13–23 on 2026-11-01.
 * The JSON Schema carries these as `x-privacy`.
 */
export const COMMAND_PRIVACY = {
    hello: {
        walletSignature: [],
        viaEntry: false,
        nodeSees: 'Nothing. Local bridge call only.',
        rules: [],
    },
    provisionIdentity: {
        walletSignature: [],
        viaEntry: false,
        nodeSees: 'Nothing. The keys cross the in-process page → daemon bridge only; native stores them in Keychain / Keystore and never logs them.',
        rules: [16],
    },
    clearIdentity: {
        walletSignature: [],
        viaEntry: false,
        nodeSees: 'Nothing. Local wipe of keys, inbox store and session.',
        rules: [],
    },
    init: {
        walletSignature: ['ownMailbox'],
        viaEntry: true,
        nodeSees: 'Entry C: client IP + ciphertext with the own mailbox route key ID, then only sealed, 256-byte-aligned SSE frames (`streamKey` in the listen command; no recipient key ID, wallet or frame type). Own mailbox B: own wallet in the signed `mailbox_listen` (its own registered mailbox). ' +
            'History setup reads `getPointer(ownEoa)` from the CoNET RPC (RPC sees own wallet + IP).',
        rules: [14, 16, 19],
    },
    setRoutes: { walletSignature: [], viaEntry: false, nodeSees: 'Nothing. Local state.', rules: [] },
    setNodes: { walletSignature: [], viaEntry: false, nodeSees: 'Nothing. Local state.', rules: [] },
    nodesResponse: { walletSignature: [], viaEntry: false, nodeSees: 'Nothing. Local state.', rules: [] },
    send: {
        walletSignature: ['recipientLayer'],
        viaEntry: true,
        nodeSees: 'Entry (never the recipient\'s or the sender\'s own mailbox; one at a time): sender IP, its own route key ID (outer wrap), then the recipient mailbox route key ID (mailbox-work layer), never the recipient user key ID. ' +
            'Recipient mailbox: decrypts the mailbox-work layer `{ data: <user-PGP armor>, NoPush? }` and sees the recipient key ID. Sender wallet, signature and PGP key are only inside the user-PGP layer.',
        rules: [14, 16, 18, 19, 22],
    },
    sendGroup: {
        walletSignature: ['recipientLayer'],
        viaEntry: true,
        nodeSees: 'Per member, the same as `send`: one user-PGP armor per member (no multi-recipient armor, so no member list on the wire).',
        rules: [14, 16, 18, 19, 22],
        gap: 'Native daemons send a plain signed envelope per member, not group V1 (no `group.v1` capability).',
    },
    issueGroupRoster: {
        walletSignature: ['recipientLayer'],
        viaEntry: true,
        nodeSees: 'Same as `sendGroup`; the owner-signed roster is inside each member\'s user-PGP layer.',
        rules: [14, 16, 18, 19, 22],
    },
    issueGroupTombstone: {
        walletSignature: ['recipientLayer'],
        viaEntry: true,
        nodeSees: 'Same as `sendGroup`.',
        rules: [14, 16, 18, 19, 22],
    },
    queryPresence: {
        walletSignature: ['peerMailbox'],
        viaEntry: true,
        nodeSees: 'Contact mailbox: querier wallet (signed `wallet_online_query.walletAddress`) + target wallet. Entry C ≠ B: querier IP + ciphertext.',
        rules: [19, 21],
        gap: 'Known exception (rule 21): the contact mailbox learns who asks. To be solved with web3://; do not patch ad hoc.',
    },
    queryNativeWake: {
        walletSignature: ['peerMailbox'],
        viaEntry: true,
        nodeSees: 'Same as `queryPresence` (`wallet_native_wake_query`).',
        rules: [19, 21],
        gap: 'Known exception (rule 21), same as `queryPresence`.',
    },
    historyLoad: {
        walletSignature: [],
        viaEntry: false,
        nodeSees: 'CoNET RPC: `getPointer(ownEoa)` + IP. IPFS gateway: content hashes of AES-GCM fragments + IP. The key-derivation signatures stay on the device.',
        rules: [],
    },
    historyRead: { walletSignature: [], viaEntry: false, nodeSees: 'Nothing. Local corpus.', rules: [] },
    historyAppend: {
        walletSignature: ['apiRelay'],
        viaEntry: false,
        nodeSees: 'IPFS gateway: encrypted fragment + index. Beamio API relay and the chain: own wallet + new index hash (EIP-712 `SetPointer`).',
        rules: [],
    },
    mailboxCommand: {
        walletSignature: ['ownMailbox', 'peerMailbox'],
        viaEntry: true,
        nodeSees: 'The target mailbox decrypts the command and sees the wallet signature and every field. Entry ≠ that mailbox: client IP + ciphertext.',
        rules: [19, 20, 21, 22],
        gap: 'Generic: signs with the own wallet. Use only for the own mailbox (e.g. `gossip_delivery_ack`) or rule-21 queries; never for a command a contact\'s mailbox executes (rules 20, 22).',
    },
    ownMailboxCommand: {
        walletSignature: ['ownMailbox'],
        viaEntry: true,
        nodeSees: 'Own mailbox B: own wallet + the command (e.g. push registration). Entry C ≠ B: client IP + ciphertext.',
        rules: [14, 19],
    },
    voiceFrame: {
        walletSignature: [],
        viaEntry: true,
        nodeSees: 'Peer channel relay: channel locator + MAC + opaque chunk (v3; no v1 fallback). Entry: rotating pool, never a relay or a mailbox.',
        rules: [18, 20, 22, 23],
        gap: 'Native: delegated to the native voice module.',
    },
    voiceListen: {
        walletSignature: ['recipientLayer'],
        viaEntry: true,
        nodeSees: 'Relay (picked by this side, never a mailbox): `voice_listen` v3 = session ID, write key, temporary wallet T and its signature, ' +
            'and the payer wallet\'s signature over T (payer address, `notAfter`). Nothing about the peer or the call ID.',
        rules: [18, 20, 23],
        gap: 'The relay learns the payer wallet (user decision 2026-11-01: payment proof by payer signature; clients may split payment across wallets). Native: delegated to the native voice module.',
    },
    voiceOffer: {
        walletSignature: ['recipientLayer'],
        viaEntry: true,
        nodeSees: 'Callee mailbox: opaque `voice_offer_store` with `push: 1` (ring ID); it stores the offer, writes it to the callee\'s sessions and rings the callee. ' +
            'The caller signature is only inside the callee user-PGP `offerArmor`.',
        rules: [13, 18, 20, 22],
    },
    voiceUnlisten: {
        walletSignature: [],
        viaEntry: true,
        nodeSees: 'The channel relay: unsigned `voice_unlisten` with the session ID.',
        rules: [20, 22],
    },
    ackInbound: {
        walletSignature: ['ownMailbox', 'recipientLayer'],
        viaEntry: true,
        nodeSees: 'Own mailbox B: `gossip_delivery_ack` (own wallet + armor hash). Sender: a `beamio_chat_delivery_receipt_v1` sent like `send` with NoPush ' +
            '(receipt and our signature only inside the sender\'s user-PGP layer).',
        rules: [14, 16, 18, 19, 22],
    },
    pause: { walletSignature: [], viaEntry: false, nodeSees: 'Nothing (the listen closes).', rules: [] },
    resume: {
        walletSignature: ['ownMailbox'],
        viaEntry: true,
        nodeSees: 'Same as the listen part of `init`.',
        rules: [14, 19],
    },
    destroy: { walletSignature: [], viaEntry: false, nodeSees: 'Nothing (the listen closes).', rules: [] },
};
//# sourceMappingURL=protocol.js.map