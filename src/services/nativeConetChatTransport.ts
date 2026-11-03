/**
 * Native-shell adapter for `@conet.project/chat-sdk` full WorkerCommand surface.
 * One transport, two shells: iOS (`chat-sdk-ios`) and Android (`chat-sdk-android`) both
 * implement the same `chatModuleCommand` / `chatModuleEvent` / `chatModuleSignRequest`
 * contract; only the bridge (how a JSON command reaches native and how events come
 * back) differs — see {@link NativeChatBridge}.
 *
 * When Beamio PWA runs inside the iOS WebView shell (`CashTreesIOS` /
 * `webkit.messageHandlers.CashTreesIOS`), Chat UI must **never** spawn the
 * TypeScript gossip Worker — even if `chatModuleCommand` is briefly missing.
 * Native `BeamioConetChatModule` owns OpenPGP, SSE listen, SI POST, and history
 * I/O. The module signs with the wallet key it gets at `init` (kept in
 * Keychain / Keystore). Older modules still emit `chatModuleSignRequest`; this
 * client signs via ethers and replies with `chatModuleSignResponse`.
 *
 * Browser path is unchanged (Worker). Prefer this client for any iOS shell
 * (checked before Android).
 */

import { ethers } from 'ethers'
import {
	CHAT_DAEMON_PROTOCOL_VERSION,
	hasCapability,
	negotiateChatDaemon,
	type ChatDaemonCapability,
	type ChatDaemonFeatures,
	type ChatDaemonHello,
} from '@conet.project/chat-sdk'
import type {
	BeamioChatClient,
	BeamioChatConfig,
	BeamioChatHistory,
	ChatEventListener,
	ChatEventMap,
	ChatEventName,
	ChatRoute,
	ChatStatus,
	GroupIssueRosterRequest,
	GroupIssueRosterResult,
	GroupIssueTombstoneRequest,
	GroupIssueTombstoneResult,
	GroupSendRequest,
	GroupSendResult,
	HistoryBufferEvent,
	HistoryEntry,
	HistoryLoadOptions,
	HistoryReadOptions,
	NodeInfo,
	SendMessageOptions,
	Unsubscribe,
} from '@conet.project/chat-sdk'

type ListenerBag<K extends ChatEventName> = Set<ChatEventListener<K>>

type Pending = {
	resolve: (v: unknown) => void
	reject: (e: Error) => void
	timer: ReturnType<typeof setTimeout>
}

const DEFAULT_RUNTIME = {
	sendFanout: 3,
	reconnectBaseMs: 4_000,
	reconnectMaxMs: 30_000,
	outerWrap: true,
} as const

type IosShellWindow = Window & {
	CashTreesIOS?: { chatModuleCommand?: unknown }
	webkit?: { messageHandlers?: { CashTreesIOS?: unknown } }
}

/**
 * True when this page runs inside the CashTrees iOS WebView shell.
 * Any `CashTreesIOS` inject or WK `messageHandlers.CashTreesIOS` means we must
 * **never** spawn the TypeScript gossip Worker.
 */
export function isCashTreesIosShell(): boolean {
	if (typeof window === 'undefined') return false
	const w = window as IosShellWindow
	if (w.CashTreesIOS && typeof w.CashTreesIOS === 'object') return true
	if (w.webkit?.messageHandlers?.CashTreesIOS) return true
	return false
}

/**
 * Prefer native Conet Chat Module for any iOS shell. `chatModuleCommand` is the
 * runtime API; shell presence alone still blocks the TS Worker fallback.
 */
export function preferIosNativeChatClient(): boolean {
	return isCashTreesIosShell()
}

/** How a shell carries `chatModuleCommand` to native and native events back to the PWA. */
export type NativeChatBridge = {
	/** Log label, e.g. `ios native chat`. */
	label: string
	/** `window` CustomEvent name that carries native payloads in `detail`. */
	eventName: string
	/** Deliver a WorkerCommand to the native module. Throws when the bridge is absent. */
	postCommand(cmd: Record<string, unknown>): void
	/** Deliver a sign result for a `chatModuleSignRequest`. */
	signResponse(payload: { reqId: string | number; ok: boolean; signature?: string; error?: string }): void
	/**
	 * chat-sdk-ios ≤ 0.1.4 history surface (see `NativeHistoryBridge`). Used only
	 * when the module does not answer `hello` (modules before protocol v1).
	 */
	legacyHistory?: boolean
}

/** Modules from protocol v1 answer `hello` at once; older ones never do. */
const HELLO_TIMEOUT_MS = 5_000
/**
 * How long `init` waits for the `hello` answer before it decides what to send.
 * `hello` goes out before the node lookup, so a v1 module has answered by then;
 * an older module costs at most this much.
 */
const HELLO_SETTLE_MS = 150

