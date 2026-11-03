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
import { VOICE_MAX_FRAME_B64, } from '../types.js';
import { getRandomNode, getRandomNodes, markGossipNodeBad, markGossipNodeHealthy, pickGossipEntryNodesForSend, pickHealthyGossipNodes, pickRouteNodesByArmoredKey, isGossipNodeHealthy, startGossipWarm, stopGossipWarm, mailboxDomainsFor, postArmorOneEntryAtATime, postUrl, postWithTimeout, } from '../nodes.js';
import { createMailboxStreamKey, isSealedMailboxFrame, openMailboxStreamFrame } from '../mailbox-stream.js';
import { base64ToUtf8, keccakUtf8, utf8ToBase64 } from '../crypto.js';
import { chatEnvelope } from '../wire.js';
import { GROUP_V1_MAX_MEMBERS, assertGroupRosterV1, classifyGroupPlaintext, createGroupMessageV1, createPaddedGroupDeliveryPacket, groupRosterHash, looksLikeGroupText, normalizeGroupAddress, signGroupObject, } from '../group.js';
import { buildPostBody, encryptOpaqueVoiceCommand, encryptRouteCommand, encryptVoiceChunkLiteral, wrapArmorToEntryRoute, wrapArmorToMailboxWork } from '../envelope.js';
import { VOICE_KIND_AUDIO, VOICE_KIND_CONTROL, VOICE_KIND_VIDEO, aesDecryptV1, aesEncryptV1, base64ToBytes, locatorFromSessionId, openVoiceChunk, sealVoiceChunk, } from '../voice-channel-v2.js';
import { buildVoiceListenV3 } from '../voice-v3.js';
import { postUntilPeerChannel } from '../voice-peer-wait.js';
import { DEFAULT_VIDEO_REORDER_DELAY_MS, DEFAULT_VOICE_REORDER_DELAY_MS, VoiceFrameReorderBuffer, } from '../voice-reorder.js';
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
export function findInboundArmor(value, depth = 0) {
    if (depth > 5)
        return '';
    if (typeof value === 'string') {
        const text = value.trim();
        // Return the armor exactly as the mailbox stored it: the ACK hash is
        // keccak256 of that string, and a trimmed copy (e.g. a voice offer that
        // ends with a newline) never matches, so the mailbox kept replaying it.
        if (/^-----BEGIN PGP MESSAGE-----/i.test(text))
            return value;
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
        /** This listen's mailbox stream key (memory only, never logged). */
        this.listenStreamKey = null;
        this.listenStreamFailures = 0;
        /**
         * Voice protocol v3 call (paid channels): this side's voice and video SSEs on
         * relays it picked, and the peer's two channels it sends to. Incoming
         * chunks are re-keyed to the page's own AES key, so the page code stays as is.
         */
        this.voiceV3 = null;
        /** v3 state after a stop: a reconnect reopens the same channels. */
        this.voiceV3Retained = null;
        this.voiceReorder = new VoiceFrameReorderBuffer({
            // Voice jitter ~120ms; video fragment groups ~200ms. Do not skip_ahead
            // immediately when a later seq arrives first — wait then timeout.
            reorderDelayMs: DEFAULT_VOICE_REORDER_DELAY_MS,
            videoReorderDelayMs: DEFAULT_VIDEO_REORDER_DELAY_MS,
            onEvent: (event) => {
                if (event.type === 'frame')
                    this.emit.voiceFrame(event.frame);
                if (event.type === 'gap')
                    this.emit.voiceGap(event.gap);
                if (event.type === 'conflict')
                    this.emit.voiceConflict(event.conflict);
            },
        });
        this.lastActivityAt = 0;
        this.paused = false;
        this.pgpReady = Promise.resolve();
        this.ackContext = null;
    }
    async init(payload) {
        this.cfg = payload;
        this.nodes = payload.nodes || [];
        this.routes = payload.routes || [];
        const pkHex = payload.identity.privateKeyHex.startsWith('0x')
            ? payload.identity.privateKeyHex
            : `0x${payload.identity.privateKeyHex}`;
        this.wallet = new ethers.Wallet(pkHex);
        this.paused = false;
        // Keep entries warm while the worker runs, so picks return at once.
        startGossipWarm(() => this.nodes);
        // Unlocking the PGP key can take longer than the client init budget.
        // Returning here lets the worker stay alive; voice listen waits for
        // the same promise instead of being told the relay could not open.
        this.emit.log('info', 'chat worker accepted init');
        this.pgpReady = this.openPgpAndListen(payload);
        void this.pgpReady;
    }
    async openPgpAndListen(payload) {
        this.emit.log('info', `chat worker init pgpArmor=${payload.identity.pgpPrivateKeyArmored.length} passphrase=${payload.identity.pgpPassphrase ? 'set' : 'empty'}`);
        const pk = await Promise.race([
            readPrivateKey({ armoredKey: payload.identity.pgpPrivateKeyArmored }),
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error('pgp key open timed out')), 20000);
            }),
        ]);
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
        if (!this.paused)
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
        stopGossipWarm();
        this.clearListen('background_pause');
        this.parkVoiceV3();
        this.voiceReorder.clear();
        this.lastActivityAt = 0;
        this.emit.status('paused');
    }
    resume() {
        if (!this.paused && this.listenController && !this.listenController.signal.aborted)
            return;
        this.paused = false;
        startGossipWarm(() => this.nodes);
        void this.startListen();
    }
    destroy() {
        stopGossipWarm();
        this.clearListen('destroy');
        this.parkVoiceV3();
        this.voiceV3Retained = null;
        this.voiceReorder.clear();
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
            // Fresh stream key per listen: B seals every frame with it, so the
            // entry relaying the SSE cannot read the recipient key ID.
            const streamKey = await createMailboxStreamKey();
            const innerArmor = await encryptRouteCommand(this.wallet, {
                command: 'mailbox_listen',
                walletAddress: this.wallet.address,
                instanceId,
                streamKey: streamKey.base64,
            }, ownRouteKey);
            this.listenStreamKey = streamKey.key;
            this.listenStreamFailures = 0;
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
        /** Mailbox B spoke on this stream (a frame opened with the stream key). */
        let heardMailbox = false;
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
            if (heardMailbox) {
                // B registered this listen under its instanceId. Reusing the same
                // command on another entry lets the old socket's late close remove the
                // new session at B: open a new listen (new instanceId and stream key).
                this.emit.log('info', `listen dropped after B answered (reason=${reason || 'stream_end'}); new listen`);
                if (this.listenController?.signal === rootSignal) {
                    this.listenController.abort('relisten');
                    this.listenController = null;
                }
                setTimeout(() => void this.startListen(), 500);
                return;
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
                // HTTP 200 only means entry C took the request. 'listening' is reported
                // when mailbox B's sealed handshake frame arrives (handleInbound).
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
                        const frame = await this.openListenFrame(payload);
                        if (!frame)
                            continue;
                        heardMailbox = true;
                        await this.handleInbound(frame, node.domain, rootSignal);
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
    /**
     * Open one mailbox SSE frame with this listen's stream key. Every mailbox
     * seals every frame; anything else (plain JSON, a frame that does not open)
     * is dropped. Contents are never logged.
     */
    async openListenFrame(payload) {
        const key = this.listenStreamKey;
        const opened = key && isSealedMailboxFrame(payload) ? await openMailboxStreamFrame(key, payload) : null;
        if (opened === null) {
            this.listenStreamFailures++;
            this.emit.log('warn', `mailbox frame did not open (${this.listenStreamFailures})`);
            return null;
        }
        this.listenStreamFailures = 0;
        return opened;
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
        // Mailbox B's first frame: `{status:200, kind:'mailbox', instanceId, nodeWallet, …}`.
        if (data?.kind === 'mailbox') {
            this.lastActivityAt = Date.now();
            this.emit.status('listening', 'handshake');
            return;
        }
        try {
            if (data?.type === 'voice_frame_v1') {
                const frame = typeof data.frameTimestamp === 'number' ? { ...data, timestamp: data.frameTimestamp } : data;
                this.voiceReorder.push(frame);
                return;
            }
            // Mailbox relays can add several JSON envelopes. Walk only a bounded
            // set of wrapper keys; never log or forward the plaintext/ciphertext.
            const armored = findInboundArmor(data ?? trimmedRaw);
            if (armored && /^-----BEGIN PGP MESSAGE-----/i.test(armored.trimStart())) {
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
                this.emit.log('info', `inbound PGP decrypted chars=${kkk.length} json=${kkk.trim().startsWith('{')} voiceOffer=${kkk.includes('voice_call_offer_v1')}`);
                if (this.tryConsumeGroupInbound(kkk))
                    return;
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
                const plainLine = JSON.stringify(data);
                if (this.tryConsumeGroupInbound(plainLine))
                    return;
                this.emit.message(plainLine, undefined, true, viaDomain);
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
        const message = chatEnvelope({ timestamp: Date.now(), text, from: this.wallet.address, signMessage });
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
        // Always wrap to the recipient's mailbox B: the entry then sees only B's
        // route key ID, never the recipient's key ID. No route, no send.
        const mailboxKey = to.routerArmoredPublicKey?.trim();
        if (!mailboxKey) {
            this.emit.log('error', 'send: recipient mailbox unknown (routerArmoredPublicKey); not sent');
            return false;
        }
        try {
            innerArmor = await wrapArmorToMailboxWork(innerArmor, mailboxKey, opts?.beamioNoPush ? { NoPush: true } : undefined);
        }
        catch (ex) {
            this.emit.log('error', `send mailbox wrap error: ${ex?.message ?? String(ex)}`);
            return false;
        }
        const mailboxDomains = new Set(pickRouteNodesByArmoredKey(this.nodes, mailboxKey).map((n) => n.domain));
        return this.postToEntries(innerArmor, mailboxDomains);
    }
    /**
     * V1 group send: one user-PGP armor per recipient. Never build a
     * multi-recipient OpenPGP message — its key-id list would reveal membership.
     */
    async sendGroup(request) {
        if (!this.wallet)
            throw new Error('not initialised');
        if (request.maxMembers != null && request.maxMembers !== GROUP_V1_MAX_MEMBERS) {
            throw new Error('V1 group membership limit is fixed at 10');
        }
        assertGroupRosterV1(request.roster, GROUP_V1_MAX_MEMBERS);
        if (request.roster.expiresAt <= Date.now())
            throw new Error('group roster has expired');
        const sender = normalizeGroupAddress(this.wallet.address);
        if (!request.roster.members.some((member) => normalizeGroupAddress(member.eoa) === sender)) {
            throw new Error('group sender is not an active member');
        }
        const now = Date.now();
        if (request.expiresAt <= now || request.expiresAt > now + 24 * 60 * 60 * 1000) {
            throw new Error('group message expiry must be within 24 hours');
        }
        const sendId = request.sendId || `${now}-${Math.random().toString(36).slice(2, 10)}`;
        const message = await createGroupMessageV1(this.wallet, {
            groupId: request.roster.groupId,
            rosterHash: groupRosterHash(request.roster),
            sendId,
            seq: request.seq,
            createdAt: now,
            expiresAt: request.expiresAt,
            body: request.body,
        });
        const plaintext = JSON.stringify(createPaddedGroupDeliveryPacket(message, request.paddingBucketBytes));
        const counts = await this.fanOutGroupPlaintext(request.roster, plaintext, request.routes, request.maxConcurrency);
        this.emit.log('info', `group send completed: accepted=${counts.acceptedRecipients} failed=${counts.failedRecipients}`);
        return { sendId, message, ...counts };
    }
    async issueGroupRoster(request) {
        if (!this.wallet)
            throw new Error('not initialised');
        const owner = normalizeGroupAddress(this.wallet.address);
        const previous = request.previous ?? null;
        if (previous)
            assertGroupRosterV1(previous);
        const wanted = (previous ? request.nextMemberEoas ?? previous.members.map((member) => member.eoa) : request.memberEoas)
            .map((eoa) => normalizeGroupAddress(eoa));
        if (!wanted.includes(owner))
            wanted.unshift(owner);
        const unique = [...new Set(wanted)];
        if (unique.length < 1 || unique.length > GROUP_V1_MAX_MEMBERS)
            throw new Error('unsupported group member count');
        const routes = this.routeMap(request.routes);
        const ownArmor = this.cfg?.identity.pgpPublicKeyArmored?.trim();
        if (!ownArmor)
            throw new Error('group owner PGP public key unavailable');
        const members = [];
        for (const eoa of unique) {
            const prior = previous?.members.find((member) => normalizeGroupAddress(member.eoa) === eoa);
            const armored = eoa === owner ? ownArmor : routes.get(eoa)?.userPublicKeyArmored?.trim();
            if (!armored)
                throw new Error('missing encrypted route for one or more group members');
            const key = await readKey({ armoredKey: armored });
            members.push({
                eoa,
                pgpFingerprint: key.getFingerprint().toLowerCase(),
                keyEpoch: prior?.keyEpoch ?? 0,
            });
        }
        const admins = (previous ? request.nextAdmins ?? previous.policy.admins : []).map((admin) => normalizeGroupAddress(admin));
        const now = Date.now();
        const roster = await signGroupObject(this.wallet, 'group roster', {
            type: 'conet_group_roster_v1',
            groupId: previous?.groupId || request.groupId || crypto.randomUUID(),
            version: previous ? previous.version + 1 : 1,
            prevRosterHash: previous ? groupRosterHash(previous) : null,
            issuedAt: now,
            expiresAt: request.expiresAt,
            policy: {
                name: (previous && request.name.trim() === '' ? previous.policy.name : request.name).trim(),
                owner,
                admins,
            },
            members,
        });
        assertGroupRosterV1(roster);
        const counts = await this.fanOutGroupPlaintext(roster, JSON.stringify(roster), request.routes);
        this.emit.log('info', `group roster issued: accepted=${counts.acceptedRecipients} failed=${counts.failedRecipients}`);
        return { roster, ...counts };
    }
    async issueGroupTombstone(request) {
        if (!this.wallet)
            throw new Error('not initialised');
        assertGroupRosterV1(request.roster);
        if (normalizeGroupAddress(request.roster.policy.owner) !== normalizeGroupAddress(this.wallet.address)) {
            throw new Error('only the group owner may issue a tombstone');
        }
        const tombstone = await signGroupObject(this.wallet, 'group tombstone', {
            type: 'conet_group_tombstone_v1',
            groupId: request.roster.groupId,
            removedAtVersion: request.roster.version + 1,
            previousRosterHash: groupRosterHash(request.roster),
            issuedAt: Date.now(),
        });
        const counts = await this.fanOutGroupPlaintext(request.roster, JSON.stringify(tombstone), request.routes);
        this.emit.log('info', `group tombstone issued: accepted=${counts.acceptedRecipients} failed=${counts.failedRecipients}`);
        return { tombstone, ...counts };
    }
    routeMap(extra) {
        const map = new Map();
        for (const route of [...this.routes, ...(extra ?? [])]) {
            if (route?.address && ethers.isAddress(route.address))
                map.set(normalizeGroupAddress(route.address), route);
        }
        return map;
    }
    async fanOutGroupPlaintext(roster, plaintext, routes, maxConcurrency = 2) {
        if (!this.wallet)
            throw new Error('not initialised');
        const sender = normalizeGroupAddress(this.wallet.address);
        const routeByAddress = this.routeMap(routes);
        const recipients = roster.members
            .filter((member) => normalizeGroupAddress(member.eoa) !== sender)
            .map((member) => ({ member, route: routeByAddress.get(normalizeGroupAddress(member.eoa)) }));
        if (recipients.some(({ route }) => !route?.userPublicKeyArmored)) {
            throw new Error('missing encrypted route for one or more group members');
        }
        const concurrency = Math.min(4, Math.max(1, maxConcurrency));
        let acceptedRecipients = 0;
        let failedRecipients = 0;
        let next = 0;
        const sendOne = async () => {
            while (next < recipients.length) {
                const current = recipients[next++];
                await new Promise((resolve) => setTimeout(resolve, 60 + Math.floor(Math.random() * 141)));
                try {
                    const ok = await this.sendSingleRecipientGroupDelivery(current.member.pgpFingerprint, current.route, plaintext);
                    if (ok)
                        acceptedRecipients += 1;
                    else
                        failedRecipients += 1;
                }
                catch {
                    failedRecipients += 1;
                }
            }
        };
        if (recipients.length) {
            await Promise.all(Array.from({ length: Math.min(concurrency, recipients.length) }, () => sendOne()));
        }
        return { acceptedRecipients, failedRecipients };
    }
    async sendSingleRecipientGroupDelivery(expectedFingerprint, to, payload) {
        if (!this.wallet)
            throw new Error('not initialised');
        const pgpPublic = to.userPublicKeyArmored?.trim();
        const routeKey = to.routerArmoredPublicKey?.trim();
        if (!pgpPublic)
            throw new Error('group recipient user PGP key unavailable');
        if (!routeKey)
            throw new Error('group recipient mailbox route unavailable');
        const key = await readKey({ armoredKey: pgpPublic });
        if (key.getFingerprint().toLowerCase() !== expectedFingerprint.toLowerCase()) {
            throw new Error('group recipient PGP key no longer matches the active roster');
        }
        const signMessage = await this.wallet.signMessage(payload);
        const envelope = { timestamp: Date.now(), text: payload, from: this.wallet.address, signMessage };
        const userArmor = await encrypt({
            message: await createMessage({ text: utf8ToBase64(JSON.stringify(envelope)) }),
            encryptionKeys: key,
            config: { preferredCompressionAlgorithm: enums.compression.uncompressed },
        });
        // Wrapped to the member's mailbox: the entry never sees the member's key ID.
        const innerArmor = await wrapArmorToMailboxWork(userArmor, routeKey);
        const mailboxDomains = new Set(pickRouteNodesByArmoredKey(this.nodes, routeKey).map((n) => n.domain));
        return this.postToEntries(innerArmor, mailboxDomains);
    }
    /** Drop group objects out of the 1:1 message stream after the outer EIP-191 check. */
    tryConsumeGroupInbound(line) {
        let env;
        try {
            env = JSON.parse(line);
        }
        catch {
            return false;
        }
        const text = typeof env.text === 'string' ? env.text : '';
        const signMessage = typeof env.signMessage === 'string' ? env.signMessage : '';
        const from = typeof env.from === 'string' ? env.from : '';
        if (!text || !signMessage || !from || !looksLikeGroupText(text))
            return false;
        let recovered = '';
        try {
            recovered = normalizeGroupAddress(ethers.verifyMessage(text, signMessage));
        }
        catch {
            this.emit.log('warn', 'group inbound rejected: outer signature');
            return true;
        }
        if (!ethers.isAddress(from) || recovered !== normalizeGroupAddress(from)) {
            this.emit.log('warn', 'group inbound rejected: signer mismatch');
            return true;
        }
        let parsed;
        try {
            parsed = classifyGroupPlaintext(text);
        }
        catch {
            this.emit.log('warn', 'group inbound rejected: malformed object');
            return true;
        }
        if (!parsed || !ethers.isAddress(parsed.signer) || normalizeGroupAddress(parsed.signer) !== recovered) {
            this.emit.log('warn', 'group inbound rejected: object signer');
            return true;
        }
        const payload = {
            kind: parsed.kind,
            recoveredFrom: recovered,
            receivedAt: Date.now(),
        };
        if (parsed.kind === 'roster')
            payload.roster = parsed.roster;
        if (parsed.kind === 'proposal')
            payload.proposal = parsed.proposal;
        if (parsed.kind === 'tombstone')
            payload.tombstone = parsed.tombstone;
        if (parsed.kind === 'message')
            payload.message = parsed.message;
        this.emit.group(payload);
        return true;
    }
    /**
     * POST armor through one entry at a time (never the same ciphertext to
     * several entries at once); the next entry only after a clear failure.
     * Voice/video frames pass `{ fanout: 1 }`: at most two entries.
     */
    async postToEntries(innerArmor, recipientMailboxDomains, options) {
        // Rule 19: never the recipient's mailbox, never our own mailbox.
        const exclude = new Set([
            ...recipientMailboxDomains,
            ...mailboxDomainsFor(this.nodes, this.cfg?.identity.ownRouteArmoredPublicKey),
        ]);
        const result = await postArmorOneEntryAtATime({
            nodes: this.nodes,
            exclude,
            maxAttempts: (options?.fanout ?? 2) <= 1 ? 2 : undefined,
            buildBody: async (node) => {
                const armored = this.cfg?.runtime.outerWrap === false
                    ? innerArmor
                    : await wrapArmorToEntryRoute(innerArmor, node.armoredPublicKey);
                return JSON.stringify(buildPostBody(armored));
            },
        });
        if (!result.ok)
            this.emit.log('warn', `post failed after ${result.attempts} entr${result.attempts === 1 ? 'y' : 'ies'}`);
        return result.ok;
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
    /**
     * The only way an offer travels: `voice_offer_store` with `push: 1` to the
     * callee mailbox. The command is opaque (sessionId is the capability),
     * encrypted to the callee mailbox route key and posted through an entry that
     * is neither mailbox. That mailbox stores the offer, writes it to the callee's
     * live sessions and rings the callee (found from the offer's recipient key
     * ID). It never decrypts `offerArmor`; it is callee user-PGP ciphertext.
     */
    async sendVoiceOffer(args) {
        try {
            const inner = await encryptOpaqueVoiceCommand({
                command: 'voice_offer_store',
                callId: args.callId,
                sessionId: args.sessionId,
                offerArmor: args.offerArmor,
                expiresAt: args.expiresAt,
                push: 1,
                pushTimestamp: args.pushTimestamp,
                timestamp: Math.floor(Date.now() / 1000),
            }, args.calleeRoute);
            if (!inner.includes('-----BEGIN PGP MESSAGE-----'))
                return { ok: false, pushed: false };
            const mailboxDomains = new Set([
                ...pickRouteNodesByArmoredKey(this.nodes, args.calleeRoute).map((n) => n.domain),
                ...mailboxDomainsFor(this.nodes, this.cfg?.identity.ownRouteArmoredPublicKey),
            ]);
            const result = await this.postVoiceCommandForJson(inner, mailboxDomains);
            const ok = result?.ok === true;
            const pushed = result?.pushed === true;
            this.emit.log(ok ? 'info' : 'warn', `voice offer ${ok ? 'stored' : 'failed'} delivered=${result?.delivered === true} pushed=${pushed} callId=${args.callId.slice(0, 8)}`);
            return { ok, pushed };
        }
        catch (ex) {
            this.emit.log('warn', `voice offer error: ${ex?.message ?? String(ex)}`);
            return { ok: false, pushed: false };
        }
    }
    /** One voice command through up to two entries; the node's JSON answer or null. */
    async postVoiceCommandForJson(innerArmor, excludeDomains) {
        const tried = new Set(excludeDomains);
        for (let wave = 0; wave < 2; wave++) {
            const [node] = await pickGossipEntryNodesForSend(this.nodes, 1, tried);
            if (!node)
                return null;
            tried.add(node.domain);
            try {
                const armored = this.cfg?.runtime.outerWrap === false
                    ? innerArmor
                    : await wrapArmorToEntryRoute(innerArmor, node.armoredPublicKey);
                const res = await postWithTimeout(postUrl(node.domain), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(buildPostBody(armored)),
                    referrerPolicy: 'no-referrer',
                }, 12000);
                if (!res.ok) {
                    markGossipNodeBad(node.domain);
                    continue;
                }
                markGossipNodeHealthy(node.domain);
                const text = (await res.text()).trim();
                try {
                    return JSON.parse(text.slice(text.indexOf('{')));
                }
                catch {
                    return { ok: true };
                }
            }
            catch {
                markGossipNodeBad(node.domain);
            }
        }
        return null;
    }
    async sendVoiceFrame(_routerArmoredPublicKey, frame) {
        const candidate = frame;
        if (typeof candidate.callId !== 'string' || !candidate.callId ||
            !Number.isSafeInteger(candidate.seq) || candidate.seq < 0 ||
            typeof candidate.payload !== 'string' || !candidate.payload ||
            candidate.payload.length > VOICE_MAX_FRAME_B64) {
            this.emit.log('warn', `sendVoiceFrame rejected: callId=${!!candidate.callId} seq=${candidate.seq} payload=${typeof candidate.payload === 'string' ? candidate.payload.length : 0}`);
            return false;
        }
        // v3 only: every frame is a metadata-free chunk on the peer's paid channel.
        // Sending needs only the peer's channel, so a call whose own listens are
        // being reopened (parked by a reconnect) still sends.
        const st = this.voiceV3ForCall(candidate.callId);
        if (!st) {
            this.emit.log('warn', 'sendVoiceFrame: no v3 call for this frame');
            return false;
        }
        try {
            const plain = await aesDecryptV1(st.uiKey, candidate.payload);
            const video = candidate.mediaKind === 'video';
            const target = video ? st.peer.video : st.peer.voice;
            // The callee learns the caller's relays from voice_channel_ready_v3.
            // Until then there is nowhere to send: not accepted (the page's link
            // watchdog counts only accepted frames), and the page keeps going.
            if (!target.relay)
                return false;
            const kind = video ? VOICE_KIND_VIDEO : parseVoiceControl(plain) ? VOICE_KIND_CONTROL : VOICE_KIND_AUDIO;
            const ok = await this.postVoiceV3Chunk(st, target, kind, candidate.seq, plain);
            return ok;
        }
        catch (ex) {
            this.emit.log('warn', `voice v3 send error: ${ex?.message ?? String(ex)}`);
            return false;
        }
    }
    /** The live call, or one parked by a reconnect, with this callId. */
    voiceV3ForCall(callId) {
        const live = this.voiceV3;
        if (live && !live.stopped && live.cfg.callId === callId)
            return live;
        const parked = this.voiceV3Retained;
        if (parked && parked.cfg.callId === callId)
            return parked;
        return null;
    }
    /** Seal one chunk for a peer channel and post it through one entry. Resolves true only when the relay accepted it. */
    async postVoiceV3Chunk(st, target, kind, seq, plain) {
        const relay = target.relay;
        if (!relay)
            return false;
        const literal = await sealVoiceChunk({
            sessionKey: target.key,
            locator: target.locator,
            writeKey: target.wk,
            kind,
            seq,
            captureMs: Date.now(),
            data: plain,
        });
        const inner = await encryptVoiceChunkLiteral(literal, relay.armoredPublicKey);
        const exclude = new Set([relay.domain, ...st.avoidDomains]);
        // Before the first accepted chunk a missing channel means the caller's listen is
        // still opening (it announces its relays first): post the chunk again.
        const result = await postUntilPeerChannel({
            seenBefore: st.txOk > 0,
            post: () => this.postVoiceChunk(inner, exclude),
            sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
            now: () => Date.now(),
            alive: () => this.voiceV3ForCall(st.cfg.callId) === st,
        });
        if (result.ok) {
            if (result.tries > 1 && st.txOk === 0)
                this.emit.log('info', `voice v3 peer channel up after tries=${result.tries}`);
            if (++st.txOk === 1)
                this.emit.log('info', 'voice v3 first chunk accepted');
            st.miss = 0;
            return true;
        }
        if (result.error === 'target_voice_session_not_found') {
            // The peer's channel is reconnecting (or gone). The frame is lost, the call
            // is not; it is reported as not accepted, so the page's 25 s watchdog
            // still ends a call whose peer stays gone.
            if (++st.miss === 1 || st.miss % 50 === 0)
                this.emit.log('warn', `voice v3 peer channel missing x${st.miss}`);
            return false;
        }
        this.emit.log('warn', `voice v3 chunk refused ${result.error ?? ''}`);
        return false;
    }
    /**
     * One entry POST for a v2 chunk (a second entry only on a network failure).
     * Reads the node's JSON so a refused chunk can fall back to v1.
     */
    async postVoiceChunk(innerArmor, excludeDomains) {
        const tried = new Set(excludeDomains);
        for (let wave = 0; wave < 2; wave++) {
            const [node] = await pickGossipEntryNodesForSend(this.nodes, 1, tried);
            if (!node)
                return { ok: false, error: 'no_entry' };
            tried.add(node.domain);
            try {
                const armored = this.cfg?.runtime.outerWrap === false
                    ? innerArmor
                    : await wrapArmorToEntryRoute(innerArmor, node.armoredPublicKey);
                const res = await postWithTimeout(postUrl(node.domain), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(buildPostBody(armored)),
                    referrerPolicy: 'no-referrer',
                }, 12000);
                if (!res.ok) {
                    markGossipNodeBad(node.domain);
                    continue;
                }
                markGossipNodeHealthy(node.domain);
                const text = (await res.text()).trim();
                try {
                    const body = JSON.parse(text.slice(text.indexOf('{')));
                    return body.ok === false ? { ok: false, error: body.error || 'refused' } : { ok: true };
                }
                catch {
                    return { ok: true };
                }
            }
            catch {
                markGossipNodeBad(node.domain);
            }
        }
        return { ok: false, error: 'network' };
    }
    /** A chunk on one of our own channels → the ordinary frame the page handles. */
    async handleVoiceV3Chunk(st, which, blobB64) {
        if (st !== this.voiceV3 || !blobB64)
            return;
        const own = st.own[which];
        try {
            const opened = await openVoiceChunk(own.key, own.locator, base64ToBytes(blobB64));
            if (++st.rx === 1)
                this.emit.log('info', `voice v3 first chunk rx ${which} kind=${opened.kind}`);
            if (opened.kind === VOICE_KIND_CONTROL) {
                const control = parseVoiceControl(opened.data);
                if (control?.type === 'voice_channel_ready_v3') {
                    this.applyPeerVoiceRelays(st, control);
                    return;
                }
            }
            this.voiceReorder.push({
                type: 'voice_frame_v1',
                callId: st.cfg.callId,
                sessionId: st.peer.voice.sid,
                seq: opened.seq,
                timestamp: opened.captureMs,
                payload: await aesEncryptV1(st.uiKey, opened.data),
                ...(opened.kind === VOICE_KIND_VIDEO ? { mediaKind: 'video' } : {}),
            });
        }
        catch (ex) {
            this.emit.log('warn', `voice v3 chunk open failed (${which}): ${ex?.message ?? String(ex)}`);
        }
    }
    /** The peer reports (or moves) the relays of its two channels. */
    applyPeerVoiceRelays(st, control) {
        if (String(control.callId || '') !== st.cfg.callId)
            return;
        const firstVoice = !st.peer.voice.relay;
        for (const which of ['voice', 'video']) {
            const node = this.voiceRelayNode(String(control[which] || ''), String(control[`${which}Ip`] || ''), String(control[`${which}Key`] || ''));
            if (node && !st.avoidDomains.has(node.domain))
                st.peer[which].relay = node;
        }
        this.emit.log('info', `voice v3 peer relays voice=${!!st.peer.voice.relay} video=${!!st.peer.video.relay}`);
        // Our own relays moved before the peer could hear about it: tell it now.
        if (firstVoice && st.peer.voice.relay && !st.relaysAnnounced)
            void this.sendVoiceChannelReady(st);
    }
    voiceNodeByDomain(domain) {
        const want = domain.trim().toUpperCase();
        if (!want)
            return null;
        return this.nodes.find((n) => String(n.domain || '').toUpperCase() === want) ?? null;
    }
    /** A relay from our node table, else from the armored key the peer sent. */
    voiceRelayNode(domain, ip, keyB64) {
        const known = this.voiceNodeByDomain(domain);
        if (known)
            return known;
        if (!domain.trim() || !keyB64)
            return null;
        try {
            const armor = base64ToUtf8(keyB64);
            if (!armor.includes('BEGIN PGP PUBLIC KEY'))
                return null;
            return { region: '', ip_addr: ip, armoredPublicKey: armor, nftNumber: 0, domain: domain.trim().toUpperCase() };
        }
        catch {
            return null;
        }
    }
    /** A random relay outside both mailboxes and outside `skip`. */
    pickVoiceRelay(avoid, skip = []) {
        const pool = this.nodes.filter((n) => n.domain && n.armoredPublicKey && !avoid.has(n.domain) && !skip.includes(n.domain));
        // Prefer a relay that answered a warm-up probe lately (alive now); still random.
        const warm = pool.filter((n) => isGossipNodeHealthy(n.domain));
        const from = warm.length ? warm : pool;
        return from.length ? from[Math.floor(Math.random() * from.length)] : null;
    }
    buildVoiceV3State(call) {
        const avoidDomains = new Set();
        for (const route of call.avoidRoutes || []) {
            for (const n of pickRouteNodesByArmoredKey(this.nodes, route))
                if (n.domain)
                    avoidDomains.add(n.domain);
        }
        for (const d of mailboxDomainsFor(this.nodes, this.cfg?.identity.ownRouteArmoredPublicKey))
            avoidDomains.add(d);
        const chan = (c) => {
            const locator = locatorFromSessionId(c.sid);
            try {
                const key = base64ToBytes(c.key);
                const wk = base64ToBytes(c.wk);
                if (!locator || key.length !== 32 || wk.length !== 32)
                    return null;
                return { sid: c.sid, locator, key, wk };
            }
            catch {
                return null;
            }
        };
        const own = {};
        const peer = {};
        for (const which of ['voice', 'video']) {
            const o = chan(call.own[which]);
            const p = chan(call.peer[which]);
            const relay = this.voiceNodeByDomain(call.own[which].relay || '') ?? this.pickVoiceRelay(avoidDomains);
            if (!o || !p || !relay) {
                this.emit.log('warn', `voice v3 config refused (${which}) own=${!!o} peer=${!!p} relay=${!!relay}`);
                return null;
            }
            own[which] = { ...o, wire: call.own[which], relay, controller: null, ready: false, reopenTimer: null, reopenAttempt: 0 };
            const peerRelay = this.voiceRelayNode(call.peer[which].relay || '', call.peer[which].relayIp || '', call.peer[which].relayKey || '');
            peer[which] = { ...p, relay: peerRelay && !avoidDomains.has(peerRelay.domain) ? peerRelay : null };
        }
        let uiKey;
        try {
            uiKey = base64ToBytes(call.uiKey);
        }
        catch {
            return null;
        }
        if (uiKey.length !== 32)
            return null;
        return {
            cfg: call, uiKey, avoidDomains, own, peer,
            relaysAnnounced: call.role === 'callee',
            announcing: false, txOk: 0, rx: 0, miss: 0, stopped: false,
        };
    }
    /**
     * Voice protocol v3: open this side's two paid channels (voice, video). With
     * `call` a new call starts; without it, `sessionId` must be the own voice
     * channel of the current or last call (reconnect). Resolves once the voice
     * channel's relay answers; the video channel opens beside it (pre-warmed).
     */
    async startVoiceListen(sessionId, call) {
        if (this.paused || !this.cfg || !sessionId) {
            this.emit.log('warn', `voice listen refused early: paused=${this.paused} cfg=${!!this.cfg} session=${!!sessionId}`);
            return false;
        }
        let st = null;
        const known = [this.voiceV3, this.voiceV3Retained].find((v) => v?.own.voice.sid === sessionId) ?? null;
        if (known)
            st = known;
        else if (call)
            st = this.buildVoiceV3State(call);
        if (!st || st.own.voice.sid !== sessionId) {
            this.emit.log('warn', 'voice listen refused: no v3 call for this session');
            return false;
        }
        if (this.voiceV3 && this.voiceV3 !== st)
            this.abortVoiceV3(this.voiceV3);
        this.voiceV3Retained = null;
        this.voiceV3 = st;
        st.stopped = false;
        this.voiceReorder.clear();
        const opening = Promise.all([
            this.openVoiceV3Channel(st, 'voice'),
            this.openVoiceV3Channel(st, 'video'),
        ]);
        // Caller: our relays are chosen; tell the callee now, beside the listens. Its
        // chunks that arrive before our channel exists are posted again (voice-peer-wait).
        if (st.cfg.role === 'caller' && !st.relaysAnnounced)
            void this.sendVoiceChannelReady(st);
        const [voiceOk, videoOk] = await opening;
        this.emit.log(voiceOk ? 'info' : 'warn', `voice v3 listen role=${st.cfg.role} voice=${voiceOk} video=${videoOk}`);
        if (voiceOk && !st.relaysAnnounced)
            void this.sendVoiceChannelReady(st);
        return voiceOk && this.voiceV3 === st;
    }
    /**
     * One own channel: `voice_listen` v3 to its relay through an entry that is
     * neither the relay nor a mailbox. A relay that refuses or never answers is
     * replaced by another random relay (twice at most); the peer is told.
     */
    async openVoiceV3Channel(st, which, attempt = 0) {
        const own = st.own[which];
        own.controller?.abort('voice_replace');
        own.ready = false;
        if (own.reopenTimer) {
            clearTimeout(own.reopenTimer);
            own.reopenTimer = null;
        }
        const relay = own.relay;
        let inner;
        try {
            inner = await encryptOpaqueVoiceCommand(await buildVoiceListenV3(own.wire, relay.domain), relay.armoredPublicKey);
        }
        catch (ex) {
            this.emit.log('warn', `voice v3 listen build failed: ${ex?.message ?? String(ex)}`);
            return false;
        }
        if (st.stopped || st !== this.voiceV3)
            return false;
        const exclude = new Set([relay.domain, ...st.avoidDomains]);
        const pool = this.nodes.filter((n) => !exclude.has(n.domain));
        const healthy = await pickHealthyGossipNodes(pool);
        const entry = getRandomNode(healthy.length ? healthy : pool);
        if (!entry)
            return false;
        const controller = new AbortController();
        own.controller = controller;
        const outcome = await this.runVoiceV3Sse(st, which, entry, inner, controller);
        if (outcome === 'ready') {
            own.ready = true;
            own.reopenAttempt = 0;
            return true;
        }
        if (st.stopped || st !== this.voiceV3 || controller.signal.aborted)
            return false;
        if (outcome === 'session_conflict' && attempt === 0) {
            // The relay still holds our last SSE: close it, then reopen the same session.
            await this.unlistenVoiceV3Channel(st, which);
            return this.openVoiceV3Channel(st, which, attempt + 1);
        }
        if (attempt >= 2)
            return false;
        const next = this.pickVoiceRelay(st.avoidDomains, [relay.domain]);
        if (!next)
            return false;
        this.emit.log('warn', `voice v3 ${which} relay failed (${outcome}); another relay`);
        own.relay = next;
        const ok = await this.openVoiceV3Channel(st, which, attempt + 1);
        if (ok && st.relaysAnnounced) {
            st.relaysAnnounced = false;
            void this.sendVoiceChannelReady(st);
        }
        return ok;
    }
    /**
     * Runs one SSE until it closes. Resolves at the relay's first answer:
     * `ready`, a refusal error from the relay, or `failed`.
     */
    runVoiceV3Sse(st, which, entry, inner, controller) {
        const sessionId = st.own[which].sid;
        return new Promise((resolve) => {
            let settled = false;
            const settle = (v) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                resolve(v);
            };
            const timer = setTimeout(() => settle('timeout'), 12000);
            controller.signal.addEventListener('abort', () => settle('aborted'), { once: true });
            void (async () => {
                let opened = false;
                try {
                    const armored = this.cfg?.runtime.outerWrap === false ? inner : await wrapArmorToEntryRoute(inner, entry.armoredPublicKey);
                    const res = await fetch(postUrl(entry.domain), {
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
                    const takeBlock = () => {
                        const crlf = buffer.indexOf('\r\n\r\n');
                        const lf = buffer.indexOf('\n\n');
                        if (crlf < 0 && lf < 0)
                            return null;
                        const cut = crlf >= 0 && (lf < 0 || crlf <= lf) ? crlf : lf;
                        const block = buffer.slice(0, cut);
                        buffer = buffer.slice(cut + (cut === crlf ? 4 : 2));
                        return block;
                    };
                    while (!controller.signal.aborted) {
                        const { value, done } = await reader.read();
                        if (done)
                            break;
                        buffer += decoder.decode(value, { stream: true });
                        let block;
                        while ((block = takeBlock()) !== null) {
                            const payload = block.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n').trim();
                            if (!payload)
                                continue;
                            try {
                                const frame = JSON.parse(payload);
                                if (frame.t === 'c' && typeof frame.d === 'string') {
                                    void this.handleVoiceV3Chunk(st, which, frame.d);
                                }
                                else if (frame.type === 'voice_ready' && frame.ok === true && String(frame.sessionId || '') === sessionId) {
                                    if (Number(frame.listen) !== 3) {
                                        this.emit.log('warn', `voice v3 ${which} relay is not v3`);
                                        settle('not_v3');
                                        controller.abort('voice_not_v3');
                                        break;
                                    }
                                    opened = true;
                                    this.emit.log('info', `voice v3 ${which} ready`);
                                    settle('ready');
                                }
                            }
                            catch { /* malformed frame */ }
                        }
                    }
                    // A refusal is a plain JSON body, not an SSE event.
                    if (!opened) {
                        const rest = buffer.trim();
                        try {
                            const body = JSON.parse(rest.slice(rest.indexOf('{')));
                            if (body.ok === false) {
                                this.emit.log('warn', `voice v3 ${which} refused: ${body.error ?? ''}`);
                                settle(String(body.error || 'refused'));
                            }
                        }
                        catch { /* not JSON */ }
                    }
                    settle('closed');
                    await reader.cancel().catch(() => { });
                }
                catch (ex) {
                    if (!controller.signal.aborted)
                        this.emit.log('warn', `voice v3 ${which} SSE failed: ${ex?.message ?? String(ex)}`);
                    settle('failed');
                }
                if (opened && !controller.signal.aborted && st === this.voiceV3 && !st.stopped) {
                    st.own[which].ready = false;
                    this.emit.log('warn', `voice v3 ${which} closed`);
                    // The page reconnects the voice channel; the video channel reopens here.
                    if (which === 'video')
                        this.scheduleVideoReopen(st);
                }
            })();
        });
    }
    scheduleVideoReopen(st) {
        const own = st.own.video;
        if (own.reopenTimer)
            return;
        const delay = Math.min(8000, 1000 * 2 ** own.reopenAttempt);
        own.reopenAttempt += 1;
        own.reopenTimer = setTimeout(() => {
            own.reopenTimer = null;
            if (st !== this.voiceV3 || st.stopped || own.ready)
                return;
            void this.openVoiceV3Channel(st, 'video').then((ok) => {
                if (!ok && st === this.voiceV3 && !st.stopped)
                    this.scheduleVideoReopen(st);
            });
        }, delay);
    }
    /**
     * `voice_channel_ready_v3` on the peer's voice channel: the relays of our two
     * channels. The caller sends it once both are open; either side sends it
     * again after moving a channel to another relay. Retried every 300 ms for
     * 10 s while the peer's channel is still opening.
     */
    async sendVoiceChannelReady(st) {
        if (st.announcing)
            return;
        st.announcing = true;
        // The caller announces while its listens open; a relay that moves meanwhile
        // is announced again when this one lands.
        const sentVoice = st.own.voice.relay.domain;
        const sentVideo = st.own.video.relay.domain;
        let stale = false;
        try {
            const body = new TextEncoder().encode(JSON.stringify({
                type: 'voice_channel_ready_v3',
                callId: st.cfg.callId,
                voice: st.own.voice.relay.domain,
                voiceIp: st.own.voice.relay.ip_addr || '',
                voiceKey: utf8ToBase64(st.own.voice.relay.armoredPublicKey),
                video: st.own.video.relay.domain,
                videoIp: st.own.video.relay.ip_addr || '',
                videoKey: utf8ToBase64(st.own.video.relay.armoredPublicKey),
            }));
            const deadline = Date.now() + 10000;
            while (Date.now() < deadline && st === this.voiceV3 && !st.stopped) {
                const target = st.peer.voice;
                if (target.relay) {
                    const literal = await sealVoiceChunk({
                        sessionKey: target.key,
                        locator: target.locator,
                        writeKey: target.wk,
                        kind: VOICE_KIND_CONTROL,
                        seq: 0,
                        captureMs: Date.now(),
                        data: body,
                    });
                    const inner = await encryptVoiceChunkLiteral(literal, target.relay.armoredPublicKey);
                    const result = await this.postVoiceChunk(inner, new Set([target.relay.domain, ...st.avoidDomains]));
                    if (result.ok) {
                        stale = st.own.voice.relay.domain !== sentVoice || st.own.video.relay.domain !== sentVideo;
                        st.relaysAnnounced = !stale;
                        this.emit.log('info', 'voice v3 channel ready sent');
                        return;
                    }
                    if (result.error !== 'target_voice_session_not_found' && result.error !== 'network' && result.error !== 'no_entry') {
                        this.emit.log('warn', `voice v3 channel ready refused ${result.error ?? ''}`);
                        return;
                    }
                }
                await new Promise((done) => setTimeout(done, 300));
            }
            this.emit.log('warn', 'voice v3 channel ready not delivered');
        }
        catch (ex) {
            this.emit.log('warn', `voice v3 channel ready error: ${ex?.message ?? String(ex)}`);
        }
        finally {
            st.announcing = false;
            if (stale && st === this.voiceV3 && !st.stopped)
                void this.sendVoiceChannelReady(st);
        }
    }
    abortVoiceV3(st) {
        st.stopped = true;
        for (const which of ['voice', 'video']) {
            const own = st.own[which];
            own.controller?.abort('voice_stop');
            own.controller = null;
            own.ready = false;
            if (own.reopenTimer)
                clearTimeout(own.reopenTimer);
            own.reopenTimer = null;
        }
    }
    /** `voice_unlisten` for one own channel, to its relay. */
    async unlistenVoiceV3Channel(st, which) {
        const own = st.own[which];
        try {
            const inner = await encryptOpaqueVoiceCommand({
                command: 'voice_unlisten',
                sessionId: own.sid,
                timestamp: Math.floor(Date.now() / 1000),
            }, own.relay.armoredPublicKey);
            const result = await this.postVoiceCommandForJson(inner, new Set([own.relay.domain, ...st.avoidDomains]));
            return result !== null;
        }
        catch {
            return false;
        }
    }
    /** Close the call's SSEs but keep its channels, so a later listen reopens them. */
    parkVoiceV3() {
        const st = this.voiceV3;
        if (!st)
            return;
        this.abortVoiceV3(st);
        this.voiceV3 = null;
        this.voiceV3Retained = st;
    }
    async stopVoiceListen(sessionId) {
        const st = [this.voiceV3, this.voiceV3Retained].find((v) => v?.own.voice.sid === sessionId) ?? null;
        if (!st)
            return true;
        this.abortVoiceV3(st);
        if (this.voiceV3 === st) {
            this.voiceV3 = null;
            this.voiceV3Retained = st;
        }
        const done = await Promise.all([
            this.unlistenVoiceV3Channel(st, 'voice'),
            this.unlistenVoiceV3Channel(st, 'video'),
        ]);
        return done.every(Boolean);
    }
}
/** JSON control frame inside a decrypted voice payload, or null for media. */
function parseVoiceControl(plain) {
    if (!plain.length || plain[0] !== 0x7b)
        return null;
    try {
        const obj = JSON.parse(new TextDecoder().decode(plain));
        return obj && typeof obj === 'object' && typeof obj.type === 'string'
            ? obj
            : null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=gossip-core.js.map