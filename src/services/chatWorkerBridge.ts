/**
 * Bridge between SilentPassUI `services/chat.ts` and `@conet.project/chat-sdk`
 * worker client. The Web Worker performs ALL inbound openpgp decryption + ethers
 * signing, so the main thread no longer blocks for seconds after startup (root
 * cause of the "app frozen ~10s after launch" bug).
 *
 * Scope of this wiring (surgical, minimal blast radius):
 *  - The inbound gossip LISTEN loop (SSE connect/reconnect + decrypt) runs in the
 *    worker; decrypted host-ready lines are fed back to the existing `newMessage`
 *    serial queue (App.tsx `addNewMessage`) — unchanged main-thread parsing.
 *  - Outbound send / presence / delivery ACK remain on the main thread (existing
 *    `sendMessage` / `wallet_online_query` / delivery ACK code paths) to keep this
 *    change small; those are not the freeze source (they are user-triggered, not a
 *    continuous background loop).
 *
 * Routing rules preserved by the worker (see repo `conet-p2p-mailbox-routing-protocol`,
 * `beamio-conet-chat-protocol`): listen encrypted to mailbox B via entry C ≠ B with
 * `listenKind:'chat'`; never direct-connect mailbox B.
 */

import {
	createBeamioChatClient,
	type BeamioChatConfig,
	type HistoryBufferEvent,
	type HistoryEntry,
	type HistoryLoadOptions,
	type HistoryReadOptions,
	type NodeInfo,
} from '@conet.project/chat-sdk'
import { CONET_ADDRESS_PGP, CONET_CHAT_INDEX_REGISTRY } from '../config/chainAddresses'

const CONET_RPC_URL = 'https://rpc1.conet.network'
const IPFS_BASE_URL = 'https://ipfs.conet.network/api'
/**
 * Cluster API base for the gasless ChatIndexRegistry pointer relay. The SDK appends
 * `/setChatIndexPointer` — matching the `x402sdk` router mounted at `/api` (see
 * beamioServer). Keep in sync with `services/AAaccount.beamioApiBase`.
 */
const BEAMIO_API_BASE_URL = 'https://beamio.app/api'

type ChatWorkerClient = ReturnType<typeof createBeamioChatClient>

/** Only one worker listen client is alive per process. A new session replaces the old. */
let activeClient: ChatWorkerClient | null = null
let workerInitPromise: Promise<boolean> | null = null
let lastGossipParams: StartWorkerGossipParams | null = null

type VoiceRelayRequest = {
	sessionId: string
	pushWakeup?: {
		callId: string
		calleeEoa: string
		expiresAt: number
		timestamp: number
		offerText?: string
		recipientPgp?: string
	}
}

/** Survives a gossip-worker restart so an in-progress call can reopen its mailbox SSE. */
let activeVoiceRelay: VoiceRelayRequest | null = null
let voiceRelayOpen: Promise<boolean> | null = null
let voiceRelayOpenSessionId = ''

/**
 * Host subscribers to encrypted-history restore/append buffer batches. Registered
 * independently of the worker session lifecycle so a page can `onHistoryBuffer(...)`
 * before or after `startWorkerGossipListen()`; the active client fans batches here.
 */
const historyBufferListeners = new Set<(batch: HistoryBufferEvent) => void>()
const voiceFrameListeners = new Set<(frame: Record<string, unknown>) => void>()

/**
 * Race fix: `initChat` sets React `gossip=true` *before* the worker client exists.
 * App effects then call `loadWorkerHistory()` while `activeClient` is still null and
 * never retry (deps unchanged). Queue the request and flush once the worker is ready.
 */
let pendingHistoryLoad: HistoryLoadOptions | true | null = null
let historyLoadInFlight: Promise<void> | null = null

/**
 * Subscribe to encrypted-history buffer batches (restore tail/backfill + live append
 * mirror). Idempotent unsubscribe. Safe to call with no active worker client.
 */
export const onHistoryBuffer = (cb: (batch: HistoryBufferEvent) => void): (() => void) => {
	historyBufferListeners.add(cb)
	return () => {
		historyBufferListeners.delete(cb)
	}
}