const LEGACY_FEATURES: ChatDaemonFeatures = negotiateChatDaemon(null)

const IOS_NATIVE_CHAT_BRIDGE: NativeChatBridge = {
	label: 'ios native chat',
	eventName: 'cashtreesios',
	legacyHistory: true,
	postCommand(cmd) {
		const ios = (window as Window & {
			CashTreesIOS?: { chatModuleCommand?: (p: Record<string, unknown>) => void }
		}).CashTreesIOS
		if (typeof ios?.chatModuleCommand !== 'function') {
			throw new Error('CashTreesIOS.chatModuleCommand unavailable')
		}
		ios.chatModuleCommand({ action: 'chatModuleCommand', command: cmd })
	},
	signResponse(payload) {
		const ios = (window as Window & {
			CashTreesIOS?: { chatModuleSignResponse?: (p: typeof payload) => void }
		}).CashTreesIOS
		if (typeof ios?.chatModuleSignResponse !== 'function') {
			throw new Error('chatModuleSignResponse unavailable')
		}
		ios.chatModuleSignResponse(payload)
	},
}

/**
 * Native shells get the wallet key with the PGP key: the module keeps it in
 * Keychain / Keystore and signs `mailbox_listen`, ACKs and sends itself, so a
 * call push can open the mailbox listen before this page runs. Older modules
 * ignore it and keep asking the page (`chatModuleSignRequest`).
 */
function identityForNative(identity: BeamioChatConfig['identity']): BeamioChatConfig['identity'] {
	return { ...identity }
}

/** How long load/append wait for the native history key (two PWA signatures) before trying anyway. */
const HISTORY_READY_WAIT_MS = 90_000
/** A native restore downloads every fragment; iOS 0.1.4 does it one by one. */
const HISTORY_LOAD_TIMEOUT_MS = 300_000
/** An append uploads a fragment + the index, then relays the head pointer. */
const HISTORY_APPEND_TIMEOUT_MS = 120_000
/** iOS 0.1.4 answers a load with only `tailCount` entries: ask for all of them. */
const LEGACY_HISTORY_LOAD_ALL = 1_000_000
const LEGACY_APPEND_QUEUE_MAX = 500
const LEGACY_LOAD_RETRY_MS = 30_000
const LEGACY_LOAD_RETRY_MAX = 10

const REGISTRY_GET_POINTER_ABI = [
	'function getPointer(address) view returns (bytes32 indexHash,uint64 ts,uint64 seq,uint64 updatedAt)',
]

const historyEntryKey = (e: HistoryEntry): string =>
	e.sendId ? `send:${e.sendId}` : `seq:${e.seq}|${e.ts}|${e.peer}`

/** iOS 0.1.4 answers `{ entries }`; Android and the TS worker answer the array itself. */
function normalizeHistoryEntries(result: unknown): HistoryEntry[] | null {
	const raw = Array.isArray(result)
		? result
		: result && typeof result === 'object' && Array.isArray((result as { entries?: unknown }).entries)
			? (result as { entries: unknown[] }).entries
			: null
	if (!raw) return null
	const out: HistoryEntry[] = []
	for (const row of raw) {
		if (!row || typeof row !== 'object') continue
		const r = row as Record<string, unknown>
		const body = typeof r.body === 'string' ? r.body : ''
		const peer = String(r.peer || '').toLowerCase()
		if (!body || !peer) continue
		out.push({
			seq: Number(r.seq) || 0,
			ts: Number(r.ts) || 0,
			peer,
			dir: r.dir === 'out' ? 'out' : 'in',
			sendId: r.sendId != null && String(r.sendId) ? String(r.sendId) : undefined,
			body,
		})
	}
	return out
}

/**
 * History over the native module (`historyLoad` / `historyAppend` / `historyRead`).
 *
 * Both native modules derive the history key from two PWA signatures. Android does that
 * after `init` resolves, so a load or append sent right after init finds no key and is
 * dropped. Every call here first waits for the module's `[history] ready` log.
 *
 * `legacy` (chat-sdk-ios ≤ 0.1.4, whose init does not report `historyApi: 2`) also needs:
 *  - load/read answer `{ entries }` once and never stream `historyBuffer`: emit the answer.
 *  - read re-downloads every fragment: answer from the entries the last load returned.
 *  - append has no sendId dedup, and an append before the first load starts the chain over
 *    at seq 0 and replaces the head pointer: hold appends until a trusted load finished.
 *  - every load rewrites the head pointer with the same records: decline that signature.
 */
