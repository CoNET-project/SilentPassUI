/**
 * `hello` negotiation (page side) and the TS Worker's own `hello` answer.
 * Spec: `protocol.ts`. Shared vectors: `spec/chat-daemon-vectors.v1.json` (`hello`).
 */

import {
	CHAT_DAEMON_CAPABILITIES,
	CHAT_DAEMON_PROTOCOL_VERSION,
	CHAT_SDK_VERSION,
	type ChatDaemonCapability,
	type ChatDaemonHello,
	type ChatDaemonImplementation,
} from './protocol.js'

/** Capabilities of the TS Worker daemon in this package. */
export const TS_WORKER_CAPABILITIES: readonly ChatDaemonCapability[] = [
	'history.v2',
	'voice.channelV2',
	'group.v1',
	'presence.query',
	'mailbox.command',
	'send.mailboxWrap',
]

export function tsWorkerHello(): ChatDaemonHello {
	return {
		protocolVersion: CHAT_DAEMON_PROTOCOL_VERSION,
		minProtocolVersion: CHAT_DAEMON_PROTOCOL_VERSION,
		sdkVersion: CHAT_SDK_VERSION,
		implementation: 'ts-worker',
		capabilities: [...TS_WORKER_CAPABILITIES],
	}
}

/**
 * What the page may rely on.
 *  - `negotiated`: the daemon answered `hello` with a version range that includes ours.
 *  - `legacy`: no usable answer (a daemon older than v1 never answers). Keep the pre-v1 rules.
 *  - `incompatible`: the daemon only speaks protocol versions newer than ours. Use no capability.
 */
export interface ChatDaemonFeatures {
	status: 'negotiated' | 'legacy' | 'incompatible'
	/** The daemon's newest protocol version (0 when legacy). */
	protocolVersion: number
	sdkVersion: string
	implementation: ChatDaemonImplementation | ''
	/** Known capabilities only, in {@link CHAT_DAEMON_CAPABILITIES} order. Empty unless negotiated. */
	capabilities: ChatDaemonCapability[]
}

const LEGACY: ChatDaemonFeatures = {
	status: 'legacy',
	protocolVersion: 0,
	sdkVersion: '',
	implementation: '',
	capabilities: [],
}

const IMPLEMENTATIONS: readonly string[] = ['ts-worker', 'ios', 'android']

function isPositiveInt(v: unknown): v is number {
	return typeof v === 'number' && Number.isInteger(v) && v >= 1
}

/**
 * Turn a `hello` answer (or `null` when none came) into {@link ChatDaemonFeatures}.
 * Unknown capabilities are dropped; a malformed answer counts as legacy.
 */
export function negotiateChatDaemon(
	reply: unknown,
	ourVersion: number = CHAT_DAEMON_PROTOCOL_VERSION,
): ChatDaemonFeatures {
	if (!reply || typeof reply !== 'object' || Array.isArray(reply)) return { ...LEGACY }
	const r = reply as Record<string, unknown>
	if (!isPositiveInt(r.protocolVersion) || !Array.isArray(r.capabilities)) return { ...LEGACY }
	const max = r.protocolVersion
	const min = r.minProtocolVersion === undefined ? max : r.minProtocolVersion
	if (!isPositiveInt(min) || min > max) return { ...LEGACY }
	const sdkVersion = typeof r.sdkVersion === 'string' ? r.sdkVersion : ''
	const implementation =
		typeof r.implementation === 'string' && IMPLEMENTATIONS.includes(r.implementation)
			? (r.implementation as ChatDaemonImplementation)
			: ''
	if (min > ourVersion) {
		return { status: 'incompatible', protocolVersion: max, sdkVersion, implementation, capabilities: [] }
	}
	const offered = new Set(r.capabilities.filter((c): c is string => typeof c === 'string'))
	const capabilities = CHAT_DAEMON_CAPABILITIES.filter((c) => offered.has(c))
	return { status: 'negotiated', protocolVersion: max, sdkVersion, implementation, capabilities }
}

export function hasCapability(features: ChatDaemonFeatures | null | undefined, cap: ChatDaemonCapability): boolean {
	return !!features && features.status === 'negotiated' && features.capabilities.includes(cap)
}
