/**
 * CoNET Chat delivery receipts:
 * 1) Mailbox ACK — encrypt to mailbox B route PGP (`gossip_delivery_ack`)
 * 2) Sender receipt — encrypt to sender user PGP (`beamio_chat_delivery_receipt_v1`)
 */
import { createMessage, enums, encrypt, readKey } from 'openpgp'
import { ethers } from 'ethers'

export const BEAMIO_CHAT_DELIVERY_RECEIPT_V1 = 'beamio_chat_delivery_receipt_v1' as const

export type ChatDeliveryReceiptV1 = {
	type: typeof BEAMIO_CHAT_DELIVERY_RECEIPT_V1
	sendId: string
	armorHash?: string
	deliveredAt: number
	from: string
}

const ackedArmorHashes = new Set<string>()
const receiptedSendIds = new Set<string>()

export function hashPgpArmor(pgpArmor: string): string {
	return ethers.keccak256(ethers.toUtf8Bytes(pgpArmor))
}

/** Unwrap nested chat `text` layers; return receipt or null. */
export function parseChatDeliveryReceiptV1(displayText: unknown): ChatDeliveryReceiptV1 | null {
	let cur: unknown = displayText
	for (let i = 0; i < 6; i++) {
		if (typeof cur === 'string') {
			const t = cur.trim()
			if (!t) return null
			try {
				cur = JSON.parse(t)
			} catch {
				return null
			}
			continue
		}
		if (!cur || typeof cur !== 'object') return null
		const o = cur as Record<string, unknown>
		if (o.type === BEAMIO_CHAT_DELIVERY_RECEIPT_V1 && typeof o.sendId === 'string' && o.sendId) {
			const from = typeof o.from === 'string' ? o.from : ''
			const deliveredAt = Number(o.deliveredAt)
			return {
				type: BEAMIO_CHAT_DELIVERY_RECEIPT_V1,
				sendId: String(o.sendId),
				armorHash: typeof o.armorHash === 'string' ? o.armorHash : undefined,
				deliveredAt: Number.isFinite(deliveredAt) ? deliveredAt : Math.floor(Date.now() / 1000),
				from,
			}
		}
		if (typeof o.text === 'string') {
			cur = o.text
			continue
		}
		return null
	}
	return null
}

export function extractInboundSendId(displayText: unknown): string | null {
	let cur: unknown = displayText
	for (let i = 0; i < 6; i++) {
		if (typeof cur === 'string') {
			try {
				cur = JSON.parse(cur.trim())
			} catch {
				return null
			}
			continue
		}
		if (!cur || typeof cur !== 'object') return null
		const o = cur as Record<string, unknown>
		if (typeof o.sendId === 'string' && o.sendId && o.type !== BEAMIO_CHAT_DELIVERY_RECEIPT_V1) {
			return o.sendId
		}
		if (typeof o.text === 'string') {
			cur = o.text
			continue
		}
		return null
	}
	return null
}

export function markMessageDeliveredBySendId(
	chats: chatData[],
	sendId: string,
): { chats: chatData[]; updated: boolean } {
	if (!sendId || !Array.isArray(chats)) return { chats, updated: false }
	let updated = false
	const next = chats.map(chat => {
		if (!chat?.messages?.length) return chat
		let touched = false
		const messages = chat.messages.map(m => {
			if (m.from !== 'me') return m
			const id = m.sendId || m.id
			if (id !== sendId) return m
			if (m.status === 'delivered') return m
			touched = true
			updated = true
			return { ...m, status: 'delivered' as const }
		})
		return touched ? { ...chat, messages } : chat
	})
	return { chats: next, updated }
}

type PostOpts = {
	routerArmoredPublicKey: string
	privateKeyArmor: string
	entryNodes: nodeInfo[]
	mailboxDomains: Set<string>
}

async function postEncryptedToMailboxRoute(
	routerArmoredPublicKey: string,
	entryNodes: nodeInfo[],
	mailboxDomains: Set<string>,
	postData: string,
): Promise<boolean> {
	const candidates = entryNodes.filter(n => !mailboxDomains.has(n.domain))
	const pool = candidates.length ? candidates : entryNodes
	if (!pool.length) return false
	const payload = JSON.stringify({ data: postData })
	const results = await Promise.all(
		pool.slice(0, 6).map(async node => {
			const url = `https://${node.domain}.conet.network/post`
			try {
				const res = await fetch(url, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: payload,
					referrerPolicy: 'no-referrer',
				})
				return res.ok || (res.status >= 200 && res.status < 300)
			} catch {
				return false
			}
		}),
	)
	return results.some(Boolean)
}