class NativeHistoryBridge implements BeamioChatHistory {
	private bufferListeners = new Set<(batch: HistoryBufferEvent) => void>()
	private readyState: 'pending' | 'ready' | 'failed' = 'pending'
	private readyWaiters = new Set<() => void>()
	private loadsInFlight = new Map<string, Promise<void>>()
	private legacyLoads = 0
	private legacySynced = false
	private legacyRetries = 0
	private legacyRetryTimer: ReturnType<typeof setTimeout> | null = null
	private corpus = new Map<string, HistoryEntry>()
	private appendQueue: Array<{ entry: Omit<HistoryEntry, 'seq'>; done: () => void }> = []
	/** Legacy loads and appends run one at a time, so a load's pointer rewrite is told apart. */
	private lane: Promise<unknown> = Promise.resolve()

	private legacy: boolean

	constructor(
		private readonly client: NativeConetChatClientImpl,
		private readonly legacyShell: boolean,
	) {
		this.legacy = legacyShell
	}

	/**
	 * After `init`. A module that answered `hello` decides by `history.v2`. An
	 * older one: iOS shells are legacy unless `init` reported `historyApi >= 2`.
	 */
	_setHistoryFeatures(features: ChatDaemonFeatures, api: number): void {
		this.legacy =
			features.status === 'negotiated'
				? !hasCapability(features, 'history.v2')
				: this.legacyShell && !(api >= 2)
	}

	/** True while a legacy load runs: its head-pointer rewrite is redundant. */
	get legacyLoadInFlight(): boolean {
		return this.legacy && this.legacyLoads > 0
	}

	/** Native log line → history key readiness. */
	_noteLog(message: string): void {
		if (/\[history\] ready\b/.test(message)) this.setReady('ready')
		else if (/\[history\] (prepare failed|domain sign failed|selfSign failed|keccak master failed|hkdf failed)/.test(message)) {
			this.setReady('failed')
		}
	}

	/** A new native session (init) derives the key again. */
	_resetSession(): void {
		this.readyState = 'pending'
		this.legacySynced = false
		this.legacyRetries = 0
		this.clearRetry()
	}

	_destroy(): void {
		this.clearRetry()
		this.setReady('failed')
		for (const item of this.appendQueue.splice(0)) item.done()
	}

	private setReady(state: 'ready' | 'failed'): void {
		this.readyState = state
		for (const wake of [...this.readyWaiters]) wake()
		this.readyWaiters.clear()
		if (state === 'ready') this.client.log('info', '[chatHistory] native history key ready')
	}

	private waitReady(): Promise<boolean> {
		if (this.readyState !== 'pending') return Promise.resolve(this.readyState === 'ready')
		return new Promise<boolean>((resolve) => {
			const wake = () => {
				clearTimeout(timer)
				this.readyWaiters.delete(wake)
				resolve(this.readyState === 'ready')
			}
			const timer = setTimeout(() => {
				this.readyWaiters.delete(wake)
				this.client.log('warn', '[chatHistory] native history key not confirmed — trying anyway')
				resolve(false)
			}, HISTORY_READY_WAIT_MS)
			this.readyWaiters.add(wake)
		})
	}

	private inLane<T>(task: () => Promise<T>): Promise<T> {
		const run = this.lane.catch(() => undefined).then(task)
		this.lane = run.catch(() => undefined)
		return run
	}

	private clearRetry(): void {
		if (this.legacyRetryTimer) clearTimeout(this.legacyRetryTimer)
		this.legacyRetryTimer = null
	}

	load(options?: HistoryLoadOptions): Promise<void> {
		const key = JSON.stringify(options ?? {})
		const running = this.loadsInFlight.get(key)
		if (running) return running
		const run = this.waitReady()
			.then(() => (this.legacy ? this.loadLegacy(options) : this.loadNative(options)))
			.finally(() => {
				if (this.loadsInFlight.get(key) === run) this.loadsInFlight.delete(key)
			})
		this.loadsInFlight.set(key, run)
		return run
	}

	private async loadNative(options?: HistoryLoadOptions): Promise<void> {
		this.client.log('info', '[chatHistory] native history.load → on-chain pointer / IPFS index')
		await this.client.request<void>({ type: 'historyLoad', reqId: 0, options }, HISTORY_LOAD_TIMEOUT_MS)
	}

	private async loadLegacy(options?: HistoryLoadOptions): Promise<void> {
		const fullLoad = !options?.peer
		const entries = await this.inLane(async (): Promise<HistoryEntry[] | null> => {
			this.legacyLoads += 1
			try {
				this.client.log('info', '[chatHistory] native history.load (iOS 0.1.4) → on-chain pointer / IPFS index')
				const result = await this.client.request<unknown>(
					{
						type: 'historyLoad',
						reqId: 0,
						options: { ...(options ?? {}), tailCount: options?.tailCount ?? LEGACY_HISTORY_LOAD_ALL },
					},
					HISTORY_LOAD_TIMEOUT_MS,
				)
				return normalizeHistoryEntries(result)
			} catch (ex) {
				this.client.log('warn', `[chatHistory] native history.load failed: ${(ex as Error)?.message ?? String(ex)}`)
				return null
			} finally {
				this.legacyLoads -= 1
			}
		})
		if (entries) {
			for (const e of entries) this.corpus.set(historyEntryKey(e), e)
			this.client.log('info', `[chatHistory] native history decrypted ${entries.length}`)
			if (entries.length) {
				this._emit({ peer: options?.peer?.toLowerCase() || 'all', entries, isTail: true })
			}
		}
		if (fullLoad && !this.legacySynced) await this.settleLegacySync(entries)
	}

