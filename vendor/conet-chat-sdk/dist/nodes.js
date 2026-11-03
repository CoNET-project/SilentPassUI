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
/**
 * Rule 19: an entry is never the recipient's mailbox nor the sender's own
 * mailbox. Domains of every node serving one of these route keys.
 */
export const mailboxDomainsFor = (nodes, ...routeKeys) => {
    const out = new Set();
    for (const key of routeKeys) {
        for (const n of pickRouteNodesByArmoredKey(nodes, key || ''))
            if (n.domain)
                out.add(n.domain);
    }
    return out;
};
const GOSSIP_HEALTH_TTL_MS = 120000;
const gossipHealthyCache = new Map();
export const markGossipNodeHealthy = (domain) => {
    gossipHealthyCache.set(domain, Date.now() + GOSSIP_HEALTH_TTL_MS);
};
export const markGossipNodeBad = (domain) => {
    gossipHealthyCache.delete(domain);
};
export const isGossipNodeHealthy = (domain) => (gossipHealthyCache.get(domain) || 0) > Date.now();
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
/**
 * Background warm-up of the healthy cache, so a pick returns at once instead of
 * probing then. Runs only while the worker runs (page open and not paused): a
 * tick every 20 s keeps about [GOSSIP_WARM_TARGET] healthy nodes, re-checking the
 * ones about to expire. Probes are the same bare `GET /`: no wallet, no identity.
 */
const GOSSIP_WARM_TARGET = 8;
const GOSSIP_WARM_TICK_MS = 20000;
let gossipWarmTimer = null;
let gossipWarmBusy = false;
export const warmGossipNodesOnce = async (nodes) => {
    if (gossipWarmBusy || !nodes.length)
        return;
    gossipWarmBusy = true;
    try {
        const now = Date.now();
        const healthy = nodes.filter((n) => isGossipNodeHealthy(n.domain));
        // Refresh the two closest to expiry, and add enough new ones to reach the target.
        const expiring = healthy
            .filter((n) => (gossipHealthyCache.get(n.domain) || 0) - now < GOSSIP_HEALTH_TTL_MS / 3)
            .slice(0, 2);
        const need = Math.max(0, GOSSIP_WARM_TARGET - healthy.length + expiring.length);
        const fresh = getRandomNodes(nodes.filter((n) => !isGossipNodeHealthy(n.domain)), Math.min(need + 2, 8));
        await Promise.all([...expiring, ...fresh].map((n) => probeGossipNode(n)));
    }
    finally {
        gossipWarmBusy = false;
    }
};
/** Start (or keep) the warm loop over `getNodes()`; returns a stop function. */
export const startGossipWarm = (getNodes) => {
    stopGossipWarm();
    void warmGossipNodesOnce(getNodes());
    gossipWarmTimer = setInterval(() => void warmGossipNodesOnce(getNodes()), GOSSIP_WARM_TICK_MS);
    return stopGossipWarm;
};
export const stopGossipWarm = () => {
    if (gossipWarmTimer)
        clearInterval(gossipWarmTimer);
    gossipWarmTimer = null;
};
export const pickHealthyGossipNodes = async (nodes) => {
    if (!nodes.length)
        return [];
    const cached = nodes.filter((n) => isGossipNodeHealthy(n.domain));
    if (cached.length >= 2)
        return cached;
    // Too few warm: use what is warm now and top up in the background.
    if (cached.length === 1) {
        void warmGossipNodesOnce(nodes);
        return cached;
    }
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
/** Per-attempt wait for an answer, and entries tried, for one delivery. */
export const POST_ATTEMPT_TIMEOUT_MS = 8000;
export const POST_MAX_ENTRIES = 4;
const POST_TOTAL_BUDGET_MS = 25000;
/** A 2xx whose JSON body says `{ "ok": false }` is a failure too. */
export const isExplicitFailureBody = (text) => {
    try {
        const parsed = JSON.parse(text.trim());
        return !!parsed && typeof parsed === 'object' && parsed.ok === false;
    }
    catch {
        return false;
    }
};
/**
 * Deliver one ciphertext through ONE entry at a time; try the next entry only
 * when this one clearly failed: connection error or reset before an answer,
 * non-2xx, a `{ ok: false }` body, or no answer within `timeoutMs`. A
 * timed-out POST may still have arrived; retrying is safe because the mailbox
 * keeps one copy per ciphertext and clients dedupe by `sendId`.
 */
export async function postArmorOneEntryAtATime(args) {
    const tried = new Set(args.exclude);
    const maxAttempts = Math.max(1, args.maxAttempts ?? POST_MAX_ENTRIES);
    const started = Date.now();
    let attempts = 0;
    while (attempts < maxAttempts && Date.now() - started < POST_TOTAL_BUDGET_MS) {
        const [node] = await pickGossipEntryNodesForSend(args.nodes, 1, tried);
        if (!node)
            break;
        tried.add(node.domain);
        attempts++;
        try {
            const body = await args.buildBody(node);
            const left = POST_TOTAL_BUDGET_MS - (Date.now() - started);
            const res = await postWithTimeout(postUrl(node.domain), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                referrerPolicy: 'no-referrer',
            }, Math.max(1000, Math.min(args.timeoutMs ?? POST_ATTEMPT_TIMEOUT_MS, left)));
            if (!res.ok) {
                markGossipNodeBad(node.domain);
                continue;
            }
            const text = await res.text().catch(() => '');
            if (isExplicitFailureBody(text))
                continue;
            markGossipNodeHealthy(node.domain);
            return { ok: true, body: text, domain: node.domain, attempts };
        }
        catch {
            markGossipNodeBad(node.domain);
        }
    }
    return { ok: false, body: '', attempts };
}
//# sourceMappingURL=nodes.js.map