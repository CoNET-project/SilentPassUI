import { ethers } from 'ethers'
import {
	createMerchantGiftRedeemCard,
	initMessage,
	sendMessage,
} from '@/services/chat'
import { storeSystemData } from '@/services/beamio'
import { CoNET_Data, setCoNET_Data } from '@/utils/globals'

export type SendMerchantGiftRedeemChatParams = {
	profiles: profile[]
	setProfiles: React.Dispatch<React.SetStateAction<profile[]>>
	allNodes: nodeInfo[]
	friend: searchResult
	privateKeyArmor: string
	amount: number
	currency: ICurrency
	merchantTitle: string
	claimUrl: string
	/** Optional personalized note sent as a normal text bubble before the gift card */
	note?: string
}

/**
 * After a successful gift purchase with Direct @BeamioTag delivery:
 * ensure chat session, optionally send note, then send merchantGift paymentCard.
 * Encrypts to the friend's EOA user PGP (exact BeamioTag profile).
 */
export async function sendMerchantGiftRedeemChat(
	params: SendMerchantGiftRedeemChatParams,
): Promise<{ ok: boolean; error?: string }> {
	const {
		profiles,
		setProfiles,
		allNodes,
		friend,
		privateKeyArmor,
		amount,
		currency,
		merchantTitle,
		claimUrl,
		note,
	} = params

	const friendAddress = (friend.address ?? '').trim()
	if (!friendAddress || !ethers.isAddress(friendAddress)) {
		return { ok: false, error: 'Friend address is missing.' }
	}
	if (!privateKeyArmor?.trim()) {
		return { ok: false, error: 'Wallet signing key is unavailable.' }
	}
	if (!claimUrl.trim()) {
		return { ok: false, error: 'Claim link is missing.' }
	}
	if (!allNodes?.length) {
		return { ok: false, error: 'CoNET nodes are not ready. Gift was purchased; notify your friend with the claim link.' }
	}
	if (!profiles?.length) {
		return { ok: false, error: 'Profile is not loaded.' }
	}

	const profile = profiles[0]
	const pk = privateKeyArmor.trim()
	profile.privateKeyArmor = pk

	const chat = await initMessage(profile, friend)
	if (!chat?.chatData?.publicArmored) {
		return {
			ok: false,
			error: 'Could not open chat with this friend (missing PGP route). Share the claim link instead.',
		}
	}

	const now = Date.now()
	const outbound: ChatMessage[] = []

	const noteText = (note ?? '').trim()
	if (noteText) {
		const sendId =
			typeof crypto !== 'undefined' && crypto.randomUUID
				? crypto.randomUUID()
				: `note_${now}_${Math.random().toString(36).slice(2)}`
		const noteMsg: ChatMessage = {
			id: sendId,
			sendId,
			from: 'me',
			text: noteText,
			createdAt: now,
			status: 'sent',
		}
		outbound.push(noteMsg)
	}

	const giftCard = createMerchantGiftRedeemCard({
		amount,
		currency,
		merchantTitle,
		claimUrl: claimUrl.trim(),
		memo: noteText || undefined,
		usdcAmount: amount,
	})
	outbound.push(giftCard)

	for (const msg of outbound) {
		chat.messages.push(msg)
	}

	setProfiles([...profiles])
	const temp = CoNET_Data
	if (temp) {
		temp.profiles = profiles
		setCoNET_Data(temp)
	}

	try {
		await storeSystemData()
	} catch {
		/* best-effort local persist */
	}

	for (const msg of outbound) {
		const payload =
			msg.paymentCard != null
				? JSON.stringify(msg)
				: JSON.stringify({
						sendId: msg.sendId,
						from: 'me' as const,
						text: msg.text,
						createdAt: msg.createdAt,
					})
		try {
			const ok = await sendMessage(chat.chatData.publicArmored, payload, pk, allNodes)
			if (!ok) {
				return {
					ok: false,
					error: 'Gift purchased, but chat delivery failed. Share the claim link with your friend.',
				}
			}
		} catch {
			return {
				ok: false,
				error: 'Gift purchased, but chat delivery failed. Share the claim link with your friend.',
			}
		}
	}

	return { ok: true }
}
