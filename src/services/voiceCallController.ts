import { markCallTiming, timeCallStep } from '@/utils/callTiming'
import { ethers } from 'ethers'
import { createMessage, encrypt, enums, readKey } from 'openpgp'
import {
	createVoiceSessionKey,
	INCOMING_CALL_RING_TIMEOUT_MS,
	makeVoiceCallSignal,
	recoverVoiceCallOfferSigner,
	signVoiceCallOffer,
	randomMailboxVoiceSessionId,
	voiceSessionKeyToBase64,
	type VoiceCallSignal,
} from '@/utils/voiceCallSession'
import {
	sendMessage,
	getRandomNodes,
	getOwnMailboxRouteArmor,
} from '@/services/chat'
import { ensureNativePushBoundForWallet } from '@/utils/cashTreesPushBind'
import { isCashTreesNativeWebView, postNativePgpCiphertext } from '@/utils/cashTreesNativeNfc'
import {
	forgetWorkerVoiceCall,
	sendWorkerVoiceOffer,
	startWorkerVoiceListen,
	stopWorkerVoiceListen,
} from '@/services/chatWorkerBridge'
import {
	newPaidVoiceChannel,
	parseVoiceChannelsWire,
	type VoiceCallV3Config,
} from '@conet.project/chat-sdk'
import { CoNET_Data } from '@/utils/globals'

export type VoiceCallControllerOptions = {
	privateKey: string
	localCallId: string
	peerEoa: string
	peerPgp: string
	peerRoute: string
	allNodes: nodeInfo[]
}

const normalizeArmor = (v?: string) => (v || '').replace(/\r/g, '').trim()

const armorToB64 = (armor: string): string => Buffer.from(normalizeArmor(armor), 'utf8').toString('base64')

/** base64 armored public key from a v3 offer → armor, or ''. */
export function voiceOfferB64Armor(raw?: string): string {
	const t = String(raw || '').trim()
	if (!t) return ''
	try {
		const armor = Buffer.from(t, 'base64').toString('utf8')
		return armor.includes('BEGIN PGP PUBLIC KEY') ? normalizeArmor(armor) : ''
	} catch {
		return ''
	}
}

/** Our own Chat user-PGP public key (the callee answers a v3 offer to it). */
function ownChatPgpPublicArmor(): string {
	const profile = CoNET_Data?.profiles?.[0] as { chatManager?: { pgpKey?: { publicKey?: string } } } | undefined
	return normalizeArmor(profile?.chatManager?.pgpKey?.publicKey)
}

/**
 * Pick the per-call relay node: a random node that is neither the caller's
 * mailbox nor the callee's. The caller's session lives there, so neither
 * mailbox learns this call. Returns null when no node qualifies.
 */
function pickVoiceRelayNode(nodes: nodeInfo[], ownRoute: string, peerRoute: string): nodeInfo | null {
	const own = normalizeArmor(ownRoute)
	const peer = normalizeArmor(peerRoute)
	const pool = nodes.filter((n) => {
		const key = normalizeArmor(n.armoredPublicKey)
		return !!key && !!String(n.ip_addr || '').trim() && key !== own && key !== peer
	})
	if (!pool.length) return null
	return pool[Math.floor(Math.random() * pool.length)]
}

/** Opaque voice route command: base64(JSON), encrypted to a node route key. No signature. */
async function encryptOpaqueVoiceCommandToRoute(command: Record<string, unknown>, routeArmor: string): Promise<string> {
	const opaque = Buffer.from(JSON.stringify(command), 'utf8').toString('base64')
	const out = await encrypt({
		message: await createMessage({ text: opaque }),
		encryptionKeys: await readKey({ armoredKey: routeArmor }),
	})
	return typeof out === 'string' ? out : String((out as { data?: unknown })?.data ?? out)
}

