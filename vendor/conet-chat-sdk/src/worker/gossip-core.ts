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

import {
	createMessage,
	decrypt,
	decryptKey,
	encrypt,
	enums,
	readKey,
	readMessage,
	readPrivateKey,
	type PrivateKey,
} from 'openpgp'
import { ethers } from 'ethers'

import {
	VOICE_MAX_FRAME_B64,
	type ChatRoute,
	type GroupInboundEvent,
	type GroupIssueRosterRequest,
	type GroupIssueRosterResult,
	type GroupIssueTombstoneRequest,
	type GroupIssueTombstoneResult,
	type GroupMemberV1,
	type GroupSendRequest,
	type GroupSendResult,
	type GroupRosterV1,
	type NodeInfo,
	type PresenceEvent,
	type StatusEvent,
	type VoiceFrame,
} from '../types.js'
import type { WorkerInitPayload } from '../protocol.js'
import {
	getRandomNode,
	getRandomNodes,
	markGossipNodeBad,
	markGossipNodeHealthy,
	pickGossipEntryNodesForSend,
	pickHealthyGossipNodes,
	pickRouteNodesByArmoredKey,
	postUrl,
	postWithTimeout,
} from '../nodes.js'
import { base64ToUtf8, keccakUtf8, utf8ToBase64 } from '../crypto.js'
import {
	GROUP_V1_MAX_MEMBERS,
	assertGroupRosterV1,
	classifyGroupPlaintext,
	createGroupMessageV1,
	createPaddedGroupDeliveryPacket,
	groupRosterHash,
	looksLikeGroupText,
	normalizeGroupAddress,
	signGroupObject,
} from '../group.js'
import type { GroupTombstoneV1 } from '../types.js'
import { armorToString, buildPostBody, encryptOpaqueVoiceCommand, encryptRouteCommand, encryptVoiceChunkLiteral, wrapArmorToEntryRoute, wrapArmorToMailboxWork } from '../envelope.js'
import {
	VOICE_KIND_AUDIO,
	VOICE_KIND_CONTROL,
	VOICE_KIND_VIDEO,
	aesDecryptV1,
	aesEncryptV1,
	base64ToBytes,
	bytesToBase64,
	locatorFromSessionId,
	openVoiceChunk,
	randomWriteKey,
	sealVoiceChunk,
} from '../voice-channel-v2.js'
import {
	DEFAULT_VIDEO_REORDER_DELAY_MS,
	DEFAULT_VOICE_REORDER_DELAY_MS,
	VoiceFrameReorderBuffer,
	type VoiceConflictEvent,
	type VoiceFrameChunk,
	type VoiceGapEvent,
} from '../voice-reorder.js'

/** Callbacks the worker entry wires to `postMessage`. */
export interface GossipEmit {
	message(line: string, armorHash: string | undefined, plain: boolean, viaDomain?: string): void
	group(payload: GroupInboundEvent): void
	voiceFrame(payload: VoiceFrame): void
	voiceGap(payload: VoiceGapEvent): void
	voiceConflict(payload: VoiceConflictEvent): void
	status(status: StatusEvent['status'], detail?: string): void
	log(level: 'info' | 'warn' | 'error', message: string): void
	presence(payload: PresenceEvent): void
}

interface TimeoutConfig {
	connectTimeout: number
	idleTimeout: number
	readOperationTimeout: number
	retryDelay: number
}

const GOSSIP_STOP_REASONS = new Set([
	'root_stop',
	'replaced_by_new_connection',
	'component_unmount',
	'relaunching',
	'connect_failed',
	'foreground_resume',
	'background_pause',
	'destroy',
])

function extractGossipListingBlockHeight(payload: unknown): string | null {
	if (!payload || typeof payload !== 'object') return null
	const epoch = (payload as Record<string, unknown>).epoch
	if (epoch == null) return null
	if (typeof epoch === 'number' && Number.isFinite(epoch)) return String(Math.trunc(epoch))
	if (typeof epoch === 'string' && epoch.trim()) return epoch.trim()
	return null
}

function isGossipListingLivenessFrame(payload: unknown): boolean {
	if (!payload || typeof payload !== 'object') return false
	const row = payload as Record<string, unknown>
	return typeof row.ipaddress === 'string' || 'nodeWallets' in row
}

const INBOUND_WRAPPER_KEYS = ['data', 'message', 'payload', 'body', 'text'] as const

function findInboundArmor(value: unknown, depth = 0): string {
	if (depth > 5) return ''
	if (typeof value === 'string') {
		const text = value.trim()
		if (/^-----BEGIN PGP MESSAGE-----/i.test(text)) return text
		if (text.startsWith('{') || text.startsWith('[')) {
			try {
				return findInboundArmor(JSON.parse(text), depth + 1)
			} catch {
				return ''
			}
		}
		// A few mailbox relays wrap the armor in base64 before placing it in
		// their JSON envelope. Decode only bounded, plausible base64 strings;
		// never treat arbitrary text as a candidate.
		if (text.length >= 32 && /^[A-Za-z0-9+/=_-]+$/.test(text)) {
			try {
				const normalized = text.replace(/-/g, '+').replace(/_/g, '/')
				const decoded = base64ToUtf8(normalized).trim()
				if (decoded && decoded !== text) {
					return findInboundArmor(decoded, depth + 1)
				}
			} catch {
				/* not base64 */
			}
		}
	}
	if (!value || typeof value !== 'object') return ''
	const row = value as Record<string, unknown>
	for (const key of INBOUND_WRAPPER_KEYS) {
		const found = findInboundArmor(row[key], depth + 1)
		if (found) return found
	}
	return ''
}

function parseInboundJson(value: string): unknown {
	let current: unknown = value
	for (let depth = 0; depth <= 5; depth += 1) {
		if (typeof current !== 'string') return current
		const text = current.trim()
		try {
			const parsed = JSON.parse(text) as unknown
			if (parsed && typeof parsed === 'object') return parsed
		} catch {
			/* try base64 below */
		}
		try {
			const decoded = base64ToUtf8(text).trim()
			if (decoded && decoded !== text) {
				current = decoded
				continue
			}
		} catch {
			/* not base64 */
		}
		return current
	}
	return current
}

export class GossipCore {
	private cfg: WorkerInitPayload | null = null
	private nodes: NodeInfo[] = []
	private routes: ChatRoute[] = []
	private wallet: ethers.Wallet | null = null
	private pgpPrivateKey: PrivateKey | null = null
	private userPgpKeyID = ''
	private listenController: AbortController | null = null
	private voiceListenController: AbortController | null = null
	/**
	 * Voice channel v2 for the current listen (CoNET Chat rule 23). The UI hands
	 * over the call's AES session key; the worker registers a write key, puts it
	 * into the caps frame, turns outgoing frames into metadata-free chunks once
	 * the peer's caps carry `chan: 2`, and turns incoming chunks back into
	 * ordinary frames for the UI.
	 */
	private voiceV2: {
		sessionId: string
		locator: Uint8Array
		key: Uint8Array
		writeKey: Uint8Array
		ownV2: boolean
		peerWriteKey: Uint8Array | null
		peerSessionId: string
		callId: string
		disabled: boolean
		txOk: number
		rx: number
		/** Consecutive `target_voice_session_not_found` answers. */
		chunkMiss: number
	} | null = null
	/**
	 * v2 state of a listen that was stopped. A reconnect reopens the same session
	 * and must register the same write key (the peer already has it) and keep
	 * the peer's key, so v2 survives the drop.
	 */
	private voiceV2Retained: GossipCore['voiceV2'] = null
	private readonly voiceReorder = new VoiceFrameReorderBuffer({
		// Voice jitter ~120ms; video fragment groups ~200ms. Do not skip_ahead
		// immediately when a later seq arrives first — wait then timeout.
		reorderDelayMs: DEFAULT_VOICE_REORDER_DELAY_MS,
		videoReorderDelayMs: DEFAULT_VIDEO_REORDER_DELAY_MS,
		onEvent: (event) => {
			if (event.type === 'frame') this.emit.voiceFrame(event.frame as VoiceFrame)
			if (event.type === 'gap') this.emit.voiceGap(event.gap)
			if (event.type === 'conflict') this.emit.voiceConflict(event.conflict)
		},
	})
	private lastActivityAt = 0
	private paused = false
	private pgpReady: Promise<void> = Promise.resolve()
	private ackContext: {
		routerArmoredPublicKey: string
		entryNodes: NodeInfo[]
		mailboxDomains: string[]
	} | null = null