/** Encrypt command to mailbox B (same shape as mining listen). */
export async function postMailboxDeliveryAck(
	opts: PostOpts & { armorHash: string; sendId?: string | null },
): Promise<boolean> {
	const { armorHash, sendId, routerArmoredPublicKey, privateKeyArmor, entryNodes, mailboxDomains } = opts
	const hash = (armorHash || '').trim().toLowerCase()
	if (!/^0x[0-9a-f]{64}$/.test(hash)) return false
	if (ackedArmorHashes.has(hash)) return true
	if (!routerArmoredPublicKey?.trim() || !privateKeyArmor?.trim()) return false

	try {
		const wallet = new ethers.Wallet(privateKeyArmor)
		const timestamp = Math.floor(Date.now() / 1000)
		const command: Record<string, unknown> = {
			command: 'gossip_delivery_ack',
			walletAddress: wallet.address,
			armorHash: hash,
			timestamp,
		}
		if (sendId) command.sendId = sendId
		const message = JSON.stringify(command)
		const signMessage = await wallet.signMessage(message)
		const encryptionKeys = await readKey({ armoredKey: routerArmoredPublicKey })
		const pgpMsg = await createMessage({
			text: Buffer.from(JSON.stringify({ message, signMessage })).toString('base64'),
		})
		const postData = await encrypt({
			message: pgpMsg,
			encryptionKeys,
			config: { preferredCompressionAlgorithm: enums.compression.zlib },
		})
		const armored = typeof postData === 'string' ? postData : String((postData as any)?.data ?? postData)
		const ok = await postEncryptedToMailboxRoute(
			routerArmoredPublicKey,
			entryNodes,
			mailboxDomains,
			armored,
		)
		if (ok) ackedArmorHashes.add(hash)
		return ok
	} catch (e: any) {
		console.warn('[postMailboxDeliveryAck]', e?.message ?? e)
		return false
	}
}

export type SendDeliveryReceiptArgs = {
	senderPublicArmored: string
	privateKeyArmor: string
	entryNodes: nodeInfo[]
	sendId: string
	armorHash?: string
	/** Caller's sendMessage implementation (avoid circular import issues). */
	sendMessage: (
		pgpPublic: string,
		text: string,
		privateKeyArmor: string,
		entryNodes: nodeInfo[],
	) => Promise<boolean>
}

/** Notify original sender; UI must treat as protocol, not a chat bubble. */
export async function sendDeliveryReceiptToSender(args: SendDeliveryReceiptArgs): Promise<boolean> {
	const { senderPublicArmored, privateKeyArmor, entryNodes, sendId, armorHash, sendMessage } = args
	if (!sendId || !senderPublicArmored?.trim() || !privateKeyArmor?.trim() || !entryNodes?.length) {
		return false
	}
	if (receiptedSendIds.has(sendId)) return true
	try {
		const wallet = new ethers.Wallet(privateKeyArmor)
		const inner: ChatDeliveryReceiptV1 = {
			type: BEAMIO_CHAT_DELIVERY_RECEIPT_V1,
			sendId,
			deliveredAt: Math.floor(Date.now() / 1000),
			from: wallet.address,
		}
		if (armorHash) inner.armorHash = armorHash
		const receiptSendId =
			typeof crypto !== 'undefined' && crypto.randomUUID
				? crypto.randomUUID()
				: `rcpt_${Date.now()}_${Math.random().toString(36).slice(2)}`
		const payload = {
			sendId: receiptSendId,
			from: 'me' as const,
			text: JSON.stringify(inner),
			createdAt: Date.now(),
		}
		const ok = await sendMessage(
			senderPublicArmored,
			JSON.stringify(payload),
			privateKeyArmor,
			entryNodes,
		)
		if (ok) receiptedSendIds.add(sendId)
		return ok
	} catch (e: any) {
		console.warn('[sendDeliveryReceiptToSender]', e?.message ?? e)
		return false
	}
}
