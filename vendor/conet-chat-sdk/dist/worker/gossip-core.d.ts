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
import type { ChatRoute, NodeInfo, PresenceEvent, StatusEvent } from '../types.js';
import type { WorkerInitPayload } from '../protocol.js';
/** Callbacks the worker entry wires to `postMessage`. */
export interface GossipEmit {
    message(line: string, armorHash: string | undefined, plain: boolean, viaDomain?: string): void;
    voiceFrame(payload: Record<string, unknown>): void;
    status(status: StatusEvent['status'], detail?: string): void;
    log(level: 'info' | 'warn' | 'error', message: string): void;
    presence(payload: PresenceEvent): void;
}
export declare class GossipCore {
    private readonly emit;
    private cfg;
    private nodes;
    private routes;
    private wallet;
    private pgpPrivateKey;
    private userPgpKeyID;
    private listenController;
    private voiceListenController;
    private lastActivityAt;
    private paused;
    private ackContext;
    constructor(emit: GossipEmit);
    init(payload: WorkerInitPayload): Promise<void>;
    setNodes(nodes: NodeInfo[]): void;
    setRoutes(routes: ChatRoute[]): void;
    pause(): void;
    resume(): void;
    destroy(): void;
    private clearListen;
    private startListen;
    private spawnGossip;
    private resolveAbortReason;
    private handleInbound;
    send(to: ChatRoute, text: string, opts?: {
        beamioNoPush?: boolean;
    }): Promise<boolean>;
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
    sendVoiceFrame(routerArmoredPublicKey: string, frame: Record<string, unknown>): Promise<boolean>;
    startVoiceListen(sessionId: string, pushWakeup?: {
        callId: string;
        calleeEoa: string;
        expiresAt: number;
        timestamp: number;
        offerText?: string;
        recipientPgp?: string;
    }): Promise<boolean>;
    stopVoiceListen(sessionId: string): Promise<boolean>;
}
//# sourceMappingURL=gossip-core.d.ts.map