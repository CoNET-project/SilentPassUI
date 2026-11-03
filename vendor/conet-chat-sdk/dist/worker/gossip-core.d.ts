/**
 * Gossip core — runs entirely inside the Worker. All `openpgp` encrypt/decrypt
 * happens here so the main thread never blocks (root cause of the multi-second
 * freeze in SilentPassUI `services/chat.ts` L945-955 inbound decrypt).
 *
 * Ported from SilentPassUI `services/chat.ts`:
 *  - `startGossip` (SSE connect/reconnect, entry health, single in-flight read)
 *  - inbound decrypt → emit host-ready line
 *  - `sendMessage` (encrypt → POST to entry A ≠ B)
 *  - `wallet_online_query` presence (encrypt to mailbox B route key, POST via C ≠ B)
 *
 * Routing rules preserved (repo `conet-p2p-mailbox-routing-protocol`,
 * `beamio-conet-chat-protocol`, `src/docs/gitbook/l0/si-developer-guide.md`):
 * listen encrypted to mailbox B route key via entry C ≠ B with `mailbox_listen`;
 * business payload encrypted to recipient EOA user PGP via entry A ≠ B; ACK
 * encrypted to mailbox B route key. Each POST wraps inner armor to **that entry's**
 * route public key. Clients never set `X-CoNET-Hop-Sigs`.
 */
