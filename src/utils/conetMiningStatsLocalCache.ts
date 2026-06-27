/**
 * CoNET Mining dashboard 全网指标本地缓存（非 EOA 隔离 —— 这是全网统计，对所有用户一致）。
 *
 * 本地优先（local-first）：
 *  - 首屏同步从 localStorage 读出上一次可信快照立即渲染，**永不显示 `—` 占位**；
 *  - 全局 background daemon 在后台刷新，**仅可信成功才写入并覆盖**（见
 *    beamio-ai-onchain-fetch.mdc / beamio-trusted-vs-untrusted-fetch.mdc）；
 *  - 拉取失败不清空、不归零、不闪 loading，保留上一次可信值。
 *  - 全新安装无缓存时回退到 `CONET_MINING_STATS_SEED` 内置快照，确保依旧无 `—`。
 */

import type { ConetNetworkStats, ConetDepinStats } from '@/services/conetNetworkStats'

export type ConetMiningStatsSnapshot = {
	network: ConetNetworkStats
	depin: ConetDepinStats
}

type StoredPayload = {
	v: 1
	savedAt: number
	network: ConetNetworkStats | null
	depin: ConetDepinStats | null
}

const STORAGE_KEY = 'beamio:conetMiningStats:v1'
const MAX_STORE_CHARS = 100_000

/**
 * 全新安装、尚无任何本地缓存时的兜底快照（authoring 时取自链上 / 官方首页指标）。
 * 仅用于「从未拉取过」的首帧，随后即被本地缓存 / 实时可信值覆盖；目的：杜绝 `—`。
 */
export const CONET_MINING_STATS_SEED: ConetMiningStatsSnapshot = {
	network: {
		stakedValidators: 2001,
		stakedValidatorsFormatted: '2,001',
		supplyIncreaseCnet: 1321,
		supplyIncreaseFormatted: '+1,321.0000',
	},
	depin: {
		depinNodeCount: 7,
		depinNodeCountFormatted: '7',
		totalGbIssued: 0,
		totalGbIssuedFormatted: '0',
	},
}

/** 读出本地缓存快照；缺失字段用 seed 兜底，保证返回值各字段均非空（无 `—`）。 */
export function loadConetMiningStatsLocalCache(): ConetMiningStatsSnapshot {
	if (typeof window === 'undefined') return CONET_MINING_STATS_SEED
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw || raw.length > MAX_STORE_CHARS) return CONET_MINING_STATS_SEED
		const p = JSON.parse(raw) as StoredPayload
		if (p?.v !== 1) return CONET_MINING_STATS_SEED
		return {
			network: p.network ?? CONET_MINING_STATS_SEED.network,
			depin: p.depin ?? CONET_MINING_STATS_SEED.depin,
		}
	} catch {
		return CONET_MINING_STATS_SEED
	}
}

/** 合并写入本地缓存（仅传入可信成功的部分；未传的维度保留上次）。 */
export function saveConetMiningStatsLocalCache(patch: {
	network?: ConetNetworkStats
	depin?: ConetDepinStats
}): void {
	if (typeof window === 'undefined') return
	try {
		const prev = loadConetMiningStatsLocalCache()
		const payload: StoredPayload = {
			v: 1,
			savedAt: Date.now(),
			network: patch.network ?? prev.network,
			depin: patch.depin ?? prev.depin,
		}
		const raw = JSON.stringify(payload)
		if (raw.length > MAX_STORE_CHARS) return
		localStorage.setItem(STORAGE_KEY, raw)
	} catch {
		/* quota / private mode */
	}
}
