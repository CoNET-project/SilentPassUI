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
export declare const markGossipNodeHealthy: (domain: string) => void;
export declare const markGossipNodeBad: (domain: string) => void;
declare function postWithTimeout(url: string, init: RequestInit, timeoutMs?: number): Promise<Response>;
export { postWithTimeout };
export declare const pickHealthyGossipNodes: (nodes: NodeInfo[]) => Promise<NodeInfo[]>;
/** Pick up to n entry nodes for gossip send (healthy preferred, exclude mailbox B). */
export declare const pickGossipEntryNodesForSend: (pool: NodeInfo[], n?: number, excludeDomains?: Set<string>) => Promise<NodeInfo[]>;
//# sourceMappingURL=nodes.d.ts.map