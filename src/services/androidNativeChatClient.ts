/**
 * Android-shell adapter for `@conet.project/chat-sdk` LISTEN parity.
 *
 * When Beamio PWA runs inside `CashTreesAndroid`, Chat UI must not spawn the
 * TypeScript gossip Worker. Native `BeamioConetChatModule` owns mailbox_listen
 * (encrypt to B route PGP, HTTP via entry C ≠ B) and emits `cashtreesandroid`
 * events with `action: "conetChat"`. This client mirrors `BeamioChatClient`
 * enough for `chatWorkerBridge` to treat it like `createBeamioChatClient`.
 *
 * Voice stays on the existing native voice channel; history/group/outbound
 * remain main-thread / stub until those paths are ported.
 */

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
	HistoryEntry,
	HistoryLoadOptions,
	HistoryReadOptions,
	InboundEnvelope,
	NodeInfo,
	SendMessageOptions,
	Unsubscribe,
} from '@conet.project/chat-sdk'
import {
	callAndroidBridgeSafe,
	isCashTreesAndroidConetChatAvailable,
	isCashTreesAndroidShell,
} from '../utils/cashTreesAndroidConetChat'

type ListenerBag<K extends ChatEventName> = Set<ChatEventListener<K>>

function normalizeArmorBody(armor: string): string {
	return armor
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l && !l.startsWith('-----') && !l.startsWith('Version') && !l.startsWith('Comment'))
		.join('')
		.replace(/[^A-Za-z0-9+/=]/g, '')
}

function fingerprintsOverlap(a: string, b: string): boolean {
	if (!a?.trim() || !b?.trim()) return false
	if (a.trim() === b.trim()) return true
	const na = normalizeArmorBody(a)
	const nb = normalizeArmorBody(b)
	if (!na || !nb) return false
	return na === nb || na.slice(0, 64) === nb.slice(0, 64)
}

function resolveMailboxIp(nodes: NodeInfo[], ownRoute: string): string {
	for (const n of nodes) {
		const ip = String((n as { ip_addr?: string }).ip_addr || (n as { ip?: string }).ip || '').trim()
		const armor = String(n.armoredPublicKey || '').trim()
		if (!ip || !armor) continue
		if (fingerprintsOverlap(ownRoute, armor)) return ip
	}
	return ''
}

function nodesForNative(nodes: NodeInfo[]): Array<{
	ip_addr: string
	domain: string
	region: string
	armoredPublicKey: string
}> {
	return nodes
		.map((n) => ({
			ip_addr: String((n as { ip_addr?: string }).ip_addr || (n as { ip?: string }).ip || '').trim(),
			domain: String(n.domain || '').trim(),
			region: String((n as { region?: string }).region || '').trim(),
			armoredPublicKey: String(n.armoredPublicKey || '').trim(),
		}))
		.filter((n) => !!n.ip_addr)
}

/**
 * Detect Android Conet Chat Module without throwing when the bridge is absent
 * (browser / iOS). Prefer `conetChatAvailable()` when present.
 *
 * Any CashTreesAndroid shell injection forces the native path so the TS gossip
 * Worker is never created inside the WebView (even if `conetChatAvailable`
 * briefly fails).
 */
export function preferAndroidNativeChatClient(): boolean {
	return isCashTreesAndroidConetChatAvailable() || isCashTreesAndroidShell()
}

