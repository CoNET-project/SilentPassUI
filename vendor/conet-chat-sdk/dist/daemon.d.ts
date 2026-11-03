/**
 * `hello` negotiation (page side) and the TS Worker's own `hello` answer.
 * Spec: `protocol.ts`. Shared vectors: `spec/chat-daemon-vectors.v1.json` (`hello`).
 */
import { type ChatDaemonCapability, type ChatDaemonHello, type ChatDaemonImplementation } from './protocol.js';
/** Capabilities of the TS Worker daemon in this package. */
export declare const TS_WORKER_CAPABILITIES: readonly ChatDaemonCapability[];
export declare function tsWorkerHello(): ChatDaemonHello;
/**
 * What the page may rely on.
 *  - `negotiated`: the daemon answered `hello` with a version range that includes ours.
 *  - `legacy`: no usable answer (a daemon older than v1 never answers). Keep the pre-v1 rules.
 *  - `incompatible`: the daemon only speaks protocol versions newer than ours. Use no capability.
 */
export interface ChatDaemonFeatures {
    status: 'negotiated' | 'legacy' | 'incompatible';
    /** The daemon's newest protocol version (0 when legacy). */
    protocolVersion: number;
    sdkVersion: string;
    implementation: ChatDaemonImplementation | '';
    /** Known capabilities only, in {@link CHAT_DAEMON_CAPABILITIES} order. Empty unless negotiated. */
    capabilities: ChatDaemonCapability[];
}
/**
 * Turn a `hello` answer (or `null` when none came) into {@link ChatDaemonFeatures}.
 * Unknown capabilities are dropped; a malformed answer counts as legacy.
 */
export declare function negotiateChatDaemon(reply: unknown, ourVersion?: number): ChatDaemonFeatures;
export declare function hasCapability(features: ChatDaemonFeatures | null | undefined, cap: ChatDaemonCapability): boolean;
//# sourceMappingURL=daemon.d.ts.map