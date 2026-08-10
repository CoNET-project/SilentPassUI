/**
 * Mining network + DePIN stats for App Daemon Worker (self-contained; no @/ imports).
 * Shapes match ConetNetworkStats / ConetDepinStats for main-thread mirror + LS.
 */

import { ethers } from 'ethers'
import { APP_DAEMON_CONET_RPC } from '../protocol'

const HOMEPAGE_METRICS_URL = 'https://mainnet.conet.network/api/conet/homepage-metrics'
const EPOCH_MINING = '0x648f1a17269627C3d465fEa40b3C229f7CacE5cA'
const GB_TOTAL = '0x96CF03e7ea65CE9954Fe206DA7bEC797427adD11'

export type WorkerConetNetworkStats = {
	stakedValidators: number
	stakedValidatorsFormatted: string
	supplyIncreaseCnet: number
	supplyIncreaseFormatted: string
}

export type WorkerConetDepinStats = {
	depinNodeCount: number
	depinNodeCountFormatted: string
	totalGbIssued: number
	totalGbIssuedFormatted: string
}

function toNumber(v: unknown): number {
	const n = typeof v === 'number' ? v : Number(v)
	return Number.isFinite(n) ? n : 0
}

/** Compact digital-asset display (≤9 sig digits, 4 frac prefer) — mirrors formatDigitalAssetDisplay. */
function formatAsset(value: number, prefix = ''): string {
	if (!Number.isFinite(value)) return `${prefix}0`
	const abs = Math.abs(value)
	const sign = value < 0 ? '-' : ''
	let scaled = abs
	let suffix = ''
	if (abs >= 10_000_000) {
		scaled = abs / 1_000_000
		suffix = 'M'
	} else if (abs >= 100_000) {
		scaled = abs / 1_000
		suffix = 'K'
	}
	const maxSig = suffix ? 8 : 9
	for (let d = 4; d >= 0; d--) {
		const factor = d > 0 ? 10 ** d : 1
		const trunc = Math.floor(scaled * factor + 1e-9)
		const intPart = Math.floor(trunc / (d > 0 ? factor : 1))
		const fracNum = d > 0 ? trunc % factor : 0
		const intStr = intPart.toLocaleString('en-US')
		const body =
			d > 0 ? `${intStr}.${fracNum.toString().padStart(d, '0')}` : intStr
		if (body.replace(/,/g, '').length <= maxSig) {
			return `${prefix}${sign}${body}${suffix}`
		}
	}
	return `${prefix}${sign}${Math.floor(scaled).toLocaleString('en-US')}${suffix}`
}

export async function fetchWorkerMiningNetworkStats(): Promise<
	{ ok: true; stats: WorkerConetNetworkStats } | { ok: false }
> {
	try {
		const res = await fetch(HOMEPAGE_METRICS_URL, {
			method: 'GET',
			headers: { accept: 'application/json' },
		})
		if (!res.ok) return { ok: false }
		const j = (await res.json()) as {
			staked_validators?: number | string
			staked_validators_formatted?: string
			supply_increase_cnet?: number | string
			supply_increase_formatted?: string
		} | null
		if (!j || (j.staked_validators === undefined && j.supply_increase_cnet === undefined)) {
			return { ok: false }
		}
		const stakedValidators = toNumber(j.staked_validators)
		const supplyIncreaseCnet = toNumber(j.supply_increase_cnet)
		return {
			ok: true,
			stats: {
				stakedValidators,
				stakedValidatorsFormatted:
					j.staked_validators_formatted?.trim() || stakedValidators.toLocaleString('en-US'),
				supplyIncreaseCnet,
				supplyIncreaseFormatted:
					j.supply_increase_formatted?.trim() || `+${formatAsset(supplyIncreaseCnet)}`,
			},
		}
	} catch {
		return { ok: false }
	}
}

export async function fetchWorkerMiningDepinStats(): Promise<
	{ ok: true; stats: WorkerConetDepinStats } | { ok: false }
> {
	try {
		const provider = new ethers.JsonRpcProvider(APP_DAEMON_CONET_RPC, 224422, {
			staticNetwork: true,
			batchMaxCount: 1,
		})
		const epoch = new ethers.Contract(
			EPOCH_MINING,
			['function currentInfo() view returns (uint256,uint256,uint256,uint256)'],
			provider,
		)
		const gbTotal = new ethers.Contract(
			GB_TOTAL,
			[
				'function getDashboard() view returns (uint256,uint256,uint256,uint256,uint256,uint256)',
			],
			provider,
		)
		const [info, dash] = await Promise.all([
			epoch.currentInfo() as Promise<[bigint, bigint, bigint, bigint]>,
			gbTotal.getDashboard() as Promise<bigint[]>,
		])
		const epochN = Number(info[0])
		if (!(epochN > 0)) return { ok: false }
		const depinNodeCount = Number(info[1])
		const totalIssuedRaw = dash[5] ?? 0n
		const totalGbIssued = parseFloat(ethers.formatUnits(totalIssuedRaw, 'gwei'))
		return {
			ok: true,
			stats: {
				depinNodeCount,
				depinNodeCountFormatted: depinNodeCount.toLocaleString('en-US'),
				totalGbIssued,
				totalGbIssuedFormatted: formatAsset(totalGbIssued),
			},
		}
	} catch {
		return { ok: false }
	}
}
