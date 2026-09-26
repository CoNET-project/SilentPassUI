/**
 * Node selection + health helpers. Runtime-agnostic (Worker-safe: uses `fetch`,
 * `globalThis` timers). Ported from SilentPassUI `services/chat.ts` with window.* removed.
 *
 * Routing rule reminder: send business payloads to entry A ≠ mailbox B; listen via
 * entry C ≠ B. Mailbox B is identified by matching the contact route armored key.
 * Client → entry uses HTTPS by default (PWA mixed-content). Never set
 * `X-CoNET-Hop-Sigs` on these requests.
 */
/** `{https|http}://{domain}.conet.network/post` — SI developer guide `postUrl`. */
export function postUrl(domain, https = true) {
    return `${https ? 'https' : 'http'}://${domain}.conet.network/post`;
}
export const getRandomNode = (allNodes) => {
    if (!allNodes.length)
        return null;
    return allNodes[Math.floor(Math.random() * allNodes.length)];
};
/** Random n distinct nodes (used for send fan-out / presence). */
export const getRandomNodes = (allNodes, n) => {
    if (!allNodes.length || n <= 0)
        return [];
    const shuffled = [...allNodes].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(n, shuffled.length));
};
export const normalizeArmoredKey = (v) => (v || '').replace(/\r/g, '').trim();
/** Mailbox B nodes = nodes whose armored public key equals the contact route key. */
export const pickRouteNodesByArmoredKey = (nodes, routerArmoredPublicKey) => {
    const target = normalizeArmoredKey(routerArmoredPublicKey);
    if (!target)
        return [];
    return nodes.filter((n) => normalizeArmoredKey(n.armoredPublicKey) === target);
};
const GOSSIP_HEALTH_TTL_MS = 120000;
const gossipHealthyCache = new Map();
export const markGossipNodeHealthy = (domain) => {
    gossipHealthyCache.set(domain, Date.now() + GOSSIP_HEALTH_TTL_MS);
};
export const markGossipNodeBad = (domain) => {
    gossipHealthyCache.delete(domain);
};
const isGossipNodeHealthy = (domain) => (gossipHealthyCache.get(domain) || 0) > Date.now();
async function postWithTimeout(url, init, timeoutMs = 12000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: ctrl.signal });
    }
    finally {
        clearTimeout(t);
    }
}
export { postWithTimeout };
const probeGossipNode = async (node, timeoutMs = 4000) => {
    // GET / only — never OPTIONS /post. Init samples up to 10 entries; SI 404 on a
    // partial first record used to paint Chrome red even when the node was fine.
    // Listen POST still does the real CORS preflight.
    try {
        const res = await postWithTimeout(`https://${node.domain}.conet.network/`, { method: 'GET', headers: { Accept: 'text/html' } }, timeoutMs);
        if (res.status >= 200 && res.status < 400) {
            markGossipNodeHealthy(node.domain);
            return true;
        }
    }
    catch {
        /* ignore */
    }
    markGossipNodeBad(node.domain);
    return false;
};
export const pickHealthyGossipNodes = async (nodes) => {
    if (!nodes.length)
        return [];
    const cached = nodes.filter((n) => isGossipNodeHealthy(n.domain));
    if (cached.length >= 2)
        return cached;
    const sample = getRandomNodes(nodes, Math.min(10, nodes.length));
    const checks = await Promise.all(sample.map(async (node) => ({ node, ok: await probeGossipNode(node) })));
    return checks.filter((n) => n.ok).map((n) => n.node);
};
/** Pick up to n entry nodes for gossip send (healthy preferred, exclude mailbox B). */
export const pickGossipEntryNodesForSend = async (pool, n = 4, excludeDomains) => {
    const filtered = excludeDomains?.size ? pool.filter((node) => !excludeDomains.has(node.domain)) : pool;
    if (!filtered.length)
        return [];
    const healthy = await pickHealthyGossipNodes(filtered);
    const source = healthy.length >= 2 ? healthy : filtered;
    return getRandomNodes(source, Math.min(n, source.length));
};
//# sourceMappingURL=nodes.js.map