import { ethers } from 'ethers'
import {
	createVoiceSessionKey,
	encryptVoiceFrame,
	INCOMING_CALL_RING_TIMEOUT_MS,
	makeVoiceCallSignal,
	recoverVoiceCallOfferSigner,
	signVoiceCallOffer,
	randomMailboxVoiceSessionId,
	randomVoiceId,
	voiceSessionKeyFromBase64,
	voiceSessionKeyToBase64,
	type VoiceCallSignal,
} from '@/utils/voiceCallSession'
import {
	sendMessage,
	getRandomNodes,
} from '@/services/chat'
import { ensureNativePushBoundForWallet } from '@/utils/cashTreesPushBind'
import {
	startWorkerVoiceListen,
	stopWorkerVoiceListen,
	sendWorkerVoiceFrame,
} from '@/services/chatWorkerBridge'

export type VoiceCallControllerOptions = {
	privateKey: string
	localCallId: string
	peerEoa: string
	peerPgp: string
	peerRoute: string
	allNodes: nodeInfo[]
}

export type VoiceCallChannel = {
	callId: string
	sessionId: string
	tempWalletAddress: string
	entryDomains: string[]
	signal: VoiceCallSignal
	sessionKey: Uint8Array
}

/**
 * Send an incoming-call rejection over the caller's temporary voice SSE.
 *
 * The caller is listening on `offer.sessionId` before the offer is delivered.
 * Keep this control signal on that short-lived encrypted relay instead of
 * depending only on the normal Chat mailbox, which may be paused while the
 * native call UI is in the foreground.
 */
const sendVoiceCallControlToTemporaryRelay = async (
	options: VoiceCallControllerOptions,
	offer: VoiceCallSignal,
	control: { type: 'voice_call_reject_v1' | 'voice_call_timeout_v1'; reason: string; framePrefix: string },
): Promise<boolean> => {
	if (!offer.sessionId || !offer.from || !offer.callId || !offer.sessionKey) return false
	try {
		const sessionKey = voiceSessionKeyFromBase64(offer.sessionKey)
		const now = Date.now()
		const body = JSON.stringify({
			type: control.type,
			callId: offer.callId,
			sessionId: offer.sessionId,
			from: new ethers.Wallet(options.privateKey).address,
			to: offer.from,
			reason: control.reason,
			createdAt: now,
			timestamp: now,
		})
		const payload = await encryptVoiceFrame(
			sessionKey,
			new TextEncoder().encode(body),
		)
		return await sendWorkerVoiceFrame(options.peerRoute, {
			type: 'voice_frame_v1',
			callId: offer.callId,
			sessionId: randomVoiceId(control.framePrefix),
			targetSessionId: offer.sessionId,
			seq: 0,
			payload,
		})
	} catch {
		return false
	}
}

export const sendVoiceCallRejectionToTemporaryRelay = async (
	options: VoiceCallControllerOptions,
	offer: VoiceCallSignal,
): Promise<boolean> => sendVoiceCallControlToTemporaryRelay(options, offer, {
	type: 'voice_call_reject_v1',
	reason: 'declined',
	framePrefix: 'reject',
})

/**
 * Chat-only voice controller. It owns temporary in-memory channel identity,
 * route-compatible mailbox use, random entry selection, signaling, and teardown.
 * The temporary wallet is never registered on-chain and never persisted.
 */
const declinedVoiceOfferKeys = new Set<string>()

export type PeerVoiceMaterial = {
	peerPgp: string
	peerRoute: string
}

export function peerVoiceMaterial(
	chats: Array<{ address?: string; chatData?: { publicArmored?: string; routersArmoreds?: string } }> | undefined,
	peerAddress: string,
): PeerVoiceMaterial {
	const want = peerAddress.trim().toLowerCase()
	const row = (chats || []).find((chat) => (chat.address || '').trim().toLowerCase() === want)
	return {
		peerPgp: String(row?.chatData?.publicArmored || '').trim(),
		peerRoute: String(row?.chatData?.routersArmoreds || '').trim(),
	}
}

/**
 * Native Decline and the in-app Decline button share this send.
 * The temporary relay reaches a live ringing page immediately. The chat
 * message is always sent as well, so the caller still ends if that relay
 * session is already gone.
 */