	/**
	 * Release held appends only after the native index matches the chain: the load returned
	 * records, or the chain has no pointer yet (first message of this account). Otherwise
	 * an append would publish an index that drops every earlier record.
	 */
	private async settleLegacySync(entries: HistoryEntry[] | null): Promise<void> {
		let trusted = !!entries && entries.length > 0
		if (!trusted && entries) trusted = (await this.client.readPointerSeq()) === 0
		if (trusted) {
			this.legacySynced = true
			this.clearRetry()
			this.flushAppendQueue()
			return
		}
		if (this.legacyRetries >= LEGACY_LOAD_RETRY_MAX || this.legacyRetryTimer) return
		this.legacyRetries += 1
		this.client.log('warn', `[chatHistory] native index not synced with the chain — retry ${this.legacyRetries} in ${LEGACY_LOAD_RETRY_MS / 1000}s`)
		this.legacyRetryTimer = setTimeout(() => {
			this.legacyRetryTimer = null
			void this.load().catch(() => undefined)
		}, LEGACY_LOAD_RETRY_MS)
	}

	async append(entry: Omit<HistoryEntry, 'seq'>): Promise<void> {
		await this.waitReady()
		if (!this.legacy) {
			await this.client.request<void>({ type: 'historyAppend', reqId: 0, entry }, HISTORY_APPEND_TIMEOUT_MS)
			return
		}
		if (entry.sendId && this.corpus.has(`send:${entry.sendId}`)) return Promise.resolve()
		return new Promise<void>((resolve) => {
			if (this.appendQueue.length >= LEGACY_APPEND_QUEUE_MAX) this.appendQueue.shift()?.done()
			this.appendQueue.push({ entry, done: resolve })
			if (this.legacySynced) this.flushAppendQueue()
			else if (!this.loadsInFlight.size && !this.legacyRetryTimer) void this.load().catch(() => undefined)
		})
	}

	/** One append at a time; skip sendIds the index already holds. */
	private flushAppendQueue(): void {
		for (const item of this.appendQueue.splice(0)) {
			void this.inLane(async () => {
				const { entry } = item
				try {
					if (entry.sendId && this.corpus.has(`send:${entry.sendId}`)) return
					await this.client.request<unknown>({ type: 'historyAppend', reqId: 0, entry }, HISTORY_APPEND_TIMEOUT_MS)
					const stored: HistoryEntry = { ...entry, peer: entry.peer.toLowerCase(), seq: this.corpus.size }
					this.corpus.set(historyEntryKey(stored), stored)
				} catch (ex) {
					this.client.log('warn', `[chatHistory] native history.append failed: ${(ex as Error)?.message ?? String(ex)}`)
				} finally {
					item.done()
				}
			})
		}
	}

	async read(options?: HistoryReadOptions): Promise<HistoryEntry[]> {
		await this.waitReady()
		if (!this.legacy) {
			const result = await this.client.request<unknown>({ type: 'historyRead', reqId: 0, options }, 60_000)
			return normalizeHistoryEntries(result) ?? []
		}
		const pending = [...this.loadsInFlight.values()]
		if (pending.length) await Promise.allSettled(pending)
		const peer = options?.peer?.toLowerCase()
		const terms = (options?.query ?? '').toLowerCase().split(/\s+/).filter(Boolean)
		const entries = [...this.corpus.values()].filter((e) => {
			if (peer && e.peer !== peer) return false
			if (!terms.length) return true
			const text = e.body.toLowerCase()
			return terms.every((t) => text.includes(t))
		})
		entries.sort((a, b) => a.ts - b.ts || a.seq - b.seq)
		const limit = options?.limit
		return limit && limit > 0 ? entries.slice(-limit) : entries
	}

	onBuffer(cb: (batch: HistoryBufferEvent) => void): Unsubscribe {
		this.bufferListeners.add(cb)
		return () => this.bufferListeners.delete(cb)
	}

	_emit(batch: HistoryBufferEvent): void {
		for (const cb of this.bufferListeners) {
			try {
				cb(batch)
			} catch {
				/* isolate */
			}
		}
	}
}

