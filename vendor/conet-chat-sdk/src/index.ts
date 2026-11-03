/**
 * @conet.project/chat-sdk — public entry (main thread).
 *
 * Gossip messaging with all openpgp encrypt/decrypt + ethers signing running in a
 * Web Worker (zero main-thread crypto → no UI freeze) + encrypted fragmented IPFS
 * history. UI-agnostic; reusable across SilentPassUI / bizSite / Alliance / POS.
 *
 * Usage (host owns worker creation so the SDK stays bundler-agnostic):
 * ```ts
 * import { createBeamioChatClient } from '@conet.project/chat-sdk'
 * const client = createBeamioChatClient(config, {
 *   workerFactory: () => new Worker(new URL('@conet.project/chat-sdk/worker', import.meta.url), { type: 'module' }),
 * })
 * await client.init()
 * client.on('message', (env) => addNewMessage(env.line)) // host serial queue + checkSign
 * ```
 */

export { createBeamioChatClient } from './client.js'
export type { BeamioChatClientOptions } from './client.js'

export {
	armorToString,
	buildPostBody,
	encryptRouteCommand,
	wrapArmorToEntryRoute,
	wrapArmorToMailboxWork,
	wrapWouldHitSameNode,
} from './envelope.js'
export type { MailboxWorkEnvelope } from './envelope.js'
export { mailboxDomainsFor, postUrl } from './nodes.js'
export {
	VOICE_PAY_VALID_SEC,
	buildVoiceListenV3,
	newPaidVoiceChannel,
	newVoiceChannelSecrets,
	newVoiceUiKey,
	parseVoiceChannelsWire,
	voiceListenText,
	voicePayText,
} from './voice-v3.js'
export type {
	VoiceCallV3Config,
	VoiceChannelWire,
	VoiceChannelsWire,
	VoiceOwnChannel,
	VoicePayAuth,
	VoicePeerChannel,
} from './voice-v3.js'
export type { VoiceOfferArgs } from './protocol.js'
export {
	GROUP_V1_DEFAULT_PADDING_BUCKET_BYTES,
	GROUP_V1_MAX_BODY_BYTES,
	GROUP_V1_MAX_MEMBERS,
	GroupStateV1,
	assertGroupAdminProposalV1,
	assertGroupMessageV1,
	assertGroupRosterV1,
	assertNextGroupRosterV1,
	classifyGroupPlaintext,
	groupRosterHash,
} from './group.js'

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
	HistoryReadOptions,
	InboundEnvelope,
	NodeInfo,
	PersistenceAdapter,
	PresenceEvent,
	GroupAdminProposalV1,
	GroupInboundEvent,
	GroupIssueRosterRequest,
	GroupIssueRosterResult,
	GroupIssueTombstoneRequest,
	GroupIssueTombstoneResult,
	GroupMemberV1,
	GroupMessageV1,
	GroupRosterV1,
	GroupSendRequest,
	GroupSendResult,
	GroupTombstoneV1,
	SendMessageOptions,
	StatusEvent,
	Unsubscribe,
	VoiceCallSignal,
	VoiceCallSignalType,
	VoiceFrame,
} from './types.js'
export type { VoiceConflictEvent, VoiceGapEvent, VoiceFrameChunk } from './voice-reorder.js'
export { VOICE_VIDEO_SEQ_BASE } from './types.js'

export {
	CHAT_DAEMON_CAPABILITIES,
	CHAT_DAEMON_PROTOCOL_VERSION,
	CHAT_SDK_VERSION,
	COMMAND_PRIVACY,
} from './protocol.js'
export type {
	ChatDaemonCapability,
	ChatDaemonCommand,
	ChatDaemonCommandType,
	ChatDaemonHello,
	ChatDaemonImplementation,
	ChatDaemonOutbound,
	CommandPrivacy,
	NativeDaemonEntry,
	NativeSignRequest,
	NativeSignResponse,
	ProvisionIdentityPayload,
	WalletSignaturePath,
	WorkerCommand,
	WorkerInitPayload,
	WorkerOutbound,
} from './protocol.js'
export { TS_WORKER_CAPABILITIES, hasCapability, negotiateChatDaemon, tsWorkerHello } from './daemon.js'
export type { ChatDaemonFeatures } from './daemon.js'
export { CALL_CONTROL_TYPES, CALL_SIGNAL_TYPES, classifyCallSignal, parseCallControl } from './call-signal.js'
export type { CallSignalKind, CallSignalMatch, CallSignalType } from './call-signal.js'
export {
	chatEnvelope,
	deliveryAckCommand,
	deliveryReceipt,
	mailboxWork,
	pendingRow,
	routeCommandLiteral,
} from './wire.js'
export type { ChatEnvelope } from './wire.js'
