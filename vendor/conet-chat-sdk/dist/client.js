/**
 * Main-thread {@link BeamioChatClient} implementation. Boots the gossip Worker,
 * marshals commands, and re-emits worker events. Zero openpgp/verify on the main
 * thread — all heavy crypto runs in the worker.
 *
 * The host supplies the Worker instance (via `workerFactory`) so the SDK stays
 * bundler-agnostic: CRA/Vite/webpack each create the worker their own way, e.g.
 *   new Worker(new URL('@beamio/chat-sdk/worker', import.meta.url), { type: 'module' })
 */
const DEFAULT_RUNTIME = {
    sendFanout: 3,
    reconnectBaseMs: 4000,
    reconnectMaxMs: 30000,
    outerWrap: true,
};
class ChatHistoryBridge {
    constructor(client) {
        this.client = client;
        this.bufferListeners = new Set();
    }
    load(options) {
        return this.client.request({ type: 'historyLoad', reqId: 0, options });
    }
    append(entry) {
        return this.client.request({ type: 'historyAppend', reqId: 0, entry });
    }
    read(options) {
        return this.client.request({ type: 'historyRead', reqId: 0, options }, 60000);
    }
    onBuffer(cb) {
        this.bufferListeners.add(cb);
        return () => this.bufferListeners.delete(cb);
    }
    _emit(batch) {
        for (const cb of this.bufferListeners) {
            try {
                cb(batch);
            }
            catch {
                /* listener errors isolated */
            }
        }
    }
}
class BeamioChatClientImpl {
    constructor(config, options) {
        this.config = config;
        this.options = options;
        this.worker = null;
        this.reqSeq = 1;
        this.pending = new Map();
        this.listeners = {
            message: new Set(),
            delivery: new Set(),
            presence: new Set(),
            status: new Set(),
            log: new Set(),
            historyBuffer: new Set(),
            voiceFrame: new Set(),
        };
        this.routes = [];
        this.nodes = [];
        this.destroyed = false;
        this.historyBridge = new ChatHistoryBridge(this);
    }
    get history() {
        return this.historyBridge;
    }
    async init() {
        if (this.worker)
            return;
        this.worker = this.options.workerFactory();
        this.worker.addEventListener('message', (ev) => this.onWorkerMessage(ev.data));
        this.worker.addEventListener('error', (ev) => {
            this.emit('log', { level: 'error', message: `worker error: ${ev.message}` });
        });
        this.nodes = await this.config.getNodes().catch(() => []);
        this.routes = [];
        const payload = {
            identity: this.config.identity,
            conetRpcUrl: this.config.conetRpcUrl,
            addressPgpContractAddress: this.config.addressPgpContractAddress,
            ipfsBaseUrl: this.config.ipfsBaseUrl,
            ipfsWriteBaseUrl: this.config.ipfsWriteBaseUrl,
            chainId: this.config.chainId ?? 224422,
            chatIndexRegistryAddress: this.config.chatIndexRegistryAddress ?? '0x1511Caa71081C84d8a591490D1b83879088EED72',
            apiBaseUrl: this.config.apiBaseUrl,
            runtime: { ...DEFAULT_RUNTIME, ...(this.config.runtime ?? {}) },
            nodes: this.nodes,
            routes: this.routes,
        };
        await this.request({ type: 'init', reqId: 0, payload });
    }
    setRoutes(routes) {
        this.routes = routes || [];
        this.postCommand({ type: 'setRoutes', routes: this.routes });
    }
    /** Push a refreshed node snapshot into the worker (host owns discovery). */
    setNodes(nodes) {
        if (!nodes?.length)
            return;
        this.nodes = nodes;
        this.postCommand({ type: 'setNodes', nodes });
    }
    async sendMessage(to, payload, opts) {
        const sendId = opts?.sendId || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        await this.request({
            type: 'send',
            reqId: 0,
            to,
            payload,
            sendId,
            beamioNoPush: opts?.beamioNoPush,
        });
        return { sendId };
    }
    async queryPresence(contacts) {
        return this.request({ type: 'queryPresence', reqId: 0, contacts });
    }
    /** After presence: true/false when the mailbox lookup is trusted; null when it is not. */
    async queryNativeWake(contact) {
        return this.request({ type: 'queryNativeWake', reqId: 0, contact });
    }
    /** Encrypt & POST an arbitrary mailbox command (e.g. gossip_delivery_ack) to route B via entry C ≠ B. */
    async postMailboxCommand(routerArmoredPublicKey, command) {
        const r = await this.request({
            type: 'mailboxCommand',
            reqId: 0,
            routerArmoredPublicKey,
            command,
        });
        return !!r?.sent;
    }
    /** Encrypt and post a command to this wallet's own mailbox route. */
    async postOwnMailboxCommand(command) {
        const r = await this.request({
            type: 'ownMailboxCommand',
            reqId: 0,
            command,
        });
        return !!r?.sent;
    }
    async sendVoiceFrame(routerArmoredPublicKey, frame) {
        const r = await this.request({
            type: 'voiceFrame',
            reqId: 0,
            routerArmoredPublicKey,
            frame,
        });
        return !!r?.sent;
    }
    async startVoiceListen(sessionId, pushWakeup) {
        const r = await this.request({ type: 'voiceListen', reqId: 0, sessionId, pushWakeup });
        return !!r?.started;
    }
    async stopVoiceListen(sessionId) {
        const r = await this.request({ type: 'voiceUnlisten', reqId: 0, sessionId });
        return !!r?.stopped;
    }
    on(event, cb) {
        this.listeners[event].add(cb);
        return () => this.listeners[event].delete(cb);
    }
    pause() {
        this.postCommand({ type: 'pause' });
    }
    resume() {
        this.postCommand({ type: 'resume' });
    }
    destroy() {
        if (this.destroyed)
            return;
        this.destroyed = true;
        this.postCommand({ type: 'destroy' });
        for (const { reject } of this.pending.values())
            reject(new Error('client destroyed'));
        this.pending.clear();
        try {
            this.worker?.terminate();
        }
        catch {
            /* ignore */
        }
        this.worker = null;
    }
    // ---- internals ------------------------------------------------------------
    request(cmd, timeoutMs = 20000) {
        if (!this.worker)
            return Promise.reject(new Error('client not initialised'));
        const reqId = this.reqSeq++;
        const message = { ...cmd, reqId };
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                if (!this.pending.has(reqId))
                    return;
                this.pending.delete(reqId);
                reject(new Error('Chat worker did not respond'));
            }, timeoutMs);
            this.pending.set(reqId, {
                resolve: (value) => {
                    clearTimeout(timer);
                    resolve(value);
                },
                reject: (error) => {
                    clearTimeout(timer);
                    reject(error);
                },
            });
            this.worker.postMessage(message);
        });
    }
    postCommand(cmd) {
        this.worker?.postMessage(cmd);
    }
    emit(event, payload) {
        for (const cb of this.listeners[event]) {
            try {
                ;
                cb(payload);
            }
            catch {
                /* isolate listener errors */
            }
        }
    }
    onWorkerMessage(msg) {
        switch (msg.type) {
            case 'ready':
            case 'ack': {
                const reqId = msg.reqId;
                const p = this.pending.get(reqId);
                if (!p)
                    return;
                this.pending.delete(reqId);
                if (msg.type === 'ready') {
                    p.resolve(undefined);
                }
                else if (msg.ok) {
                    p.resolve(msg.result);
                }
                else {
                    p.reject(new Error(msg.error));
                }
                return;
            }
            case 'event:message':
                this.emit('message', msg.payload);
                return;
            case 'event:delivery':
                this.emit('delivery', msg.payload);
                return;
            case 'event:presence':
                this.emit('presence', msg.payload);
                return;
            case 'event:status':
                this.emit('status', msg.payload);
                return;
            case 'event:historyBuffer':
                this.emit('historyBuffer', msg.payload);
                this.historyBridge._emit(msg.payload);
                return;
            case 'event:voiceFrame':
                this.emit('voiceFrame', msg.payload);
                return;
            case 'event:log':
                this.emit('log', { level: msg.level, message: msg.message });
                return;
            case 'nodesRequest': {
                void this.config
                    .getNodes()
                    .then((nodes) => {
                    this.nodes = nodes;
                    this.postCommand({ type: 'nodesResponse', reqId: msg.reqId, nodes });
                })
                    .catch(() => {
                    this.postCommand({ type: 'nodesResponse', reqId: msg.reqId, nodes: this.nodes });
                });
                return;
            }
            default:
                return;
        }
    }
}
/** Factory: create a chat client. Call `init()` before use. */
export function createBeamioChatClient(config, options) {
    return new BeamioChatClientImpl(config, options);
}
//# sourceMappingURL=client.js.map