export const onVoiceFrame = (cb: (frame: Record<string, unknown>) => void): (() => void) => {
	voiceFrameListeners.add(cb)
	return () => voiceFrameListeners.delete(cb)
}

const runHistoryLoad = async (options?: HistoryLoadOptions): Promise<void> => {
	const client = activeClient
	if (!client) return
	try {
		await client.history.load(options)
	} catch (ex) {
		console.warn(
			'[chatHistory] history.load failed:',
			(ex as Error)?.message ?? String(ex),
		)
	}
}

/**
 * Restore encrypted history from the on-chain head pointer (RPC `getPointer(eoa)`) →
 * IPFS index → decrypt tail → backfill.
 *
 * If the gossip worker is not ready yet, queues the load and runs it automatically
 * when {@link startWorkerGossipListen} finishes init (recover / LoadingPage race).
 */
export const loadWorkerHistory = async (options?: HistoryLoadOptions): Promise<void> => {
	if (!activeClient) {
		pendingHistoryLoad = options ?? true
		console.info('[chatHistory] load queued — worker not ready yet')
		return
	}
	const queued = pendingHistoryLoad
	pendingHistoryLoad = null
	const opts = options ?? (queued && queued !== true ? queued : undefined)
	const run = runHistoryLoad(opts)
	historyLoadInFlight = run
	try {
		await run
		const entries = await readDecryptedChatHistory()
		if (!entries) return
		for (const cb of decryptedHistoryListeners) {
			try {
				cb(entries)
			} catch {
				/* isolate subscriber */
			}
		}
	} finally {
		if (historyLoadInFlight === run) historyLoadInFlight = null
	}
}

/**
 * Append a sent/received entry to encrypted history (local mirror + IPFS fragment +
 * on-chain head pointer via the gasless relay). Best-effort: no-ops when no worker
 * client is active. Never throws into the message-store path.
 */
export const appendWorkerHistory = async (
	entry: Omit<HistoryEntry, 'seq'>,
): Promise<void> => {
	if (!activeClient) return
	try {
		await activeClient.history.append(entry)
	} catch {
		/* best-effort persist; the local profile.chats mirror is still authoritative */
	}
}

/**
 * Global decrypted history. UI must call this instead of fetching IPFS fragments.
 * `null` means the worker is not ready — keep the last trusted transcript.
 * A `query` searches the whole local corpus (message text, call status, file name).
 */
export const readDecryptedChatHistory = async (
	options?: HistoryReadOptions,
): Promise<HistoryEntry[] | null> => {
	if (!activeClient) return null
	try {
		return await activeClient.history.read(options)
	} catch {
		return null
	}
}

export const searchDecryptedChatHistory = async (
	query: string,
	options?: Omit<HistoryReadOptions, 'query'>,
): Promise<HistoryEntry[] | null> => {
	const text = query.trim()
	if (!text) return readDecryptedChatHistory(options)
	return readDecryptedChatHistory({ ...options, query: text })
}

const decryptedHistoryListeners = new Set<(entries: HistoryEntry[]) => void>()

/** Fired after a history load with the full local decrypted corpus. */
export const onDecryptedChatHistory = (
	cb: (entries: HistoryEntry[]) => void,
): (() => void) => {
	decryptedHistoryListeners.add(cb)
	return () => decryptedHistoryListeners.delete(cb)
}

/**
 * Build the gossip Worker from the published `@conet.project/chat-sdk` package.
 * Webpack 5 (CRA/Craco) statically detects `new Worker(new URL(specifier,
 * import.meta.url))` and emits a classic worker chunk that loads openpgp/ethers
 * with `importScripts`. Module workers reject `importScripts`, so the chunk
 * never installs `onmessage` and voice listen times out. Keep this a classic
 * Worker (no `type: 'module'`).
 */
function makeGossipWorker(): Worker {
	return new Worker(new URL('@conet.project/chat-sdk/worker', import.meta.url), {
		// Chunk name is the worker name. A new name bypasses a cached worker
		// that never finished opening the PGP key and left voice listen with no relay.
		name: 'beamio-chat-gossip-relay',
	})
}