class NativeConetChatClientImpl implements BeamioChatClient {
	private reqSeq = 1
	private pending = new Map<number, Pending>()
	private listeners: { [K in ChatEventName]?: ListenerBag<K> } = {}
	private historyBridge: NativeHistoryBridge
	private routes: ChatRoute[] = []
	private nodes: NodeInfo[] = []
	private destroyed = false
	private nativeListener: ((ev: Event) => void) | null = null
	private signingKeyHex: string
	private features: ChatDaemonFeatures = LEGACY_FEATURES
	private helloAnswer: Promise<ChatDaemonHello | null> = Promise.resolve(null)

	constructor(
		private readonly config: BeamioChatConfig,
		private readonly bridge: NativeChatBridge,
	) {
		this.historyBridge = new NativeHistoryBridge(this, bridge.legacyHistory === true)
		this.signingKeyHex = (config.identity.privateKeyHex || '').replace(/^0x/i, '')
	}

	get history(): BeamioChatHistory {
		return this.historyBridge
	}

	/** Protocol v1 `hello` answer of the native module; null for modules before v1. */
	hello(): Promise<ChatDaemonHello | null> {
		return this.helloAnswer
	}

	/** What the native module negotiated (`legacy` until / unless it answers `hello`). */
	get daemonFeatures(): ChatDaemonFeatures {
		return this.features
	}

	/** True when the module negotiated `cap`, or did not answer `hello` (keep the pre-v1 behaviour). */
	private allows(cap: ChatDaemonCapability): boolean {
		return this.features.status !== 'negotiated' || hasCapability(this.features, cap)
	}

	private startHello(): Promise<ChatDaemonHello | null> {
		const answer = this.request<unknown>(
			{ type: 'hello', reqId: 0, protocolVersion: CHAT_DAEMON_PROTOCOL_VERSION },
			HELLO_TIMEOUT_MS,
		)
			.then((result) => {
				const features = negotiateChatDaemon(result)
				this.features = features
				if (features.status === 'negotiated') {
					this.log(
						'info',
						`${this.bridge.label}: protocol v${features.protocolVersion} sdk ${features.sdkVersion || '?'} caps=${features.capabilities.join(',')}`,
					)
					return result as ChatDaemonHello
				}
				this.log('warn', `${this.bridge.label}: hello answer not usable (${features.status})`)
				return null
			})
			.catch(() => {
				if (!this.destroyed) this.log('info', `${this.bridge.label}: no hello answer (module before protocol v1)`)
				return null
			})
		this.helloAnswer = answer
		return answer
	}

	async init(): Promise<void> {
		if (this.destroyed) throw new Error('native chat client destroyed')
		this.historyBridge._resetSession()
		this.attachNativeListener()
		this.features = LEGACY_FEATURES
		const hello = this.startHello()
		this.nodes = await this.config.getNodes().catch(() => [])
		await Promise.race([hello, new Promise((resolve) => setTimeout(resolve, HELLO_SETTLE_MS))])
		this.routes = []
		const payload = {
			identity: identityForNative(this.config.identity),
			conetRpcUrl: this.config.conetRpcUrl,
			addressPgpContractAddress: this.config.addressPgpContractAddress,
			ipfsBaseUrl: this.config.ipfsBaseUrl,
			ipfsWriteBaseUrl: this.config.ipfsWriteBaseUrl,
			chainId: this.config.chainId ?? 224422,
			chatIndexRegistryAddress:
				this.config.chatIndexRegistryAddress ?? '0x1511Caa71081C84d8a591490D1b83879088EED72',
			apiBaseUrl: this.config.apiBaseUrl,
			runtime: { ...DEFAULT_RUNTIME, ...(this.config.runtime ?? {}) },
			nodes: this.nodes,
			routes: this.routes,
			// `inbound.deferAck`: the page confirms each stored inbound message with
			// `ackInbound`; the module holds the mailbox ACK until then. Modules
			// before protocol v1 get it too (older SDKs ignore it).
			deferAck: this.allows('inbound.deferAck'),
		}
		// `identity.provision`: hand the keys to the native daemon first (stored in
		// Keychain / Keystore). `init` still carries them for shells that predate
		// the command (the page can update before the shell does); modules before
		// protocol v1 get the command anyway and ignore it when unknown.
		const id = this.config.identity
		if (this.allows('identity.provision')) this.postCommand({
			type: 'provisionIdentity',
			reqId: -1,
			payload: {
				eoa: id.eoaAddress,
				walletPrivateKey: id.privateKeyHex,
				pgpPrivateKeyArmored: id.pgpPrivateKeyArmored,
				pgpPublicKeyArmored: id.pgpPublicKeyArmored,
				ownRoute: id.ownRouteArmoredPublicKey,
			},
		})
		const ready = await this.request<{ historyApi?: unknown } | undefined>({ type: 'init', reqId: 0, payload }, 180_000)
		this.historyBridge._setHistoryFeatures(
			this.features,
			Number(ready && typeof ready === 'object' ? ready.historyApi : 0) || 0,
		)
	}