	constructor(private readonly emit: GossipEmit) {}

	async init(payload: WorkerInitPayload): Promise<void> {
		this.cfg = payload
		this.nodes = payload.nodes || []
		this.routes = payload.routes || []
		const pkHex = payload.identity.privateKeyHex.startsWith('0x')
			? payload.identity.privateKeyHex
			: `0x${payload.identity.privateKeyHex}`
		this.wallet = new ethers.Wallet(pkHex)
		this.paused = false
		// Unlocking the PGP key can take longer than the client init budget.
		// Returning here lets the worker stay alive; voice listen waits for
		// the same promise instead of being told the relay could not open.
		this.emit.log('info', 'chat worker accepted init')
		this.pgpReady = this.openPgpAndListen(payload)
		void this.pgpReady
	}

	private async openPgpAndListen(payload: WorkerInitPayload): Promise<void> {
		this.emit.log(
			'info',
			`chat worker init pgpArmor=${payload.identity.pgpPrivateKeyArmored.length} passphrase=${payload.identity.pgpPassphrase ? 'set' : 'empty'}`,
		)
		const pk = await Promise.race([
			readPrivateKey({ armoredKey: payload.identity.pgpPrivateKeyArmored }),
			new Promise<never>((_, reject) => {
				setTimeout(() => reject(new Error('pgp key open timed out')), 20_000)
			}),
		])
		this.emit.log('info', `chat worker pgp key decrypted=${pk.isDecrypted()}`)
		this.pgpPrivateKey = pk.isDecrypted()
			? pk
			: await decryptKey({ privateKey: pk, passphrase: payload.identity.pgpPassphrase || '' })
		this.emit.log('info', 'chat worker pgp decrypt ready')
		if (payload.identity.pgpPublicKeyArmored) {
			try {
				const keyObj = await readKey({ armoredKey: payload.identity.pgpPublicKeyArmored })
				this.userPgpKeyID = keyObj.getKeyIDs()[1].toHex().toUpperCase()
			} catch {
				/* keyID optional */
			}
		}
		if (!this.paused) await this.startListen()
	}

	setNodes(nodes: NodeInfo[]): void {
		if (nodes?.length) this.nodes = nodes
	}

	setRoutes(routes: ChatRoute[]): void {
		this.routes = routes || []
	}

	pause(): void {
		this.paused = true
		this.clearListen('background_pause')
		this.voiceListenController?.abort('voice_stop')
		this.voiceReorder.clear()
		this.lastActivityAt = 0
		this.emit.status('paused')
	}

	resume(): void {
		if (!this.paused && this.listenController && !this.listenController.signal.aborted) return
		this.paused = false
		void this.startListen()
	}

	destroy(): void {
		this.clearListen('destroy')
		this.voiceListenController?.abort('voice_stop')
		this.voiceReorder.clear()
		this.wallet = null
		this.pgpPrivateKey = null
		this.cfg = null
	}

	private clearListen(reason: string): void {
		if (this.listenController) {
			try {
				this.listenController.abort(reason)
			} catch {
				/* ignore */
			}
			this.listenController = null
		}
	}