export interface StartWorkerGossipParams {
	/** Own mailbox B route armored public key (encrypt listen to this). */
	ownRouteArmoredPublicKey: string
	/** Raw ethers private key hex (used only inside the worker for EIP-191 signing). */
	privateKeyHex: string
	/** Armored PGP private key (decrypts inbound in the worker). */
	pgpPrivateKeyArmored: string
	/** Armored PGP public key (keyID / diagnostics). */
	pgpPublicKeyArmored: string
	/** Current healthy CoNET node snapshot (host owns discovery). */
	nodes: nodeInfo[]
	/** Session lifecycle signal; abort tears down the worker client. */
	rootSignal: AbortSignal
	/** Decrypted host-ready line → existing addNewMessage serial queue. */
	onLine: (line: string) => void
	onVoiceFrame?: (frame: Record<string, unknown>) => void
	/** Any inbound / liveness activity → refresh main-thread staleness timer. */
	onActivity: () => void
	/** Optional structured log sink (never logs key material / plaintext / ciphertext). */
	onLog?: (level: 'info' | 'warn' | 'error', message: string) => void
}

/** Tear down the active worker listen client (idempotent). */
export const stopWorkerGossip = (): void => {
	if (activeClient) {
		try {
			activeClient.destroy()
		} catch {
			/* ignore */
		}
		activeClient = null
	}
	voiceRelayOpen = null
	voiceRelayOpenSessionId = ''
}

/** True when a worker listen client is currently alive. */
export const isWorkerGossipActive = (): boolean => activeClient !== null

/** True while gossip init or a voice relay open must not be torn down. */
export const isWorkerGossipBusy = (): boolean =>
	workerInitPromise !== null || activeVoiceRelay !== null

/** Route public key the live worker encrypts voice_listen to. Empty when listen is down. */
export const getWorkerGossipRouteArmor = (): string => {
	if (!activeClient || !lastGossipParams || lastGossipParams.rootSignal.aborted) return ''
	return lastGossipParams.ownRouteArmoredPublicKey?.trim() || ''
}

/** Last listen parameters, including a session whose signal has already aborted. */
export const getWorkerGossipListenParams = (): StartWorkerGossipParams | null =>
	lastGossipParams

/**
 * Start the worker-based gossip LISTEN. Resolves true when the worker acknowledged
 * `init` (its internal `startListen()` then owns SSE connect/reconnect). Any prior
 * client is destroyed first (a new connection replaces the old).
 */