	/** Diagnostics into the host log sink (no key material / plaintext). */
	log(level: 'info' | 'warn' | 'error', message: string): void {
		this.emit('log', { level, message })
	}

	/** On-chain history head `seq` (RPC `getPointer`); 0 = no pointer yet, null = unreadable. */
	async readPointerSeq(): Promise<number | null> {
		const owner = this.config.identity.eoaAddress
		const registry = this.config.chatIndexRegistryAddress ?? '0x1511Caa71081C84d8a591490D1b83879088EED72'
		if (!owner || !this.config.conetRpcUrl) return null
		const net = new ethers.Network('conet', this.config.chainId ?? 224422)
		const provider = new ethers.JsonRpcProvider(this.config.conetRpcUrl, net, { staticNetwork: net })
		try {
			const contract = new ethers.Contract(registry, REGISTRY_GET_POINTER_ABI, provider)
			const ptr = await contract.getPointer(owner)
			if (!ptr?.[0] || /^0x0+$/.test(String(ptr[0]))) return 0
			return Number(ptr[2])
		} catch {
			return null
		} finally {
			provider.destroy()
		}
	}

	/** The page stored these inbound messages: let the native module ACK the mailbox (`inbound.deferAck`). */
	ackInbound(armorHashes: string[]): void {
		const hashes = (armorHashes || []).filter((h) => typeof h === 'string' && h.length > 0)
		if (!hashes.length || this.destroyed || !this.allows('inbound.deferAck')) return
		this.postCommand({ type: 'ackInbound', armorHashes: hashes })
	}

	setRoutes(routes: ChatRoute[]): void {
		this.routes = routes || []
		this.postCommand({ type: 'setRoutes', routes: this.routes })
	}

	setNodes(nodes: NodeInfo[]): void {
		if (!nodes?.length) return
		this.nodes = nodes
		this.postCommand({ type: 'setNodes', nodes })
	}

	async sendGroupMessage(request: GroupSendRequest): Promise<GroupSendResult> {
		return this.request<GroupSendResult>({ type: 'sendGroup', reqId: 0, request }, 60_000)
	}

	async issueGroupRoster(request: GroupIssueRosterRequest): Promise<GroupIssueRosterResult> {
		return this.request<GroupIssueRosterResult>({ type: 'issueGroupRoster', reqId: 0, request }, 60_000)
	}

	async issueGroupTombstone(request: GroupIssueTombstoneRequest): Promise<GroupIssueTombstoneResult> {
		return this.request<GroupIssueTombstoneResult>({ type: 'issueGroupTombstone', reqId: 0, request }, 60_000)
	}

	async sendMessage(to: ChatRoute, payload: string, opts?: SendMessageOptions): Promise<{ sendId: string }> {
		const sendId = opts?.sendId || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
		const result = await this.request<{ sent?: unknown } | null>(
			{
				type: 'send',
				reqId: 0,
				to,
				payload,
				sendId,
				beamioNoPush: opts?.beamioNoPush,
			},
			60_000,
		)
		// The module acks ok with `sent: false` when every entry failed.
		if (result && typeof result === 'object' && result.sent === false) {
			throw new Error('native send: not delivered to any entry')
		}
		return { sendId }
	}

	async queryPresence(contacts: ChatRoute[]): Promise<Record<string, boolean>> {
		const result = await this.request<Record<string, boolean>>(
			{ type: 'queryPresence', reqId: 0, contacts },
			30_000,
		)
		return result && typeof result === 'object' ? result : {}
	}

	async queryNativeWake(contact: ChatRoute): Promise<boolean | null> {
		try {
			const result = await this.request<{ nativeWakeable?: boolean; ok?: boolean }>(
				{ type: 'queryNativeWake', reqId: 0, contact },
				30_000,
			)
			if (!result || typeof result !== 'object') return null
			if (result.ok === false) return null
			return typeof result.nativeWakeable === 'boolean' ? result.nativeWakeable : null
		} catch {
			return null
		}
	}

	async postMailboxCommand(
		routerArmoredPublicKey: string,
		command: Record<string, unknown>,
	): Promise<boolean> {
		try {
			await this.request<void>(
				{ type: 'mailboxCommand', reqId: 0, routerArmoredPublicKey, command },
				30_000,
			)
			return true
		} catch {
			return false
		}
	}

	async postOwnMailboxCommand(command: Record<string, unknown>): Promise<boolean> {
		try {
			await this.request<void>({ type: 'ownMailboxCommand', reqId: 0, command }, 30_000)
			return true
		} catch {
			return false
		}
	}

	async startVoiceListen(
		sessionId: string,
		pushWakeup?: {
			callId: string
			calleeEoa: string
			expiresAt: number
			timestamp: number
			offerText?: string
			recipientPgp?: string
		},
	): Promise<boolean> {
		try {
			await this.request<void>({ type: 'voiceListen', reqId: 0, sessionId, pushWakeup }, 60_000)
			return true
		} catch {
			return false
		}
	}