/**
 * Send the offer to the callee's mailbox through a random entry (CoNET Chat
 * path): one opaque `voice_offer_store` with `push: 1`, encrypted to that
 * mailbox's route key. The mailbox stores the offer, writes it to the
 * callee's live sessions and rings the callee itself (it finds the callee
 * from the offer's recipient key ID). The entry sees only that mailbox's key
 * id; no other node learns who is being called. The shell picks the entry and
 * never the callee's mailbox.
 */
async function deliverOfferToCalleeMailbox(args: {
	offerArmor: string
	calleeRoute: string
	excludeIps: string[]
	callId: string
	sessionId: string
	expiresAt: number
	pushTimestamp: number
}): Promise<boolean> {
	const store = await encryptOpaqueVoiceCommandToRoute({
		command: 'voice_offer_store',
		callId: args.callId,
		sessionId: args.sessionId,
		offerArmor: args.offerArmor,
		expiresAt: args.expiresAt,
		push: 1,
		pushTimestamp: args.pushTimestamp,
		timestamp: Math.floor(Date.now() / 1000),
	}, args.calleeRoute)
	markCallTiming('offer-store-pgp')
	const posted = await timeCallStep('offer-store-post', () => postNativePgpCiphertext(store, args.excludeIps))
	let ok = false
	let pushed = false
	try {
		const body = JSON.parse((posted.body || '').trim() || '{}') as { ok?: unknown; pushed?: unknown }
		ok = posted.ok && body.ok === true
		pushed = body.pushed === true
	} catch {
		ok = false
	}
	console.info(`[voiceCall] offer to callee mailbox ok=${ok} pushed=${pushed}`)
	return ok
}

export type VoiceCallChannel = {
	callId: string
	/** v3 caller before the accept: the ring ID. Otherwise our own voice channel. */
	sessionId: string
	/** v3: the peer's voice channel (frames go there). Empty until known. */
	peerSessionId?: string
	signal: VoiceCallSignal
	/** The page's own AES key for its frames (the worker re-keys per channel). */
	sessionKey: Uint8Array
}

async function encryptVoiceOfferArmorToCallee(
	offerText: string,
	recipientPgp: string,
	privateKey: string,
): Promise<string> {
	const wallet = new ethers.Wallet(privateKey)
	const signMessage = await wallet.signMessage(offerText)
	const envelope = {
		timestamp: Date.now(),
		text: offerText,
		from: wallet.address,
		signMessage,
	}
	const opaque = Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64')
	const postData = await encrypt({
		message: await createMessage({ text: opaque }),
		encryptionKeys: await readKey({ armoredKey: recipientPgp }),
		config: { preferredCompressionAlgorithm: enums.compression.zlib },
	})
	const armored =
		typeof postData === 'string'
			? postData
			: String((postData as { data?: unknown })?.data ?? postData)
	if (!armored.includes('-----BEGIN PGP MESSAGE-----') || armored.length > 48_000) {
		throw new Error('voice_offer_armor_invalid')
	}
	return armored
}

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
 * Decline / timeout must target the *offer caller* (offer.from), never the
 * currently open Chat thread. Local chats may miss route/PGP on cold start —
 * fall back to AddressPGP so the chat reject reaches the dialer.
 */
