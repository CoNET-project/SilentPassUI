/**
 * Reconcile local ValidatorDepositRedeem issued-code ledger with on-chain truth.
 * Probes current + legacy + per-row contract addresses; removes ghosts when trusted absent.
 */

import { ethers } from 'ethers'
import { CONET_VALIDATOR_DEPOSIT_REDEEM } from '@/config/chainAddresses'
import {
	readValidatorDepositRedeemOnChain,
	readValidatorDepositRedeemCreateTxReceipt,
	resolveValidatorDepositRedeemDisplayStatus,
	shouldEagerRemoveValidatorDepositRedeemIssuedLocally,
	shouldRemoveValidatorDepositRedeemIssuedAfterTrustedChainProbe,
	DEPRECATED_VALIDATOR_DEPOSIT_REDEEM_ADDRESSES,
} from '@/services/validatorDepositRedeemAdmin'
import {
	deleteValidatorDepositRedeemIssued,
	listValidatorDepositRedeemIssuedForAdmin,
	mergeValidatorDepositRedeemIssued,
	type ValidatorDepositRedeemIssuedRecord,
} from '@/utils/validatorDepositRedeemIssuedDb'

function probeContractAddresses(row: ValidatorDepositRedeemIssuedRecord): string[] {
	const out = new Set<string>()
	for (const raw of [
		CONET_VALIDATOR_DEPOSIT_REDEEM,
		...DEPRECATED_VALIDATOR_DEPOSIT_REDEEM_ADDRESSES,
		row.contract,
	]) {
		if (raw && ethers.isAddress(raw)) out.add(ethers.getAddress(raw))
	}
	return [...out]
}

async function probeIssuedExistsOnAnyContract(
	codeHash: string,
	row: ValidatorDepositRedeemIssuedRecord,
): Promise<{ ok: true; exists: boolean } | { ok: false; error: string }> {
	const addresses = probeContractAddresses(row)
	let anyOk = false
	let anyExists = false
	let lastError = 'getRedeem failed'

	for (const addr of addresses) {
		const chain = await readValidatorDepositRedeemOnChain(codeHash, addr)
		if (chain.ok) {
			anyOk = true
			if (chain.exists) anyExists = true
		} else {
			lastError = chain.error
		}
	}

	if (!anyOk) return { ok: false, error: lastError }
	return { ok: true, exists: anyExists }
}

/** Sync one admin's issued rows: eager-drop failed drafts, then chain-prune ghosts. */
export async function syncValidatorDepositRedeemIssuedForAdmin(adminEoaLower: string): Promise<void> {
	if (!adminEoaLower) return
	const rows = await listValidatorDepositRedeemIssuedForAdmin(adminEoaLower)

	for (const row of rows) {
		if (row.localStatus === 'submitting') {
			continue
		}
		if (shouldEagerRemoveValidatorDepositRedeemIssuedLocally(row.localStatus)) {
			await deleteValidatorDepositRedeemIssued(row.id)
			continue
		}

		const probe = await probeIssuedExistsOnAnyContract(row.codeHash, row)
		if (!probe.ok) continue

		let createTxReceipt: 'pending' | 'success' | 'reverted' | undefined
		if (row.createTxHash && !probe.exists) {
			const receipt = await readValidatorDepositRedeemCreateTxReceipt(row.createTxHash)
			if (receipt.ok) createTxReceipt = receipt.status
		}

		if (
			shouldRemoveValidatorDepositRedeemIssuedAfterTrustedChainProbe({
				row,
				existsOnChain: probe.exists,
				createTxReceipt,
			})
		) {
			await deleteValidatorDepositRedeemIssued(row.id)
			continue
		}

		const chain = await readValidatorDepositRedeemOnChain(
			row.codeHash,
			ethers.isAddress(row.contract) ? row.contract : CONET_VALIDATOR_DEPOSIT_REDEEM,
		)
		if (!chain.ok || !chain.exists) continue

		const displayStatus = resolveValidatorDepositRedeemDisplayStatus({
			localStatus: row.localStatus,
			chain,
		})
		if (
			displayStatus !== row.localStatus ||
			row.chainActive !== chain.active ||
			row.chainConsumed !== chain.consumed
		) {
			await mergeValidatorDepositRedeemIssued(row.id, {
				localStatus: displayStatus,
				chainActive: chain.active,
				chainConsumed: chain.consumed,
				chainValidatorCount: chain.validatorCount,
				contract: CONET_VALIDATOR_DEPOSIT_REDEEM,
			})
		}
	}
}
