/**
 * Encrypted fragmented IPFS history — runs inside the Worker.
 *
 * Design (repo plan `beamio_chat_sdk`, on-chain head pointer variant):
 *  - master   = keccak256(EOA_sign("beamio.chat.history.v1|chainId|eoa"))  (private key never leaves worker)
 *  - indexKey = HKDF(master, "index-enc")       → AES-256-GCM of the ordered index manifest
 *  - fragment ratchet: k_i = HKDF(master, `frag|${seq}|${cid_{i-1}}`), cid_{-1}=HKDF(master,"frag-genesis")
 *      cipher_i = AES-GCM(k_i, plaintext_i); cid_i = keccak256(cipher_i) → content-addressed IPFS fragment.
 *      All cid_{i-1} recorded in the index → any k_i is O(1) derivable (newest-first restore).
 *  - HEAD POINTER (mutable): the encrypted index cipher is itself a content-addressed IPFS fragment
 *      (indexHash = keccak256(cipher)). The *latest* indexHash is recorded on-chain in `ChatIndexRegistry`
 *      via an EIP-712 `SetPointer(owner,indexHash,ts,seq,nonce)` signed offline by the EOA; a gasless API
 *      relayer pays gas. Only the owner's signature can move the owner's pointer (write right = private key).
 *      Read path is pure RPC `getPointer(eoa)` (no mutable server state). Replaces the old `point-${L}` alias.
 *
 * Trust rule: a failed/untrusted network read must NOT clobber the local IndexedDB
 * mirror (repo `beamio-trusted-vs-untrusted-fetch`).
 */
