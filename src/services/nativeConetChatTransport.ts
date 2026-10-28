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
 * I/O. EOA signing stays on the PWA main thread (1B): native emits
 * `chatModuleSignRequest`; this client signs via ethers and replies with
 * `chatModuleSignResponse`.
 *
 * Browser path is unchanged (Worker). Prefer this client for any iOS shell
 * (checked before Android).
 */

import { ethers } from 'ethers'
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
}

const IOS_NATIVE_CHAT_BRIDGE: NativeChatBridge = {
	label: 'ios native chat',
	eventName: 'cashtreesios',
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

function stripPrivateKeyFromIdentity(identity: BeamioChatConfig['identity']): BeamioChatConfig['identity'] {
	return {
		...identity,
		// 1B: never send EOA hex to native / Keychain.
		privateKeyHex: '',
	}
}

class NativeHistoryBridge implements BeamioChatHistory {
	private bufferListeners = new Set<(batch: HistoryBufferEvent) => void>()

	constructor(private readonly client: NativeConetChatClientImpl) {}

	load(options?: HistoryLoadOptions): Promise<void> {
		return this.client.request<void>({ type: 'historyLoad', reqId: 0, options })
	}

	append(entry: Omit<HistoryEntry, 'seq'>): Promise<void> {
		return this.client.request<void>({ type: 'historyAppend', reqId: 0, entry })
	}

	read(options?: HistoryReadOptions): Promise<HistoryEntry[]> {
		return this.client.request<HistoryEntry[]>({ type: 'historyRead', reqId: 0, options }, 60_000)
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

	constructor(
		private readonly config: BeamioChatConfig,
		private readonly bridge: NativeChatBridge,
	) {
		this.historyBridge = new NativeHistoryBridge(this)
		this.signingKeyHex = (config.identity.privateKeyHex || '').replace(/^0x/i, '')
	}

	get history(): BeamioChatHistory {
		return this.historyBridge
	}

	async init(): Promise<void> {
		if (this.destroyed) throw new Error('native chat client destroyed')
		this.attachNativeListener()
		this.nodes = await this.config.getNodes().catch(() => [])
		this.routes = []
		const payload = {
			identity: stripPrivateKeyFromIdentity(this.config.identity),
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
		}
		await this.request<void>({ type: 'init', reqId: 0, payload }, 180_000)
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
		await this.request<unknown>(
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
					| { domain?: ethers.TypedDataDomain; types?: Record<string, Array<ethers.TypedDataField>>; value?: Record<string, unknown> }
					| undefined
				if (!td?.domain || !td.types || !td.value) {
					reply(false, undefined, 'bad_typed_data')
					return
				}
				const { EIP712Domain: _omit, ...types } = td.types as Record<string, Array<ethers.TypedDataField>> & {
					EIP712Domain?: unknown
				}
				const sig = await wallet.signTypedData(td.domain, types, td.value)
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

/**
 * Native chat client for a shell. Defaults to the iOS bridge; the Android shell passes its own
 * {@link NativeChatBridge} (see `androidNativeChatClient.ts`).
 */
export function createNativeConetChatClient(
	config: BeamioChatConfig,
	bridge: NativeChatBridge = IOS_NATIVE_CHAT_BRIDGE,
): BeamioChatClient {
	return new NativeConetChatClientImpl(config, bridge)
}