const startWorkerGossipListenInternal = async (p: StartWorkerGossipParams): Promise<boolean> => {
	lastGossipParams = p
	stopWorkerGossip()
	if (p.rootSignal.aborted) return false

	const eoaAddress = deriveEoaAddress(p.privateKeyHex)
	const nodeSnapshot = p.nodes.slice()

	const config: BeamioChatConfig = {
		identity: {
			eoaAddress,
			privateKeyHex: p.privateKeyHex,
			pgpPrivateKeyArmored: p.pgpPrivateKeyArmored,
			pgpPassphrase: '',
			pgpPublicKeyArmored: p.pgpPublicKeyArmored,
			ownRouteArmoredPublicKey: p.ownRouteArmoredPublicKey,
		},
		conetRpcUrl: CONET_RPC_URL,
		addressPgpContractAddress: CONET_ADDRESS_PGP,
		getNodes: async () => nodeSnapshot as unknown as NodeInfo[],
		ipfsBaseUrl: IPFS_BASE_URL,
		// On-chain encrypted-history head pointer: read via RPC getPointer(eoa); write via
		// EOA off-chain signature relayed (gasless) through the Cluster/Master. Enables
		// fresh-device recovery of chat history after account delete/restore.
		chatIndexRegistryAddress: CONET_CHAT_INDEX_REGISTRY,
		apiBaseUrl: BEAMIO_API_BASE_URL,
	}

	const client = createBeamioChatClient(config, { workerFactory: makeGossipWorker })
	activeClient = client

	const unsubs: Array<() => void> = []
	unsubs.push(
		client.on('message', (env) => {
			if (env.line) p.onLine(env.line)
			if (p.rootSignal.aborted) return
			p.onActivity()
		}),
	)
	unsubs.push(
		client.on('status', (st) => {
			// 'listening' is emitted on connect AND on every liveness/listing heartbeat →
			// keep the main-thread staleness timer fresh (parity with the old per-frame
			// noteGossipActivity()).
			if (st.status === 'listening') p.onActivity()
			p.onLog?.('info', `gossip status: ${st.status}${st.detail ? ` (${st.detail})` : ''}`)
		}),
	)
	unsubs.push(
		client.on('log', (l) => {
			p.onLog?.(l.level, l.message)
		}),
	)
	unsubs.push(client.on('voiceFrame', (frame) => {
		for (const cb of voiceFrameListeners) {
			try { cb(frame) } catch { /* isolate voice UI listeners */ }
		}
		p.onVoiceFrame?.(frame)
	}))
	// Fan encrypted-history restore/append batches to host subscribers (ChatList / chat page).
	unsubs.push(
		client.history.onBuffer((batch) => {
			if (p.rootSignal.aborted) return
			for (const cb of historyBufferListeners) {
				try {
					cb(batch)
				} catch {
					/* ignore individual subscriber failure */
				}
			}
		}),
	)

	const teardown = () => {
		for (const u of unsubs.splice(0)) {
			try {
				u()
			} catch {
				/* ignore */
			}
		}
		if (activeClient === client) {
			try {
				client.destroy()
			} catch {
				/* ignore */
			}
			activeClient = null
		}
		p.rootSignal.removeEventListener('abort', teardown)
	}
	p.rootSignal.addEventListener('abort', teardown)

	try {
		await client.init()
		if (p.rootSignal.aborted) {
			teardown()
			return false
		}
		// Always restore encrypted history once the worker identity/RPC is ready.
		// Covers: (1) loads queued while `gossip=true` before activeClient existed,
		// (2) recover with empty local chats (AppShell skips re-initChat).
		p.onLog?.('info', 'chat history: worker ready — loading on-chain/IPFS index')
		void loadWorkerHistory()
		if (activeVoiceRelay) void openActiveVoiceRelay(activeVoiceRelay.sessionId)
		return true
	} catch (ex) {
		p.onLog?.('error', `worker gossip init failed: ${(ex as Error)?.message ?? String(ex)}`)
		teardown()
		return false
	}
}

export const startWorkerGossipListen = async (p: StartWorkerGossipParams): Promise<boolean> => {
	if (workerInitPromise) return workerInitPromise
	const promise = startWorkerGossipListenInternal(p)
	workerInitPromise = promise
	try {
		return await promise
	} finally {
		if (workerInitPromise === promise) workerInitPromise = null
	}
}

/**
 * Point an already-running listen at the current chain mailbox route.
 * Restarts the worker with the same session signal and node snapshot.
 */
export const retargetWorkerGossipRoute = async (
	ownRouteArmoredPublicKey: string,
	nodes?: StartWorkerGossipParams['nodes'],
): Promise<boolean> => {
	const prev = lastGossipParams
	const next = ownRouteArmoredPublicKey.trim()
	if (!prev || !next || prev.rootSignal.aborted) return false
	if (prev.ownRouteArmoredPublicKey === next && !nodes?.length) return true
	return startWorkerGossipListen({
		...prev,
		ownRouteArmoredPublicKey: next,
		nodes: nodes?.length ? nodes : prev.nodes,
	})
}

const wait = (ms: number) => new Promise<void>((resolve) => {
	setTimeout(resolve, ms)
})

const waitForVoiceWorker = async (): Promise<ChatWorkerClient | null> => {
	const deadline = Date.now() + 8_000
	while (Date.now() < deadline) {
		// The client is assigned before init() completes. Its postMessage queue
		// preserves init -> voiceListen ordering, so do not await a stale
		// workerInitPromise here; that promise can remain pending while the
		// worker is already able to process the queued relay command.
		if (activeClient) return activeClient
		const starting = workerInitPromise
		if (starting) await starting.catch(() => false)
		if (activeClient) return activeClient
		const retryParams = lastGossipParams
		if (retryParams && !retryParams.rootSignal.aborted && !workerInitPromise) {
			await startWorkerGossipListen(retryParams)
			if (activeClient) return activeClient
		}
		// An aborted session cannot be restarted from here. Spinning the full
		// deadline only delays the relay error; the caller restarts listen first.
		if (!activeClient && !workerInitPromise && (!retryParams || retryParams.rootSignal.aborted)) {
			return null
		}
		await wait(200)
	}
	return activeClient
}