	// ---- Listen (dedicated Mailbox B route, entry C ≠ B) -------------------------
	private async startListen(): Promise<void> {
		if (this.paused) return
		if (!this.cfg || !this.wallet || !this.pgpPrivateKey) return
		if (this.listenController && !this.listenController.signal.aborted) {
			this.emit.log('info', 'listen skipped: SSE already live')
			return
		}
		this.listenController = null

		// Resolve mailbox B route from the identity's own route (host injects own route key).
		const ownRouteKey = this.cfg.identity.ownRouteArmoredPublicKey || ''
		const routeNodes = pickRouteNodesByArmoredKey(this.nodes, ownRouteKey)
		if (!ownRouteKey || !routeNodes.length) {
			// Ask host to refresh nodes; retry shortly.
			this.emit.log('warn', 'listen: no route node for own mailbox key; awaiting nodes')
			this.emit.status('reconnecting', 'awaiting_route_nodes')
			setTimeout(() => void this.startListen(), 6_000)
			return
		}
		const mailboxDomains = new Set(routeNodes.map((n) => n.domain))

		this.emit.status('connecting')
		const controller = new AbortController()
		this.listenController = controller
		const rootSignal = controller.signal

		try {
			const instanceId =
				typeof crypto.randomUUID === 'function'
					? crypto.randomUUID()
					: utf8ToBase64(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
			const innerArmor = await encryptRouteCommand(
				this.wallet,
				{
					command: 'mailbox_listen',
					walletAddress: this.wallet.address,
					instanceId,
				},
				ownRouteKey,
			)

			const entryCandidates = this.nodes.filter((n) => !mailboxDomains.has(n.domain))
			const healthyNodes = await pickHealthyGossipNodes(entryCandidates.length ? entryCandidates : this.nodes)
			if (!healthyNodes.length) {
				this.emit.log('warn', 'listen: no healthy entry C; retry')
				this.emit.status('reconnecting', 'no_entry_c')
				this.clearListen('connect_failed')
				setTimeout(() => void this.startListen(), 6_000)
				return
			}
			this.ackContext = {
				routerArmoredPublicKey: ownRouteKey,
				entryNodes: healthyNodes,
				mailboxDomains: [...mailboxDomains],
			}

			this.spawnGossip(healthyNodes, innerArmor, rootSignal)
		} catch (ex) {
			this.emit.log('error', `startListen error: ${(ex as Error)?.message ?? String(ex)}`)
			this.clearListen('connect_failed')
			this.emit.status('error', (ex as Error)?.message)
			setTimeout(() => void this.startListen(), 6_000)
		}
	}

	private spawnGossip(
		nodes: NodeInfo[],
		innerArmor: string,
		rootSignal: AbortSignal,
		timeoutConfig?: Partial<TimeoutConfig>,
		reconnectAttempt = 0,
	): void {
		if (rootSignal.aborted) return
		if (!nodes.length) return
		const node = getRandomNode(nodes)!
		const config: TimeoutConfig = {
			connectTimeout: 12_000,
			// Mailbox B keepalives are bounded at 60–180s. Keep enough margin
			// for transport/proxy jitter before declaring the SSE idle.
			idleTimeout: 240_000,
			readOperationTimeout: 20_000,
			retryDelay: 2_000,
			...timeoutConfig,
		}
		const url = postUrl(node.domain)
		const controller = new AbortController()
		const onRootAbort = () => controller.abort('root_stop')
		rootSignal.addEventListener('abort', onRootAbort)

		let isRelaunching = false
		const triggerRelaunch = (reason?: string) => {
			if (rootSignal.aborted) return
			if (isRelaunching) return
			isRelaunching = true
			rootSignal.removeEventListener('abort', onRootAbort)
			try {
				controller.abort('relaunching')
			} catch {
				/* ignore */
			}
			const nextAttempt = reconnectAttempt + 1
			const delay = Math.min(30_000, Math.round(config.retryDelay * Math.pow(1.6, Math.min(nextAttempt, 8))))
			setTimeout(() => {
				if (rootSignal.aborted) return
				this.emit.log('info', `reconnecting entry C attempt=${nextAttempt} reason=${reason || 'stream_end'}`)
				const remaining = nodes.filter((n) => n.domain !== node.domain)
				this.spawnGossip(remaining.length ? remaining : nodes, innerArmor, rootSignal, timeoutConfig, nextAttempt)
			}, delay)
		}

		let connectTimer: ReturnType<typeof setTimeout> | null = null
		let idleTimer: ReturnType<typeof setTimeout> | null = null
		const resetIdle = () => {
			if (idleTimer) clearTimeout(idleTimer)
			idleTimer = setTimeout(() => controller.abort('idle_timeout'), config.idleTimeout)
		}

		void (async () => {
			let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
			let pendingRead: Promise<ReadableStreamReadResult<Uint8Array>> | null = null
			try {
				const armored =
					this.cfg?.runtime.outerWrap === false
						? innerArmor
						: await wrapArmorToEntryRoute(innerArmor, node.armoredPublicKey)
				connectTimer = setTimeout(() => controller.abort('connect_timeout'), config.connectTimeout)
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
				})
				if (connectTimer) clearTimeout(connectTimer)
				if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
				markGossipNodeHealthy(node.domain)
				this.lastActivityAt = Date.now()
				reconnectAttempt = 0
				this.emit.status('listening')
				reader = res.body.getReader()
				const decoder = new TextDecoder('utf-8')
				let buffer = ''
				resetIdle()

				while (true) {
					// eslint-disable-next-line no-throw-literal -- string stop-reason protocol (see resolveAbortReason)
					if (rootSignal.aborted) throw 'root_stop'
					if (controller.signal.aborted) throw controller.signal.reason
					let readResult: ReadableStreamReadResult<Uint8Array>
					let readTimer: ReturnType<typeof setTimeout> | undefined
					try {
						if (!pendingRead) pendingRead = reader.read()
						const timeoutPromise = new Promise<never>((_, reject) => {
							readTimer = setTimeout(() => reject(new Error('read_operation_timeout')), config.readOperationTimeout)
						})
						readResult = await Promise.race([pendingRead, timeoutPromise])
						pendingRead = null
					} catch (readErr: unknown) {
						if ((readErr as Error)?.message === 'read_operation_timeout') {
							// eslint-disable-next-line no-throw-literal -- string stop-reason protocol (see resolveAbortReason)
							if (rootSignal.aborted) throw 'root_stop'
							if (controller.signal.aborted) throw controller.signal.reason
							continue
						}
						pendingRead = null
						throw readErr
					} finally {
						if (readTimer) clearTimeout(readTimer)
					}

					const { value, done } = readResult
					if (done) break
					resetIdle()
					reconnectAttempt = 0
					this.lastActivityAt = Date.now()
					buffer += decoder.decode(value, { stream: true })

					let idx: number
					while ((idx = buffer.indexOf('\r\n\r\n')) !== -1 || (idx = buffer.indexOf('\n\n')) !== -1) {
						const isFour = buffer.substring(idx, idx + 4) === '\r\n\r\n'
						const separatorLen = isFour ? 4 : 2
						const block = buffer.slice(0, idx)
						buffer = buffer.slice(idx + separatorLen)
						const lines = block.split('\n')
						const dataLines = lines.filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart())
						const payload = (dataLines.length ? dataLines.join('\n') : block).trim()
						if (!payload) continue
						await this.handleInbound(payload, node.domain, rootSignal)
					}
				}
				triggerRelaunch('server_closed')
			} catch (err: unknown) {
				if (connectTimer) clearTimeout(connectTimer)
				if (idleTimer) clearTimeout(idleTimer)
				const msg = this.resolveAbortReason(err, controller, rootSignal)
				if (GOSSIP_STOP_REASONS.has(msg)) return
				if ((err as { name?: string })?.name === 'AbortError' && rootSignal.aborted) return
				if ((err as { name?: string })?.name !== 'AbortError') {
					this.emit.log('warn', `SSE error (${node.domain}): ${msg}`)
				}
				if (msg === 'connect_timeout' || msg === 'idle_timeout' || msg === 'Failed to fetch') {
					markGossipNodeBad(node.domain)
				}
				triggerRelaunch(msg)
			} finally {
				rootSignal.removeEventListener('abort', onRootAbort)
				if (reader) {
					try {
						await reader.cancel()
						reader.releaseLock()
					} catch {
						/* ignore */
					}
				}
			}
		})()
	}

	private resolveAbortReason(err: unknown, controller: AbortController, rootSignal: AbortSignal): string {
		if (typeof err === 'string' && err) return err
		const signalReason = controller.signal.reason ?? rootSignal.reason
		if (typeof signalReason === 'string' && signalReason) return signalReason
		if (err && typeof err === 'object' && 'message' in err && typeof (err as Error).message === 'string') {
			return (err as Error).message
		}
		return 'unknown'
	}

	private async handleInbound(rawData: string, viaDomain: string, _rootSignal: AbortSignal): Promise<void> {
		const trimmedRaw = rawData.trim()
		let data: Record<string, unknown> | null = null
		try {
			const parsed = JSON.parse(trimmedRaw) as unknown
			if (parsed && typeof parsed === 'object') {
				data = parsed as Record<string, unknown>
			}
		} catch {
			// Some mailbox/entry implementations deliver the SSE `data:` value
			// as the armored PGP message itself. Keep that compatibility path;
			// do not require JSON before attempting decryption.
		}
		if (data && isGossipListingLivenessFrame(data) && extractGossipListingBlockHeight(data)) {
			// Liveness/listing frame: no business payload, but proves the SSE is alive.
			// Refresh internal activity + surface a heartbeat so the host can keep its
			// own foreground/background staleness timer fresh (parity with the old
			// main-thread noteGossipActivity() that fired on every frame).
			this.lastActivityAt = Date.now()
			this.emit.status('listening', 'heartbeat')
			return
		}
		if (data?.type === 'mailbox_keepalive') {
			this.lastActivityAt = Date.now()
			this.emit.status('listening', 'heartbeat')
			return
		}
		try {
			if (data?.type === 'voice_frame_v1') {
				const frame = typeof data.frameTimestamp === 'number' ? { ...data, timestamp: data.frameTimestamp } : data
				this.voiceReorder.push(frame as unknown as VoiceFrameChunk)
				return
			}
			// Mailbox relays can add several JSON envelopes. Walk only a bounded
			// set of wrapper keys; never log or forward the plaintext/ciphertext.
			const armored = findInboundArmor(data ?? trimmedRaw)
			if (armored && /^-----BEGIN PGP MESSAGE-----/i.test(armored)) {
				this.emit.log('info', `inbound PGP candidate bytes=${armored.length} via=${viaDomain}`)
				const msg = await readMessage({ armoredMessage: armored })
				const { data: decrypted } = await decrypt({ message: msg, decryptionKeys: this.pgpPrivateKey! })
				const decryptedString = typeof decrypted === 'string' ? decrypted : String(decrypted)
				// Senders historically used both base64(JSON) and JSON directly.
				// Normalize both, including bounded nested data/message wrappers.
				const parsed = parseInboundJson(decryptedString)
				const kkk =
					typeof parsed === 'string'
						? parsed
						: JSON.stringify(parsed)
				this.emit.log(
					'info',
					`inbound PGP decrypted chars=${kkk.length} json=${kkk.trim().startsWith('{')} voiceOffer=${kkk.includes('voice_call_offer_v1')}`,
				)
				if (this.tryConsumeGroupInbound(kkk)) return
				const armorHash = keccakUtf8(armored)
				let line = kkk
				try {
					const env = JSON.parse(kkk) as Record<string, unknown>
					if (env && typeof env === 'object') {
						env._beamioPgpArmorHash = armorHash
						line = JSON.stringify(env)
					}
				} catch {
					/* keep raw */
				}
				this.emit.message(line, armorHash, false, viaDomain)
			} else if (data && data.from && data.text != null && data.signMessage) {
				const plainLine = JSON.stringify(data)
				if (this.tryConsumeGroupInbound(plainLine)) return
				this.emit.message(plainLine, undefined, true, viaDomain)
			}
		} catch (ex: unknown) {
			const msg = (ex as Error)?.message ?? String(ex)
			if (msg.includes('No decryption key packets found')) {
				this.emit.log('warn', 'inbound PGP is not for this listen key (stale contact publicArmored or wrong recipient)')
				return
			}
			this.emit.log('warn', `inbound parse error: ${msg}`)
		}
	}

	// ---- Send (recipient EOA user PGP, entry A ≠ B, wrap to each A) ------------
	async send(to: ChatRoute, text: string, opts?: { beamioNoPush?: boolean }): Promise<boolean> {
		if (!this.wallet) throw new Error('not initialised')
		const pgpPublic = to.userPublicKeyArmored?.trim()
		if (!pgpPublic) {
			this.emit.log('error', 'send: missing recipient userPublicKeyArmored')
			return false
		}
		const signMessage = await this.wallet.signMessage(text)
		const message = { timestamp: Date.now(), text, from: this.wallet.address, signMessage }
		let innerArmor: string
		try {
			const encObj = {
				message: await createMessage({ text: utf8ToBase64(JSON.stringify(message)) }),
				encryptionKeys: await readKey({ armoredKey: pgpPublic }),
				config: { preferredCompressionAlgorithm: enums.compression.zlib },
			}
			innerArmor = await encrypt(encObj)
		} catch (ex: unknown) {
			this.emit.log('error', `send encrypt error: ${(ex as Error)?.message ?? String(ex)}`)
			return false
		}
		if (opts?.beamioNoPush) {
			const mailboxKey = to.routerArmoredPublicKey?.trim()
			if (!mailboxKey) {
				this.emit.log('error', 'send: NoPush requires recipient mailbox routerArmoredPublicKey')
				return false
			}
			try {
				innerArmor = await wrapArmorToMailboxWork(innerArmor, mailboxKey, { NoPush: true })
			} catch (ex: unknown) {
				this.emit.log('error', `send mailbox wrap error: ${(ex as Error)?.message ?? String(ex)}`)
				return false
			}
		}
		const mailboxDomains = new Set(pickRouteNodesByArmoredKey(this.nodes, to.routerArmoredPublicKey || '').map((n) => n.domain))
		return this.postToEntries(innerArmor, mailboxDomains)
	}

	/**
	 * V1 group send: one user-PGP armor per recipient. Never build a
	 * multi-recipient OpenPGP message — its key-id list would reveal membership.
	 */
	async sendGroup(request: GroupSendRequest): Promise<GroupSendResult> {
		if (!this.wallet) throw new Error('not initialised')
		if (request.maxMembers != null && request.maxMembers !== GROUP_V1_MAX_MEMBERS) {
			throw new Error('V1 group membership limit is fixed at 10')
		}
		assertGroupRosterV1(request.roster, GROUP_V1_MAX_MEMBERS)
		if (request.roster.expiresAt <= Date.now()) throw new Error('group roster has expired')
		const sender = normalizeGroupAddress(this.wallet.address)
		if (!request.roster.members.some((member) => normalizeGroupAddress(member.eoa) === sender)) {
			throw new Error('group sender is not an active member')
		}
		const now = Date.now()
		if (request.expiresAt <= now || request.expiresAt > now + 24 * 60 * 60 * 1000) {
			throw new Error('group message expiry must be within 24 hours')
		}
		const sendId = request.sendId || `${now}-${Math.random().toString(36).slice(2, 10)}`
		const message = await createGroupMessageV1(this.wallet, {
			groupId: request.roster.groupId,
			rosterHash: groupRosterHash(request.roster),
			sendId,
			seq: request.seq,
			createdAt: now,
			expiresAt: request.expiresAt,
			body: request.body,
		})
		const plaintext = JSON.stringify(createPaddedGroupDeliveryPacket(message, request.paddingBucketBytes))
		const counts = await this.fanOutGroupPlaintext(request.roster, plaintext, request.routes, request.maxConcurrency)
		this.emit.log('info', `group send completed: accepted=${counts.acceptedRecipients} failed=${counts.failedRecipients}`)
		return { sendId, message, ...counts }
	}

	async issueGroupRoster(request: GroupIssueRosterRequest): Promise<GroupIssueRosterResult> {
		if (!this.wallet) throw new Error('not initialised')
		const owner = normalizeGroupAddress(this.wallet.address)
		const previous = request.previous ?? null
		if (previous) assertGroupRosterV1(previous)
		const wanted = (previous ? request.nextMemberEoas ?? previous.members.map((member) => member.eoa) : request.memberEoas)
			.map((eoa) => normalizeGroupAddress(eoa))
		if (!wanted.includes(owner)) wanted.unshift(owner)
		const unique = [...new Set(wanted)]
		if (unique.length < 1 || unique.length > GROUP_V1_MAX_MEMBERS) throw new Error('unsupported group member count')
		const routes = this.routeMap(request.routes)
		const ownArmor = this.cfg?.identity.pgpPublicKeyArmored?.trim()
		if (!ownArmor) throw new Error('group owner PGP public key unavailable')
		const members: GroupMemberV1[] = []
		for (const eoa of unique) {
			const prior = previous?.members.find((member) => normalizeGroupAddress(member.eoa) === eoa)
			const armored = eoa === owner ? ownArmor : routes.get(eoa)?.userPublicKeyArmored?.trim()
			if (!armored) throw new Error('missing encrypted route for one or more group members')
			const key = await readKey({ armoredKey: armored })
			members.push({
				eoa,
				pgpFingerprint: key.getFingerprint().toLowerCase(),
				keyEpoch: prior?.keyEpoch ?? 0,
			})
		}
		const admins = (previous ? request.nextAdmins ?? previous.policy.admins : []).map((admin) => normalizeGroupAddress(admin))
		const now = Date.now()
		const roster = await signGroupObject<GroupRosterV1>(this.wallet, 'group roster', {
			type: 'conet_group_roster_v1' as const,
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
		})
		assertGroupRosterV1(roster)
		const counts = await this.fanOutGroupPlaintext(roster, JSON.stringify(roster), request.routes)
		this.emit.log('info', `group roster issued: accepted=${counts.acceptedRecipients} failed=${counts.failedRecipients}`)
		return { roster, ...counts }
	}

	async issueGroupTombstone(request: GroupIssueTombstoneRequest): Promise<GroupIssueTombstoneResult> {
		if (!this.wallet) throw new Error('not initialised')
		assertGroupRosterV1(request.roster)
		if (normalizeGroupAddress(request.roster.policy.owner) !== normalizeGroupAddress(this.wallet.address)) {
			throw new Error('only the group owner may issue a tombstone')
		}
		const tombstone = await signGroupObject<GroupTombstoneV1>(this.wallet, 'group tombstone', {
			type: 'conet_group_tombstone_v1',
			groupId: request.roster.groupId,
			removedAtVersion: request.roster.version + 1,
			previousRosterHash: groupRosterHash(request.roster),
			issuedAt: Date.now(),
		})
		const counts = await this.fanOutGroupPlaintext(request.roster, JSON.stringify(tombstone), request.routes)
		this.emit.log('info', `group tombstone issued: accepted=${counts.acceptedRecipients} failed=${counts.failedRecipients}`)
		return { tombstone, ...counts }
	}

	private routeMap(extra: ChatRoute[] | undefined): Map<string, ChatRoute> {
		const map = new Map<string, ChatRoute>()
		for (const route of [...this.routes, ...(extra ?? [])]) {
			if (route?.address && ethers.isAddress(route.address)) map.set(normalizeGroupAddress(route.address), route)
		}
		return map
	}

	private async fanOutGroupPlaintext(
		roster: GroupSendRequest['roster'],
		plaintext: string,
		routes: ChatRoute[] | undefined,
		maxConcurrency = 2,
	): Promise<{ acceptedRecipients: number; failedRecipients: number }> {
		if (!this.wallet) throw new Error('not initialised')
		const sender = normalizeGroupAddress(this.wallet.address)
		const routeByAddress = this.routeMap(routes)
		const recipients = roster.members
			.filter((member) => normalizeGroupAddress(member.eoa) !== sender)
			.map((member) => ({ member, route: routeByAddress.get(normalizeGroupAddress(member.eoa)) }))
		if (recipients.some(({ route }) => !route?.userPublicKeyArmored)) {
			throw new Error('missing encrypted route for one or more group members')
		}
		const concurrency = Math.min(4, Math.max(1, maxConcurrency))
		let acceptedRecipients = 0
		let failedRecipients = 0
		let next = 0
		const sendOne = async (): Promise<void> => {
			while (next < recipients.length) {
				const current = recipients[next++]
				await new Promise<void>((resolve) => setTimeout(resolve, 60 + Math.floor(Math.random() * 141)))
				try {
					const ok = await this.sendSingleRecipientGroupDelivery(
						current.member.pgpFingerprint,
						current.route!,
						plaintext,
					)
					if (ok) acceptedRecipients += 1
					else failedRecipients += 1
				} catch {
					failedRecipients += 1
				}
			}
		}
		if (recipients.length) {
			await Promise.all(Array.from({ length: Math.min(concurrency, recipients.length) }, () => sendOne()))
		}
		return { acceptedRecipients, failedRecipients }
	}

	private async sendSingleRecipientGroupDelivery(
		expectedFingerprint: string,
		to: ChatRoute,
		payload: string,
	): Promise<boolean> {
		if (!this.wallet) throw new Error('not initialised')
		const pgpPublic = to.userPublicKeyArmored?.trim()
		const routeKey = to.routerArmoredPublicKey?.trim()
		if (!pgpPublic) throw new Error('group recipient user PGP key unavailable')
		if (!routeKey) throw new Error('group recipient mailbox route unavailable')
		const key = await readKey({ armoredKey: pgpPublic })
		if (key.getFingerprint().toLowerCase() !== expectedFingerprint.toLowerCase()) {
			throw new Error('group recipient PGP key no longer matches the active roster')
		}
		const signMessage = await this.wallet.signMessage(payload)
		const envelope = { timestamp: Date.now(), text: payload, from: this.wallet.address, signMessage }
		const innerArmor = await encrypt({
			message: await createMessage({ text: utf8ToBase64(JSON.stringify(envelope)) }),
			encryptionKeys: key,
			config: { preferredCompressionAlgorithm: enums.compression.uncompressed },
		})
		const mailboxDomains = new Set(pickRouteNodesByArmoredKey(this.nodes, routeKey).map((n) => n.domain))
		return this.postToEntries(innerArmor, mailboxDomains)
	}

	/** Drop group objects out of the 1:1 message stream after the outer EIP-191 check. */
	private tryConsumeGroupInbound(line: string): boolean {
		let env: Record<string, unknown>
		try {
			env = JSON.parse(line) as Record<string, unknown>
		} catch {
			return false
		}
		const text = typeof env.text === 'string' ? env.text : ''
		const signMessage = typeof env.signMessage === 'string' ? env.signMessage : ''
		const from = typeof env.from === 'string' ? env.from : ''
		if (!text || !signMessage || !from || !looksLikeGroupText(text)) return false
		let recovered = ''
		try {
			recovered = normalizeGroupAddress(ethers.verifyMessage(text, signMessage))
		} catch {
			this.emit.log('warn', 'group inbound rejected: outer signature')
			return true
		}
		if (!ethers.isAddress(from) || recovered !== normalizeGroupAddress(from)) {
			this.emit.log('warn', 'group inbound rejected: signer mismatch')
			return true
		}
		let parsed: ReturnType<typeof classifyGroupPlaintext>
		try {
			parsed = classifyGroupPlaintext(text)
		} catch {
			this.emit.log('warn', 'group inbound rejected: malformed object')
			return true
		}
		if (!parsed || !ethers.isAddress(parsed.signer) || normalizeGroupAddress(parsed.signer) !== recovered) {
			this.emit.log('warn', 'group inbound rejected: object signer')
			return true
		}
		const payload: GroupInboundEvent = {
			kind: parsed.kind,
			recoveredFrom: recovered,
			receivedAt: Date.now(),
		}
		if (parsed.kind === 'roster') payload.roster = parsed.roster
		if (parsed.kind === 'proposal') payload.proposal = parsed.proposal
		if (parsed.kind === 'tombstone') payload.tombstone = parsed.tombstone
		if (parsed.kind === 'message') payload.message = parsed.message
		this.emit.group(payload)
		return true
	}

	/**
	 * POST armor to entry nodes. Text gossip may fan out in parallel.
	 * Voice/video media frames must pass `{ fanout: 1 }` so a single seq is
	 * delivered once (any one 2xx succeeds; wave2 is retry only, not a duplicate).
	 */
	private async postToEntries(
		innerArmor: string,
		excludeDomains: Set<string>,
		options?: { fanout?: number },
	): Promise<boolean> {
		const send = async (targets: NodeInfo[]): Promise<boolean> => {
			if (!targets.length) return false
			const results = await Promise.all(
				targets.map(async (node) => {
					const url = postUrl(node.domain)
					try {
						const armored =
							this.cfg?.runtime.outerWrap === false
								? innerArmor
								: await wrapArmorToEntryRoute(innerArmor, node.armoredPublicKey)
						const res = await postWithTimeout(
							url,
							{
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(buildPostBody(armored)),
								referrerPolicy: 'no-referrer',
							},
							12_000,
						)
						if (!res.ok) {
							markGossipNodeBad(node.domain)
							return false
						}
						markGossipNodeHealthy(node.domain)
						return true
					} catch {
						markGossipNodeBad(node.domain)
						return false
					}
				}),
			)
			return results.some(Boolean)
		}
		const fanout = options?.fanout ?? this.cfg?.runtime.sendFanout ?? 3
		// Media: exactly one entry per wave. Text: historical fanout+1 parallel picks.
		const pickCount =
			fanout <= 1 ? 1 : Math.min(fanout + 1, Math.max(1, this.nodes.length))
		const wave1 = await pickGossipEntryNodesForSend(this.nodes, pickCount, excludeDomains)
		if (await send(wave1)) return true
		const tried = new Set([...excludeDomains, ...wave1.map((n) => n.domain)])
		const wave2 = await pickGossipEntryNodesForSend(this.nodes, pickCount, tried)
		return send(wave2)
	}

	// ---- Presence (wallet_online_query, encrypt to mailbox B, POST via C ≠ B) --
	async queryPresence(contacts: ChatRoute[]): Promise<Record<string, boolean>> {
		const out: Record<string, boolean> = {}
		if (!this.wallet || !contacts.length) return out
		await Promise.all(
			contacts.map(async (c) => {
				const addr = (c.address || '').trim().toLowerCase()
				const route = (c.routerArmoredPublicKey || '').trim()
				if (!addr || !ethers.isAddress(addr) || !route) return
				const routeNodes = pickRouteNodesByArmoredKey(this.nodes, route)
				const mailboxDomains = new Set(routeNodes.map((n) => n.domain).filter(Boolean))
				const r = await this.walletOnlineQuery(addr, route, mailboxDomains)
				if (r?.ok) out[addr] = r.online
			}),
		)
		this.emit.presence({ online: out })
		return out
	}

	/**
	 * After presence: whether the contact mailbox has a registered native shell
	 * (iOS, Android, Windows, Linux, or macOS) that push can wake.
	 * null = untrusted; do not clear the last trusted answer.
	 */
	async queryNativeWake(contact: ChatRoute): Promise<boolean | null> {
		if (!this.wallet) return null
		const addr = (contact.address || '').trim()
		const route = (contact.routerArmoredPublicKey || '').trim()
		if (!addr || !ethers.isAddress(addr) || !route) return null
		const routeNodes = pickRouteNodesByArmoredKey(this.nodes, route)
		const mailboxDomains = new Set(routeNodes.map((n) => n.domain).filter(Boolean))
		const r = await this.walletNativeWakeQuery(addr, route, mailboxDomains)
		if (!r?.ok) return null
		return r.nativeWakeable
	}

	private async walletOnlineQuery(
		targetWallet: string,
		routerArmoredPublicKey: string,
		mailboxDomains: Set<string>,
	): Promise<{ ok: boolean; online: boolean } | null> {
		if (!this.wallet) return null
		try {
			const timestamp = Math.floor(Date.now() / 1000)
			const command = {
				command: 'wallet_online_query',
				walletAddress: this.wallet.address,
				targetWallet: ethers.getAddress(targetWallet),
				timestamp,
			}
			const innerArmor = await encryptRouteCommand(this.wallet, command, routerArmoredPublicKey)
			const pool = this.nodes.filter((n) => n?.domain && !mailboxDomains.has(n.domain))
			if (!pool.length) return null
			const entries = await pickGossipEntryNodesForSend(pool, 4, mailboxDomains)
			const targets = entries.length ? entries : getRandomNodes(pool, Math.min(4, pool.length))
			if (!targets.length) return null
			const results = await Promise.all(
				targets.map(async (node) => {
					const url = postUrl(node.domain)
					try {
						const armored =
							this.cfg?.runtime.outerWrap === false
								? innerArmor
								: await wrapArmorToEntryRoute(innerArmor, node.armoredPublicKey)
						const res = await postWithTimeout(
							url,
							{
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(buildPostBody(armored)),
								referrerPolicy: 'no-referrer',
							},
							10_000,
						)
						const text = (await res.text()).trim()
						if (!text) return null
						try {
							return JSON.parse(text)
						} catch {
							const m = text.match(/\{[\s\S]*\}/)
							return m ? JSON.parse(m[0]) : null
						}
					} catch {
						return null
					}
				}),
			)
			for (const r of results) {
				if (r && typeof r === 'object' && (r as { ok?: boolean }).ok === true) {
					return { ok: true, online: !!(r as { online?: boolean }).online }
				}
			}
			return null
		} catch {
			return null
		}
	}

	private async walletNativeWakeQuery(
		targetWallet: string,
		routerArmoredPublicKey: string,
		mailboxDomains: Set<string>,
	): Promise<{ ok: boolean; nativeWakeable: boolean } | null> {
		if (!this.wallet) return null
		try {
			const timestamp = Math.floor(Date.now() / 1000)
			const command = {
				command: 'wallet_native_wake_query',
				walletAddress: this.wallet.address,
				targetWallet: ethers.getAddress(targetWallet),
				timestamp,
			}
			const innerArmor = await encryptRouteCommand(this.wallet, command, routerArmoredPublicKey)
			const pool = this.nodes.filter((n) => n?.domain && !mailboxDomains.has(n.domain))
			if (!pool.length) return null
			const entries = await pickGossipEntryNodesForSend(pool, 4, mailboxDomains)
			const targets = entries.length ? entries : getRandomNodes(pool, Math.min(4, pool.length))
			if (!targets.length) return null
			const results = await Promise.all(
				targets.map(async (node) => {
					const url = postUrl(node.domain)
					try {
						const armored =
							this.cfg?.runtime.outerWrap === false
								? innerArmor
								: await wrapArmorToEntryRoute(innerArmor, node.armoredPublicKey)
						const res = await postWithTimeout(
							url,
							{
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(buildPostBody(armored)),
								referrerPolicy: 'no-referrer',
							},
							10_000,
						)
						const text = (await res.text()).trim()
						if (!text) return null
						try {
							return JSON.parse(text)
						} catch {
							const m = text.match(/\{[\s\S]*\}/)
							return m ? JSON.parse(m[0]) : null
						}
					} catch {
						return null
					}
				}),
			)
			for (const r of results) {
				if (r && typeof r === 'object' && (r as { ok?: boolean }).ok === true) {
					return { ok: true, nativeWakeable: !!(r as { nativeWakeable?: boolean }).nativeWakeable }
				}
			}
			return null
		} catch {
			return null
		}
	}

	/** Encrypt a mailbox command (e.g. gossip_delivery_ack) to route B and POST via entry C ≠ B. */
	async postMailboxCommand(
		routerArmoredPublicKey: string,
		command: Record<string, unknown>,
	): Promise<boolean> {
		if (!this.wallet) return false
		try {
			const innerArmor = await encryptRouteCommand(this.wallet, command, routerArmoredPublicKey)
			const mailboxDomains = new Set(
				pickRouteNodesByArmoredKey(this.nodes, routerArmoredPublicKey).map((n) => n.domain),
			)
			return this.postToEntries(innerArmor, mailboxDomains)
		} catch (ex) {
			this.emit.log('warn', `postMailboxCommand error: ${(ex as Error)?.message ?? String(ex)}`)
			return false
		}
	}

	async postOwnMailboxCommand(command: Record<string, unknown>): Promise<boolean> {
		const route = this.cfg?.identity.ownRouteArmoredPublicKey || ''
		if (!route) return false
		return this.postMailboxCommand(route, command)
	}

	/**
	 * `voice_offer_store` to the callee mailbox. The command is opaque (sessionId
	 * is the capability), encrypted to the callee mailbox route key and posted
	 * through entries that are not that mailbox, like every other mailbox command.
	 * The mailbox never decrypts `offerArmor`; it is callee user-PGP ciphertext.
	 */
	/**
	 * With `push: 1` a v2 callee mailbox also rings the callee itself (it finds
	 * the callee from the offer's recipient key ID) and answers `pushed: true`,
	 * so our voice_listen need not carry the callee wallet. Resolves to whether
	 * it rang; old mailboxes never say so.
	 */
	private async indexVoiceOfferOnCalleeMailbox(args: {
		callId: string
		sessionId: string
		expiresAt: number
		offerArmor: string
		calleeRoute: string
		pushTimestamp: number
	}): Promise<boolean> {
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
			}, args.calleeRoute)
			if (!inner.includes('-----BEGIN PGP MESSAGE-----')) return false
			const mailboxDomains = new Set(
				pickRouteNodesByArmoredKey(this.nodes, args.calleeRoute).map((n) => n.domain),
			)
			const result = await this.postVoiceCommandForJson(inner, mailboxDomains)
			const rang = result?.pushed === true
			this.emit.log(result?.ok ? 'info' : 'warn', `voice offer index ${result?.ok ? 'stored' : 'failed'} pushed=${rang} callId=${args.callId.slice(0, 8)}`)
			return rang
		} catch (ex) {
			this.emit.log('warn', `voice offer index error: ${(ex as Error)?.message ?? String(ex)}`)
			return false
		}
	}

	/** One voice command through up to two entries; the node's JSON answer or null. */
	private async postVoiceCommandForJson(
		innerArmor: string,
		excludeDomains: Set<string>,
	): Promise<Record<string, unknown> | null> {
		const tried = new Set(excludeDomains)
		for (let wave = 0; wave < 2; wave++) {
			const [node] = await pickGossipEntryNodesForSend(this.nodes, 1, tried)
			if (!node) return null
			tried.add(node.domain)
			try {
				const armored = this.cfg?.runtime.outerWrap === false
					? innerArmor
					: await wrapArmorToEntryRoute(innerArmor, node.armoredPublicKey)
				const res = await postWithTimeout(postUrl(node.domain), {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(buildPostBody(armored)),
					referrerPolicy: 'no-referrer',
				}, 12_000)
				if (!res.ok) {
					markGossipNodeBad(node.domain)
					continue
				}
				markGossipNodeHealthy(node.domain)
				const text = (await res.text()).trim()
				try {
					return JSON.parse(text.slice(text.indexOf('{'))) as Record<string, unknown>
				} catch {
					return { ok: true }
				}
			} catch {
				markGossipNodeBad(node.domain)
			}
		}
		return null
	}

	async sendVoiceFrame(routerArmoredPublicKey: string, frame: Record<string, unknown>): Promise<boolean> {
		const candidate = frame as Partial<VoiceFrame> & { targetWallet?: string; targetSessionId?: string }
		// Accept legacy UI alias `targetWallet` → canonical VoiceFrame.`to`.
		const to =
			(typeof candidate.to === 'string' && candidate.to.trim()) ||
			(typeof candidate.targetWallet === 'string' && candidate.targetWallet.trim()) ||
			''
		// Mailbox delivers only when targetSessionId matches the peer voice_listen.
		const targetSessionId =
			typeof candidate.targetSessionId === 'string' ? candidate.targetSessionId.trim() : ''
		const targetSessionOk = /^[0-9a-fA-F-]{16,64}$/.test(targetSessionId)
		if (
			typeof candidate.callId !== 'string' || !candidate.callId ||
			typeof candidate.sessionId !== 'string' || !candidate.sessionId ||
			!targetSessionOk ||
			!Number.isSafeInteger(candidate.seq) || (candidate.seq as number) < 0 ||
			typeof candidate.timestamp !== 'number' || !Number.isFinite(candidate.timestamp) ||
			typeof candidate.payload !== 'string' || !candidate.payload ||
			candidate.payload.length > VOICE_MAX_FRAME_B64
		) {
			this.emit.log(
				'warn',
				`sendVoiceFrame rejected: callId=${!!candidate.callId} session=${!!candidate.sessionId} to=${!!to} targetSession=${targetSessionOk} seq=${candidate.seq} payload=${typeof candidate.payload === 'string' ? candidate.payload.length : 0}`,
			)
			return false
		}
		let payload = candidate.payload
		const mailboxDomains = new Set(
			pickRouteNodesByArmoredKey(this.nodes, routerArmoredPublicKey).map((n) => n.domain),
		)
		const v2 = this.voiceV2
		if (v2 && candidate.sessionId === v2.sessionId) {
			v2.peerSessionId = targetSessionId
			v2.callId = candidate.callId
			try {
				let plain = await aesDecryptV1(v2.key, payload)
				const control = parseVoiceControl(plain)
				// Our node holds a v2 channel: the caps frame tells the peer its write key.
				if (control && v2.ownV2 && (control.type === 'voice_media_caps_v1' || control.type === 'voice_video_enable_v1')) {
					control.chan = 2
					control.wk = bytesToBase64(v2.writeKey)
					plain = new TextEncoder().encode(JSON.stringify(control))
					payload = await aesEncryptV1(v2.key, plain)
				}
				const locator = locatorFromSessionId(targetSessionId)
				if (v2.peerWriteKey && !v2.disabled && locator) {
					const kind = (candidate as { mediaKind?: string }).mediaKind === 'video'
						? VOICE_KIND_VIDEO
						: control ? VOICE_KIND_CONTROL : VOICE_KIND_AUDIO
					const literal = await sealVoiceChunk({
						sessionKey: v2.key,
						locator,
						writeKey: v2.peerWriteKey,
						kind,
						seq: candidate.seq as number,
						captureMs: Date.now(),
						data: plain,
					})
					const inner = await encryptVoiceChunkLiteral(literal, routerArmoredPublicKey)
					const result = await this.postVoiceChunk(inner, mailboxDomains)
					if (result.ok) {
						if (++v2.txOk === 1) this.emit.log('info', 'voice v2 first chunk accepted')
						v2.chunkMiss = 0
						return true
					}
					if (result.error === 'voice_chunk_auth' || result.error === 'invalid_voice_chunk') {
						v2.disabled = true
						this.emit.log('warn', `voice v2 chunk refused (${result.error}); v1 for the rest of the call`)
					} else if (result.error === 'target_voice_session_not_found') {
						// The peer's listen is down (reconnecting) or reopened without v2.
						// Send this frame as v1 and keep v2: the peer re-listens with the
						// same write key, and the next chunk goes through again.
						if (++v2.chunkMiss === 1 || v2.chunkMiss % 50 === 0) {
							this.emit.log('warn', `voice v2 chunk target missing x${v2.chunkMiss}; this frame as v1`)
						}
					} else {
						return false
					}
				}
			} catch (ex) {
				this.emit.log('warn', `voice v2 send error: ${(ex as Error)?.message ?? String(ex)}`)
			}
		}
		// The peer's mailbox decrypts this command, so it carries only what the
		// relay needs (CoNET Chat protocol): no sender or recipient wallet. The
		// sessionId is the capability; identity stays inside the AES payload.
		const command = {
			command: 'voice_uplink',
			type: 'voice_frame_v1',
			callId: candidate.callId,
			sessionId: candidate.sessionId,
			targetSessionId,
			direction: candidate.direction || 'uplink',
			seq: candidate.seq,
			frameTimestamp: candidate.timestamp,
			payload,
			...(candidate.frameId ? { frameId: candidate.frameId } : {}),
			...(candidate.chunkIndex !== undefined ? { chunkIndex: candidate.chunkIndex } : {}),
			...(candidate.chunkCount !== undefined ? { chunkCount: candidate.chunkCount } : {}),
			timestamp: Math.floor(Date.now() / 1000),
		}
		const innerArmor = await encryptOpaqueVoiceCommand(command, routerArmoredPublicKey)
		// One successful entry POST per frame — never parallel fanout of the same seq.
		return this.postToEntries(innerArmor, mailboxDomains, { fanout: 1 })
	}

	/**
	 * One entry POST for a v2 chunk (a second entry only on a network failure).
	 * Reads the node's JSON so a refused chunk can fall back to v1.
	 */
	private async postVoiceChunk(
		innerArmor: string,
		excludeDomains: Set<string>,
	): Promise<{ ok: boolean; error?: string }> {
		const tried = new Set(excludeDomains)
		for (let wave = 0; wave < 2; wave++) {
			const [node] = await pickGossipEntryNodesForSend(this.nodes, 1, tried)
			if (!node) return { ok: false, error: 'no_entry' }
			tried.add(node.domain)
			try {
				const armored = this.cfg?.runtime.outerWrap === false
					? innerArmor
					: await wrapArmorToEntryRoute(innerArmor, node.armoredPublicKey)
				const res = await postWithTimeout(postUrl(node.domain), {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(buildPostBody(armored)),
					referrerPolicy: 'no-referrer',
				}, 12_000)
				if (!res.ok) {
					markGossipNodeBad(node.domain)
					continue
				}
				markGossipNodeHealthy(node.domain)
				const text = (await res.text()).trim()
				try {
					const body = JSON.parse(text.slice(text.indexOf('{'))) as { ok?: boolean; error?: string }
					return body.ok === false ? { ok: false, error: body.error || 'refused' } : { ok: true }
				} catch {
					return { ok: true }
				}
			} catch {
				markGossipNodeBad(node.domain)
			}
		}
		return { ok: false, error: 'network' }
	}

	/** A v2 chunk on our own channel → the ordinary frame the UI already handles. */
	private async handleVoiceChunk(blobB64: string): Promise<void> {
		const v2 = this.voiceV2
		if (!v2 || !blobB64) return
		try {
			const opened = await openVoiceChunk(v2.key, v2.locator, base64ToBytes(blobB64))
			if (++v2.rx === 1) this.emit.log('info', `voice v2 first chunk rx kind=${opened.kind}`)
			this.notePeerVoiceCaps(opened.data)
			this.voiceReorder.push({
				type: 'voice_frame_v1',
				callId: v2.callId,
				sessionId: v2.peerSessionId,
				seq: opened.seq,
				timestamp: opened.captureMs,
				payload: await aesEncryptV1(v2.key, opened.data),
				...(opened.kind === VOICE_KIND_VIDEO ? { mediaKind: 'video' } : {}),
			} as unknown as VoiceFrameChunk)
		} catch (ex) {
			this.emit.log('warn', `voice v2 chunk open failed: ${(ex as Error)?.message ?? String(ex)}`)
		}
	}

	/** Peer caps with `chan: 2` carry the write key for the peer's channel. */
	private notePeerVoiceCaps(plain: Uint8Array): void {
		const v2 = this.voiceV2
		if (!v2 || v2.peerWriteKey) return
		const control = parseVoiceControl(plain)
		if (!control || Number(control.chan) !== 2 || typeof control.wk !== 'string') return
		try {
			const wk = base64ToBytes(control.wk)
			if (wk.length === 32) {
				v2.peerWriteKey = wk
				this.emit.log('info', 'voice v2 peer channel')
			}
		} catch { /* ignore */ }
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
			calleeRoute?: string
		},
		/** Base64 AES session key of the call: enables voice channel v2. */
		channelKey?: string,
	): Promise<boolean> {
		const wallet = this.wallet
		if (this.paused || !this.cfg || !wallet || !sessionId) {
			this.emit.log('warn', `voice listen refused early: paused=${this.paused} cfg=${!!this.cfg} wallet=${!!wallet} session=${!!sessionId}`)
			return false
		}
		try {
			await this.pgpReady
		} catch (ex) {
			this.emit.log('warn', `voice listen refused: pgp key did not open (${(ex as Error)?.message ?? String(ex)})`)
			return false
		}
		this.voiceListenController?.abort('voice_replace')
		// Drop pending reorder state from the previous listen so a new session
		// cannot stall behind an old nextSeq / overflowed buffer.
		this.voiceReorder.clear()
		const previous = [this.voiceV2, this.voiceV2Retained].find((v) => v?.sessionId === sessionId) ?? null
		this.voiceV2 = null
		this.voiceV2Retained = null
		const locator = locatorFromSessionId(sessionId)
		const sameKey = (raw: string | undefined): boolean => {
			if (!previous || !raw) return !!previous && !raw
			try {
				const key = base64ToBytes(raw)
				return key.length === previous.key.length && key.every((b, i) => b === previous.key[i])
			} catch { return false }
		}
		if (previous && sameKey(channelKey)) {
			// Reconnect: same write key and peer key; the handshake re-confirms ownV2.
			this.voiceV2 = { ...previous, ownV2: false }
		} else if (channelKey && locator) {
			try {
				const key = base64ToBytes(channelKey)
				if (key.length === 32) {
					this.voiceV2 = {
						sessionId, locator, key, writeKey: randomWriteKey(), ownV2: false,
						peerWriteKey: null, peerSessionId: '', callId: '', disabled: false, txOk: 0, rx: 0, chunkMiss: 0,
					}
				}
			} catch { /* v1 only */ }
		}
		const v2Setup = this.voiceV2
			? { v: 2, wk: bytesToBase64(this.voiceV2.writeKey) }
			: {}
		const route = this.cfg.identity.ownRouteArmoredPublicKey || ''
		const routeNodes = pickRouteNodesByArmoredKey(this.nodes, route)
		const mailboxDomains = new Set(routeNodes.map((n) => n.domain))
		const pool = this.nodes.filter((n) => !mailboxDomains.has(n.domain))
		const candidates = pool.length ? pool : this.nodes
		const healthy = await pickHealthyGossipNodes(candidates)
		const entries = healthy.length ? healthy : candidates
		if (!route || !routeNodes.length || !entries.length) {
			this.emit.log('warn', `voice listen refused: route=${!!route} mailbox=${routeNodes.length} entries=${entries.length}`)
			return false
		}
		let offerArmor = ''
		const offerText = pushWakeup?.offerText?.trim() || ''
		const recipientPgp = pushWakeup?.recipientPgp?.trim() || ''
		if (offerText && recipientPgp) {
			try {
				const signMessage = await wallet.signMessage(offerText)
				const envelope = {
					timestamp: Date.now(),
					text: offerText,
					from: wallet.address,
					signMessage,
				}
				offerArmor = await armorToString(await encrypt({
					message: await createMessage({ text: utf8ToBase64(JSON.stringify(envelope)) }),
					encryptionKeys: await readKey({ armoredKey: recipientPgp }),
					config: { preferredCompressionAlgorithm: enums.compression.zlib },
				}))
				if (!offerArmor.includes('-----BEGIN PGP MESSAGE-----') || offerArmor.length > 48_000) {
					this.emit.log('warn', 'voice offer armor missing or too large; continuing listen for VoIP push')
					offerArmor = ''
				}
			} catch (ex) {
				// Do not abort voice_listen: mailbox still needs the SSE attach
				// so notifyVoiceCallPush can wake a force-quit iOS CallKit UI.
				this.emit.log('warn', `voice offer encrypt failed; continuing listen for VoIP push: ${(ex as Error)?.message ?? String(ex)}`)
				offerArmor = ''
			}
		}
		// Index the encrypted offer on the callee mailbox ourselves. The caller
		// mailbox forwards the same armor and indexes it, but that remote leg is
		// best effort and is missing on mailboxes that predate it. A killed iOS app
		// reads the caller identity from this index (`voice_offer_fetch`), so
		// without it the incoming call has no name. Same armor, same ids: storing
		// twice is harmless. It runs beside the listen encrypt below and is awaited
		// (capped) before the listen POST, because the ring push follows that POST.
		const offerIndexed: Promise<boolean> = offerArmor && pushWakeup?.callId && pushWakeup.calleeRoute
			? this.indexVoiceOfferOnCalleeMailbox({
				callId: pushWakeup.callId,
				sessionId,
				expiresAt: pushWakeup.expiresAt,
				offerArmor,
				calleeRoute: pushWakeup.calleeRoute,
				pushTimestamp: pushWakeup.timestamp,
			})
			: Promise.resolve(false)
		// Both listen variants now; pick after the offer store answers. The
		// legacy one makes our own node ring the callee, so that node learns the
		// callee wallet: only when the callee mailbox did not ring it.
		const [innerBase, innerWake] = await Promise.all([
			encryptOpaqueVoiceCommand({
				command: 'voice_listen',
				sessionId,
				timestamp: Math.floor(Date.now() / 1000),
				...v2Setup,
			}, route),
			pushWakeup
				? encryptOpaqueVoiceCommand({
					command: 'voice_listen',
					sessionId,
					timestamp: Math.floor(Date.now() / 1000),
					...v2Setup,
					callId: pushWakeup.callId,
					targetWallet: pushWakeup.calleeEoa,
					expiresAt: pushWakeup.expiresAt,
					pushTimestamp: pushWakeup.timestamp,
					...(offerArmor ? { offerArmor } : {}),
				}, route)
				: Promise.resolve(''),
		])
		let inner = innerBase
		if (!inner.includes('-----BEGIN PGP MESSAGE-----')) {
			this.emit.log('warn', 'voice listen armor missing')
			return false
		}
		const controller = new AbortController()
		this.voiceListenController = controller
		const node = getRandomNode(entries)!
		this.emit.log('info', `voice listen entry=${node.domain} mailbox=${routeNodes[0]?.domain ?? ''}`)
		let handshakeSettled = false
		const handshake = new Promise<boolean>((resolve) => {
			const timer = setTimeout(() => {
				if (handshakeSettled) return
				handshakeSettled = true
				this.emit.log('warn', 'voice relay handshake timed out')
				resolve(false)
			}, 12_000)
			controller.signal.addEventListener('abort', () => {
				if (handshakeSettled) return
				handshakeSettled = true
				clearTimeout(timer)
				resolve(false)
			}, { once: true })
			const markReady = () => {
				if (handshakeSettled) return
				handshakeSettled = true
				clearTimeout(timer)
				resolve(true)
			}
			void (async () => {
				try {
					// The listen POST is what rings the callee. Let the offer index land
					// first, but never hold the call for more than 3 s.
					const rang = await Promise.race([offerIndexed, new Promise<boolean>((done) => setTimeout(() => done(false), 3_000))])
					if (pushWakeup && !rang && innerWake.includes('-----BEGIN PGP MESSAGE-----')) inner = innerWake
					if (pushWakeup) this.emit.log('info', `voice callee wake by ${rang ? 'callee-mailbox' : 'legacy-listen'}`)
					const armored = this.cfg?.runtime.outerWrap === false ? inner : await wrapArmorToEntryRoute(inner, node.armoredPublicKey)
					const res = await fetch(postUrl(node.domain), {
						method: 'POST',
						headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', Connection: 'keep-alive' },
						body: JSON.stringify(buildPostBody(armored)),
						signal: controller.signal,
						cache: 'no-store',
					})
					if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
					const reader = res.body.getReader()
					const decoder = new TextDecoder()
					let buffer = ''
					const takeBlock = (): string | null => {
						const crlf = buffer.indexOf('\r\n\r\n')
						const lf = buffer.indexOf('\n\n')
						if (crlf < 0 && lf < 0) return null
						const cut = crlf >= 0 && (lf < 0 || crlf <= lf) ? crlf : lf
						const width = cut === crlf ? 4 : 2
						const block = buffer.slice(0, cut)
						buffer = buffer.slice(cut + width)
						return block
					}
					while (!controller.signal.aborted) {
						const { value, done } = await reader.read()
						if (done) break
						buffer += decoder.decode(value, { stream: true })
						let block: string | null
						while ((block = takeBlock()) !== null) {
							const payload = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n').trim()
							if (!payload) continue
							try {
								const frame = JSON.parse(payload) as Record<string, unknown>
								if (frame.type === 'voice_ready' && frame.ok === true && String(frame.sessionId || '') === sessionId) {
									const chanV2 = Number(frame.v) === 2 && this.voiceV2?.sessionId === sessionId
									if (chanV2 && this.voiceV2) this.voiceV2.ownV2 = true
									this.emit.log('info', `voice ready wallet=${String(frame.nodeWallet ?? '')} chan=${chanV2 ? 2 : 1}`)
									markReady()
								} else if (frame.type === 'voice_ready') {
									this.emit.log('warn', 'voice ready ignored')
								}
								if (frame.t === 'c' && typeof frame.d === 'string') {
									void this.handleVoiceChunk(frame.d)
									continue
								}
								if (frame.type === 'voice_frame_v1') {
									const normalized = typeof frame.frameTimestamp === 'number' ? { ...frame, timestamp: frame.frameTimestamp } : frame
									const v2 = this.voiceV2
									if (v2 && typeof frame.payload === 'string') {
										if (typeof frame.sessionId === 'string') v2.peerSessionId = frame.sessionId
										if (typeof frame.callId === 'string') v2.callId = frame.callId
										if (!v2.peerWriteKey) {
											void aesDecryptV1(v2.key, frame.payload).then((p) => this.notePeerVoiceCaps(p)).catch(() => {})
										}
									}
									this.voiceReorder.push(normalized as unknown as VoiceFrameChunk)
								}
							} catch { /* malformed frame */ }
						}
					}
					if (!handshakeSettled) {
						handshakeSettled = true
						clearTimeout(timer)
						resolve(false)
					}
					await reader.cancel()
				} catch (ex) {
					if (!handshakeSettled) {
						handshakeSettled = true
						clearTimeout(timer)
						resolve(false)
					}
					if (!controller.signal.aborted) this.emit.log('warn', `voice SSE failed: ${(ex as Error)?.message ?? String(ex)}`)
				}
			})()
		})
		const opened = await handshake
		if (!opened && this.voiceListenController === controller) {
			controller.abort('voice_stop')
			this.voiceListenController = null
		}
		return opened
	}

	async stopVoiceListen(sessionId: string): Promise<boolean> {
		const route = this.cfg?.identity.ownRouteArmoredPublicKey || ''
		const wallet = this.wallet
		this.voiceListenController?.abort('voice_stop')
		this.voiceListenController = null
		if (this.voiceV2?.sessionId === sessionId) {
			this.voiceV2Retained = this.voiceV2
			this.voiceV2 = null
		}
		if (!route || !wallet) return true
		const innerArmor = await encryptOpaqueVoiceCommand({
			command: 'voice_unlisten',
			sessionId,
			timestamp: Math.floor(Date.now() / 1000),
		}, route)
		return this.postToEntries(innerArmor, new Set(
			pickRouteNodesByArmoredKey(this.nodes, route).map((n) => n.domain),
		))
	}
}

/** JSON control frame inside a decrypted voice payload, or null for media. */
function parseVoiceControl(plain: Uint8Array): Record<string, unknown> | null {
	if (!plain.length || plain[0] !== 0x7b) return null
	try {
		const obj = JSON.parse(new TextDecoder().decode(plain)) as unknown
		return obj && typeof obj === 'object' && typeof (obj as { type?: unknown }).type === 'string'
			? obj as Record<string, unknown>
			: null
	} catch {
		return null
	}
}