export function createAndroidNativeChatClient(config: BeamioChatConfig): BeamioChatClient {
	const listeners: { [K in ChatEventName]?: ListenerBag<K> } = {}
	let destroyed = false
	let nativeListener: ((ev: Event) => void) | null = null
	let lastNodes: NodeInfo[] = []

	const emit = <K extends ChatEventName>(event: K, payload: ChatEventMap[K]) => {
		const set = listeners[event] as ListenerBag<K> | undefined
		if (!set) return
		for (const cb of set) {
			try {
				cb(payload)
			} catch {
				/* isolate host listeners */
			}
		}
	}

	const emitStatus = (status: ChatStatus, detail?: string) => {
		emit('status', { status, detail })
		emit('log', {
			level: status === 'error' ? 'error' : 'info',
			message: `android native chat: ${status}${detail ? ` (${detail})` : ''}`,
		})
	}

	const onNativeEvent = (ev: Event) => {
		const detail = (ev as CustomEvent).detail as Record<string, unknown> | undefined
		if (!detail || detail.action !== 'conetChat') return
		const kind = String(detail.kind || '')
		if (kind === 'status') {
			const status = String(detail.status || 'idle') as ChatStatus
			const detailMsg = detail.detail != null ? String(detail.detail) : undefined
			emitStatus(status, detailMsg)
			return
		}
		if (kind === 'message') {
			const line = String(detail.line || '')
			if (!line) return
			const env: InboundEnvelope = {
				line,
				armorHash: detail.armorHash != null ? String(detail.armorHash) : undefined,
				plain: detail.wasPlaintext === true,
				viaDomain: detail.viaDomain != null ? String(detail.viaDomain) : undefined,
				receivedAt: Date.now(),
			}
			emit('message', env)
		}
	}

	const history: BeamioChatHistory = {
		async load(_options?: HistoryLoadOptions): Promise<void> {
			/* MVP: encrypted history stays on worker path; native listen-only. */
		},
		async append(_entry: Omit<HistoryEntry, 'seq'>): Promise<void> {
			/* no-op until native history port */
		},
		async read(_options?: HistoryReadOptions): Promise<HistoryEntry[]> {
			return []
		},
		onBuffer(): Unsubscribe {
			return () => undefined
		},
	}

	const client: BeamioChatClient = {
		async init(): Promise<void> {
			if (destroyed) throw new Error('android native chat destroyed')
			if (!preferAndroidNativeChatClient()) {
				throw new Error('CashTreesAndroid.conetChatAvailable unavailable')
			}
			const nodes = await config.getNodes().catch(() => [] as NodeInfo[])
			lastNodes = nodes.slice()
			const identity = config.identity
			const ownRouteArmoredPublicKey = identity.ownRouteArmoredPublicKey || ''
			const mailboxIp = resolveMailboxIp(nodes, ownRouteArmoredPublicKey)
			const payload = {
				privateKeyHex: identity.privateKeyHex,
				pgpPrivateKeyArmored: identity.pgpPrivateKeyArmored,
				pgpPublicKeyArmored: identity.pgpPublicKeyArmored,
				pgpPassphrase: identity.pgpPassphrase || '',
				ownRouteArmoredPublicKey,
				eoaAddress: identity.eoaAddress,
				eoa: identity.eoaAddress,
				mailboxIp,
				nodes: nodesForNative(nodes),
			}
			if (typeof window !== 'undefined' && !nativeListener) {
				nativeListener = onNativeEvent
				window.addEventListener('cashtreesandroid', nativeListener as EventListener)
			}
			emitStatus('connecting')
			const ok = callAndroidBridgeSafe('conetChatInit', JSON.stringify(payload))
			if (ok !== true && ok !== 'true') {
				emitStatus('error', 'conetChatInit_failed')
				throw new Error('conetChatInit refused')
			}
		},

		async sendMessage(
			_to: ChatRoute,
			_payload: string,
			_opts?: SendMessageOptions,
		): Promise<{ sendId: string }> {
			throw new Error('android native chat: sendMessage stays on main-thread path')
		},

		async sendGroupMessage(_request: GroupSendRequest): Promise<GroupSendResult> {
			throw new Error('android native chat: group send is not available yet')
		},

		async issueGroupRoster(_request: GroupIssueRosterRequest): Promise<GroupIssueRosterResult> {
			throw new Error('android native chat: group roster is not available yet')
		},

		async issueGroupTombstone(
			_request: GroupIssueTombstoneRequest,
		): Promise<GroupIssueTombstoneResult> {
			throw new Error('android native chat: group tombstone is not available yet')
		},

		async postMailboxCommand(
			_routerArmoredPublicKey: string,
			_command: Record<string, unknown>,
		): Promise<boolean> {
			return false
		},

		async postOwnMailboxCommand(_command: Record<string, unknown>): Promise<boolean> {
			return false
		},

		async sendVoiceFrame(
			_routerArmoredPublicKey: string,
			_frame: Record<string, unknown>,
		): Promise<boolean> {
			/* Voice frames use the existing native voice channel, not this module. */
			return false
		},

		async startVoiceListen(
			_sessionId: string,
			_pushWakeup?: {
				callId: string
				calleeEoa: string
				expiresAt: number
				timestamp: number
				offerText?: string
				recipientPgp?: string
			},
		): Promise<boolean> {
			/* Shell already owns voice listen when CashTreesAndroid is present. */
			return true
		},

		async stopVoiceListen(_sessionId: string): Promise<boolean> {
			return true
		},

		on<K extends ChatEventName>(event: K, cb: ChatEventListener<K>): Unsubscribe {
			let set = listeners[event] as ListenerBag<K> | undefined
			if (!set) {
				set = new Set()
				;(listeners as Record<string, Set<ChatEventListener<ChatEventName>>>)[event] = set as Set<
					ChatEventListener<ChatEventName>
				>
			}
			set.add(cb)
			return () => {
				set!.delete(cb)
			}
		},

		async queryPresence(_contacts: ChatRoute[]): Promise<Record<string, boolean>> {
			return {}
		},

		async queryNativeWake(_contact: ChatRoute): Promise<boolean | null> {
			return null
		},

		setRoutes(_routes: ChatRoute[]): void {
			/* listen is mailbox-scoped; contact routes are host-owned */
		},

		history,

		pause(): void {
			callAndroidBridgeSafe('conetChatStop')
			emitStatus('paused')
		},

		resume(): void {
			if (destroyed) return
			void client.init().catch(() => undefined)
		},

		destroy(): void {
			destroyed = true
			callAndroidBridgeSafe('conetChatStop')
			if (typeof window !== 'undefined' && nativeListener) {
				window.removeEventListener('cashtreesandroid', nativeListener as EventListener)
				nativeListener = null
			}
			for (const key of Object.keys(listeners) as ChatEventName[]) {
				listeners[key]?.clear()
			}
			emitStatus('idle', 'destroyed')
		},
	}

	/** Optional: refresh native node snapshot without full re-init. */
	;(client as BeamioChatClient & { updateNativeNodes?: (nodes: NodeInfo[]) => void }).updateNativeNodes = (
		nodes: NodeInfo[],
	) => {
		lastNodes = nodes.slice()
		callAndroidBridgeSafe('conetChatUpdateNodes', JSON.stringify(nodesForNative(nodes)))
	}

	void lastNodes
	return client
}