import { ethers } from 'ethers';
import { aesGcmDecryptString, aesGcmEncryptString, base64ToBytes, bytesToBase64, hexToBytes, hkdf, keccakUtf8, } from '../crypto.js';
/** ChatIndexRegistry lives only on CoNET L1; EIP-712 domain chainId is fixed. */
const REGISTRY_CHAIN_ID = 224422;
const REGISTRY_READ_ABI = [
    'function getPointer(address) view returns (bytes32 indexHash,uint64 ts,uint64 seq,uint64 updatedAt)',
    'function nonceOf(address) view returns (uint256)',
];
const SET_POINTER_TYPES = {
    SetPointer: [
        { name: 'owner', type: 'address' },
        { name: 'indexHash', type: 'bytes32' },
        { name: 'ts', type: 'uint64' },
        { name: 'seq', type: 'uint64' },
        { name: 'nonce', type: 'uint256' },
    ],
};
const LOCAL_INDEX_KEY_PREFIX = 'beamio.chat.history.index:';
const LOCAL_FRAG_KEY_PREFIX = 'beamio.chat.history.frag:';
const LOCAL_PLAIN_KEY_PREFIX = 'beamio.chat.history.plain:';
const FRAGMENT_GENESIS_INFO = 'frag-genesis';
function extractSearchText(body) {
    const parts = [];
    const push = (value) => {
        if (typeof value === 'string' && value.trim())
            parts.push(value);
    };
    try {
        const msg = JSON.parse(body);
        push(msg.text);
        const call = msg.callRecord;
        push(call?.status);
        const file = msg.fileMessage;
        push(file?.filename);
        push(file?.archiveName);
        if (msg.voiceMessage)
            parts.push('voice message');
        const payment = msg.paymentCard;
        push(payment?.title);
    }
    catch {
        push(body);
    }
    return parts.join('\n').toLowerCase();
}
function isPlainRecord(value) {
    if (!value || typeof value !== 'object')
        return false;
    const row = value;
    const entry = row.entry;
    return (!!entry &&
        typeof entry.body === 'string' &&
        typeof entry.peer === 'string' &&
        (entry.dir === 'in' || entry.dir === 'out') &&
        typeof row.searchText === 'string');
}
function diagnosticCid(cid) {
    return typeof cid === 'string' && cid.length > 12
        ? `${cid.slice(0, 10)}…${cid.slice(-8)}`
        : cid;
}
export class HistoryStore {
    constructor(emit, opts) {
        this.emit = emit;
        this.opts = opts;
        this.master = null;
        this.indexKey = null;
        this.genesisCid = '';
        this.manifest = null;
        this.eoaLower = '';
        this.ready = false;
        /** Cached signer + its self-address EIP-191 signature (storageFragment auth). */
        this.wallet = null;
        this.selfSign = '';
        /** Lazily-created read-only CoNET provider (RPC-first pointer reads). */
        this.provider = null;
        this.mutationChain = Promise.resolve();
        /** Decrypted corpus. Keyed by fragment cid so a known body is never fetched again. */
        this.corpus = new Map();
        /** Last on-chain index hash already merged into the local manifest. */
        this.syncedIndexHash = '';
    }
    get writeBase() {
        return (this.opts.ipfsWriteBaseUrl || this.opts.ipfsBaseUrl).replace(/\/$/, '');
    }
    get readBase() {
        return this.opts.ipfsBaseUrl.replace(/\/$/, '');
    }
    getProvider() {
        if (!this.provider) {
            const net = new ethers.Network('conet', REGISTRY_CHAIN_ID);
            this.provider = new ethers.JsonRpcProvider(this.opts.conetRpcUrl, net, { staticNetwork: net });
        }
        return this.provider;
    }
    async init() {
        if (this.ready)
            return;
        this.eoaLower = this.opts.eoaAddress.toLowerCase();
        const pkHex = this.opts.privateKeyHex.startsWith('0x') ? this.opts.privateKeyHex : `0x${this.opts.privateKeyHex}`;
        const wallet = new ethers.Wallet(pkHex);
        this.wallet = wallet;
        // storageFragment auth message = the wallet's own address (checkSign(wallet, sig, wallet)).
        this.selfSign = await wallet.signMessage(wallet.address);
        const domain = `beamio.chat.history.v1|${this.opts.chainId}|${this.eoaLower}`;
        const sig = await wallet.signMessage(domain);
        this.master = hexToBytes(keccakUtf8(sig));
        this.indexKey = await hkdf(this.master, 'index-enc', 32);
        const genesisBytes = await hkdf(this.master, FRAGMENT_GENESIS_INFO, 32);
        this.genesisCid = ethers.hexlify(genesisBytes);
        this.ready = true;
    }
    // ---- On-chain head pointer / index ---------------------------------------
    /** Local mirror is keyed per-EOA (index cipher changes each append). */
    localIndexKey() {
        return `${LOCAL_INDEX_KEY_PREFIX}${this.eoaLower}`;
    }
    /** Read the on-chain head pointer (RPC-first). Returns null when unset/unreachable. */
    async readOnchainPointer() {
        try {
            const registry = new ethers.Contract(this.opts.chatIndexRegistryAddress, REGISTRY_READ_ABI, this.getProvider());
            const ptr = await registry.getPointer(ethers.getAddress(this.eoaLower));
            const indexHash = String(ptr[0]);
            if (!indexHash || indexHash === ethers.ZeroHash)
                return null;
            this.emit.log('info', `[history] pointer index=${diagnosticCid(indexHash)} seq=${ptr[2].toString()} ts=${ptr[1].toString()}`);
            return { indexHash, ts: BigInt(ptr[1].toString()), seq: BigInt(ptr[2].toString()) };
        }
        catch (ex) {
            this.emit.log('warn', `[history] pointer read failed: ${ex?.message ?? String(ex)}`);
            return null;
        }
    }
    /** Fetch the encrypted index cipher by its content hash. */
    async fetchIndexCipherByHash(indexHash) {
        try {
            const url = `${this.readBase}/getFragment?hash=${encodeURIComponent(indexHash)}`;
            const res = await fetch(url, { method: 'GET', cache: 'no-store' });
            if (!res.ok) {
                this.emit.log('warn', `[history] index fetch failed hash=${diagnosticCid(indexHash)} http=${res.status}`);
                return null;
            }
            const text = (await res.text()).trim();
            this.emit.log('info', `[history] index fetched hash=${diagnosticCid(indexHash)} chars=${text.length}`);
            return text || null;
        }
        catch {
            this.emit.log('warn', `[history] index fetch threw hash=${diagnosticCid(indexHash)}`);
            return null;
        }
    }
    async loadLocalManifest() {
        // Local-first (instant open).
        if (this.opts.persistence) {
            const cached = (await this.opts.persistence.get(this.localIndexKey()));
            if (cached && this.indexKey) {
                try {
                    const json = await aesGcmDecryptString(this.indexKey, cached);
                    const parsed = JSON.parse(json);
                    if (parsed?.v === 1)
                        this.manifest = parsed;
                }
                catch {
                    /* corrupt local; fall through to network */
                }
            }
        }
        return this.manifest;
    }
    recordKey(record) {
        return record.sendId ? `send:${record.sendId}` : `cid:${record.cid}`;
    }
    unionMergeRecords(local, remote) {
        const byKey = new Map();
        for (const record of [...local, ...remote]) {
            const key = this.recordKey(record);
            if (!byKey.has(key))
                byKey.set(key, record);
        }
        return [...byKey.values()].sort((a, b) => a.seq - b.seq || a.cid.localeCompare(b.cid));
    }
    hasChainConflict(local, remote, merged) {
        const seqToCid = new Map();
        const prevToCid = new Map();
        for (const record of [...local, ...remote]) {
            const prior = seqToCid.get(record.seq);
            if (prior && prior !== record.cid)
                return true;
            seqToCid.set(record.seq, record.cid);
            const fork = prevToCid.get(record.prevCid);
            if (fork && fork !== record.cid)
                return true;
            prevToCid.set(record.prevCid, record.cid);
        }
        const ordered = [...merged].sort((a, b) => a.seq - b.seq);
        return ordered.some((record, index) => {
            const previous = index === 0 ? this.genesisCid : ordered[index - 1].cid;
            return record.seq !== index || record.prevCid !== previous;
        });
    }
    async decryptRecord(record) {
        const { entry } = await this.materializeRecord(record);
        return entry;
    }
    async relinearizeAndReencrypt(records) {
        const decrypted = await Promise.all(records.map(async (record) => ({ record, body: await this.decryptRecord(record) })));
        if (decrypted.some(({ body }) => !body))
            return null;
        const ordered = decrypted
            .map(({ record, body }) => ({ record, body: body }))
            .sort((a, b) => a.body.ts - b.body.ts ||
            String(a.body.sendId || '').localeCompare(String(b.body.sendId || '')) ||
            a.record.cid.localeCompare(b.record.cid));
        const next = [];
        for (const { record, body } of ordered) {
            const seq = next.length;
            const prevCid = seq ? next[seq - 1].cid : this.genesisCid;
            const cipher = await aesGcmEncryptString(await this.fragmentKey(seq, prevCid), body.body);
            const cid = keccakUtf8(cipher);
            if (this.opts.persistence)
                await this.opts.persistence.set(`${LOCAL_FRAG_KEY_PREFIX}${cid}`, cipher);
            if (!await this.uploadFragment(cipher))
                return null;
            next.push({
                ...record,
                seq,
                cid,
                prevCid,
                peer: body.peer.toLowerCase(),
                ts: body.ts,
                dir: body.dir,
                sendId: body.sendId,
                preview: body.body.slice(0, 80),
            });
        }
        return next;
    }
    async syncFromHeadUnlocked() {
        await this.init();
        await this.loadLocalManifest();
        const pointer = await this.readOnchainPointer();
        if (!pointer || !this.indexKey)
            return false;
        if (this.syncedIndexHash && pointer.indexHash === this.syncedIndexHash && this.manifest)
            return false;
        const cipher = await this.fetchIndexCipherByHash(pointer.indexHash);
        if (!cipher)
            return false;
        try {
            const parsed = JSON.parse(await aesGcmDecryptString(this.indexKey, cipher));
            if (parsed?.v !== 1 || parsed.eoa?.toLowerCase() !== this.eoaLower) {
                this.emit.log('warn', '[history] index rejected: version or EOA mismatch');
                return false;
            }
            const local = this.manifest?.records ?? [];
            const remote = Array.isArray(parsed.records) ? parsed.records : [];
            const merged = this.unionMergeRecords(local, remote);
            this.emit.log('info', `[history] index decrypted remoteRecords=${remote.length} localRecords=${local.length} mergedRecords=${merged.length}`);
            const records = this.hasChainConflict(local, remote, merged)
                ? await this.relinearizeAndReencrypt(merged)
                : merged;
            if (!records) {
                this.emit.log('warn', '[history] index chain conflict could not be relinearized');
                return false;
            }
            const changed = records.length !== local.length || records.some((record, index) => record.cid !== local[index]?.cid);
            if (!changed) {
                this.syncedIndexHash = pointer.indexHash;
                return false;
            }
            const nextManifest = { ...parsed, updatedAt: Date.now(), records };
            const persisted = await this.persistManifest(nextManifest, { requireRemoteCommit: Boolean(this.opts.apiBaseUrl) });
            if (persisted)
                this.syncedIndexHash = pointer.indexHash;
            return persisted;
        }
        catch (ex) {
            this.emit.log('warn', `[history] index decrypt/parse failed: ${ex?.message ?? String(ex)}`);
            return false;
        }
    }
    /** Union-sync the local mirror with the current on-chain head. */
    async syncFromHead() {
        let result = false;
        this.mutationChain = this.mutationChain.catch(() => undefined).then(async () => {
            result = await this.syncFromHeadUnlocked();
        });
        await this.mutationChain;
        return result;
    }
    async persistManifest(nextManifest = this.manifest, options) {
        if (!nextManifest || !this.indexKey)
            return false;
        const json = JSON.stringify(nextManifest);
        const cipher = await aesGcmEncryptString(this.indexKey, json);
        // Upload the fresh index cipher as a content-addressed fragment, then move the on-chain head pointer.
        const indexHash = await this.uploadFragment(cipher);
        const requiresRemoteCommit = Boolean(options?.requireRemoteCommit && this.opts.apiBaseUrl);
        if (requiresRemoteCommit && (!indexHash || !(await this.updateOnchainPointer(indexHash, nextManifest)))) {
            return false;
        }
        // Only publish the local manifest after the remote commit when sync requires one.
        if (this.opts.persistence)
            await this.opts.persistence.set(this.localIndexKey(), cipher);
        this.manifest = nextManifest;
        if (!requiresRemoteCommit && indexHash)
            await this.updateOnchainPointer(indexHash, nextManifest);
        return Boolean(indexHash);
    }
    /**
     * Move the EOA's on-chain head pointer to `indexHash` via the gasless relay.
     * The EOA signs `SetPointer(owner,indexHash,ts,seq,nonce)` (EIP-712); the API relayer pays gas.
     * No-op (with a warning) when `apiBaseUrl` is not configured.
     */
    async updateOnchainPointer(indexHash, manifest = this.manifest) {
        if (!this.wallet)
            return false;
        if (!this.opts.apiBaseUrl) {
            this.emit.log('warn', 'chat history: apiBaseUrl unset — on-chain head pointer not updated');
            return false;
        }
        if (!ethers.isHexString(indexHash, 32)) {
            this.emit.log('warn', `chat history: bad indexHash ${indexHash}`);
            return false;
        }
        try {
            const nonce = await new ethers.Contract(this.opts.chatIndexRegistryAddress, REGISTRY_READ_ABI, this.getProvider()).nonceOf(this.wallet.address);
            // ts = client monotonic timestamp (ms); seq = monotonic append count. Both non-decreasing.
            const ts = BigInt(Date.now());
            const seq = BigInt(manifest.records?.length ?? 0);
            const domain = {
                name: 'ChatIndexRegistry',
                version: '1',
                chainId: REGISTRY_CHAIN_ID,
                verifyingContract: this.opts.chatIndexRegistryAddress,
            };
            const value = { owner: this.wallet.address, indexHash, ts, seq, nonce: BigInt(nonce.toString()) };
            const signature = await this.wallet.signTypedData(domain, SET_POINTER_TYPES, value);
            const base = this.opts.apiBaseUrl.replace(/\/$/, '');
            const res = await fetch(`${base}/setChatIndexPointer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    owner: this.wallet.address,
                    indexHash,
                    ts: ts.toString(),
                    seq: seq.toString(),
                    nonce: nonce.toString(),
                    signature,
                }),
            });
            if (!res.ok) {
                this.emit.log('warn', `setChatIndexPointer HTTP ${res.status}`);
                return false;
            }
            return true;
        }
        catch (ex) {
            this.emit.log('warn', `updateOnchainPointer error: ${ex?.message ?? String(ex)}`);
            return false;
        }
    }
    // ---- Fragment upload/download --------------------------------------------
    async uploadFragment(cipherB64) {
        if (!this.wallet)
            throw new Error('history not initialised');
        const contentHash = keccakUtf8(cipherB64);
        // storageFragment contract: { wallet, signMessage, image }. `image` is the raw
        // content whose keccak256(toUtf8Bytes(image)) the server recomputes as the hash.
        const body = {
            wallet: this.wallet.address,
            signMessage: this.selfSign,
            image: cipherB64,
        };
        try {
            const res = await fetch(`${this.writeBase}/storageFragment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                this.emit.log('warn', `uploadFragment HTTP ${res.status}`);
                return null;
            }
            return contentHash;
        }
        catch (ex) {
            this.emit.log('warn', `uploadFragment error: ${ex?.message ?? String(ex)}`);
            return null;
        }
    }
    async downloadFragment(cid) {
        // Local mirror first.
        if (this.opts.persistence) {
            const cached = (await this.opts.persistence.get(`${LOCAL_FRAG_KEY_PREFIX}${cid}`));
            if (cached)
                return cached;
        }
        try {
            const url = `${this.readBase}/getFragment?hash=${encodeURIComponent(cid)}`;
            const res = await fetch(url, { method: 'GET', cache: 'no-store' });
            if (!res.ok) {
                this.emit.log('warn', `[history] fragment fetch failed cid=${diagnosticCid(cid)} http=${res.status}`);
                return null;
            }
            const text = (await res.text()).trim();
            this.emit.log('info', `[history] fragment fetched cid=${diagnosticCid(cid)} chars=${text.length}`);
            if (text && this.opts.persistence)
                await this.opts.persistence.set(`${LOCAL_FRAG_KEY_PREFIX}${cid}`, text);
            return text || null;
        }
        catch (ex) {
            this.emit.log('warn', `[history] fragment fetch threw cid=${diagnosticCid(cid)}: ${ex?.message ?? String(ex)}`);
            return null;
        }
    }
    async fragmentKey(seq, prevCid) {
        if (!this.master)
            throw new Error('history not initialised');
        return hkdf(this.master, `frag|${seq}|${prevCid}`, 32);
    }
    plainKey(cid) {
        return `${LOCAL_PLAIN_KEY_PREFIX}${this.eoaLower}:${cid}`;
    }
    async rememberPlain(cid, entry) {
        const row = { entry, searchText: extractSearchText(entry.body) };
        this.corpus.set(cid, row);
        if (this.opts.persistence)
            await this.opts.persistence.set(this.plainKey(cid), row);
    }
    /** Memory, then local plaintext, then local cipher, then IPFS. A hit never reaches the next step. */
    async materializeRecord(rec) {
        const known = this.corpus.get(rec.cid);
        if (known)
            return { entry: known.entry, fresh: false };
        if (this.opts.persistence) {
            const stored = await this.opts.persistence.get(this.plainKey(rec.cid));
            if (isPlainRecord(stored)) {
                this.corpus.set(rec.cid, stored);
                return { entry: stored.entry, fresh: false };
            }
        }
        const cipher = await this.downloadFragment(rec.cid);
        if (!cipher) {
            this.emit.log('warn', `[history] record unavailable seq=${rec.seq} cid=${diagnosticCid(rec.cid)}`);
            return { entry: null, fresh: false };
        }
        try {
            const key = await this.fragmentKey(rec.seq, rec.prevCid);
            const body = await aesGcmDecryptString(key, cipher);
            const entry = {
                seq: rec.seq,
                ts: rec.ts,
                peer: rec.peer,
                dir: rec.dir,
                sendId: rec.sendId,
                body,
            };
            await this.rememberPlain(rec.cid, entry);
            return { entry, fresh: true };
        }
        catch (ex) {
            this.emit.log('warn', `[history] record decrypt failed seq=${rec.seq} cid=${diagnosticCid(rec.cid)} prev=${diagnosticCid(rec.prevCid)}: ${ex?.message ?? String(ex)}`);
            return { entry: null, fresh: false };
        }
    }
    matchesQuery(cid, query) {
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
        if (!terms.length)
            return true;
        const text = this.corpus.get(cid)?.searchText ?? '';
        return terms.every((term) => text.includes(term));
    }
    // ---- Public: load / append -----------------------------------------------
    async load(options) {
        await this.init();
        const tailCount = options?.tailCount ?? 60;
        const localOnly = options?.localOnly ?? false;
        const emitMode = options?.emit ?? 'fresh';
        const peerFilter = options?.peer ? options.peer.toLowerCase() : undefined;
        await this.loadLocalManifest();
        if (!localOnly)
            await this.syncFromHead();
        const manifest = this.manifest;
        if (!manifest?.records?.length) {
            this.emit.buffer(peerFilter ?? 'all', [], true);
            return;
        }
        let records = manifest.records;
        if (peerFilter)
            records = records.filter((r) => r.peer.toLowerCase() === peerFilter);
        if (!records.length) {
            this.emit.buffer(peerFilter ?? 'all', [], true);
            return;
        }
        const ordered = [...records].sort((a, b) => a.seq - b.seq);
        const tail = ordered.slice(Math.max(0, ordered.length - tailCount));
        const older = ordered.slice(0, Math.max(0, ordered.length - tailCount));
        this.emit.log('info', `[history] load peer=${peerFilter ?? 'all'} records=${ordered.length} tail=${tail.length} older=${older.length}`);
        const publish = async (recordsToOpen, isTail) => {
            const opened = await Promise.all(recordsToOpen.map((record) => this.materializeRecord(record)));
            const entries = opened
                .filter((row) => row.entry && (emitMode === 'all' || row.fresh))
                .map((row) => row.entry);
            const freshCount = opened.filter((row) => row.fresh).length;
            this.emit.log('info', `[history] corpus ${isTail ? 'tail' : 'backfill'} records=${recordsToOpen.length} fresh=${freshCount} emitted=${entries.length}`);
            if (entries.length)
                this.emit.buffer(peerFilter ?? 'all', entries, isTail);
        };
        await publish(tail, true);
        const batchSize = 20;
        for (let i = older.length; i > 0; i -= batchSize) {
            const slice = older.slice(Math.max(0, i - batchSize), i);
            await publish(slice, false);
        }
    }
    /**
     * Global read of the decrypted corpus. Does not refresh the on-chain pointer.
     * Missing bodies are decrypted once and stored; later reads stay local.
     */
    async read(options) {
        let result = [];
        this.mutationChain = this.mutationChain.catch(() => undefined).then(async () => {
            await this.init();
            await this.loadLocalManifest();
            const peer = options?.peer?.toLowerCase();
            const query = options?.query?.trim() ?? '';
            const records = (this.manifest?.records ?? []).filter((record) => !peer || record.peer.toLowerCase() === peer);
            const entries = [];
            let fresh = 0;
            for (const record of records) {
                const opened = await this.materializeRecord(record);
                if (opened.fresh)
                    fresh += 1;
                if (!opened.entry)
                    continue;
                if (query && !this.matchesQuery(record.cid, query))
                    continue;
                entries.push(opened.entry);
            }
            entries.sort((a, b) => a.ts - b.ts || a.seq - b.seq);
            const limit = options?.limit;
            result = limit && limit > 0 ? entries.slice(-limit) : entries;
            this.emit.log('info', `[history] read records=${records.length} fresh=${fresh} matches=${result.length}${query ? ' query=1' : ''}`);
        });
        await this.mutationChain;
        return result;
    }
    hasSendId(sendId) {
        if (!sendId || !this.manifest?.records?.length)
            return false;
        return this.manifest.records.some((record) => record.sendId === sendId);
    }
    async append(entry) {
        this.mutationChain = this.mutationChain.catch(() => undefined).then(async () => {
            // A conversation refresh re-mirrors every local bubble. Those sendIds are
            // already in the in-memory index after the first load — do not pull the
            // on-chain pointer or the IPFS index again for each one.
            if (!this.manifest)
                await this.loadLocalManifest();
            if (this.hasSendId(entry.sendId))
                return;
            await this.syncFromHeadUnlocked();
            if (!this.manifest)
                this.manifest = { v: 1, eoa: this.eoaLower, updatedAt: Date.now(), records: [] };
            const records = this.manifest.records;
            if (entry.sendId && records.some((record) => record.sendId === entry.sendId)) {
                this.emit.log('info', `[history] append skipped existing sendId=${diagnosticCid(entry.sendId)}`);
                return;
            }
            const seq = records.length ? records[records.length - 1].seq + 1 : 0;
            const prevCid = records.length ? records[records.length - 1].cid : this.genesisCid;
            const cipher = await aesGcmEncryptString(await this.fragmentKey(seq, prevCid), entry.body);
            const cid = keccakUtf8(cipher);
            if (this.opts.persistence)
                await this.opts.persistence.set(`${LOCAL_FRAG_KEY_PREFIX}${cid}`, cipher);
            await this.uploadFragment(cipher);
            records.push({
                seq,
                cid,
                prevCid,
                ts: entry.ts,
                peer: entry.peer.toLowerCase(),
                dir: entry.dir,
                sendId: entry.sendId,
                preview: entry.body.slice(0, 80),
            });
            await this.rememberPlain(cid, {
                seq,
                ts: entry.ts,
                peer: entry.peer.toLowerCase(),
                dir: entry.dir,
                sendId: entry.sendId,
                body: entry.body,
            });
            this.manifest.updatedAt = Date.now();
            await this.persistManifest();
        });
        await this.mutationChain;
    }
    destroy() {
        this.master = null;
        this.indexKey = null;
        this.manifest = null;
        this.corpus.clear();
        this.syncedIndexHash = '';
        this.provider?.destroy?.();
        this.provider = null;
        this.ready = false;
    }
}
// Encoding helpers kept for potential binary fragment mode (unused for now).
HistoryStore._b64 = { bytesToBase64, base64ToBytes };
//# sourceMappingURL=history.js.map