import { type ChatRoute, type GroupInboundEvent, type GroupIssueRosterRequest, type GroupIssueRosterResult, type GroupIssueTombstoneRequest, type GroupIssueTombstoneResult, type GroupSendRequest, type GroupSendResult, type NodeInfo, type PresenceEvent, type StatusEvent, type VoiceFrame } from '../types.js';
import type { WorkerInitPayload } from '../protocol.js';
import { type VoiceCallV3Config } from '../voice-v3.js';
import { type VoiceConflictEvent, type VoiceGapEvent } from '../voice-reorder.js';
/** Callbacks the worker entry wires to `postMessage`. */
export interface GossipEmit {
    message(line: string, armorHash: string | undefined, plain: boolean, viaDomain?: string): void;
    group(payload: GroupInboundEvent): void;
    voiceFrame(payload: VoiceFrame): void;
    voiceGap(payload: VoiceGapEvent): void;
    voiceConflict(payload: VoiceConflictEvent): void;
    status(status: StatusEvent['status'], detail?: string): void;
    log(level: 'info' | 'warn' | 'error', message: string): void;
    presence(payload: PresenceEvent): void;
}
export declare function findInboundArmor(value: unknown, depth?: number): string;
export declare class GossipCore {
    private readonly emit;
    private cfg;
    private nodes;
    private routes;
    private wallet;
    private pgpPrivateKey;
    private userPgpKeyID;
    private listenController;
    /** This listen's mailbox stream key (memory only, never logged). */
    private listenStreamKey;
    private listenStreamFailures;
    /**
     * Voice protocol v3 call (paid channels): this side's voice and video SSEs on
     * relays it picked, and the peer's two channels it sends to. Incoming
     * chunks are re-keyed to the page's own AES key, so the page code stays as is.
     */
    private voiceV3;
    /** v3 state after a stop: a reconnect reopens the same channels. */
    private voiceV3Retained;
    private readonly voiceReorder;
    private lastActivityAt;
    private paused;
    private pgpReady;
    private ackContext;
    constructor(emit: GossipEmit);
    init(payload: WorkerInitPayload): Promise<void>;
    private openPgpAndListen;
    setNodes(nodes: NodeInfo[]): void;
    setRoutes(routes: ChatRoute[]): void;
    pause(): void;
    resume(): void;
    destroy(): void;
    private clearListen;
    private startListen;
    private spawnGossip;
    private resolveAbortReason;
    /**
     * Open one mailbox SSE frame with this listen's stream key. Every mailbox
     * seals every frame; anything else (plain JSON, a frame that does not open)
     * is dropped. Contents are never logged.
     */
    private openListenFrame;
    private handleInbound;
    send(to: ChatRoute, text: string, opts?: {
        beamioNoPush?: boolean;
    }): Promise<boolean>;
    /**
     * V1 group send: one user-PGP armor per recipient. Never build a
     * multi-recipient OpenPGP message — its key-id list would reveal membership.
     */
    sendGroup(request: GroupSendRequest): Promise<GroupSendResult>;
    issueGroupRoster(request: GroupIssueRosterRequest): Promise<GroupIssueRosterResult>;
    issueGroupTombstone(request: GroupIssueTombstoneRequest): Promise<GroupIssueTombstoneResult>;
    private routeMap;
    private fanOutGroupPlaintext;
    private sendSingleRecipientGroupDelivery;
    /** Drop group objects out of the 1:1 message stream after the outer EIP-191 check. */
    private tryConsumeGroupInbound;
    /**
     * POST armor through one entry at a time (never the same ciphertext to
     * several entries at once); the next entry only after a clear failure.
     * Voice/video frames pass `{ fanout: 1 }`: at most two entries.
     */
    private postToEntries;
    queryPresence(contacts: ChatRoute[]): Promise<Record<string, boolean>>;
    /**
     * After presence: whether the contact mailbox has a registered native shell
     * (iOS, Android, Windows, Linux, or macOS) that push can wake.
     * null = untrusted; do not clear the last trusted answer.
     */
    queryNativeWake(contact: ChatRoute): Promise<boolean | null>;
    private walletOnlineQuery;
    private walletNativeWakeQuery;
    /** Encrypt a mailbox command (e.g. gossip_delivery_ack) to route B and POST via entry C ≠ B. */
    postMailboxCommand(routerArmoredPublicKey: string, command: Record<string, unknown>): Promise<boolean>;
    postOwnMailboxCommand(command: Record<string, unknown>): Promise<boolean>;
    /**
     * The only way an offer travels: `voice_offer_store` with `push: 1` to the
     * callee mailbox. The command is opaque (sessionId is the capability),
     * encrypted to the callee mailbox route key and posted through an entry that
     * is neither mailbox. That mailbox stores the offer, writes it to the callee's
     * live sessions and rings the callee (found from the offer's recipient key
     * ID). It never decrypts `offerArmor`; it is callee user-PGP ciphertext.
     */
    sendVoiceOffer(args: {
        callId: string;
        sessionId: string;
        expiresAt: number;
        offerArmor: string;
        calleeRoute: string;
        pushTimestamp: number;
    }): Promise<{
        ok: boolean;
        pushed: boolean;
    }>;
    /** One voice command through up to two entries; the node's JSON answer or null. */
    private postVoiceCommandForJson;
    sendVoiceFrame(_routerArmoredPublicKey: string, frame: Record<string, unknown>): Promise<boolean>;
    /** The live call, or one parked by a reconnect, with this callId. */
    private voiceV3ForCall;
    /** Seal one chunk for a peer channel and post it through one entry. Resolves true only when the relay accepted it. */
    private postVoiceV3Chunk;
    /**
     * One entry POST for a v2 chunk (a second entry only on a network failure).
     * Reads the node's JSON so a refused chunk can fall back to v1.
     */
    private postVoiceChunk;
    /** A chunk on one of our own channels → the ordinary frame the page handles. */
    private handleVoiceV3Chunk;
    /** The peer reports (or moves) the relays of its two channels. */
    private applyPeerVoiceRelays;
    private voiceNodeByDomain;
    /** A relay from our node table, else from the armored key the peer sent. */
    private voiceRelayNode;
    /** A random relay outside both mailboxes and outside `skip`. */
    private pickVoiceRelay;
    private buildVoiceV3State;
    /**
     * Voice protocol v3: open this side's two paid channels (voice, video). With
     * `call` a new call starts; without it, `sessionId` must be the own voice
     * channel of the current or last call (reconnect). Resolves once the voice
     * channel's relay answers; the video channel opens beside it (pre-warmed).
     */
    startVoiceListen(sessionId: string, call?: VoiceCallV3Config): Promise<boolean>;
    /**
     * One own channel: `voice_listen` v3 to its relay through an entry that is
     * neither the relay nor a mailbox. A relay that refuses or never answers is
     * replaced by another random relay (twice at most); the peer is told.
     */
    private openVoiceV3Channel;
    /**
     * Runs one SSE until it closes. Resolves at the relay's first answer:
     * `ready`, a refusal error from the relay, or `failed`.
     */
    private runVoiceV3Sse;
    private scheduleVideoReopen;
    /**
     * `voice_channel_ready_v3` on the peer's voice channel: the relays of our two
     * channels. The caller sends it once both are open; either side sends it
     * again after moving a channel to another relay. Retried every 300 ms for
     * 10 s while the peer's channel is still opening.
     */
    private sendVoiceChannelReady;
    private abortVoiceV3;
    /** `voice_unlisten` for one own channel, to its relay. */
    private unlistenVoiceV3Channel;
    /** Close the call's SSEs but keep its channels, so a later listen reopens them. */
    private parkVoiceV3;
    stopVoiceListen(sessionId: string): Promise<boolean>;
}
//# sourceMappingURL=gossip-core.d.ts.map