const openActiveVoiceRelay = (sessionId: string): Promise<boolean> => {
	if (voiceRelayOpen && voiceRelayOpenSessionId === sessionId) return voiceRelayOpen
	const run = (async (): Promise<boolean> => {
		const relay = activeVoiceRelay
		if (!relay || relay.sessionId !== sessionId) {
			console.warn(`[voiceListen] relay missing before open session=${sessionId}`)
			return false
		}
		const client = await waitForVoiceWorker()
		if (!client) {
			console.warn(`[voiceListen] chat worker was not ready session=${sessionId}`)
			return false
		}
		if (activeVoiceRelay?.sessionId !== sessionId) {
			console.warn(`[voiceListen] relay replaced while the worker started session=${sessionId}`)
			return false
		}
		try {
			const started = await client.startVoiceListen(sessionId, relay.pushWakeup)
			if (!started) console.warn('[voiceListen] worker refused to open the voice relay')
			if (started && activeVoiceRelay?.sessionId !== sessionId) {
				console.warn(`[voiceListen] relay cleared after the worker accepted session=${sessionId}`)
			}
			return started && activeVoiceRelay?.sessionId === sessionId
		} catch (ex) {
			console.warn('[voiceListen] worker error', (ex as Error)?.message ?? String(ex))
			return false
		}
	})()
	const tracked = run.finally(() => {
		if (voiceRelayOpen === tracked) {
			voiceRelayOpen = null
			voiceRelayOpenSessionId = ''
		}
	})
	voiceRelayOpen = tracked
	voiceRelayOpenSessionId = sessionId
	return tracked
}

export const startWorkerVoiceListen = async (
	sessionId: string,
	pushWakeup?: {
		callId: string
		calleeEoa: string
		expiresAt: number
		timestamp: number
		offerText?: string
		recipientPgp?: string
	},
): Promise<boolean> => {
	activeVoiceRelay = { sessionId, pushWakeup }
	const started = await openActiveVoiceRelay(sessionId)
	if (started) return true
	if (activeVoiceRelay?.sessionId !== sessionId) {
		console.warn('[voiceListen] session changed before the worker retry')
		return false
	}
	// One recovery. Restart only when the worker is actually gone. Restarting
	// a live worker aborts the handshake that is still opening.
	if (!isWorkerGossipActive()) {
		const prev = lastGossipParams
		if (prev && !prev.rootSignal.aborted) {
			console.warn('[voiceListen] restarting the chat worker before one more relay open')
			await startWorkerGossipListen(prev)
		}
	}
	if (activeVoiceRelay?.sessionId !== sessionId) return false
	return openActiveVoiceRelay(sessionId)
}

/** Post a signed command to the current wallet's own mailbox through the worker. */
export const postWorkerOwnMailboxCommand = async (
	command: Record<string, unknown>,
): Promise<boolean> => {
	if (!activeClient) return false
	try {
		return await activeClient.postOwnMailboxCommand(command)
	} catch {
		return false
	}
}

export const stopWorkerVoiceListen = async (sessionId: string): Promise<boolean> => {
	if (activeVoiceRelay?.sessionId === sessionId) activeVoiceRelay = null
	if (!activeClient) return false
	try {
		return await activeClient.stopVoiceListen(sessionId)
	} catch {
		return false
	}
}

export const sendWorkerVoiceFrame = async (
	routerArmoredPublicKey: string,
	frame: Record<string, unknown>,
): Promise<boolean> => {
	if (!activeClient) return false
	try {
		return await activeClient.sendVoiceFrame(routerArmoredPublicKey, frame)
	} catch {
		return false
	}
}

/** Cheap EOA derivation from the raw private key (no network). */
function deriveEoaAddress(privateKeyHex: string): string {
	try {
		// Lazy require to avoid pulling ethers into any tree-shaken path unnecessarily.
		// (ethers is already a top-level dep; this is a plain synchronous compute.)
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { ethers } = require('ethers') as typeof import('ethers')
		const hex = privateKeyHex.startsWith('0x') ? privateKeyHex : `0x${privateKeyHex}`
		return new ethers.Wallet(hex).address
	} catch {
		return ''
	}
}
