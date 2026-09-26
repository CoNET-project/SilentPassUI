/**
 * Worker entry — side-effectful. Import ONLY inside a Worker context
 * (`new Worker(new URL('.../worker/entry.js', import.meta.url), { type: 'module' })`).
 *
 * All openpgp encrypt/decrypt + ethers signing/verify-free hot paths live here so the
 * main thread stays responsive. Bridges {@link WorkerInbound} commands to {@link WorkerOutbound}
 * events via `postMessage`.
 */
import { GossipCore } from './gossip-core.js';
import { HistoryStore } from './history.js';
const ctx = globalThis;
function post(msg) {
    ctx.postMessage(msg);
}
let gossip = null;
let history = null;
let historySyncTimer = null;
const HISTORY_SYNC_DELAY_MS = 30000;
function stopHistorySync() {
    if (historySyncTimer !== null) {
        clearTimeout(historySyncTimer);
        historySyncTimer = null;
    }
}
function scheduleHistorySync() {
    stopHistorySync();
    historySyncTimer = setTimeout(async () => {
        historySyncTimer = null;
        if (!history)
            return;
        try {
            const changed = await history.syncFromHead();
            // Publish only bodies that were not already in the plaintext corpus.
            if (changed)
                await history.load({ localOnly: true, emit: 'fresh' });
        }
        catch (ex) {
            post({ type: 'event:log', level: 'warn', message: `history sync failed: ${ex?.message ?? String(ex)}` });
        }
        finally {
            if (history)
                scheduleHistorySync();
        }
    }, HISTORY_SYNC_DELAY_MS);
}
function makeGossip() {
    return new GossipCore({
        message: (line, armorHash, plain, viaDomain) => post({ type: 'event:message', payload: { line, armorHash, plain, viaDomain, receivedAt: Date.now() } }),
        voiceFrame: (payload) => post({ type: 'event:voiceFrame', payload }),
        status: (status, detail) => post({ type: 'event:status', payload: { status, detail } }),
        log: (level, message) => post({ type: 'event:log', level, message }),
        presence: (payload) => post({ type: 'event:presence', payload }),
    });
}
function makeHistory(payload) {
    return new HistoryStore({
        buffer: (peer, entries, isTail) => post({ type: 'event:historyBuffer', payload: { peer, entries, isTail } }),
        log: (level, message) => post({ type: 'event:log', level, message }),
    }, {
        eoaAddress: payload.identity.eoaAddress,
        privateKeyHex: payload.identity.privateKeyHex,
        chainId: payload.chainId,
        ipfsBaseUrl: payload.ipfsBaseUrl,
        ipfsWriteBaseUrl: payload.ipfsWriteBaseUrl,
        conetRpcUrl: payload.conetRpcUrl,
        chatIndexRegistryAddress: payload.chatIndexRegistryAddress,
        apiBaseUrl: payload.apiBaseUrl,
        // PersistenceAdapter cannot cross the worker boundary (functions aren't
        // clonable). The worker uses its own IndexedDB-backed adapter instead.
        persistence: createWorkerPersistence(),
    });
}
/** IndexedDB persistence local to the worker (main-thread adapter can't be transferred). */
function createWorkerPersistence() {
    const DB_NAME = 'beamio-chat-sdk';
    const STORE = 'kv';
    let dbPromise = null;
    const open = () => {
        if (dbPromise)
            return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE))
                    db.createObjectStore(STORE);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return dbPromise;
    };
    const tx = async (mode, fn) => {
        const db = await open();
        return new Promise((resolve, reject) => {
            const t = db.transaction(STORE, mode);
            const store = t.objectStore(STORE);
            const req = fn(store);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    };
    return {
        async get(key) {
            try {
                return await tx('readonly', (s) => s.get(key));
            }
            catch {
                return undefined;
            }
        },
        async set(key, value) {
            try {
                await tx('readwrite', (s) => s.put(value, key));
            }
            catch {
                /* ignore */
            }
        },
        async delete(key) {
            try {
                await tx('readwrite', (s) => s.delete(key));
            }
            catch {
                /* ignore */
            }
        },
    };
}
async function handle(cmd) {
    switch (cmd.type) {
        case 'init': {
            try {
                gossip = makeGossip();
                history = makeHistory(cmd.payload);
                await gossip.init(cmd.payload);
                post({ type: 'ready', reqId: cmd.reqId });
                scheduleHistorySync();
            }
            catch (ex) {
                post({ type: 'ack', reqId: cmd.reqId, ok: false, error: ex?.message ?? String(ex) });
            }
            return;
        }
        case 'setRoutes':
            gossip?.setRoutes(cmd.routes);
            return;
        case 'setNodes':
            gossip?.setNodes(cmd.nodes);
            return;
        case 'send': {
            try {
                const ok = await gossip.send(cmd.to, cmd.payload, { beamioNoPush: cmd.beamioNoPush });
                post({ type: 'ack', reqId: cmd.reqId, ok: true, result: { sent: ok, sendId: cmd.sendId } });
            }
            catch (ex) {
                post({ type: 'ack', reqId: cmd.reqId, ok: false, error: ex?.message ?? String(ex) });
            }
            return;
        }
        case 'queryPresence': {
            try {
                const result = await gossip.queryPresence(cmd.contacts);
                post({ type: 'ack', reqId: cmd.reqId, ok: true, result });
            }
            catch (ex) {
                post({ type: 'ack', reqId: cmd.reqId, ok: false, error: ex?.message ?? String(ex) });
            }
            return;
        }
        case 'queryNativeWake': {
            try {
                const result = await gossip.queryNativeWake(cmd.contact);
                post({ type: 'ack', reqId: cmd.reqId, ok: true, result });
            }
            catch (ex) {
                post({ type: 'ack', reqId: cmd.reqId, ok: false, error: ex?.message ?? String(ex) });
            }
            return;
        }
        case 'historyLoad': {
            try {
                await history.load(cmd.options);
                post({ type: 'ack', reqId: cmd.reqId, ok: true });
            }
            catch (ex) {
                post({ type: 'ack', reqId: cmd.reqId, ok: false, error: ex?.message ?? String(ex) });
            }
            return;
        }
        case 'historyRead': {
            try {
                const entries = await history.read(cmd.options);
                post({ type: 'ack', reqId: cmd.reqId, ok: true, result: entries });
            }
            catch (ex) {
                post({ type: 'ack', reqId: cmd.reqId, ok: false, error: ex?.message ?? String(ex) });
            }
            return;
        }
        case 'historyAppend': {
            try {
                await history.append(cmd.entry);
                post({ type: 'ack', reqId: cmd.reqId, ok: true });
            }
            catch (ex) {
                post({ type: 'ack', reqId: cmd.reqId, ok: false, error: ex?.message ?? String(ex) });
            }
            return;
        }
        case 'mailboxCommand': {
            try {
                const ok = await gossip.postMailboxCommand(cmd.routerArmoredPublicKey, cmd.command);
                post({ type: 'ack', reqId: cmd.reqId, ok: true, result: { sent: ok } });
            }
            catch (ex) {
                post({ type: 'ack', reqId: cmd.reqId, ok: false, error: ex?.message ?? String(ex) });
            }
            return;
        }
        case 'ownMailboxCommand': {
            try {
                const ok = await gossip.postOwnMailboxCommand(cmd.command);
                post({ type: 'ack', reqId: cmd.reqId, ok: true, result: { sent: ok } });
            }
            catch (ex) {
                post({ type: 'ack', reqId: cmd.reqId, ok: false, error: ex?.message ?? String(ex) });
            }
            return;
        }
        case 'voiceFrame': {
            try {
                const ok = await gossip.sendVoiceFrame(cmd.routerArmoredPublicKey, cmd.frame);
                post({ type: 'ack', reqId: cmd.reqId, ok: true, result: { sent: ok } });
            }
            catch (ex) {
                post({ type: 'ack', reqId: cmd.reqId, ok: false, error: ex?.message ?? String(ex) });
            }
            return;
        }
        case 'voiceListen': {
            try {
                const ok = await gossip.startVoiceListen(cmd.sessionId, cmd.pushWakeup);
                post({ type: 'ack', reqId: cmd.reqId, ok: true, result: { started: ok } });
            }
            catch (ex) {
                post({ type: 'ack', reqId: cmd.reqId, ok: false, error: ex?.message ?? String(ex) });
            }
            return;
        }
        case 'voiceUnlisten': {
            try {
                const ok = await gossip.stopVoiceListen(cmd.sessionId);
                post({ type: 'ack', reqId: cmd.reqId, ok: true, result: { stopped: ok } });
            }
            catch (ex) {
                post({ type: 'ack', reqId: cmd.reqId, ok: false, error: ex?.message ?? String(ex) });
            }
            return;
        }
        case 'pause':
            gossip?.pause();
            return;
        case 'resume':
            gossip?.resume();
            return;
        case 'destroy':
            stopHistorySync();
            gossip?.destroy();
            history?.destroy();
            gossip = null;
            history = null;
            return;
        case 'nodesResponse':
            if (cmd.nodes?.length)
                gossip?.setNodes(cmd.nodes);
            return;
        default:
            return;
    }
}
ctx.addEventListener('message', (ev) => {
    void handle(ev.data);
});
//# sourceMappingURL=entry.js.map