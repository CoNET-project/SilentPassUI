import {
	BEAMIO_AA_MULTISIG_TYPE,
	parseAaMultisigInnerFromChatDisplayText,
	type AaMultisigInner,
	type AaMultisigProposeInner,
} from '@/utils/aaMultisigProtocol'

export type AaMultisigChatPreview = {
	type: typeof BEAMIO_AA_MULTISIG_TYPE
	action: AaMultisigInner['action']
	taskId: string
	aaAccount: string
	title: string
	kindLabel: string
	threshold: number
	signatureCount: number
	ctaLabel: string
	/** Live progress from local task store when available. */
	progressLabel?: string
	statusLine?: string
}

function kindLabel(kind: AaMultisigProposeInner['kind']): string {
	switch (kind) {
		case 'transfer':
			return 'Transfer'
		case 'set_policy':
			return 'Policy update'
		case 'cancel':
			return 'Cancel'
		default:
			return 'Multisig'
	}
}

function defaultTitle(inner: AaMultisigProposeInner): string {
	if (inner.title?.trim()) return inner.title.trim()
	switch (inner.kind) {
		case 'transfer':
			return 'Smart Wallet transfer'
		case 'set_policy':
			return 'Update multisig signers'
		case 'cancel':
			return 'Multisig cancellation'
		default:
			return 'Smart Wallet multisig request'
	}
}

function signatureCountForPropose(inner: AaMultisigProposeInner): number {
	return inner.creatorSignature ? 1 : 0
}

/** Chat bubble preview for inbound AA multisig gossip (propose / sign). */
export function parseAaMultisigChatPreview(displayText: string): AaMultisigChatPreview | null {
	const inner = parseAaMultisigInnerFromChatDisplayText(displayText)
	if (!inner) return null

	if (inner.action === 'propose') {
		return {
			type: BEAMIO_AA_MULTISIG_TYPE,
			action: 'propose',
			taskId: inner.taskId,
			aaAccount: inner.aaAccount,
			title: defaultTitle(inner),
			kindLabel: kindLabel(inner.kind),
			threshold: inner.threshold,
			signatureCount: signatureCountForPropose(inner),
			ctaLabel: 'Review & sign',
		}
	}

	if (inner.action === 'sign') {
		return {
			type: BEAMIO_AA_MULTISIG_TYPE,
			action: 'sign',
			taskId: inner.taskId,
			aaAccount: inner.aaAccount,
			title: 'Multisig signature update',
			kindLabel: 'Co-signer signed',
			threshold: 0,
			signatureCount: 0,
			ctaLabel: 'Open multisig',
		}
	}

	return null
}
