import { ethers } from 'ethers'
import {
	createVoiceSessionKey,
	makeVoiceCallSignal,
	randomVoiceId,
	voiceSessionKeyFromBase64,
	voiceSessionKeyToBase64,
	type VoiceCallSignal,
} from '@/utils/voiceCallSession'
import {
	sendMessage,
	sendVoiceCallOffer,
	getRandomNodes,
} from '@/services/chat'
import {
	startWorkerVoiceListen,
	stopWorkerVoiceListen,
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
 * Chat-only voice controller. It owns temporary in-memory channel identity,
 * route-compatible mailbox use, random entry selection, signaling, and teardown.
 * The temporary wallet is never registered on-chain and never persisted.
 */
export function createVoiceCallController(options: VoiceCallControllerOptions) {
	const tempWallet = ethers.Wallet.createRandom()
	let activeSessionId: string | null = null
	let activeSessionKey: Uint8Array | null = null
	let selectedEntries = getRandomNodes(options.allNodes, Math.min(4, options.allNodes.length))

	const startOutgoing = async (): Promise<VoiceCallChannel | null> => {
		const sessionId = randomVoiceId('voice')
		const sessionKey = createVoiceSessionKey()
		selectedEntries = getRandomNodes(options.allNodes, Math.min(4, options.allNodes.length))
		if (!await startWorkerVoiceListen(sessionId)) return null
		const signal = makeVoiceCallSignal({
			type: 'voice_call_offer_v1',
			callId: options.localCallId,
			sessionId,
			from: new ethers.Wallet(options.privateKey).address,
			to: options.peerEoa,
			sessionKey: voiceSessionKeyToBase64(sessionKey),
			tempWalletAddress: tempWallet.address,
			entryDomains: selectedEntries.map(node => node.domain),
			codec: 'audio/webm;codecs=opus',
		})
		const sent = await sendVoiceCallOffer({
			recipientPgp: options.peerPgp,
			recipientRoute: options.peerRoute,
			signal,
			privateKey: options.privateKey,
			allNodes: options.allNodes,
			entryNodes: selectedEntries,
		})
		if (!sent) {
			await stopWorkerVoiceListen(sessionId)
			return null
		}
		activeSessionId = sessionId
		activeSessionKey = sessionKey
		return { callId: signal.callId, sessionId, tempWalletAddress: tempWallet.address, entryDomains: signal.entryDomains || [], signal, sessionKey }
	}

	const acceptIncoming = async (offer: VoiceCallSignal): Promise<VoiceCallChannel | null> => {
		const sessionId = randomVoiceId('voice')
		const sessionKey = voiceSessionKeyFromBase64(offer.sessionKey || '')
		selectedEntries = getRandomNodes(options.allNodes, Math.min(4, options.allNodes.length))
		if (!await startWorkerVoiceListen(sessionId)) return null
		const answer = makeVoiceCallSignal({
			type: 'voice_call_accept_v1',
			callId: offer.callId,
			sessionId,
			peerSessionId: offer.sessionId,
			from: new ethers.Wallet(options.privateKey).address,
			to: offer.from,
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
		return sendMessage(options.peerPgp, JSON.stringify(reject), options.privateKey, selectedEntries.length ? selectedEntries : options.allNodes)
	}

	const end = async (): Promise<void> => {
		if (activeSessionId) await stopWorkerVoiceListen(activeSessionId)
		activeSessionId = null
		activeSessionKey = null
	}

	return {
		startOutgoing,
		acceptIncoming,
		rejectIncoming,
		end,
		get activeSessionId() { return activeSessionId },
		get activeSessionKey() { return activeSessionKey },
		get tempWalletAddress() { return tempWallet.address },
		get entryDomains() { return selectedEntries.map(node => node.domain) },
	}
}

export type VoiceCallController = ReturnType<typeof createVoiceCallController>