export async function declineIncomingVoiceOffer(
	options: VoiceCallControllerOptions,
	offer: VoiceCallSignal,
): Promise<boolean> {
	if (!offer.callId || !offer.sessionId) return false
	const key = `${offer.callId}:${offer.sessionId}`
	if (declinedVoiceOfferKeys.has(key)) return true
	declinedVoiceOfferKeys.add(key)
	const controller = createVoiceCallController(options)
	const sent = await controller.rejectIncoming(offer)
	if (!sent) declinedVoiceOfferKeys.delete(key)
	return sent
}

/**
 * Android unanswered-ring timeout and any later native timeout share this send.
 * Same dual path as Decline: temporary relay when the caller SSE is still up,
 * plus a user-PGP chat message because Telecom can outlive that relay.
 */
export async function timeoutIncomingVoiceOffer(
	options: VoiceCallControllerOptions,
	offer: VoiceCallSignal,
): Promise<boolean> {
	if (!offer.callId || !offer.sessionId) return false
	const key = `${offer.callId}:${offer.sessionId}`
	if (declinedVoiceOfferKeys.has(key)) return true
	declinedVoiceOfferKeys.add(key)
	const controller = createVoiceCallController(options)
	const sent = await controller.timeoutIncoming(offer)
	if (!sent) declinedVoiceOfferKeys.delete(key)
	return sent
}