	async stopVoiceListen(sessionId: string): Promise<boolean> {
		try {
			await this.request<void>({ type: 'voiceUnlisten', reqId: 0, sessionId }, 30_000)
			return true
		} catch {
			return false
		}
	}

	async sendVoiceFrame(routerArmoredPublicKey: string, frame: Record<string, unknown>): Promise<boolean> {
		try {
			await this.request<void>({ type: 'voiceFrame', reqId: 0, routerArmoredPublicKey, frame }, 30_000)
			return true
		} catch {
			return false
		}
	}

	pause(): void {
		this.postCommand({ type: 'pause' })
	}

	resume(): void {
		this.postCommand({ type: 'resume' })
	}

	destroy(): void {
		if (this.destroyed) return
		this.destroyed = true
		try {
			this.postCommand({ type: 'destroy' })
		} catch {
			/* ignore */
		}
		this.detachNativeListener()
		this.historyBridge._destroy()
		this.rejectPending(new Error('native chat destroyed'))
		for (const k of Object.keys(this.listeners) as ChatEventName[]) {
			this.listeners[k]?.clear()
		}
	}

	on<K extends ChatEventName>(event: K, cb: ChatEventListener<K>): Unsubscribe {
		let set = this.listeners[event] as ListenerBag<K> | undefined
		if (!set) {
			set = new Set()
			;(this.listeners as Record<string, Set<ChatEventListener<ChatEventName>>>)[event] = set as Set<
				ChatEventListener<ChatEventName>
			>
		}
		set.add(cb)
		return () => set!.delete(cb)
	}

