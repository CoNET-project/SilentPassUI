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
import type { HistoryEntry, HistoryLoadOptions, HistoryReadOptions, PersistenceAdapter } from '../types.js';
import { base64ToBytes, bytesToBase64 } from '../crypto.js';
export interface HistoryEmit {
    buffer(peer: string, entries: HistoryEntry[], isTail: boolean): void;
    log(level: 'info' | 'warn' | 'error', message: string): void;
}
export declare class HistoryStore {
    private readonly emit;
    private readonly opts;
    private master;
    private indexKey;
    private genesisCid;
    private manifest;
    private eoaLower;
    private ready;
    /** Cached signer + its self-address EIP-191 signature (storageFragment auth). */
    private wallet;
    private selfSign;
    /** Lazily-created read-only CoNET provider (RPC-first pointer reads). */
    private provider;
    private mutationChain;
    /** Decrypted corpus. Keyed by fragment cid so a known body is never fetched again. */
    private corpus;
    /** Last on-chain index hash already merged into the local manifest. */
    private syncedIndexHash;
    constructor(emit: HistoryEmit, opts: {
        eoaAddress: string;
        privateKeyHex: string;
        chainId: number;
        ipfsBaseUrl: string;
        ipfsWriteBaseUrl?: string;
        conetRpcUrl: string;
        chatIndexRegistryAddress: string;
        apiBaseUrl?: string;
        persistence?: PersistenceAdapter;
    });
    private get writeBase();
    private get readBase();
    private getProvider;
    init(): Promise<void>;
    /** Local mirror is keyed per-EOA (index cipher changes each append). */
    private localIndexKey;
    /** Read the on-chain head pointer (RPC-first). Returns null when unset/unreachable. */
    private readOnchainPointer;
    /** Fetch the encrypted index cipher by its content hash. */
    private fetchIndexCipherByHash;
    private loadLocalManifest;
    private recordKey;
    private unionMergeRecords;
    private hasChainConflict;
    private decryptRecord;
    private relinearizeAndReencrypt;
    private syncFromHeadUnlocked;
    /** Union-sync the local mirror with the current on-chain head. */
    syncFromHead(): Promise<boolean>;
    private persistManifest;
    /**
     * Move the EOA's on-chain head pointer to `indexHash` via the gasless relay.
     * The EOA signs `SetPointer(owner,indexHash,ts,seq,nonce)` (EIP-712); the API relayer pays gas.
     * No-op (with a warning) when `apiBaseUrl` is not configured.
     */
    private updateOnchainPointer;
    private uploadFragment;
    private downloadFragment;
    private fragmentKey;
    private plainKey;
    private rememberPlain;
    /** Memory, then local plaintext, then local cipher, then IPFS. A hit never reaches the next step. */
    private materializeRecord;
    private matchesQuery;
    load(options?: HistoryLoadOptions): Promise<void>;
    /**
     * Global read of the decrypted corpus. Does not refresh the on-chain pointer.
     * Missing bodies are decrypted once and stored; later reads stay local.
     */
    read(options?: HistoryReadOptions): Promise<HistoryEntry[]>;
    private hasSendId;
    append(entry: Omit<HistoryEntry, 'seq'>): Promise<void>;
    destroy(): void;
    static _b64: {
        bytesToBase64: typeof bytesToBase64;
        base64ToBytes: typeof base64ToBytes;
    };
}
//# sourceMappingURL=history.d.ts.map