export async function resolvePeerVoiceMaterialAsync(
	chats: Array<{ address?: string; chatData?: { publicArmored?: string; routersArmoreds?: string } }> | undefined,
	peerAddress: string,
	privateKey: string,
): Promise<PeerVoiceMaterial> {
	const local = peerVoiceMaterial(chats, peerAddress)
	if (local.peerPgp && local.peerRoute) return local
	const addr = peerAddress.trim()
	if (!addr || !privateKey) return local
	try {
		const { getKeysFromCoNETPGPSCByAddress } = await import('@/services/chat')
		const kk = await getKeysFromCoNETPGPSCByAddress(addr)
		if (!kk) return local
		return {
			peerPgp: local.peerPgp || String(kk.publicArmored || '').trim(),
			peerRoute: local.peerRoute || String(kk.routersArmoreds || '').trim(),
		}
	} catch {
		return local
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

const ringingSentVoiceOfferKeys = new Set<string>()

/**
 * Wake receipt (`voice_call_ringing_v1`): tell the caller this device is ringing.
 * Browser callee only — inside a native shell the shell sends it, because the
 * shell can ring while this page is not running. Same path as Decline: caller
 * user-PGP, caller mailbox route layer, random entry; NoPush (the caller is
 * dialing in the foreground).
 */
export async function notifyIncomingVoiceRinging(
	options: VoiceCallControllerOptions,
	offer: VoiceCallSignal,
): Promise<boolean> {
	if (!offer.callId || !offer.sessionId || isCashTreesNativeWebView()) return false
	const key = `${offer.callId}:${offer.sessionId}`
	if (ringingSentVoiceOfferKeys.has(key)) return true
	ringingSentVoiceOfferKeys.add(key)
	const controller = createVoiceCallController(options)
	const sent = await controller.ringingIncoming(offer)
	if (!sent) ringingSentVoiceOfferKeys.delete(key)
	return sent
}

export function createVoiceCallController(options: VoiceCallControllerOptions) {
	let activeSessionId: string | null = null
	let activeSessionKey: Uint8Array | null = null
	let activeSignal: VoiceCallSignal | null = null
	let selectedEntries = getRandomNodes(options.allNodes, Math.min(4, options.allNodes.length))

	/**
	 * Voice protocol v3 dial: sign the offer and send it to the callee mailbox
	 * (`voice_offer_store`, `push: 1`). No channel and no temporary wallet here:
	 * the callee creates all four channels when it answers.
	 */
	const startOutgoing = async (): Promise<VoiceCallChannel | null> => {
		const ringId = randomMailboxVoiceSessionId()
		const uiKey = createVoiceSessionKey()
		const ownRoute = getOwnMailboxRouteArmor()
		const ownPgp = ownChatPgpPublicArmor()
		if (!ownRoute || !ownPgp || !options.peerRoute || !options.peerPgp) {
			console.warn(`[voiceCall] dial refused: ownRoute=${!!ownRoute} ownPgp=${!!ownPgp} peerRoute=${!!options.peerRoute} peerPgp=${!!options.peerPgp}`)
			return null
		}
		const callerTag = options.localCallId.trim().replace(/^@/, '')
		const signal = await signVoiceCallOffer(makeVoiceCallSignal({
			type: 'voice_call_offer_v1',
			proto: 3,
			callId: randomMailboxVoiceSessionId(),
			sessionId: ringId,
			from: new ethers.Wallet(options.privateKey).address,
			to: options.peerEoa,
			codec: 'audio/pcm;rate=16000',
			callerPgp: armorToB64(ownPgp),
			callerRoute: armorToB64(ownRoute),
			...( /^[A-Za-z0-9_]{1,32}$/.test(callerTag) && !/^[0-9a-fA-F]{16,32}$/.test(callerTag)
				? { callerTag }
				: {}),
		}), options.privateKey)
		markCallTiming('offer-signed')
		const pushTimestamp = Math.floor(Date.now() / 1000)
		// Ring window must stay inside the mailbox/API 10-minute cap.
		const ringExpiresAt = Date.now() + INCOMING_CALL_RING_TIMEOUT_MS
		let offerArmor: string
		try {
			offerArmor = await encryptVoiceOfferArmorToCallee(JSON.stringify(signal), options.peerPgp, options.privateKey)
		} catch (ex) {
			console.warn('[voiceCall] offer encrypt failed', (ex as Error)?.message ?? ex)
			return null
		}
		markCallTiming('offer-callee-pgp')
		const nativeShell = isCashTreesNativeWebView()
		let delivered = false
		if (nativeShell) {
			// Entry: neither mailbox (rule 19).
			const mailboxIps = options.allNodes
				.filter((n) => {
					const key = normalizeArmor(n.armoredPublicKey)
					return key === normalizeArmor(options.peerRoute) || key === normalizeArmor(ownRoute)
				})
				.map((n) => String(n.ip_addr || '').trim())
				.filter(Boolean)
			delivered = await deliverOfferToCalleeMailbox({
				offerArmor,
				calleeRoute: options.peerRoute,
				excludeIps: mailboxIps,
				callId: signal.callId,
				sessionId: ringId,
				expiresAt: ringExpiresAt,
				pushTimestamp,
			})
		} else {
			const stored = await timeCallStep('offer-store-post', () => sendWorkerVoiceOffer({
				callId: signal.callId,
				sessionId: ringId,
				expiresAt: ringExpiresAt,
				pushTimestamp,
				offerArmor,
				calleeRoute: options.peerRoute,
			}))
			delivered = stored.ok
		}
		if (!delivered) {
			console.warn('[voiceCall] offer delivery to callee mailbox failed')
			return null
		}
		ensureNativePushBoundForWallet()
		activeSessionId = null
		activeSessionKey = uiKey
		activeSignal = signal
		return {
			callId: signal.callId,
			sessionId: ringId,
			signal,
			sessionKey: uiKey,
		}
	}

	/**
	 * v3 caller (browser): the callee's accept carries our two channels (temporary
	 * wallet + payment signature) and its own two. Pick our relays, open our
	 * channels, then the worker tells the callee where they are.
	 */
	const applyAccept = async (accept: VoiceCallSignal): Promise<{ sessionId: string; peerSessionId: string } | null> => {
		if (!activeSignal || accept.callId !== activeSignal.callId || Number(accept.proto) !== 3 || !activeSessionKey) return null
		const ch = parseVoiceChannelsWire(accept.ch)
		if (!ch) {
			console.warn('[voiceCall] accept has no usable channels')
			return null
		}
		const ownRoute = getOwnMailboxRouteArmor()
		const voiceRelay = pickVoiceRelayNode(options.allNodes, ownRoute, options.peerRoute)
		const videoRelay = pickVoiceRelayNode(options.allNodes, ownRoute, options.peerRoute)
		if (!voiceRelay || !videoRelay || !ch.cv.tk || !ch.cv.pay || !ch.cV.tk || !ch.cV.pay) return null
		const call: VoiceCallV3Config = {
			callId: accept.callId,
			uiKey: voiceSessionKeyToBase64(activeSessionKey),
			role: 'caller',
			own: {
				voice: { sid: ch.cv.sid, key: ch.cv.key, wk: ch.cv.wk, tk: ch.cv.tk, pay: ch.cv.pay, relay: voiceRelay.domain },
				video: { sid: ch.cV.sid, key: ch.cV.key, wk: ch.cV.wk, tk: ch.cV.tk, pay: ch.cV.pay, relay: videoRelay.domain },
			},
			peer: {
				voice: { sid: ch.ev.sid, key: ch.ev.key, wk: ch.ev.wk, relay: ch.ev.relay, relayIp: ch.ev.relayIp, relayKey: ch.ev.relayKey },
				video: { sid: ch.eV.sid, key: ch.eV.key, wk: ch.eV.wk, relay: ch.eV.relay, relayIp: ch.eV.relayIp, relayKey: ch.eV.relayKey },
			},
			avoidRoutes: [ownRoute, options.peerRoute].filter(Boolean),
		}
		if (!await timeCallStep('caller-channels', () => startWorkerVoiceListen(ch.cv.sid, call))) return null
		activeSessionId = ch.cv.sid
		return { sessionId: ch.cv.sid, peerSessionId: ch.ev.sid }
	}

	/**
	 * v3 callee (browser): create the four channels, open our two (relays we
	 * pick) and send the accept to the caller's mailbox as a chat message.
	 */
	const acceptIncoming = async (offer: VoiceCallSignal): Promise<VoiceCallChannel | null> => {
		// Native shell owns Accept + temporary media (AES accept + AudioRecord/Track).
		// PWA must not start worker listen or chat-send accept on shell.
		if (isCashTreesNativeWebView()) {
			console.warn('[voiceCall] acceptIncoming skipped — native shell owns Accept + media')
			return null
		}
		if (Number(offer.proto) !== 3) {
			console.warn('[voiceCall] offer is not voice protocol v3; not answered')
			return null
		}
		const callerEoa = recoverVoiceCallOfferSigner(offer)
		const callerPgp = voiceOfferB64Armor(offer.callerPgp) || options.peerPgp
		const callerRoute = voiceOfferB64Armor(offer.callerRoute) || options.peerRoute
		if (!callerEoa || !callerPgp || !callerRoute) return null
		const payer = new ethers.Wallet(options.privateKey)
		const ownRoute = getOwnMailboxRouteArmor()
		const voiceRelay = pickVoiceRelayNode(options.allNodes, ownRoute, callerRoute)
		const videoRelay = pickVoiceRelayNode(options.allNodes, ownRoute, callerRoute)
		if (!voiceRelay || !videoRelay) return null
		// This round the callee's own wallet pays every channel; the format allows
		// a different payer per channel.
		const [cv, cV, ev, eV] = await Promise.all([
			newPaidVoiceChannel(payer),
			newPaidVoiceChannel(payer),
			newPaidVoiceChannel(payer),
			newPaidVoiceChannel(payer),
		])
		ev.relay = voiceRelay.domain
		eV.relay = videoRelay.domain
		const uiKey = createVoiceSessionKey()
		const call: VoiceCallV3Config = {
			callId: offer.callId,
			uiKey: voiceSessionKeyToBase64(uiKey),
			role: 'callee',
			own: { voice: ev, video: eV },
			peer: {
				voice: { sid: cv.sid, key: cv.key, wk: cv.wk },
				video: { sid: cV.sid, key: cV.key, wk: cV.wk },
			},
			avoidRoutes: [ownRoute, callerRoute].filter(Boolean),
		}
		const answer = makeVoiceCallSignal({
			type: 'voice_call_accept_v1',
			proto: 3,
			callId: offer.callId,
			sessionId: offer.sessionId,
			from: payer.address,
			to: callerEoa,
			codec: 'audio/pcm;rate=16000',
			ch: {
				cv: { sid: cv.sid, key: cv.key, wk: cv.wk, tk: cv.tk, pay: cv.pay },
				cV: { sid: cV.sid, key: cV.key, wk: cV.wk, tk: cV.tk, pay: cV.pay },
				ev: {
					sid: ev.sid, key: ev.key, wk: ev.wk, relay: ev.relay,
					relayIp: String(voiceRelay.ip_addr || '').trim(), relayKey: armorToB64(voiceRelay.armoredPublicKey),
				},
				eV: {
					sid: eV.sid, key: eV.key, wk: eV.wk, relay: eV.relay,
					relayIp: String(videoRelay.ip_addr || '').trim(), relayKey: armorToB64(videoRelay.armoredPublicKey),
				},
			},
		})
		selectedEntries = getRandomNodes(options.allNodes, Math.min(4, options.allNodes.length))
		const [listening, sent] = await Promise.all([
			startWorkerVoiceListen(ev.sid, call),
			sendMessage(
				callerPgp,
				JSON.stringify(answer),
				options.privateKey,
				options.allNodes,
				{ beamioNoPush: true, recipientRouteArmored: callerRoute },
			),
		])
		if (!sent || !listening) {
			console.warn(`[voiceCall] v3 answer failed sent=${sent} listening=${listening}`)
			await stopWorkerVoiceListen(ev.sid)
			forgetWorkerVoiceCall(ev.sid)
			return null
		}
		activeSessionId = ev.sid
		activeSessionKey = uiKey
		activeSignal = answer
		return {
			callId: answer.callId,
			sessionId: ev.sid,
			peerSessionId: cv.sid,
			signal: answer,
			sessionKey: uiKey,
		}
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
		// To the caller's mailbox (the shell sends its own from native when it owns the call).
		const sentToCaller = (voiceOfferB64Armor(offer.callerPgp) || options.peerPgp)
			? await sendMessage(
				voiceOfferB64Armor(offer.callerPgp) || options.peerPgp,
				JSON.stringify(reject),
				options.privateKey,
				selectedEntries.length ? selectedEntries : options.allNodes,
				{ recipientRouteArmored: voiceOfferB64Armor(offer.callerRoute) || options.peerRoute },
			)
			: false
		if (isCashTreesNativeWebView() && !sentToCaller) {
			console.warn('[voiceCall] rejectIncoming native — chat reject failed or no caller key')
		}
		return sentToCaller || isCashTreesNativeWebView()
	}

	const ringingIncoming = async (offer: VoiceCallSignal): Promise<boolean> => {
		const callerPgp = voiceOfferB64Armor(offer.callerPgp) || options.peerPgp
		const callerRoute = voiceOfferB64Armor(offer.callerRoute) || options.peerRoute
		if (!callerPgp || !callerRoute) return false
		const ringing = makeVoiceCallSignal({
			type: 'voice_call_ringing_v1',
			callId: offer.callId,
			sessionId: offer.sessionId,
			from: new ethers.Wallet(options.privateKey).address,
			to: offer.from,
		})
		return sendMessage(
			callerPgp,
			JSON.stringify(ringing),
			options.privateKey,
			selectedEntries.length ? selectedEntries : options.allNodes,
			{ beamioNoPush: true, recipientRouteArmored: callerRoute },
		)
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
		const sentToCaller = (voiceOfferB64Armor(offer.callerPgp) || options.peerPgp)
			? await sendMessage(
				voiceOfferB64Armor(offer.callerPgp) || options.peerPgp,
				JSON.stringify(timeout),
				options.privateKey,
				selectedEntries.length ? selectedEntries : options.allNodes,
				{ recipientRouteArmored: voiceOfferB64Armor(offer.callerRoute) || options.peerRoute },
			)
			: false
		if (isCashTreesNativeWebView() && !sentToCaller) {
			console.warn('[voiceCall] timeoutIncoming native — chat timeout failed or no caller key')
		}
		return sentToCaller || isCashTreesNativeWebView()
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
		if (notifyPeer && activeSignal && (activeSessionId || activeSignal.type === 'voice_call_offer_v1')) {
			const selfAddress = new ethers.Wallet(options.privateKey).address
			const signal = makeVoiceCallSignal({
				type: 'voice_end_v1',
				callId: activeSignal.callId,
				// The ring ID names the call on both sides.
				sessionId: activeSignal.sessionId,
				from: selfAddress,
				to: options.peerEoa,
			})
			await sendMessage(
				options.peerPgp,
				JSON.stringify(signal),
				options.privateKey,
				selectedEntries.length ? selectedEntries : options.allNodes,
			)
		}
		if (activeSessionId) {
			await stopWorkerVoiceListen(activeSessionId)
			forgetWorkerVoiceCall(activeSessionId)
		}
		activeSessionId = null
		activeSessionKey = null
		activeSignal = null
	}

	return {
		startOutgoing,
		acceptIncoming,
		applyAccept,
		rejectIncoming,
		ringingIncoming,
		timeoutIncoming,
		notifyRingTimeout,
		end,
		get activeSessionId() { return activeSessionId },
		get activeSessionKey() { return activeSessionKey },
	}
}

export type VoiceCallController = ReturnType<typeof createVoiceCallController>