	/** Exposed for history bridge / internal request helper. */
	request<T>(cmd: Record<string, unknown>, timeoutMs = 20_000): Promise<T> {
		if (this.destroyed) return Promise.reject(new Error('native chat destroyed'))
		const reqId = this.reqSeq++
		const body = { ...cmd, reqId }
		return new Promise<T>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(reqId)
				reject(new Error(`native chat request timeout (${String(cmd.type)})`))
			}, timeoutMs)
			this.pending.set(reqId, {
				resolve: (v) => resolve(v as T),
				reject,
				timer,
			})
			try {
				this.postCommand(body)
			} catch (e) {
				clearTimeout(timer)
				this.pending.delete(reqId)
				reject(e instanceof Error ? e : new Error(String(e)))
			}
		})
	}

	private postCommand(cmd: Record<string, unknown>): void {
		this.bridge.postCommand(cmd)
	}

	private emit<K extends ChatEventName>(event: K, payload: ChatEventMap[K]): void {
		const set = this.listeners[event] as ListenerBag<K> | undefined
		if (!set) return
		for (const cb of set) {
			try {
				cb(payload)
			} catch {
				/* isolate */
			}
		}
	}

	private emitStatus(status: ChatStatus, detail?: string): void {
		this.emit('status', { status, detail })
		this.emit('log', {
			level: status === 'error' ? 'error' : 'info',
			message: `${this.bridge.label}: ${status}${detail ? ` (${detail})` : ''}`,
		})
	}

	private rejectPending(err: Error): void {
		for (const [, p] of this.pending) {
			clearTimeout(p.timer)
			p.reject(err)
		}
		this.pending.clear()
	}

	private attachNativeListener(): void {
		if (this.nativeListener || typeof window === 'undefined') return
		this.nativeListener = (ev: Event) => {
			const detail = (ev as CustomEvent).detail as Record<string, unknown> | undefined
			if (!detail || typeof detail !== 'object') return
			const action = String(detail.action || '')
			if (action === 'chatModuleSignRequest') {
				void this.handleSignRequest(detail)
				return
			}
			if (action === 'chatModuleEvent') {
				this.handleOutbound(detail.event ?? detail.payload ?? detail)
				return
			}
			// Native may also emit the WorkerOutbound shape at the top level.
			if (typeof detail.type === 'string' && String(detail.type).startsWith('event:')) {
				this.handleOutbound(detail)
			}
		}
		window.addEventListener(this.bridge.eventName, this.nativeListener)
	}

	private detachNativeListener(): void {
		if (!this.nativeListener || typeof window === 'undefined') return
		window.removeEventListener(this.bridge.eventName, this.nativeListener)
		this.nativeListener = null
	}

	private async handleSignRequest(detail: Record<string, unknown>): Promise<void> {
		const reqId = String(detail.reqId || '')
		const kind = String(detail.kind || 'eip191')
		const reply = (ok: boolean, signature?: string, error?: string) => {
			try {
				this.bridge.signResponse({
					reqId,
					ok,
					signature: signature || '',
					error: error || '',
				})
			} catch {
				/* ignore */
			}
		}
		try {
			const hex = this.signingKeyHex
			if (hex.length < 64) {
				reply(false, undefined, 'missing_signing_key')
				return
			}
			const wallet = new ethers.Wallet(`0x${hex}`)
			if (kind === 'eip712') {
				const td = detail.typedData as
					| {
							domain?: ethers.TypedDataDomain
							types?: Record<string, Array<ethers.TypedDataField>>
							primaryType?: string
							value?: Record<string, unknown>
							message?: Record<string, unknown>
					  }
					| undefined
				// iOS sends the EIP-712 `message` key, Android sends both `value` and `message`.
				const value = td?.value ?? td?.message
				if (!td?.domain || !td.types || !value) {
					reply(false, undefined, 'bad_typed_data')
					return
				}
				if (td.primaryType === 'SetPointer' && this.historyBridge.legacyLoadInFlight) {
					// iOS 0.1.4 rewrites the unchanged index on every load; skip that relay write.
					reply(false, undefined, 'redundant_pointer_write')
					return
				}
				const { EIP712Domain: _omit, ...types } = td.types as Record<string, Array<ethers.TypedDataField>> & {
					EIP712Domain?: unknown
				}
				const sig = await wallet.signTypedData(td.domain, types, value)
				reply(true, sig)
				return
			}
			const message = String(detail.message || '')
			if (!message) {
				reply(false, undefined, 'empty_message')
				return
			}
			const sig = await wallet.signMessage(message)
			reply(true, sig)
		} catch (e) {
			reply(false, undefined, e instanceof Error ? e.message : String(e))
		}
	}

	private handleOutbound(raw: unknown): void {
		if (!raw || typeof raw !== 'object') return
		const msg = raw as Record<string, unknown>
		const type = String(msg.type || '')

		if (type === 'ready' || type === 'ack') {
			const reqId = Number(msg.reqId)
			const pending = this.pending.get(reqId)
			if (!pending) return
			clearTimeout(pending.timer)
			this.pending.delete(reqId)
			if (type === 'ready' || msg.ok === true) {
				pending.resolve(msg.result)
			} else {
				pending.reject(new Error(String(msg.error || 'native_ack_failed')))
			}
			return
		}

		if (type === 'nodesRequest') {
			const reqId = Number(msg.reqId)
			void this.config
				.getNodes()
				.then((nodes) => {
					this.nodes = nodes || []
					this.postCommand({ type: 'nodesResponse', reqId, nodes: this.nodes })
				})
				.catch(() => {
					this.postCommand({ type: 'nodesResponse', reqId, nodes: this.nodes })
				})
			return
		}

		switch (type) {
			case 'event:message':
				this.emit('message', msg.payload as ChatEventMap['message'])
				break
			case 'event:group':
				this.emit('group', msg.payload as ChatEventMap['group'])
				break
			case 'event:delivery':
				this.emit('delivery', msg.payload as ChatEventMap['delivery'])
				break
			case 'event:presence':
				this.emit('presence', msg.payload as ChatEventMap['presence'])
				break
			case 'event:status': {
				const st = msg.payload as { status?: ChatStatus; detail?: string }
				this.emitStatus(st?.status || 'listening', st?.detail)
				break
			}
			case 'event:historyBuffer': {
				const batch = msg.payload as HistoryBufferEvent
				this.historyBridge._emit(batch)
				this.emit('historyBuffer', batch)
				break
			}
			case 'event:voiceFrame':
				this.emit('voiceFrame', msg.payload as ChatEventMap['voiceFrame'])
				break
			case 'event:voiceGap':
				this.emit('voiceGap', msg.payload as ChatEventMap['voiceGap'])
				break
			case 'event:voiceConflict':
				this.emit('voiceConflict', msg.payload as ChatEventMap['voiceConflict'])
				break
			case 'event:log':
				this.historyBridge._noteLog(String(msg.message || ''))
				this.emit('log', {
					level: (msg.level as 'info' | 'warn' | 'error') || 'info',
					message: String(msg.message || ''),
				})
				break
			default:
				break
		}
	}
}

/** Native chat client: {@link BeamioChatClient} plus the native-only daemon surface. */
export type NativeConetChatClient = BeamioChatClient & {
	readonly daemonFeatures: ChatDaemonFeatures
	ackInbound(armorHashes: string[]): void
}

export function isNativeConetChatClient(client: unknown): client is NativeConetChatClient {
	return client instanceof NativeConetChatClientImpl
}

/**
 * Native chat client for a shell. Defaults to the iOS bridge; the Android shell passes its own
 * {@link NativeChatBridge} (see `androidNativeChatClient.ts`).
 */
export function createNativeConetChatClient(
	config: BeamioChatConfig,
	bridge: NativeChatBridge = IOS_NATIVE_CHAT_BRIDGE,
): NativeConetChatClient {
	return new NativeConetChatClientImpl(config, bridge)
}
