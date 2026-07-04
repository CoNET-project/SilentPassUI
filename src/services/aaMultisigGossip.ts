import {
	BEAMIO_AA_MULTISIG_TYPE,
	buildAaMultisigChatOuterLine,
	type AaMultisigInner,
	type AaMultisigProposeInner,
	type AaMultisigRejectInner,
	type AaMultisigSignInner,
	type AaMultisigSubmittedInner,
} from '@/utils/aaMultisigProtocol'
import { getKeysFromCoNETPGPSC, getRandomNodes, sendMessage } from '@/services/chat'

async function sendMultisigInnerToRecipient(params: {
	recipientEoa: string
	inner: AaMultisigInner
	privateKeyArmor: string
	allNodes: nodeInfo[]
}): Promise<boolean> {
	const keys = await getKeysFromCoNETPGPSC(params.recipientEoa, params.privateKeyArmor)
	if (!keys?.publicArmored) return false
	const outerLine = buildAaMultisigChatOuterLine(params.inner)
	const nodes = getRandomNodes(params.allNodes, 2)
	if (!nodes.length) return false
	return sendMessage(keys.publicArmored, outerLine, params.privateKeyArmor, nodes)
}

export async function broadcastAaMultisigInner(params: {
	recipients: string[]
	inner: AaMultisigInner
	privateKeyArmor: string
	allNodes: nodeInfo[]
	excludeEoa?: string
}): Promise<{ sent: number; failed: number }> {
	const exclude = (params.excludeEoa ?? '').toLowerCase()
	const uniq = [...new Set(params.recipients.map((r) => r.toLowerCase()))].filter(
		(r) => r.startsWith('0x') && r.length === 42 && r !== exclude
	)
	let sent = 0
	let failed = 0
	for (const recipient of uniq) {
		const ok = await sendMultisigInnerToRecipient({
			recipientEoa: recipient,
			inner: params.inner,
			privateKeyArmor: params.privateKeyArmor,
			allNodes: params.allNodes,
		})
		if (ok) sent++
		else failed++
	}
	return { sent, failed }
}

export function buildProposeInner(
	fields: Omit<AaMultisigProposeInner, 'type' | 'action' | 'sendId'>
): AaMultisigProposeInner {
	return {
		type: BEAMIO_AA_MULTISIG_TYPE,
		action: 'propose',
		sendId: crypto.randomUUID().toLowerCase(),
		...fields,
	}
}

export function buildSignInner(
	fields: Omit<AaMultisigSignInner, 'type' | 'action' | 'sendId'>
): AaMultisigSignInner {
	return {
		type: BEAMIO_AA_MULTISIG_TYPE,
		action: 'sign',
		sendId: crypto.randomUUID().toLowerCase(),
		...fields,
	}
}

export function buildRejectInner(
	fields: Omit<AaMultisigRejectInner, 'type' | 'action' | 'sendId'>
): AaMultisigRejectInner {
	return {
		type: BEAMIO_AA_MULTISIG_TYPE,
		action: 'reject',
		sendId: crypto.randomUUID().toLowerCase(),
		...fields,
	}
}

export function buildSubmittedInner(
	fields: Omit<AaMultisigSubmittedInner, 'type' | 'action' | 'sendId'>
): AaMultisigSubmittedInner {
	return {
		type: BEAMIO_AA_MULTISIG_TYPE,
		action: 'submitted',
		sendId: crypto.randomUUID().toLowerCase(),
		...fields,
	}
}