export function createVoiceCallController(options: VoiceCallControllerOptions) {
	const tempWallet = ethers.Wallet.createRandom()
	let activeSessionId: string | null = null
	let activeSessionKey: Uint8Array | null = null
	let activeSignal: VoiceCallSignal | null = null
	let selectedEntries = getRandomNodes(options.allNodes, Math.min(4, options.allNodes.length))

	const startOutgoing = async (): Promise<VoiceCallChannel | null> => {
		const sessionId = randomMailboxVoiceSessionId()
		const sessionKey = createVoiceSessionKey()
		selectedEntries = getRandomNodes(options.allNodes, Math.min(4, options.allNodes.length))
		const callerTag = options.localCallId.trim().replace(/^@/, '')
		const signal = await signVoiceCallOffer(makeVoiceCallSignal({
			type: 'voice_call_offer_v1',
			callId: randomMailboxVoiceSessionId(),
			sessionId,
			from: new ethers.Wallet(options.privateKey).address,
			to: options.peerEoa,
			sessionKey: voiceSessionKeyToBase64(sessionKey),
			tempWalletAddress: tempWallet.address,
			entryDomains: selectedEntries.map(node => node.domain),
			codec: 'audio/webm;codecs=opus',
			...( /^[A-Za-z0-9_]{1,32}$/.test(callerTag) && !/^[0-9a-fA-F]{16,32}$/.test(callerTag)
				? { callerTag }
				: {}),
		}), options.privateKey)
		const pushTimestamp = Math.floor(Date.now() / 1000)
		// Ring window must stay inside the mailbox/API 10-minute cap.
		// One voice_listen carries the wake fields and the offer already
		// encrypted to the callee user PGP. The caller's mailbox forwards that
		// ciphertext; the caller does not POST the offer again.
		const ringExpiresAt = Date.now() + INCOMING_CALL_RING_TIMEOUT_MS
		if (!await startWorkerVoiceListen(sessionId, {
			callId: signal.callId,
			calleeEoa: signal.to,
			expiresAt: ringExpiresAt,
			timestamp: pushTimestamp,
			offerText: JSON.stringify(signal),
			recipientPgp: options.peerPgp,
		})) return null
		ensureNativePushBoundForWallet()
		activeSessionId = sessionId
		activeSessionKey = sessionKey
		activeSignal = signal
		return { callId: signal.callId, sessionId, tempWalletAddress: tempWallet.address, entryDomains: signal.entryDomains || [], signal, sessionKey }
	}

	const acceptIncoming = async (offer: VoiceCallSignal): Promise<VoiceCallChannel | null> => {
		const sessionId = randomMailboxVoiceSessionId()
		const sessionKey = voiceSessionKeyFromBase64(offer.sessionKey || '')
		selectedEntries = getRandomNodes(options.allNodes, Math.min(4, options.allNodes.length))
		if (!await startWorkerVoiceListen(sessionId)) return null
		const callerEoa = recoverVoiceCallOfferSigner(offer)
		const answer = makeVoiceCallSignal({
			type: 'voice_call_accept_v1',
			callId: offer.callId,
			sessionId,
			peerSessionId: offer.sessionId,
			from: new ethers.Wallet(options.privateKey).address,
			to: callerEoa || options.peerEoa,
			tempWalletAddress: tempWallet.address,
			entryDomains: selectedEntries.map(node => node.domain),
			codec: offer.codec || 'audio/webm;codecs=opus',
		})
		const sent = await sendMessage(
			options.peerPgp,
			JSON.stringify(answer),
			options.privateKey,
			selectedEntries.length ? selectedEntries : options.allNodes,
		)
		if (!sent) {
			await stopWorkerVoiceListen(sessionId)
			return null
		}
		activeSessionId = sessionId
		activeSessionKey = sessionKey
		activeSignal = answer
		return { callId: answer.callId, sessionId, tempWalletAddress: tempWallet.address, entryDomains: answer.entryDomains || [], signal: answer, sessionKey }
	}

	const rejectIncoming = async (offer: VoiceCallSignal): Promise<boolean> => {
		const reject = makeVoiceCallSignal({
			type: 'voice_call_reject_v1',
			callId: offer.callId,
			sessionId: offer.sessionId,
			from: new ethers.Wallet(options.privateKey).address,
			to: offer.from,
			reason: 'declined',
		})
		const sentToTemporaryRelay = await sendVoiceCallRejectionToTemporaryRelay(options, offer)
		const sentToCaller = options.peerPgp
			? await sendMessage(
				options.peerPgp,
				JSON.stringify(reject),
				options.privateKey,
				selectedEntries.length ? selectedEntries : options.allNodes,
			)
			: false
		return sentToTemporaryRelay || sentToCaller
	}

	const timeoutIncoming = async (offer: VoiceCallSignal): Promise<boolean> => {
		const timeout = makeVoiceCallSignal({
			type: 'voice_call_timeout_v1',
			callId: offer.callId,
			sessionId: offer.sessionId,
			from: new ethers.Wallet(options.privateKey).address,
			to: offer.from,
			reason: 'timeout',
		})
		const sentToTemporaryRelay = await sendVoiceCallControlToTemporaryRelay(options, offer, {
			type: 'voice_call_timeout_v1',
			reason: 'timeout',
			framePrefix: 'timeout',
		})
		const sentToCaller = options.peerPgp
			? await sendMessage(
				options.peerPgp,
				JSON.stringify(timeout),
				options.privateKey,
				selectedEntries.length ? selectedEntries : options.allNodes,
			)
			: false
		return sentToTemporaryRelay || sentToCaller
	}

	const notifyRingTimeout = async (): Promise<boolean> => {
		if (!activeSignal?.callId || !activeSignal.sessionId || !options.peerPgp) return false
		const timeout = makeVoiceCallSignal({
			type: 'voice_call_timeout_v1',
			callId: activeSignal.callId,
			sessionId: activeSignal.sessionId,
			from: new ethers.Wallet(options.privateKey).address,
			to: options.peerEoa,
			reason: 'timeout',
		})
		return sendMessage(
			options.peerPgp,
			JSON.stringify(timeout),
			options.privateKey,
			selectedEntries.length ? selectedEntries : options.allNodes,
		)
	}

	const end = async (notifyPeer = true): Promise<void> => {
		if (notifyPeer && activeSignal && activeSessionId) {
			const signal = makeVoiceCallSignal({
				type: 'voice_end_v1',
				callId: activeSignal.callId,
				sessionId: activeSessionId,
				from: new ethers.Wallet(options.privateKey).address,
				to: options.peerEoa,
			})
			await sendMessage(
				options.peerPgp,
				JSON.stringify(signal),
				options.privateKey,
				selectedEntries.length ? selectedEntries : options.allNodes,
			)
		}
		if (activeSessionId) await stopWorkerVoiceListen(activeSessionId)
		activeSessionId = null
		activeSessionKey = null
		activeSignal = null
	}

	return {
		startOutgoing,
		acceptIncoming,
		rejectIncoming,
		timeoutIncoming,
		notifyRingTimeout,
		end,
		get activeSessionId() { return activeSessionId },
		get activeSessionKey() { return activeSessionKey },
		get tempWalletAddress() { return tempWallet.address },
		get entryDomains() { return selectedEntries.map(node => node.domain) },
	}
}

export type VoiceCallController = ReturnType<typeof createVoiceCallController>
