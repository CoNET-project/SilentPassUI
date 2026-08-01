/**
 * CoNET 全网指标：
 *  1) L1 共识层（与区块浏览器首页 https://mainnet.conet.network/ 的
 *     「Total staked validators」「Total CONET supply increase」面板同源）——
 *     全网共识 / 原生币增发的索引器聚合值，**无单合约 view 可直读**，由 CoNET 官方
 *     区块浏览器后端 `/api/conet/homepage-metrics` 给出，是该指标的唯一权威来源。
 *  2) DePIN 层（节点数量 + GB 代币总产量）—— 直接走 CoNET RPC 读链上合约：
 *     - DePIN 节点数量：epoch_mining_info.currentInfo() 的 totalMiners
 *     - GB 代币总产量：**legacy** ConetGB_total.getDashboard() 的 totalIssued（1155 挖矿轨，已弃用；
 *       canonical 用户 GB = GBToken ERC20 — 见 `.cursor/rules/beamio-gb-erc20-canonical.mdc`）
 *     （遵守 RPC-first：可链上直读的合约 view 一律走 RPC，不经中心化 API。）
 *
 * 读取失败为不可信结果：调用方应保留上一次可信值，不得把失败当作「0」覆盖展示
 * （见 beamio-trusted-vs-untrusted-fetch.mdc / beamio-ai-onchain-fetch.mdc）。
 */

import { ethers } from 'ethers'
import { conetDepinProvider } from '@/utils/constants'

const CONET_HOMEPAGE_METRICS_URL = 'https://mainnet.conet.network/api/conet/homepage-metrics'

/** CoNET DePIN epoch mining info（全网在线 DePIN 节点 / 用户 / 速率）。 */
const CONET_EPOCH_MINING_INFO_ADDRESS = '0x648f1a17269627C3d465fEa40b3C229f7CacE5cA'
const EPOCH_MINING_INFO_ABI = [
	'function currentInfo() view returns (uint256 epoch, uint256 totalMiners, uint256 minerRate, uint256 totalUsrs)',
] as const

/** CoNET GB Total dashboard（@deprecated legacy ConetGB1155 全网发行统计；非 GBToken ERC20 余额）。 */
const CONET_GB_TOTAL_ADDRESS = '0x96CF03e7ea65CE9954Fe206DA7bEC797427adD11'
const GB_TOTAL_ABI = [
	'function getDashboard() view returns (uint256 todayTotalIssued, uint256 yestodayTotalIssued, uint256 monthlyTotalIssued, uint256 lastMonthlyTotalIssued, uint256 yearlyTotalIssued, uint256 totalIssued)',
] as const

/** GB Total 仪表盘以 gwei（9 位精度）计量（与 CoNET 官方 Dashboard 一致）。 */
const CONET_GB_TOTAL_UNIT = 'gwei'

export type ConetNetworkStats = {
	/** CoNET L1 全网质押验证节点数量 */
	stakedValidators: number
	/** 已格式化（千分位）的验证节点数量，如 "2,001" */
	stakedValidatorsFormatted: string
	/** 全网 CONET 增发量（CNET，原生币） */
	supplyIncreaseCnet: number
	/** 已格式化的增发量，如 "+1,320.3908" */
	supplyIncreaseFormatted: string
}

export type ConetNetworkStatsResult =
	| { ok: true; stats: ConetNetworkStats }
	| { ok: false; error: string }

type HomepageMetricsResponse = {
	staked_validators?: number | string
	staked_validators_formatted?: string
	supply_increase_cnet?: number | string
	supply_increase_formatted?: string
}

function toNumber(v: unknown): number {
	const n = typeof v === 'number' ? v : Number(v)
	return Number.isFinite(n) ? n : 0
}

/**
 * 拉取 CoNET 全网指标。成功返回可信结果；任何 HTTP 非 2xx / 网络失败 / 解析失败
 * 均返回 { ok: false }，调用方据此保留上次可信值。
 */
export async function fetchConetNetworkStats(signal?: AbortSignal): Promise<ConetNetworkStatsResult> {
	try {
		const res = await fetch(CONET_HOMEPAGE_METRICS_URL, {
			method: 'GET',
			headers: { accept: 'application/json' },
			signal,
		})
		if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
		const j = (await res.json()) as HomepageMetricsResponse | null
		if (!j || (j.staked_validators === undefined && j.supply_increase_cnet === undefined)) {
			return { ok: false, error: 'Malformed homepage metrics response' }
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
					j.supply_increase_formatted?.trim() ||
					`+${supplyIncreaseCnet.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`,
			},
		}
	} catch (e: unknown) {
		const err = e as { name?: string; message?: string }
		if (err?.name === 'AbortError') return { ok: false, error: 'aborted' }
		return { ok: false, error: err?.message ?? 'CoNET network stats fetch failed' }
	}
}

export type ConetDepinStats = {
	/** CoNET DePIN 全网在线节点数量（epoch_mining_info.totalMiners） */
	depinNodeCount: number
	/** 已格式化（千分位）的节点数量 */
	depinNodeCountFormatted: string
	/** GB 代币全网总产量（CoNET GB Total.totalIssued，已按精度换算为 GB） */
	totalGbIssued: number
	/** 已格式化（千分位 + 2 位小数）的 GB 总产量 */
	totalGbIssuedFormatted: string
}

export type ConetDepinStatsResult =
	| { ok: true; stats: ConetDepinStats }
	| { ok: false; error: string }

function formatGb(value: number): string {
	const abs = Math.abs(value)
	if (abs >= 1e9) return `${(value / 1e9).toLocaleString('en-US', { maximumFractionDigits: 2 })}B`
	if (abs >= 1e6) return `${(value / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 })}M`
	if (abs >= 1e3) return `${(value / 1e3).toLocaleString('en-US', { maximumFractionDigits: 2 })}K`
	return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/**
 * 读取 CoNET DePIN 全网指标（节点数量 + GB 代币总产量），两项并行走 CoNET RPC。
 * 任一读失败即返回 { ok: false }，调用方保留上次可信值（不得当作 0 覆盖）。
 */
export async function fetchConetDepinStats(): Promise<ConetDepinStatsResult> {
	try {
		const epochSC = new ethers.Contract(
			CONET_EPOCH_MINING_INFO_ADDRESS,
			EPOCH_MINING_INFO_ABI,
			conetDepinProvider,
		)
		const gbTotalSC = new ethers.Contract(CONET_GB_TOTAL_ADDRESS, GB_TOTAL_ABI, conetDepinProvider)

		const [info, dashboard] = await Promise.all([epochSC.currentInfo!(), gbTotalSC.getDashboard!()])

		const epoch = Number(info[0] as bigint)
		if (!(epoch > 0)) return { ok: false, error: 'epoch_mining_info not ready' }
		const depinNodeCount = Number(info[1] as bigint)
		const totalIssuedRaw = dashboard[5] as bigint
		const totalGbIssued = parseFloat(ethers.formatUnits(totalIssuedRaw ?? 0n, CONET_GB_TOTAL_UNIT))

		return {
			ok: true,
			stats: {
				depinNodeCount,
				depinNodeCountFormatted: depinNodeCount.toLocaleString('en-US'),
				totalGbIssued,
				totalGbIssuedFormatted: formatGb(totalGbIssued),
			},
		}
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { ok: false, error: err?.shortMessage ?? err?.message ?? 'CoNET DePIN stats fetch failed' }
	}
}
