/**
 * Bridge between bizSite `services/chat.ts` and the vendored Beamio Chat SDK
 * worker client. The Web Worker performs ALL inbound openpgp decryption + ethers
 * signing, so the main thread no longer blocks on gossip decrypt.
 *
 * Scope:
 *  - Inbound gossip LISTEN (SSE + decrypt) runs in the worker; decrypted lines
 *    feed the existing `newMessage` serial queue (App.tsx `addNewMessage`).
 *  - Outbound send remains on the main thread (`sendMessage`).
 *  - Encrypted chat history: ChatIndexRegistry on-chain pointer + IPFS fragments.
 *
 * Private key is session-memory only (bizSite lock protocol). It is passed into
 * the worker at init and destroyed with `stopWorkerGossip()` on Lock / logout.
 * Worker IndexedDB stores only encrypted history fragments, never the EOA key.
 *
 * Routing: listen encrypted to mailbox B via entry C ≠ B with `listenKind:'chat'`.
 */

import { createBeamioChatClient } from '../vendor/beamio-chat-sdk'
import type {
	BeamioChatConfig,
	HistoryBufferEvent,
	HistoryEntry,
	HistoryLoadOptions,
	NodeInfo,
} from '../vendor/beamio-chat-sdk/types'
import { CONET_ADDRESS_PGP, CONET_CHAT_INDEX_REGISTRY } from '../config/chainAddresses'

const CONET_RPC_URL = 'https://rpc1.conet.network'
const IPFS_BASE_URL = 'https://ipfs.conet.network/api'
const BEAMIO_API_BASE_URL = 'https://beamio.app/api'

type ChatWorkerClient = ReturnType<typeof createBeamioChatClient>

let activeClient: ChatWorkerClient | null = null

const historyBufferListeners = new Set<(batch: HistoryBufferEvent) => void>()

let pendingHistoryLoad: HistoryLoadOptions | true | null = null
let historyLoadInFlight: Promise<void> | null = null

export const onHistoryBuffer = (cb: (batch: HistoryBufferEvent) => void): (() => void) => {
	historyBufferListeners.add(cb)
	return () => {
		historyBufferListeners.delete(cb)
	}
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
	} finally {
		if (historyLoadInFlight === run) historyLoadInFlight = null
	}
}

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

function makeGossipWorker(): Worker {
	return new Worker(new URL('../vendor/beamio-chat-sdk/worker/entry.ts', import.meta.url), {
		type: 'module',
		name: 'beamio-chat-gossip',
	})
}

export interface StartWorkerGossipParams {
	ownRouteArmoredPublicKey: string
	privateKeyHex: string
	pgpPrivateKeyArmored: string
	pgpPublicKeyArmored: string
	nodes: nodeInfo[]
	rootSignal: AbortSignal
	onLine: (line: string) => void
	onActivity: () => void
	onLog?: (level: 'info' | 'warn' | 'error', message: string) => void
}

export const stopWorkerGossip = (): void => {
	if (activeClient) {
		try {
			activeClient.destroy()
		} catch {
			/* ignore */
		}
		activeClient = null
	}
}

export const isWorkerGossipActive = (): boolean => activeClient !== null

export const startWorkerGossipListen = async (p: StartWorkerGossipParams): Promise<boolean> => {
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
		chatIndexRegistryAddress: CONET_CHAT_INDEX_REGISTRY,
		apiBaseUrl: BEAMIO_API_BASE_URL,
	}

	const client = createBeamioChatClient(config, { workerFactory: makeGossipWorker })
	activeClient = client

	const unsubs: Array<() => void> = []
	unsubs.push(
		client.on('message', (env) => {
			if (p.rootSignal.aborted) return
			p.onActivity()
			if (env.line) p.onLine(env.line)
		}),
	)
	unsubs.push(
		client.on('status', (st) => {
			if (st.status === 'listening') p.onActivity()
			p.onLog?.('info', `gossip status: ${st.status}${st.detail ? ` (${st.detail})` : ''}`)
		}),
	)
	unsubs.push(
		client.on('log', (l) => {
			p.onLog?.(l.level, l.message)
		}),
	)
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
		p.onLog?.('info', 'chat history: worker ready — loading on-chain/IPFS index')
		void loadWorkerHistory()
		return true
	} catch (ex) {
		p.onLog?.('error', `worker gossip init failed: ${(ex as Error)?.message ?? String(ex)}`)
		teardown()
		return false
	}
}

function deriveEoaAddress(privateKeyHex: string): string {
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { ethers } = require('ethers') as typeof import('ethers')
		const hex = privateKeyHex.startsWith('0x') ? privateKeyHex : `0x${privateKeyHex}`
		return new ethers.Wallet(hex).address
	} catch {
		return ''
	}
}
