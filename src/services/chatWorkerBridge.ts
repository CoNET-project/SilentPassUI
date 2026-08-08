/**
 * Bridge between SilentPassUI `services/chat.ts` and the vendored Beamio Chat SDK
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

import { createBeamioChatClient } from '../vendor/beamio-chat-sdk'
import type { BeamioChatConfig, NodeInfo } from '../vendor/beamio-chat-sdk/types'
import { CONET_ADDRESS_PGP } from '../config/chainAddresses'

const CONET_RPC_URL = 'https://rpc1.conet.network'
const IPFS_BASE_URL = 'https://ipfs.conet.network/api'

type ChatWorkerClient = ReturnType<typeof createBeamioChatClient>

/** Only one worker listen client is alive per process. A new session replaces the old. */
let activeClient: ChatWorkerClient | null = null

/**
 * Build the gossip Worker. Webpack 5 (CRA/Craco) statically detects the
 * `new Worker(new URL(..., import.meta.url))` pattern and emits a separate worker
 * chunk, transpiling the `.ts` entry via the same babel loaders (entry lives under
 * `src/` so CRA's ModuleScopePlugin allows it).
 */
function makeGossipWorker(): Worker {
	return new Worker(new URL('../vendor/beamio-chat-sdk/worker/entry.ts', import.meta.url), {
		type: 'module',
		name: 'beamio-chat-gossip',
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
}

/** True when a worker listen client is currently alive. */
export const isWorkerGossipActive = (): boolean => activeClient !== null

/**
 * Start the worker-based gossip LISTEN. Resolves true when the worker acknowledged
 * `init` (its internal `startListen()` then owns SSE connect/reconnect). Any prior
 * client is destroyed first (a new connection replaces the old).
 */
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
		return true
	} catch (ex) {
		p.onLog?.('error', `worker gossip init failed: ${(ex as Error)?.message ?? String(ex)}`)
		teardown()
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
