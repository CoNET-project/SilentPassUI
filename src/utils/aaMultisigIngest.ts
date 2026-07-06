import {
	mergeInboundMultisigInner,
	parseAaMultisigInnerFromChatDisplayText,
	type AaMultisigTaskLocal,
} from '@/utils/aaMultisigProtocol'
import {
	getAaMultisigTask,
	getAaMultisigTaskAny,
	ingestAaMultisigTaskLocal,
} from '@/utils/aaMultisigLocalStore'
import { ingestAaMultisigFromExport } from '@/utils/aaMultisigOfflineSync'

export { ingestAaMultisigFromExport }

/**
 * Parse inbound CoNET chat displayText and merge into local AA multisig task store.
 * Called from App.tsx `addNewMessage` after EIP-191 envelope verification.
 */
export function ingestAaMultisigFromChat(params: {
	displayText: string
	fromEoa: string
	walletEoa: string
}): AaMultisigTaskLocal | null {
	const inner = parseAaMultisigInnerFromChatDisplayText(params.displayText)
	if (!inner) return null

	const aaAccount = inner.aaAccount
	if (!aaAccount) return null

	const existing =
		getAaMultisigTask(params.walletEoa, aaAccount, inner.taskId) ??
		getAaMultisigTaskAny(params.walletEoa, inner.taskId)
	const merged = mergeInboundMultisigInner(existing, inner, params.fromEoa)
	if (!merged) return null

	ingestAaMultisigTaskLocal(params.walletEoa, aaAccount, merged)
	return merged
}
