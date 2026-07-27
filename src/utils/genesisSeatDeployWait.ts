import { ethers } from 'ethers'
import { CONET_VALIDATOR_DEPOSIT_REDEEM } from '@/config/chainAddresses'
import { conetDepinProvider } from '@/utils/constants'
import { fetchBeneficiaryNodeBundle } from '@/services/validatorWalletNodeProfile'

const CLAIMED_EVENT =
	'event ValidatorRedeemClaimed(bytes32 indexed requestId, bytes32 indexed codeHash, address indexed claimer, address beneficiary, uint256 validatorCount, string targetNodeIp, string[] conetDepinNodeIps, uint256 gbMiningNodeCount)'

const POLL_MS = 4_000
const DEFAULT_TIMEOUT_MS = 10 * 60_000
const LOOKBACK_BLOCKS = 4_000n

export type GenesisSeatDeployWaitResult =
	| {
			ok: true
			depinNodeIps: string[]
			guardianNodeIds: string[]
			claimTxHash: string | null
			claimCount: number
	  }
	| { ok: false; error: string }

export type GenesisSeatBaseline = {
	depinNodeIps: string[]
	claimCount: number
	guardianNodeIds: string[]
}

/** Snapshot node bundle before payment so we can detect the new claim. */
export async function readGenesisSeatBeneficiaryBaseline(
	beneficiaryEoa: string,
): Promise<GenesisSeatBaseline | null> {
	if (!ethers.isAddress(beneficiaryEoa)) return null
	const r = await fetchBeneficiaryNodeBundle(ethers.getAddress(beneficiaryEoa))
	if (!r.ok) return null
	const ips = (r.bundle.conetDepinNodeIps ?? []).map((s) => String(s ?? '').trim()).filter(Boolean)
	const ids = (r.bundle.guardianNodeIds ?? []).map((n) => String(n))
	const claimCount = Number(r.bundle.claimCount ?? 0)
	return {
		depinNodeIps: ips,
		guardianNodeIds: ids,
		claimCount: Number.isFinite(claimCount) ? claimCount : 0,
	}
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DOMException('Aborted', 'AbortError'))
			return
		}
		const t = window.setTimeout(() => resolve(), ms)
		const onAbort = () => {
			window.clearTimeout(t)
			reject(new DOMException('Aborted', 'AbortError'))
		}
		signal?.addEventListener('abort', onAbort, { once: true })
	})
}

async function findRecentClaimTxForBeneficiary(
	beneficiary: string,
	expectedQty: number,
): Promise<{ claimTxHash: string; depinNodeIps: string[] } | null> {
	const contractAddr = CONET_VALIDATOR_DEPOSIT_REDEEM?.trim()
	if (!contractAddr || !ethers.isAddress(contractAddr)) return null
	const iface = new ethers.Interface([CLAIMED_EVENT])
	const topic0 = iface.getEvent('ValidatorRedeemClaimed')!.topicHash
	try {
		const head = BigInt(await conetDepinProvider.getBlockNumber())
		const fromBlock = head > LOOKBACK_BLOCKS ? head - LOOKBACK_BLOCKS : 0n
		const logs = await conetDepinProvider.getLogs({
			address: ethers.getAddress(contractAddr),
			fromBlock: Number(fromBlock),
			toBlock: Number(head),
			topics: [topic0],
		})
		const want = ethers.getAddress(beneficiary).toLowerCase()
		for (let i = logs.length - 1; i >= 0; i--) {
			const log = logs[i]
			try {
				const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data })
				if (!parsed || parsed.name !== 'ValidatorRedeemClaimed') continue
				const claimBeneficiary = ethers.getAddress(String(parsed.args.beneficiary))
				if (claimBeneficiary.toLowerCase() !== want) continue
				const validatorCount = Number(parsed.args.validatorCount ?? 0)
				if (expectedQty > 0 && validatorCount > 0 && validatorCount !== expectedQty) {
					// Still accept if beneficiary matches — qty may differ in edge cases.
				}
				const ips = (parsed.args.conetDepinNodeIps as string[] | undefined)
					?.map((s) => String(s ?? '').trim())
					.filter(Boolean) ?? []
				return { claimTxHash: log.transactionHash, depinNodeIps: ips }
			} catch {
				/* skip undecodable */
			}
		}
	} catch {
		return null
	}
	return null
}

/**
 * After USDC settle + background fulfill, wait until CoNET claim assigns DePIN seats
 * to `beneficiaryEoa` (ValidatorRedeemClaimed / getBeneficiaryNodeBundle growth).
 * Uses setTimeout polling only (no setInterval).
 */
export async function waitForGenesisSeatNodesAssigned(params: {
	beneficiaryEoa: string
	expectedQty: number
	baseline: GenesisSeatBaseline | null
	signal?: AbortSignal
	timeoutMs?: number
}): Promise<GenesisSeatDeployWaitResult> {
	const beneficiary = ethers.getAddress(params.beneficiaryEoa)
	const expectedQty = Math.max(1, Math.floor(Number(params.expectedQty) || 1))
	const baseline = params.baseline
	const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS
	const started = Date.now()

	while (Date.now() - started < timeoutMs) {
		if (params.signal?.aborted) {
			return { ok: false, error: 'Cancelled' }
		}

		const fromLog = await findRecentClaimTxForBeneficiary(beneficiary, expectedQty)
		const bundle = await fetchBeneficiaryNodeBundle(beneficiary)

		if (bundle.ok) {
			const ips = (bundle.bundle.conetDepinNodeIps ?? []).map((s) => String(s ?? '').trim()).filter(Boolean)
			const ids = (bundle.bundle.guardianNodeIds ?? []).map((n) => String(n))
			const claimCount = Number(bundle.bundle.claimCount ?? 0)
			const claimGrew =
				baseline == null
					? ips.length >= expectedQty || claimCount >= 1
					: claimCount > baseline.claimCount || ips.length >= baseline.depinNodeIps.length + expectedQty

			if (claimGrew || (fromLog && fromLog.depinNodeIps.length > 0)) {
				// Prefer full beneficiary bundle (all seats owned); fall back to event ips.
				const finalIps = ips.length > 0 ? ips : fromLog?.depinNodeIps ?? []
				return {
					ok: true,
					depinNodeIps: finalIps,
					guardianNodeIds: ids,
					claimTxHash: fromLog?.claimTxHash ?? null,
					claimCount: Number.isFinite(claimCount) ? claimCount : 0,
				}
			}
		} else if (fromLog && fromLog.depinNodeIps.length > 0) {
			return {
				ok: true,
				depinNodeIps: fromLog.depinNodeIps,
				guardianNodeIds: [],
				claimTxHash: fromLog.claimTxHash,
				claimCount: 0,
			}
		}

		try {
			await sleep(POLL_MS, params.signal)
		} catch {
			return { ok: false, error: 'Cancelled' }
		}
	}

	return {
		ok: false,
		error: 'Timed out waiting for CoNET DePIN node assignment. Payment succeeded — nodes may still appear shortly.',
	}
}
