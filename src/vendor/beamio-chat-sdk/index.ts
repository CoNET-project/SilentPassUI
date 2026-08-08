/**
 * @beamio/chat-sdk — public entry (main thread), vendored into SilentPassUI.
 *
 * Gossip messaging with all openpgp encrypt/decrypt + ethers signing running in a
 * Web Worker (zero main-thread crypto → no UI freeze) + encrypted fragmented IPFS
 * history. UI-agnostic; reusable across SilentPassUI / bizSite / Alliance / POS.
 */

export { createBeamioChatClient } from './client'
export type { BeamioChatClientOptions } from './client'

export type {
	BeamioChatClient,
	BeamioChatConfig,
	BeamioChatHistory,
	ChatEventListener,
	ChatEventMap,
	ChatEventName,
	ChatIdentity,
	ChatLogEvent,
	ChatRoute,
	ChatRuntimeOptions,
	ChatStatus,
	DeliveryReceiptEvent,
	HistoryBufferEvent,
	HistoryEntry,
	HistoryLoadOptions,
	InboundEnvelope,
	NodeInfo,
	PersistenceAdapter,
	PresenceEvent,
	StatusEvent,
	Unsubscribe,
} from './types'
