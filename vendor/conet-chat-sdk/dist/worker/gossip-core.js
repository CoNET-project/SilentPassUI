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
import { createMessage, decrypt, decryptKey, encrypt, enums, readKey, readMessage, readPrivateKey, } from 'openpgp';
import { ethers } from 'ethers';
import { getRandomNode, getRandomNodes, markGossipNodeBad, markGossipNodeHealthy, pickGossipEntryNodesForSend, pickHealthyGossipNodes, pickRouteNodesByArmoredKey, postUrl, postWithTimeout, } from '../nodes.js';
import { base64ToUtf8, keccakUtf8, utf8ToBase64 } from '../crypto.js';
import { armorToString, buildPostBody, encryptOpaqueVoiceCommand, encryptRouteCommand, wrapArmorToEntryRoute, wrapArmorToMailboxWork } from '../envelope.js';
const GOSSIP_STOP_REASONS = new Set([
    'root_stop',
    'replaced_by_new_connection',
    'component_unmount',
    'relaunching',
    'connect_failed',
    'foreground_resume',
    'background_pause',
    'destroy',
]);
function extractGossipListingBlockHeight(payload) {
    if (!payload || typeof payload !== 'object')
        return null;
    const epoch = payload.epoch;
    if (epoch == null)
        return null;
    if (typeof epoch === 'number' && Number.isFinite(epoch))
        return String(Math.trunc(epoch));
    if (typeof epoch === 'string' && epoch.trim())
        return epoch.trim();
    return null;
}
function isGossipListingLivenessFrame(payload) {
    if (!payload || typeof payload !== 'object')
        return false;
    const row = payload;
    return typeof row.ipaddress === 'string' || 'nodeWallets' in row;
}
const INBOUND_WRAPPER_KEYS = ['data', 'message', 'payload', 'body', 'text'];
function findInboundArmor(value, depth = 0) {
    if (depth > 5)
        return '';
    if (typeof value === 'string') {
        const text = value.trim();
        if (/^-----BEGIN PGP MESSAGE-----/i.test(text))
            return text;
        if (text.startsWith('{') || text.startsWith('[')) {
            try {
                return findInboundArmor(JSON.parse(text), depth + 1);
            }
            catch {
                return '';
            }
        }
        // A few mailbox relays wrap the armor in base64 before placing it in
        // their JSON envelope. Decode only bounded, plausible base64 strings;
        // never treat arbitrary text as a candidate.
        if (text.length >= 32 && /^[A-Za-z0-9+/=_-]+$/.test(text)) {
            try {
                const normalized = text.replace(/-/g, '+').replace(/_/g, '/');
                const decoded = base64ToUtf8(normalized).trim();
                if (decoded && decoded !== text) {
                    return findInboundArmor(decoded, depth + 1);
                }
            }
            catch {
                /* not base64 */
            }
        }
    }
    if (!value || typeof value !== 'object')
        return '';
    const row = value;
    for (const key of INBOUND_WRAPPER_KEYS) {
        const found = findInboundArmor(row[key], depth + 1);
        if (found)
            return found;
    }
    return '';
}
function parseInboundJson(value) {
    let current = value;
    for (let depth = 0; depth <= 5; depth += 1) {
        if (typeof current !== 'string')
            return current;
        const text = current.trim();
        try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === 'object')
                return parsed;
        }
        catch {
            /* try base64 below */
        }
        try {
            const decoded = base64ToUtf8(text).trim();
            if (decoded && decoded !== text) {
                current = decoded;
                continue;
            }
        }
        catch {
            /* not base64 */
        }
        return current;
    }
    return current;
}
export class GossipCore {
    constructor(emit) {
        this.emit = emit;
        this.cfg = null;
        this.nodes = [];
        this.routes = [];
        this.wallet = null;
        this.pgpPrivateKey = null;
        this.userPgpKeyID = '';
        this.listenController = null;
        this.voiceListenController = null;
        this.lastActivityAt = 0;
        this.paused = false;
        this.ackContext = null;
    }
    async init(payload) {
        this.cfg = payload;
        this.nodes = payload.nodes || [];
        this.routes = payload.routes || [];
        this.emit.log('info', `chat worker init pgpArmor=${payload.identity.pgpPrivateKeyArmored.length} passphrase=${payload.identity.pgpPassphrase ? 'set' : 'empty'}`);
        const pkHex = payload.identity.privateKeyHex.startsWith('0x')
            ? payload.identity.privateKeyHex
            : `0x${payload.identity.privateKeyHex}`;
        this.wallet = new ethers.Wallet(pkHex);
        const pk = await readPrivateKey({ armoredKey: payload.identity.pgpPrivateKeyArmored });
        this.emit.log('info', `chat worker pgp key decrypted=${pk.isDecrypted()}`);
        this.pgpPrivateKey = pk.isDecrypted()
            ? pk
            : await decryptKey({ privateKey: pk, passphrase: payload.identity.pgpPassphrase || '' });
        this.emit.log('info', 'chat worker pgp decrypt ready');
        if (payload.identity.pgpPublicKeyArmored) {
            try {
                const keyObj = await readKey({ armoredKey: payload.identity.pgpPublicKeyArmored });
                this.userPgpKeyID = keyObj.getKeyIDs()[1].toHex().toUpperCase();
            }
            catch {
                /* keyID optional */
            }
        }
        this.paused = false;
        await this.startListen();
    }
    setNodes(nodes) {
        if (nodes?.length)
            this.nodes = nodes;
    }
    setRoutes(routes) {
        this.routes = routes || [];
    }
    pause() {
        this.paused = true;
        this.clearListen('background_pause');
        this.voiceListenController?.abort('voice_stop');
        this.lastActivityAt = 0;
        this.emit.status('paused');
    }
    resume() {
        if (!this.paused && this.listenController && !this.listenController.signal.aborted)
            return;
        this.paused = false;
        void this.startListen();
    }
    destroy() {
        this.clearListen('destroy');
        this.voiceListenController?.abort('voice_stop');
        this.wallet = null;
        this.pgpPrivateKey = null;
        this.cfg = null;
    }
    clearListen(reason) {
        if (this.listenController) {
            try {
                this.listenController.abort(reason);
            }
            catch {
                /* ignore */
            }
            this.listenController = null;
        }
    }
    // ---- Listen (dedicated Mailbox B route, entry C ≠ B) -------------------------
    async startListen() {
        if (this.paused)
            return;
        if (!this.cfg || !this.wallet || !this.pgpPrivateKey)
            return;
        if (this.listenController && !this.listenController.signal.aborted) {
            this.emit.log('info', 'listen skipped: SSE already live');
            return;
        }
        this.listenController = null;
        // Resolve mailbox B route from the identity's own route (host injects own route key).
        const ownRouteKey = this.cfg.identity.ownRouteArmoredPublicKey || '';
        const routeNodes = pickRouteNodesByArmoredKey(this.nodes, ownRouteKey);
        if (!ownRouteKey || !routeNodes.length) {
            // Ask host to refresh nodes; retry shortly.
            this.emit.log('warn', 'listen: no route node for own mailbox key; awaiting nodes');
            this.emit.status('reconnecting', 'awaiting_route_nodes');
            setTimeout(() => void this.startListen(), 6000);
            return;
        }
        const mailboxDomains = new Set(routeNodes.map((n) => n.domain));
        this.emit.status('connecting');
        const controller = new AbortController();
        this.listenController = controller;
        const rootSignal = controller.signal;
        try {
            const instanceId = typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : utf8ToBase64(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
            const innerArmor = await encryptRouteCommand(this.wallet, {
                command: 'mailbox_listen',
                walletAddress: this.wallet.address,
                instanceId,
            }, ownRouteKey);
            const entryCandidates = this.nodes.filter((n) => !mailboxDomains.has(n.domain));
            const healthyNodes = await pickHealthyGossipNodes(entryCandidates.length ? entryCandidates : this.nodes);
            if (!healthyNodes.length) {
                this.emit.log('warn', 'listen: no healthy entry C; retry');
                this.emit.status('reconnecting', 'no_entry_c');
                this.clearListen('connect_failed');
                setTimeout(() => void this.startListen(), 6000);
                return;
            }
            this.ackContext = {
                routerArmoredPublicKey: ownRouteKey,
                entryNodes: healthyNodes,
                mailboxDomains: [...mailboxDomains],
            };
            this.spawnGossip(healthyNodes, innerArmor, rootSignal);
        }
        catch (ex) {
            this.emit.log('error', `startListen error: ${ex?.message ?? String(ex)}`);
            this.clearListen('connect_failed');
            this.emit.status('error', ex?.message);
            setTimeout(() => void this.startListen(), 6000);
        }
    }
    spawnGossip(nodes, innerArmor, rootSignal, timeoutConfig, reconnectAttempt = 0) {
        if (rootSignal.aborted)
            return;
        if (!nodes.length)
            return;
        const node = getRandomNode(nodes);
        const config = {
            connectTimeout: 12000,
            // Mailbox B keepalives are bounded at 60–180s. Keep enough margin
            // for transport/proxy jitter before declaring the SSE idle.
            idleTimeout: 240000,
            readOperationTimeout: 20000,
            retryDelay: 2000,
            ...timeoutConfig,
        };
        const url = postUrl(node.domain);
        const controller = new AbortController();
        const onRootAbort = () => controller.abort('root_stop');
        rootSignal.addEventListener('abort', onRootAbort);
        let isRelaunching = false;
        const triggerRelaunch = (reason) => {
            if (rootSignal.aborted)
                return;
            if (isRelaunching)
                return;
            isRelaunching = true;
            rootSignal.removeEventListener('abort', onRootAbort);
            try {
                controller.abort('relaunching');
            }
            catch {
                /* ignore */
            }
            const nextAttempt = reconnectAttempt + 1;
            const delay = Math.min(30000, Math.round(config.retryDelay * Math.pow(1.6, Math.min(nextAttempt, 8))));
            setTimeout(() => {
                if (rootSignal.aborted)
                    return;
                this.emit.log('info', `reconnecting entry C attempt=${nextAttempt} reason=${reason || 'stream_end'}`);
                const remaining = nodes.filter((n) => n.domain !== node.domain);
                this.spawnGossip(remaining.length ? remaining : nodes, innerArmor, rootSignal, timeoutConfig, nextAttempt);
            }, delay);
        };
        let connectTimer = null;
        let idleTimer = null;
        const resetIdle = () => {
            if (idleTimer)
                clearTimeout(idleTimer);
            idleTimer = setTimeout(() => controller.abort('idle_timeout'), config.idleTimeout);
        };
        void (async () => {
            let reader;
            let pendingRead = null;
            try {
                const armored = this.cfg?.runtime.outerWrap === false
                    ? innerArmor
                    : await wrapArmorToEntryRoute(innerArmor, node.armoredPublicKey);
                connectTimer = setTimeout(() => controller.abort('connect_timeout'), config.connectTimeout);
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json;charset=UTF-8',
                        Accept: 'text/event-stream',
                        Connection: 'keep-alive',
                    },
                    body: JSON.stringify(buildPostBody(armored)),
                    signal: controller.signal,
                    cache: 'no-store',
                });
                if (connectTimer)
                    clearTimeout(connectTimer);
                if (!res.ok || !res.body)
                    throw new Error(`HTTP ${res.status}`);
                markGossipNodeHealthy(node.domain);
                this.lastActivityAt = Date.now();
                reconnectAttempt = 0;
                this.emit.status('listening');
                reader = res.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let buffer = '';
                resetIdle();
                while (true) {
                    // eslint-disable-next-line no-throw-literal -- string stop-reason protocol (see resolveAbortReason)
                    if (rootSignal.aborted)
                        throw 'root_stop';
                    if (controller.signal.aborted)
                        throw controller.signal.reason;
                    let readResult;
                    let readTimer;
                    try {
                        if (!pendingRead)
                            pendingRead = reader.read();
                        const timeoutPromise = new Promise((_, reject) => {
                            readTimer = setTimeout(() => reject(new Error('read_operation_timeout')), config.readOperationTimeout);
                        });
                        readResult = await Promise.race([pendingRead, timeoutPromise]);
                        pendingRead = null;
                    }
                    catch (readErr) {
                        if (readErr?.message === 'read_operation_timeout') {
                            // eslint-disable-next-line no-throw-literal -- string stop-reason protocol (see resolveAbortReason)
                            if (rootSignal.aborted)
                                throw 'root_stop';
                            if (controller.signal.aborted)
                                throw controller.signal.reason;
                            continue;
                        }
                        pendingRead = null;
                        throw readErr;
                    }
                    finally {
                        if (readTimer)
                            clearTimeout(readTimer);
                    }
                    const { value, done } = readResult;
                    if (done)
                        break;
                    resetIdle();
                    reconnectAttempt = 0;
                    this.lastActivityAt = Date.now();
                    buffer += decoder.decode(value, { stream: true });
                    let idx;
                    while ((idx = buffer.indexOf('\r\n\r\n')) !== -1 || (idx = buffer.indexOf('\n\n')) !== -1) {
                        const isFour = buffer.substring(idx, idx + 4) === '\r\n\r\n';
                        const separatorLen = isFour ? 4 : 2;
                        const block = buffer.slice(0, idx);
                        buffer = buffer.slice(idx + separatorLen);
                        const lines = block.split('\n');
                        const dataLines = lines.filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart());
                        const payload = (dataLines.length ? dataLines.join('\n') : block).trim();
                        if (!payload)
                            continue;
                        await this.handleInbound(payload, node.domain, rootSignal);
                    }
                }
                triggerRelaunch('server_closed');
            }
            catch (err) {
                if (connectTimer)
                    clearTimeout(connectTimer);
                if (idleTimer)
                    clearTimeout(idleTimer);
                const msg = this.resolveAbortReason(err, controller, rootSignal);
                if (GOSSIP_STOP_REASONS.has(msg))
                    return;
                if (err?.name === 'AbortError' && rootSignal.aborted)
                    return;
                if (err?.name !== 'AbortError') {
                    this.emit.log('warn', `SSE error (${node.domain}): ${msg}`);
                }
                if (msg === 'connect_timeout' || msg === 'idle_timeout' || msg === 'Failed to fetch') {
                    markGossipNodeBad(node.domain);
                }
                triggerRelaunch(msg);
            }
            finally {
                rootSignal.removeEventListener('abort', onRootAbort);
                if (reader) {
                    try {
                        await reader.cancel();
                        reader.releaseLock();
                    }
                    catch {
                        /* ignore */
                    }
                }
            }
        })();
    }
    resolveAbortReason(err, controller, rootSignal) {
        if (typeof err === 'string' && err)
            return err;
        const signalReason = controller.signal.reason ?? rootSignal.reason;
        if (typeof signalReason === 'string' && signalReason)
            return signalReason;
        if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
            return err.message;
        }
        return 'unknown';
    }
    async handleInbound(rawData, viaDomain, _rootSignal) {
        const trimmedRaw = rawData.trim();
        let data = null;
        try {
            const parsed = JSON.parse(trimmedRaw);
            if (parsed && typeof parsed === 'object') {
                data = parsed;
            }
        }
        catch {
            // Some mailbox/entry implementations deliver the SSE `data:` value
            // as the armored PGP message itself. Keep that compatibility path;
            // do not require JSON before attempting decryption.
        }
        if (data && isGossipListingLivenessFrame(data) && extractGossipListingBlockHeight(data)) {
            // Liveness/listing frame: no business payload, but proves the SSE is alive.
            // Refresh internal activity + surface a heartbeat so the host can keep its
            // own foreground/background staleness timer fresh (parity with the old
            // main-thread noteGossipActivity() that fired on every frame).
            this.lastActivityAt = Date.now();
            this.emit.status('listening', 'heartbeat');
            return;
        }
        if (data?.type === 'mailbox_keepalive') {
            this.lastActivityAt = Date.now();
            this.emit.status('listening', 'heartbeat');
            return;
        }
        try {
            if (data?.type === 'voice_frame_v1') {
                this.emit.voiceFrame(data);
                return;
            }
            // Mailbox relays can add several JSON envelopes. Walk only a bounded
            // set of wrapper keys; never log or forward the plaintext/ciphertext.
            const armored = findInboundArmor(data ?? trimmedRaw);
            if (armored && /^-----BEGIN PGP MESSAGE-----/i.test(armored)) {
                this.emit.log('info', `inbound PGP candidate bytes=${armored.length} via=${viaDomain}`);
                const msg = await readMessage({ armoredMessage: armored });
                const { data: decrypted } = await decrypt({ message: msg, decryptionKeys: this.pgpPrivateKey });
                const decryptedString = typeof decrypted === 'string' ? decrypted : String(decrypted);
                // Senders historically used both base64(JSON) and JSON directly.
                // Normalize both, including bounded nested data/message wrappers.
                const parsed = parseInboundJson(decryptedString);
                const kkk = typeof parsed === 'string'
                    ? parsed
                    : JSON.stringify(parsed);
                this.emit.log('info', `inbound PGP decrypted chars=${kkk.length} json=${kkk.trim().startsWith('{')}`);
                const armorHash = keccakUtf8(armored);
                let line = kkk;
                try {
                    const env = JSON.parse(kkk);
                    if (env && typeof env === 'object') {
                        env._beamioPgpArmorHash = armorHash;
                        line = JSON.stringify(env);
                    }
                }
                catch {
                    /* keep raw */
                }
                this.emit.message(line, armorHash, false, viaDomain);
            }
            else if (data && data.from && data.text != null && data.signMessage) {
                this.emit.message(JSON.stringify(data), undefined, true, viaDomain);
            }
        }
        catch (ex) {
            const msg = ex?.message ?? String(ex);
            if (msg.includes('No decryption key packets found')) {
                this.emit.log('warn', 'inbound PGP is not for this listen key (stale contact publicArmored or wrong recipient)');
                return;
            }
            this.emit.log('warn', `inbound parse error: ${msg}`);
        }
    }
    // ---- Send (recipient EOA user PGP, entry A ≠ B, wrap to each A) ------------
    async send(to, text, opts) {
        if (!this.wallet)
            throw new Error('not initialised');
        const pgpPublic = to.userPublicKeyArmored?.trim();
        if (!pgpPublic) {
            this.emit.log('error', 'send: missing recipient userPublicKeyArmored');
            return false;
        }
        const signMessage = await this.wallet.signMessage(text);
        const message = { timestamp: Date.now(), text, from: this.wallet.address, signMessage };
        let innerArmor;
        try {
            const encObj = {
                message: await createMessage({ text: utf8ToBase64(JSON.stringify(message)) }),
                encryptionKeys: await readKey({ armoredKey: pgpPublic }),
                config: { preferredCompressionAlgorithm: enums.compression.zlib },
            };
            innerArmor = await encrypt(encObj);
        }
        catch (ex) {
            this.emit.log('error', `send encrypt error: ${ex?.message ?? String(ex)}`);
            return false;
        }
        if (opts?.beamioNoPush) {
            const mailboxKey = to.routerArmoredPublicKey?.trim();
            if (!mailboxKey) {
                this.emit.log('error', 'send: NoPush requires recipient mailbox routerArmoredPublicKey');
                return false;
            }
            try {
                innerArmor = await wrapArmorToMailboxWork(innerArmor, mailboxKey, { NoPush: true });
            }
            catch (ex) {
                this.emit.log('error', `send mailbox wrap error: ${ex?.message ?? String(ex)}`);
                return false;
            }
        }
        const mailboxDomains = new Set(pickRouteNodesByArmoredKey(this.nodes, to.routerArmoredPublicKey || '').map((n) => n.domain));
        return this.postToEntries(innerArmor, mailboxDomains);
    }
    async postToEntries(innerArmor, excludeDomains) {
        const send = async (targets) => {
            if (!targets.length)
                return false;
            const results = await Promise.all(targets.map(async (node) => {
                const url = postUrl(node.domain);
                try {
                    const armored = this.cfg?.runtime.outerWrap === false
                        ? innerArmor
                        : await wrapArmorToEntryRoute(innerArmor, node.armoredPublicKey);
                    const res = await postWithTimeout(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(buildPostBody(armored)),
                        referrerPolicy: 'no-referrer',
                    }, 12000);
                    if (!res.ok) {
                        markGossipNodeBad(node.domain);
                        return false;
                    }
                    markGossipNodeHealthy(node.domain);
                    return true;
                }
                catch {
                    markGossipNodeBad(node.domain);
                    return false;
                }
            }));
            return results.some(Boolean);
        };
        const fanout = this.cfg?.runtime.sendFanout ?? 3;
        const wave1 = await pickGossipEntryNodesForSend(this.nodes, Math.min(fanout + 1, this.nodes.length), excludeDomains);
        if (await send(wave1))
            return true;
        const tried = new Set([...excludeDomains, ...wave1.map((n) => n.domain)]);
        const wave2 = await pickGossipEntryNodesForSend(this.nodes, Math.min(fanout + 1, this.nodes.length), tried);
        return send(wave2);
    }
    // ---- Presence (wallet_online_query, encrypt to mailbox B, POST via C ≠ B) --
    async queryPresence(contacts) {
        const out = {};
        if (!this.wallet || !contacts.length)
            return out;
        await Promise.all(contacts.map(async (c) => {
            const addr = (c.address || '').trim().toLowerCase();
            const route = (c.routerArmoredPublicKey || '').trim();
            if (!addr || !ethers.isAddress(addr) || !route)
                return;
            const routeNodes = pickRouteNodesByArmoredKey(this.nodes, route);
            const mailboxDomains = new Set(routeNodes.map((n) => n.domain).filter(Boolean));
            const r = await this.walletOnlineQuery(addr, route, mailboxDomains);
            if (r?.ok)
                out[addr] = r.online;
        }));
        this.emit.presence({ online: out });
        return out;
    }
    /**
     * After presence: whether the contact mailbox has a registered native shell
     * (iOS, Android, Windows, Linux, or macOS) that push can wake.
     * null = untrusted; do not clear the last trusted answer.
     */
    async queryNativeWake(contact) {
        if (!this.wallet)
            return null;
        const addr = (contact.address || '').trim();
        const route = (contact.routerArmoredPublicKey || '').trim();
        if (!addr || !ethers.isAddress(addr) || !route)
            return null;
        const routeNodes = pickRouteNodesByArmoredKey(this.nodes, route);
        const mailboxDomains = new Set(routeNodes.map((n) => n.domain).filter(Boolean));
        const r = await this.walletNativeWakeQuery(addr, route, mailboxDomains);
        if (!r?.ok)
            return null;
        return r.nativeWakeable;
    }
    async walletOnlineQuery(targetWallet, routerArmoredPublicKey, mailboxDomains) {
        if (!this.wallet)
            return null;
        try {
            const timestamp = Math.floor(Date.now() / 1000);
            const command = {
                command: 'wallet_online_query',
                walletAddress: this.wallet.address,
                targetWallet: ethers.getAddress(targetWallet),
                timestamp,
            };
            const innerArmor = await encryptRouteCommand(this.wallet, command, routerArmoredPublicKey);
            const pool = this.nodes.filter((n) => n?.domain && !mailboxDomains.has(n.domain));
            if (!pool.length)
                return null;
            const entries = await pickGossipEntryNodesForSend(pool, 4, mailboxDomains);
            const targets = entries.length ? entries : getRandomNodes(pool, Math.min(4, pool.length));
            if (!targets.length)
                return null;
            const results = await Promise.all(targets.map(async (node) => {
                const url = postUrl(node.domain);
                try {
                    const armored = this.cfg?.runtime.outerWrap === false
                        ? innerArmor
                        : await wrapArmorToEntryRoute(innerArmor, node.armoredPublicKey);
                    const res = await postWithTimeout(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(buildPostBody(armored)),
                        referrerPolicy: 'no-referrer',
                    }, 10000);
                    const text = (await res.text()).trim();
                    if (!text)
                        return null;
                    try {
                        return JSON.parse(text);
                    }
                    catch {
                        const m = text.match(/\{[\s\S]*\}/);
                        return m ? JSON.parse(m[0]) : null;
                    }
                }
                catch {
                    return null;
                }
            }));
            for (const r of results) {
                if (r && typeof r === 'object' && r.ok === true) {
                    return { ok: true, online: !!r.online };
                }
            }
            return null;
        }
        catch {
            return null;
        }
    }
    async walletNativeWakeQuery(targetWallet, routerArmoredPublicKey, mailboxDomains) {
        if (!this.wallet)
            return null;
        try {
            const timestamp = Math.floor(Date.now() / 1000);
            const command = {
                command: 'wallet_native_wake_query',
                walletAddress: this.wallet.address,
                targetWallet: ethers.getAddress(targetWallet),
                timestamp,
            };
            const innerArmor = await encryptRouteCommand(this.wallet, command, routerArmoredPublicKey);
            const pool = this.nodes.filter((n) => n?.domain && !mailboxDomains.has(n.domain));
            if (!pool.length)
                return null;
            const entries = await pickGossipEntryNodesForSend(pool, 4, mailboxDomains);
            const targets = entries.length ? entries : getRandomNodes(pool, Math.min(4, pool.length));
            if (!targets.length)
                return null;
            const results = await Promise.all(targets.map(async (node) => {
                const url = postUrl(node.domain);
                try {
                    const armored = this.cfg?.runtime.outerWrap === false
                        ? innerArmor
                        : await wrapArmorToEntryRoute(innerArmor, node.armoredPublicKey);
                    const res = await postWithTimeout(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(buildPostBody(armored)),
                        referrerPolicy: 'no-referrer',
                    }, 10000);
                    const text = (await res.text()).trim();
                    if (!text)
                        return null;
                    try {
                        return JSON.parse(text);
                    }
                    catch {
                        const m = text.match(/\{[\s\S]*\}/);
                        return m ? JSON.parse(m[0]) : null;
                    }
                }
                catch {
                    return null;
                }
            }));
            for (const r of results) {
                if (r && typeof r === 'object' && r.ok === true) {
                    return { ok: true, nativeWakeable: !!r.nativeWakeable };
                }
            }
            return null;
        }
        catch {
            return null;
        }
    }
    /** Encrypt a mailbox command (e.g. gossip_delivery_ack) to route B and POST via entry C ≠ B. */
    async postMailboxCommand(routerArmoredPublicKey, command) {
        if (!this.wallet)
            return false;
        try {
            const innerArmor = await encryptRouteCommand(this.wallet, command, routerArmoredPublicKey);
            const mailboxDomains = new Set(pickRouteNodesByArmoredKey(this.nodes, routerArmoredPublicKey).map((n) => n.domain));
            return this.postToEntries(innerArmor, mailboxDomains);
        }
        catch (ex) {
            this.emit.log('warn', `postMailboxCommand error: ${ex?.message ?? String(ex)}`);
            return false;
        }
    }
    async postOwnMailboxCommand(command) {
        const route = this.cfg?.identity.ownRouteArmoredPublicKey || '';
        if (!route)
            return false;
        return this.postMailboxCommand(route, command);
    }
    async sendVoiceFrame(routerArmoredPublicKey, frame) {
        const command = { command: 'voice_uplink', ...frame, timestamp: Math.floor(Date.now() / 1000) };
        const innerArmor = await encryptOpaqueVoiceCommand(command, routerArmoredPublicKey);
        const mailboxDomains = new Set(pickRouteNodesByArmoredKey(this.nodes, routerArmoredPublicKey).map((n) => n.domain));
        return this.postToEntries(innerArmor, mailboxDomains);
    }
    async startVoiceListen(sessionId, pushWakeup) {
        const wallet = this.wallet;
        if (this.paused || !this.cfg || !wallet || !sessionId) {
            this.emit.log('warn', `voice listen refused early: paused=${this.paused} cfg=${!!this.cfg} wallet=${!!wallet} session=${!!sessionId}`);
            return false;
        }
        this.voiceListenController?.abort('voice_replace');
        const route = this.cfg.identity.ownRouteArmoredPublicKey || '';
        const routeNodes = pickRouteNodesByArmoredKey(this.nodes, route);
        const mailboxDomains = new Set(routeNodes.map((n) => n.domain));
        const pool = this.nodes.filter((n) => !mailboxDomains.has(n.domain));
        const candidates = pool.length ? pool : this.nodes;
        const healthy = await pickHealthyGossipNodes(candidates);
        const entries = healthy.length ? healthy : candidates;
        if (!route || !entries.length) {
            this.emit.log('warn', `voice listen refused: route=${!!route} nodes=${this.nodes.length} entries=${entries.length}`);
            return false;
        }
        let offerArmor = '';
        const offerText = pushWakeup?.offerText?.trim() || '';
        const recipientPgp = pushWakeup?.recipientPgp?.trim() || '';
        if (offerText && recipientPgp) {
            try {
                const signMessage = await wallet.signMessage(offerText);
                const envelope = {
                    timestamp: Date.now(),
                    text: offerText,
                    from: wallet.address,
                    signMessage,
                };
                offerArmor = armorToString(await encrypt({
                    message: await createMessage({ text: utf8ToBase64(JSON.stringify(envelope)) }),
                    encryptionKeys: await readKey({ armoredKey: recipientPgp }),
                    config: { preferredCompressionAlgorithm: enums.compression.zlib },
                }));
            }
            catch (ex) {
                this.emit.log('warn', `voice offer encrypt failed: ${ex?.message ?? String(ex)}`);
                return false;
            }
            if (!offerArmor.includes('-----BEGIN PGP MESSAGE-----') || offerArmor.length > 48000) {
                this.emit.log('warn', 'voice offer armor missing or too large');
                return false;
            }
        }
        const inner = await encryptOpaqueVoiceCommand({
            command: 'voice_listen',
            sessionId,
            timestamp: Math.floor(Date.now() / 1000),
            ...(pushWakeup ? {
                callId: pushWakeup.callId,
                targetWallet: pushWakeup.calleeEoa,
                expiresAt: pushWakeup.expiresAt,
                pushTimestamp: pushWakeup.timestamp,
            } : {}),
            ...(offerArmor ? { offerArmor } : {}),
        }, route);
        const controller = new AbortController();
        this.voiceListenController = controller;
        const node = getRandomNode(entries);
        void (async () => {
            try {
                const armored = this.cfg?.runtime.outerWrap === false ? inner : await wrapArmorToEntryRoute(inner, node.armoredPublicKey);
                const res = await fetch(postUrl(node.domain), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', Connection: 'keep-alive' },
                    body: JSON.stringify(buildPostBody(armored)),
                    signal: controller.signal,
                    cache: 'no-store',
                });
                if (!res.ok || !res.body)
                    throw new Error(`HTTP ${res.status}`);
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                while (!controller.signal.aborted) {
                    const { value, done } = await reader.read();
                    if (done)
                        break;
                    buffer += decoder.decode(value, { stream: true });
                    let idx;
                    while ((idx = buffer.indexOf('\n\n')) >= 0) {
                        const block = buffer.slice(0, idx);
                        buffer = buffer.slice(idx + 2);
                        const payload = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n').trim();
                        if (!payload)
                            continue;
                        try {
                            const frame = JSON.parse(payload);
                            if (frame.type === 'voice_frame_v1')
                                this.emit.voiceFrame(frame);
                        }
                        catch { /* malformed frame */ }
                    }
                }
                await reader.cancel();
            }
            catch (ex) {
                if (!controller.signal.aborted)
                    this.emit.log('warn', `voice SSE failed: ${ex?.message ?? String(ex)}`);
            }
        })();
        return true;
    }
    async stopVoiceListen(sessionId) {
        const route = this.cfg?.identity.ownRouteArmoredPublicKey || '';
        const wallet = this.wallet;
        this.voiceListenController?.abort('voice_stop');
        this.voiceListenController = null;
        if (!route || !wallet)
            return true;
        const innerArmor = await encryptOpaqueVoiceCommand({
            command: 'voice_unlisten',
            sessionId,
            timestamp: Math.floor(Date.now() / 1000),
        }, route);
        return this.postToEntries(innerArmor, new Set(pickRouteNodesByArmoredKey(this.nodes, route).map((n) => n.domain)));
    }
}
//# sourceMappingURL=gossip-core.js.map