/**
 * Node selection + health helpers. Runtime-agnostic (Worker-safe: uses `fetch`,
 * `globalThis` timers). Ported from SilentPassUI `services/chat.ts` with window.* removed.
 *
 * Routing rule reminder: send business payloads to entry A ≠ mailbox B; listen via
 * entry C ≠ B. Mailbox B is identified by matching the contact route armored key.
 * Client → entry uses HTTPS by default (PWA mixed-content). Never set
 * `X-CoNET-Hop-Sigs` on these requests.
 */
import type { NodeInfo } from './types.js';
/** `{https|http}://{domain}.conet.network/post` — SI developer guide `postUrl`. */
export declare function postUrl(domain: string, https?: boolean): string;
export declare const getRandomNode: (allNodes: NodeInfo[]) => NodeInfo | null;
/** Random n distinct nodes (used for send fan-out / presence). */
export declare const getRandomNodes: (allNodes: NodeInfo[], n: number) => NodeInfo[];
export declare const normalizeArmoredKey: (v?: string) => string;
/** Mailbox B nodes = nodes whose armored public key equals the contact route key. */
export declare const pickRouteNodesByArmoredKey: (nodes: NodeInfo[], routerArmoredPublicKey: string) => NodeInfo[];
/**
 * Rule 19: an entry is never the recipient's mailbox nor the sender's own
 * mailbox. Domains of every node serving one of these route keys.
 */
export declare const mailboxDomainsFor: (nodes: NodeInfo[], ...routeKeys: Array<string | undefined>) => Set<string>;
export declare const markGossipNodeHealthy: (domain: string) => void;
export declare const markGossipNodeBad: (domain: string) => void;
export declare const isGossipNodeHealthy: (domain: string) => boolean;
declare function postWithTimeout(url: string, init: RequestInit, timeoutMs?: number): Promise<Response>;
export { postWithTimeout };
export declare const warmGossipNodesOnce: (nodes: NodeInfo[]) => Promise<void>;
/** Start (or keep) the warm loop over `getNodes()`; returns a stop function. */
export declare const startGossipWarm: (getNodes: () => NodeInfo[]) => (() => void);
export declare const stopGossipWarm: () => void;
export declare const pickHealthyGossipNodes: (nodes: NodeInfo[]) => Promise<NodeInfo[]>;
/** Pick up to n entry nodes for gossip send (healthy preferred, exclude mailbox B). */
export declare const pickGossipEntryNodesForSend: (pool: NodeInfo[], n?: number, excludeDomains?: Set<string>) => Promise<NodeInfo[]>;
/** Per-attempt wait for an answer, and entries tried, for one delivery. */
export declare const POST_ATTEMPT_TIMEOUT_MS = 8000;
export declare const POST_MAX_ENTRIES = 4;
/** A 2xx whose JSON body says `{ "ok": false }` is a failure too. */
export declare const isExplicitFailureBody: (text: string) => boolean;
/**
 * Deliver one ciphertext through ONE entry at a time; try the next entry only
 * when this one clearly failed: connection error or reset before an answer,
 * non-2xx, a `{ ok: false }` body, or no answer within `timeoutMs`. A
 * timed-out POST may still have arrived; retrying is safe because the mailbox
 * keeps one copy per ciphertext and clients dedupe by `sendId`.
 */
export declare function postArmorOneEntryAtATime(args: {
    nodes: NodeInfo[];
    exclude: Set<string>;
    /** JSON body for this entry (e.g. armor wrapped to that entry's key). */
    buildBody: (node: NodeInfo) => Promise<string>;
    maxAttempts?: number;
    timeoutMs?: number;
}): Promise<{
    ok: boolean;
    body: string;
    domain?: string;
    attempts: number;
}>;
//# sourceMappingURL=nodes.d.ts.map