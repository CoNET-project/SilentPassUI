import { ethers } from 'ethers'
import {
	CONET_GB_DECIMALS as GB_ERC20_DECIMALS,
	CONET_GB_DEPIN_AIRDROP,
	CONET_GUARDIAN_NODES_INFO_V6,
	CONET_VALIDATOR_DEPOSIT_REDEEM,
} from '@/config/chainAddresses'
import { conetDepinProvider } from '@/utils/constants'

/**
 * 直读 ValidatorDepositRedeem（CoNET RPC）：
 * - {resolveNodeBundle} — 节点档案（数量、IP 列表、CNET / GB / USDC 余额）
 * - {resolveUnifiedIncomeStats} — GB + CNET 收入统计（受益人总量 + 每节点明细）
 *
 * 单一事实来源为链上合约，不经过后端 API（beamio-rpc-first-no-centralized-api.mdc）。
 */

const NODE_BUNDLE_TUPLE =
	'tuple(address beneficiary, uint256[] guardianNodeIds, string[] depinNodeIps, address[] nodeWallets, bytes[] validatorPubkeys, bool[] validatorActive, uint256 validatorNodeCount, uint256 gbMiningNodeCount, uint256 claimCount, uint256 nativeBalance, uint256 gbBalance, uint256 usdcBalance)'

const INCOME_TOTALS_TUPLE =
	'tuple(uint256 cumulative, uint256 hour, uint256 day, uint256 week, uint256 month, uint256 year)'

const NODE_INCOME_ROW_TUPLE = `tuple(address nodeWallet, string depinNodeIp, ${INCOME_TOTALS_TUPLE} gb, ${INCOME_TOTALS_TUPLE} cnet)`

const UNIFIED_INCOME_STATS_TUPLE = `tuple(address beneficiary, ${INCOME_TOTALS_TUPLE} gbBeneficiary, ${INCOME_TOTALS_TUPLE} cnetBeneficiary, ${NODE_INCOME_ROW_TUPLE}[] nodes)`

const VALIDATOR_WALLET_NODE_PROFILE_ABI = [
	'function getWalletDepinNodeIps(address wallet) view returns (string[])',
	'function getDepinBeneficiaryByIp(string conetDepinNodeIp) view returns (address)',
	'function getBeneficiaryByNodeWallet(address nodeWallet) view returns (address)',
	`function getBeneficiaryNodeBundle(address beneficiary) view returns (${NODE_BUNDLE_TUPLE})`,
	`function resolveNodeBundle(address maybeWallet, string conetDepinNodeIp) view returns (${NODE_BUNDLE_TUPLE})`,
	`function resolveUnifiedIncomeStats(address maybeWallet, string conetDepinNodeIp, uint256 anchorTs) view returns (${UNIFIED_INCOME_STATS_TUPLE})`,
	'function clRewardPaid(address beneficiary) view returns (uint256)',
	'event NodeRewardSettled(uint256 indexed guardianId, address indexed beneficiary, uint256 amount, bytes32 indexed eventKey)',
	'function airdropInfoOf(address beneficiary) view returns (uint256 accrued, uint256 claimed, uint256 claimable, uint64 claimableAt)',
	'function referrerExtension() view returns (address)',
	'function gbToken() view returns (address)',
	'function rewardIndexer() view returns (address)',
] as const

// ConetGB1155 income views（与合约 IConetGB1155Income 对齐）。用于 unified 单调用因 gas cap 失败时，
// 客户端按受益人 / 每节点**分别**直读（每次 RPC 调用独立，各自落在节点 eth_call gasCap 之内）。
const GB_INCOME_ABI = [
	'function balanceOf(address account, uint256 id) view returns (uint256)',
	'function nodeTotalIssued(address node) view returns (uint256)',
	'function nodeIssuedThisHourOf(address node) view returns (uint256)',
	'function nodeIssuedTodayOf(address node) view returns (uint256)',
	'function nodeIssuedThisWeekOf(address node) view returns (uint256)',
	'function nodeIssuedThisMonthOf(address node) view returns (uint256)',
	'function nodeIssuedThisYearOf(address node) view returns (uint256)',
	'function issuedThisHourOf(address account) view returns (uint256)',
	'function issuedTodayOf(address account) view returns (uint256)',
	'function issuedThisWeekOf(address account) view returns (uint256)',
	'function issuedThisMonthOf(address account) view returns (uint256)',
	'function issuedThisYearOf(address account) view returns (uint256)',
] as const

// ValidatorNodeRewardIndexer summary（每次约 21M gas：年度按小时桶聚合）。务必**逐个**调用，
// 多个 subject 聚合进单次 unified 会超过节点 eth_call gasCap（~50M），导致 OOG → "revert no data"。
const REWARD_INDEXER_SUMMARY_ABI = [
	'function getNodeRewardSummary(address nodeWallet, uint256 anchorTs) view returns (uint256 cumulative, uint256 hour, uint256 day, uint256 week, uint256 month, uint256 year)',
	'function getBeneficiaryRewardSummary(address beneficiary, uint256 anchorTs) view returns (uint256 cumulative, uint256 hour, uint256 day, uint256 week, uint256 month, uint256 year)',
] as const

const VALIDATOR_REFERRER_EXTENSION_ABI = [
	'function REFERRER_NODES_PER_REWARD() view returns (uint256)',
	'function referrerOfBeneficiary(address beneficiary) view returns (address)',
	'function getReferrerSummary(address referrer) view returns (uint256 referredBeneficiaryCount, uint256 referralNodeTotal, uint256 rewardMilestonePaid, uint256 pendingRewardNodes, uint256 referredNodesOwnedTotal)',
	'function getReferrerReferredBeneficiaries(address referrer, uint256 offset, uint256 limit) view returns (address[])',
	'function resolveReferrerDetail(address referrer, uint256 beneficiaryOffset, uint256 beneficiaryLimit) view returns (address[] referredBeneficiaries, uint256 referralNodeTotal, uint256 rewardNodesGranted, uint256 pendingRewardNodes, tuple(uint256 guardianNodeId, address nodeWallet, string depinNodeIp)[] rewardNodes)',
] as const

const GUARDIAN_NODES_INFO_V6_ABI = [
	'function ipaddress2owner(string ipaddress) view returns (address)',
	'function getOwnerIPs(address owner) view returns (string[])',
	'function ipaddressToRegion(string ipaddress) view returns (string)',
] as const

const DEPIN_NODE_COUNTRY_LABELS: Record<string, string> = {
	US: 'United States',
	CA: 'Canada',
	GB: 'United Kingdom',
	DE: 'Germany',
	ES: 'Spain',
	FR: 'France',
	AU: 'Australia',
	HK: 'Hong Kong',
	JP: 'Japan',
	SG: 'Singapore',
	NL: 'Netherlands',
}

const DEPIN_NODE_REGION_CACHE_TTL_MS = 30_000
const depinNodeRegionCache = new Map<string, { region: string; fetchedAt: number }>()
const depinNodeRegionInflight = new Map<string, Promise<string>>()

function normalizeDepinIp(raw: string): string {
	return String(raw ?? '').trim().toLowerCase()
}

function resolveGuardianNodesInfoAddress(): string | null {
	const raw = CONET_GUARDIAN_NODES_INFO_V6?.trim()
	if (!raw) return null
	try {
		const a = ethers.getAddress(raw)
		return a === ethers.ZeroAddress ? null : a
	} catch {
		return null
	}
}

async function readDepinNodeWalletByIp(ip: string): Promise<string | null> {
	const guardianAddr = resolveGuardianNodesInfoAddress()
	if (!guardianAddr) return null
	const trimmed = ip.trim()
	const candidates = trimmed.toLowerCase() === trimmed ? [trimmed] : [trimmed, trimmed.toLowerCase()]
	const guardian = new ethers.Contract(guardianAddr, GUARDIAN_NODES_INFO_V6_ABI, conetDepinProvider)
	for (const candidate of candidates) {
		try {
			const owner = ethers.getAddress(await guardian.ipaddress2owner!(candidate))
			if (owner !== ethers.ZeroAddress) return owner
		} catch {
			// try next candidate
		}
	}
	return null
}

async function readDepinNodeIpsByWallet(nodeWallet: string): Promise<string[]> {
	const guardianAddr = resolveGuardianNodesInfoAddress()
	if (!guardianAddr) return []
	const guardian = new ethers.Contract(guardianAddr, GUARDIAN_NODES_INFO_V6_ABI, conetDepinProvider)
	try {
		const ips = (await guardian.getOwnerIPs!(nodeWallet)) as string[]
		return ips.map((ip) => normalizeDepinIp(ip)).filter(Boolean)
	} catch {
		return []
	}
}

/** Guardian `regionName`（如 `PA.US` / `NW.DE`）→ ISO 国家码。 */
export function formatDepinNodeCountryCodeFromRegionName(regionName: string): string {
	const raw = String(regionName ?? '').trim()
	if (!raw) return ''
	const parts = raw.split('.').filter(Boolean)
	if (parts.length >= 2) {
		const country = parts[parts.length - 1]
		if (/^[A-Z]{2}$/i.test(country)) return country.toUpperCase()
	}
	if (/^[A-Z]{2}$/i.test(raw)) return raw.toUpperCase()
	return ''
}

/** 用户可见国家名（英语）；未知 ISO 码回退原 region 末段或 region 全文。 */
export function formatDepinNodeCountryLabel(regionName: string): string {
	const code = formatDepinNodeCountryCodeFromRegionName(regionName)
	if (code) return DEPIN_NODE_COUNTRY_LABELS[code] ?? code
	const raw = String(regionName ?? '').trim()
	return raw
}

async function readDepinNodeRegionByIp(ip: string): Promise<string> {
	const guardianAddr = resolveGuardianNodesInfoAddress()
	if (!guardianAddr) return ''
	const trimmed = ip.trim()
	if (!trimmed) return ''
	const cached = depinNodeRegionCache.get(trimmed.toLowerCase())
	if (cached && Date.now() - cached.fetchedAt < DEPIN_NODE_REGION_CACHE_TTL_MS) {
		return cached.region
	}
	const inflight = depinNodeRegionInflight.get(trimmed.toLowerCase())
	if (inflight) return inflight

	const task = (async (): Promise<string> => {
		const guardian = new ethers.Contract(guardianAddr, GUARDIAN_NODES_INFO_V6_ABI, conetDepinProvider)
		const candidates =
			trimmed.toLowerCase() === trimmed ? [trimmed] : [trimmed, trimmed.toLowerCase()]
		for (const candidate of candidates) {
			try {
				const region = String(await guardian.ipaddressToRegion!(candidate)).trim()
				if (region) {
					depinNodeRegionCache.set(trimmed.toLowerCase(), { region, fetchedAt: Date.now() })
					return region
				}
			} catch {
				// try next candidate
			}
		}
		depinNodeRegionCache.set(trimmed.toLowerCase(), { region: '', fetchedAt: Date.now() })
		return ''
	})().finally(() => {
		depinNodeRegionInflight.delete(trimmed.toLowerCase())
	})

	depinNodeRegionInflight.set(trimmed.toLowerCase(), task)
	return task
}

/** RPC 直读 GuardianNodesInfoV6.ipaddressToRegion → 国家展示名；无映射时 null。 */
export async function fetchDepinNodeCountryLabelByIp(ip: string): Promise<string | null> {
	const region = await readDepinNodeRegionByIp(ip)
	if (!region) return null
	const label = formatDepinNodeCountryLabel(region)
	return label || null
}

/** 按 IP 串行拉取国家（30s TTL）；失败项跳过，不覆写调用方已有缓存。 */
export async function fetchDepinNodeCountryLabelsByIps(ips: string[]): Promise<Record<string, string>> {
	const out: Record<string, string> = {}
	const unique = [...new Set(ips.map((ip) => normalizeDepinIp(ip)).filter(Boolean))]
	for (const ip of unique) {
		const label = await fetchDepinNodeCountryLabelByIp(ip)
		if (label) out[ip] = label
	}
	return out
}

async function readBeneficiaryByIp(
	redeem: ethers.Contract,
	ip: string
): Promise<string | null> {
	try {
		const addr = ethers.getAddress(await redeem.getDepinBeneficiaryByIp!(ip))
		return addr === ethers.ZeroAddress ? null : addr
	} catch {
		return null
	}
}

async function readBeneficiariesForIps(
	redeem: ethers.Contract,
	ips: string[]
): Promise<{ beneficiary: string | null; beneficiaries: string[] }> {
	const seen = new Set<string>()
	const beneficiaries: string[] = []
	for (const ip of ips) {
		const b = await readBeneficiaryByIp(redeem, ip)
		if (!b || seen.has(b.toLowerCase())) continue
		seen.add(b.toLowerCase())
		beneficiaries.push(b)
	}
	return { beneficiary: beneficiaries[0] ?? null, beneficiaries }
}

/** CoNET 原生代币精度 */
const CONET_NATIVE_DECIMALS = 18
/** @deprecated Legacy ConetGB1155 income fields (18-dec); user wallet GB = GBToken ERC20 (9-dec). */
const CONET_GB_DECIMALS = 18
/** CoNET USDC 精度 */
const CONET_USDC_DECIMALS = 6

export type ValidatorWalletNodeProfile = {
	wallet: string
	/** 该钱包累计拥有的 CoNET 验证节点数量 */
	validatorNodeCount: number
	/** 尚未 active 的验证节点数量（总数 − 链上 active 绑定数） */
	validatorPendingCount: number
	/** 该钱包累计拥有的 GB 挖矿节点数量 */
	gbMiningNodeCount: number
	/** 成功兑换次数 */
	claimCount: number
	/** 去重后的 CoNET DePIN 节点 IP 一览表 */
	conetDepinNodeIps: string[]
	/** 原生 CoNET（CNET）余额（wei，18 decimals） */
	nativeBalanceRaw: string
	/** GB 余额（18 decimals） */
	gbBalanceRaw: string
	/** USDC 余额（6 decimals） */
	usdcBalanceRaw: string
	/** 人类可读格式（已按精度格式化） */
	nativeBalance: string
	gbBalance: string
	usdcBalance: string
}

export type ValidatorWalletNodeProfileResult =
	| { ok: true; profile: ValidatorWalletNodeProfile }
	| { ok: false; error: string }

export type ReferrerRewardNodeDetail = {
	guardianNodeId: string
	nodeWallet: string
	depinNodeIp: string
}

export type ReferrerDetail = {
	referrer: string
	/** Wallets introduced by this referrer (redeem beneficiaries). */
	referredBeneficiaries: string[]
	/** Cumulative validator nodes introduced via referred wallets' claims. */
	referralNodeTotal: string
	/** Count of milestone reward node bundles already granted to the referrer. */
	rewardNodesGranted: string
	pendingRewardNodes: string
	nodesPerReward: string
	/** Granted reward nodes: DePIN node wallet + IP (+ guardian id). */
	rewardNodes: ReferrerRewardNodeDetail[]
}

export type ReferrerDetailResult = { ok: true; detail: ReferrerDetail } | { ok: false; error: string }

function parseReferrerRewardNodeRows(raw: unknown): ReferrerRewardNodeDetail[] {
	if (!Array.isArray(raw)) return []
	return raw.map((row) => {
		const r = row as Record<string, unknown> | unknown[]
		const get = (name: string, idx: number): unknown => (r && typeof r === 'object' && name in (r as object) ? (r as Record<string, unknown>)[name] : (r as unknown[])[idx])
		return {
			guardianNodeId: String(get('guardianNodeId', 0) ?? '0'),
			nodeWallet: ethers.getAddress(String(get('nodeWallet', 1))),
			depinNodeIp: normalizeDepinIp(String(get('depinNodeIp', 2) ?? '')),
		}
	})
}

/**
 * RPC-direct referrer detail: referred wallet list, cumulative introduced node total,
 * and granted reward node rows (validator/DePIN node wallet + IP).
 */
export async function fetchReferrerDetail(
	referrerAddress: string,
	opts?: { beneficiaryOffset?: number; beneficiaryLimit?: number }
): Promise<ReferrerDetailResult> {
	const ext = await resolveValidatorReferrerExtensionAddress()
	if (!ext) return { ok: false, error: 'Validator referrer extension not configured' }
	if (!referrerAddress || !ethers.isAddress(referrerAddress)) return { ok: false, error: 'Invalid referrer address' }
	const referrer = ethers.getAddress(referrerAddress.trim())
	const beneficiaryOffset = Math.max(0, opts?.beneficiaryOffset ?? 0)
	// beneficiaryLimit=0 on-chain means return all referred wallets.
	const beneficiaryLimit = Math.max(0, opts?.beneficiaryLimit ?? 0)
	const read = new ethers.Contract(ext, VALIDATOR_REFERRER_EXTENSION_ABI, conetDepinProvider)
	try {
		const [detail, nodesPerReward] = await Promise.all([
			read.resolveReferrerDetail!(referrer, BigInt(beneficiaryOffset), BigInt(beneficiaryLimit)),
			read.REFERRER_NODES_PER_REWARD!(),
		])
		const referredBeneficiaries = ((detail[0] as string[]) ?? []).map((a) => ethers.getAddress(a))
		return {
			ok: true,
			detail: {
				referrer,
				referredBeneficiaries,
				referralNodeTotal: (detail[1] as bigint).toString(),
				rewardNodesGranted: (detail[2] as bigint).toString(),
				pendingRewardNodes: (detail[3] as bigint).toString(),
				nodesPerReward: (nodesPerReward as bigint).toString(),
				rewardNodes: parseReferrerRewardNodeRows(detail[4]),
			},
		}
	} catch (e: unknown) {
		return { ok: false, error: (e as { message?: string })?.message ?? 'Referrer detail read failed' }
	}
}

export type ReferrerDashboardSummary = {
	referrer: string
	referredBeneficiaryCount: string
	referralNodeTotal: string
	rewardMilestonePaid: string
	pendingRewardNodes: string
	referredNodesOwnedTotal: string
	nodesPerReward: string
}

export type ReferrerDashboardResult =
	| { ok: true; summary: ReferrerDashboardSummary; referredBeneficiaries: string[] }
	| { ok: false; error: string }

/** RPC-direct referrer dashboard: introduced wallets, cumulative referral nodes, reward progress. */
export async function fetchReferrerDashboard(
	referrerAddress: string,
	opts?: { offset?: number; limit?: number }
): Promise<ReferrerDashboardResult> {
	const ext = await resolveValidatorReferrerExtensionAddress()
	if (!ext) return { ok: false, error: 'Validator referrer extension not configured' }
	if (!referrerAddress || !ethers.isAddress(referrerAddress)) return { ok: false, error: 'Invalid referrer address' }
	const referrer = ethers.getAddress(referrerAddress.trim())
	const offset = Math.max(0, opts?.offset ?? 0)
	const limit = Math.max(1, Math.min(200, opts?.limit ?? 50))
	const read = new ethers.Contract(ext, VALIDATOR_REFERRER_EXTENSION_ABI, conetDepinProvider)
	try {
		const [summaryTuple, nodesPerReward, beneficiaries] = await Promise.all([
			read.getReferrerSummary!(referrer),
			read.REFERRER_NODES_PER_REWARD!(),
			read.getReferrerReferredBeneficiaries!(referrer, BigInt(offset), BigInt(limit)),
		])
		const s = summaryTuple as bigint[]
		return {
			ok: true,
			summary: {
				referrer,
				referredBeneficiaryCount: s[0].toString(),
				referralNodeTotal: s[1].toString(),
				rewardMilestonePaid: s[2].toString(),
				pendingRewardNodes: s[3].toString(),
				referredNodesOwnedTotal: s[4].toString(),
				nodesPerReward: (nodesPerReward as bigint).toString(),
			},
			referredBeneficiaries: (beneficiaries as string[]).map((a) => ethers.getAddress(a)),
		}
	} catch (e: unknown) {
		return { ok: false, error: (e as { message?: string })?.message ?? 'Referrer dashboard read failed' }
	}
}

export async function fetchReferrerOfBeneficiary(beneficiaryAddress: string): Promise<string | null> {
	const ext = await resolveValidatorReferrerExtensionAddress()
	if (!ext || !beneficiaryAddress || !ethers.isAddress(beneficiaryAddress)) return null
	const read = new ethers.Contract(ext, VALIDATOR_REFERRER_EXTENSION_ABI, conetDepinProvider)
	try {
		const ref = ethers.getAddress(await read.referrerOfBeneficiary!(ethers.getAddress(beneficiaryAddress)))
		return ref === ethers.ZeroAddress ? null : ref
	} catch {
		return null
	}
}

export function resolveValidatorDepositRedeemAddress(): string | null {
	const raw = CONET_VALIDATOR_DEPOSIT_REDEEM?.trim()
	if (!raw) return null
	try {
		const a = ethers.getAddress(raw)
		return a === ethers.ZeroAddress ? null : a
	} catch {
		return null
	}
}

async function resolveValidatorReferrerExtensionAddress(): Promise<string | null> {
	const main = resolveValidatorDepositRedeemAddress()
	if (!main) return null
	const read = new ethers.Contract(main, VALIDATOR_WALLET_NODE_PROFILE_ABI, conetDepinProvider)
	try {
		const ext = ethers.getAddress(await read.referrerExtension!())
		return ext === ethers.ZeroAddress ? null : ext
	} catch {
		return null
	}
}

/** 链上 active 绑定数 = validatorActive 中为 true 的条目；pending = 总数 − active。 */
export function computeValidatorPendingCount(
	validatorNodeCount: number,
	validatorActive: boolean[]
): number {
	const total = Math.max(0, validatorNodeCount)
	const active = validatorActive.filter(Boolean).length
	return Math.max(0, total - active)
}

/** 将 {resolveNodeBundle} 解析结果转为受益人钱包档案视图。 */
function bundleToWalletProfile(bundle: BeneficiaryNodeBundle): ValidatorWalletNodeProfile | null {
	if (!bundle.beneficiary) return null
	return {
		wallet: bundle.beneficiary,
		validatorNodeCount: bundle.validatorNodeCount,
		validatorPendingCount: computeValidatorPendingCount(
			bundle.validatorNodeCount,
			bundle.validatorActive
		),
		gbMiningNodeCount: bundle.gbMiningNodeCount,
		claimCount: bundle.claimCount,
		conetDepinNodeIps: bundle.conetDepinNodeIps,
		nativeBalanceRaw: bundle.nativeBalanceRaw,
		gbBalanceRaw: bundle.gbBalanceRaw,
		usdcBalanceRaw: bundle.usdcBalanceRaw,
		nativeBalance: bundle.nativeBalance,
		gbBalance: bundle.gbBalance,
		usdcBalance: bundle.usdcBalance,
	}
}

/**
 * 读取钱包的 CoNET 节点档案。读取失败为不可信结果，调用方应保留上一次可信值，
 * 不得把失败当作「没有节点 / 余额为 0」（见 beamio-trusted-vs-untrusted-fetch.mdc）。
 */
export async function fetchValidatorWalletNodeProfile(
	walletAddress: string
): Promise<ValidatorWalletNodeProfileResult> {
	const contract = resolveValidatorDepositRedeemAddress()
	if (!contract) return { ok: false, error: 'ValidatorDepositRedeem address not configured' }
	if (!walletAddress || !ethers.isAddress(walletAddress)) return { ok: false, error: 'Invalid wallet address' }
	const wallet = ethers.getAddress(walletAddress.trim())
	const c = new ethers.Contract(contract, VALIDATOR_WALLET_NODE_PROFILE_ABI, conetDepinProvider)
	try {
		const r = await c.resolveNodeBundle!(wallet, '')
		const profile = bundleToWalletProfile(parseNodeBundle(r as ethers.Result))
		if (!profile) return { ok: false, error: 'No beneficiary profile for wallet' }
		return { ok: true, profile }
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { ok: false, error: err?.shortMessage ?? err?.message ?? 'resolveNodeBundle read failed' }
	}
}

export type DepinBeneficiaryLookupResult =
	| {
			ok: true
			query: string
			/** Redeem beneficiary assigned during claim */
			beneficiary: string | null
			/** All distinct redeem beneficiaries across matched DePIN IPs */
			beneficiaries: string[]
			/** DePIN node operator wallet from GuardianNodesInfoV6 */
			nodeWallet: string | null
			/** Related CoNET DePIN node IPs */
			conetDepinNodeIps: string[]
	  }
	| { ok: false; error: string }

/**
 * 通过 CoNET DePIN 节点 IP、节点运营钱包或 redeem 受益人钱包，反查 redeem 受益人地址。
 * - IP：GuardianNodesInfoV6.ipaddress2owner → 节点钱包；ValidatorDepositRedeem.getDepinBeneficiaryByIp → 受益人
 * - 节点运营钱包：GuardianNodesInfoV6.getOwnerIPs → IP 列表 → 各 IP 查受益人
 * - 受益人钱包：ValidatorDepositRedeem.getWalletDepinNodeIps 确认其为受益人
 */
export async function fetchDepinBeneficiary(ipOrWallet: string): Promise<DepinBeneficiaryLookupResult> {
	const contract = resolveValidatorDepositRedeemAddress()
	if (!contract) return { ok: false, error: 'ValidatorDepositRedeem address not configured' }
	const raw = String(ipOrWallet ?? '').trim()
	if (!raw) return { ok: false, error: 'Enter a DePIN node IP or wallet address' }
	const redeem = new ethers.Contract(contract, VALIDATOR_WALLET_NODE_PROFILE_ABI, conetDepinProvider)
	try {
		if (ethers.isAddress(raw)) {
			const wallet = ethers.getAddress(raw)
			const beneficiaryIps = ((await redeem.getWalletDepinNodeIps!(wallet)) as string[])
				.map(normalizeDepinIp)
				.filter(Boolean)
			if (beneficiaryIps.length > 0) {
				return {
					ok: true,
					query: raw,
					beneficiary: wallet,
					beneficiaries: [wallet],
					nodeWallet: null,
					conetDepinNodeIps: beneficiaryIps,
				}
			}
			const nodeIps = await readDepinNodeIpsByWallet(wallet)
			if (nodeIps.length > 0) {
				const { beneficiary, beneficiaries } = await readBeneficiariesForIps(redeem, nodeIps)
				return {
					ok: true,
					query: raw,
					beneficiary,
					beneficiaries,
					nodeWallet: wallet,
					conetDepinNodeIps: nodeIps,
				}
			}
			return {
				ok: true,
				query: raw,
				beneficiary: null,
				beneficiaries: [],
				nodeWallet: null,
				conetDepinNodeIps: [],
			}
		}

		const ip = normalizeDepinIp(raw)
		const nodeWallet = await readDepinNodeWalletByIp(ip)
		const beneficiary = await readBeneficiaryByIp(redeem, ip)
		return {
			ok: true,
			query: raw,
			beneficiary,
			beneficiaries: beneficiary ? [beneficiary] : [],
			nodeWallet,
			conetDepinNodeIps: [ip],
		}
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { ok: false, error: err?.shortMessage ?? err?.message ?? 'DePIN beneficiary lookup failed' }
	}
}

export type NodeBeneficiaryProfileResult =
	| {
			ok: true
			query: string
			/** redeem 受益人地址；null = 未分配 */
			beneficiary: string | null
			/** DePIN 节点运营钱包（GuardianNodesInfoV6.ipaddress2owner）；null = 非 IP 查询或未登记 */
			nodeWallet: string | null
			/** 解析所用的 IP（IP 查询时为该 IP；钱包查询时为其名下 IP 列表） */
			matchedIps: string[]
			/** 受益人完整节点档案；beneficiary 为 null 时该字段为 null */
			profile: ValidatorWalletNodeProfile | null
	  }
	| { ok: false; error: string }

/**
 * 一步到位：传 CoNET DePIN 节点 IP / 节点运营钱包 / 受益人钱包，单次 RPC 调用
 * {resolveNodeBundle} 返回受益人完整档案（验证节点数量、IP 一览表、CNET / GB / USDC 余额）。
 *
 * 读取失败为不可信结果，调用方应保留上一次可信值（见 beamio-trusted-vs-untrusted-fetch.mdc）。
 */
export async function fetchNodeBeneficiaryProfile(ipOrWallet: string): Promise<NodeBeneficiaryProfileResult> {
	const contract = resolveValidatorDepositRedeemAddress()
	if (!contract) return { ok: false, error: 'ValidatorDepositRedeem address not configured' }
	const raw = String(ipOrWallet ?? '').trim()
	if (!raw) return { ok: false, error: 'Enter a DePIN node IP or wallet address' }
	const isAddr = ethers.isAddress(raw)
	const maybeWallet = isAddr ? ethers.getAddress(raw) : ethers.ZeroAddress
	const ip = isAddr ? '' : normalizeDepinIp(raw)
	const redeem = new ethers.Contract(contract, VALIDATOR_WALLET_NODE_PROFILE_ABI, conetDepinProvider)
	try {
		const r = await redeem.resolveNodeBundle!(maybeWallet, ip)
		const bundle = parseNodeBundle(r as ethers.Result)
		if (!bundle.beneficiary) {
			const nodeWallet = isAddr ? null : await readDepinNodeWalletByIp(ip)
			return {
				ok: true,
				query: raw,
				beneficiary: null,
				nodeWallet,
				matchedIps: isAddr ? [] : [ip],
				profile: null,
			}
		}
		const profile = bundleToWalletProfile(bundle)
		let nodeWallet: string | null = null
		let matchedIps = bundle.conetDepinNodeIps
		if (isAddr) {
			const wallet = ethers.getAddress(raw)
			if (wallet.toLowerCase() !== bundle.beneficiary.toLowerCase()) {
				nodeWallet = wallet
			}
		} else {
			nodeWallet = await readDepinNodeWalletByIp(ip)
			matchedIps = [ip]
		}
		return {
			ok: true,
			query: raw,
			beneficiary: bundle.beneficiary,
			nodeWallet,
			matchedIps,
			profile,
		}
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { ok: false, error: err?.shortMessage ?? err?.message ?? 'Node beneficiary profile lookup failed' }
	}
}

/** 受益人名下的单个节点（id / IP / 节点运营钱包，三者一一对应）。 */
export type BeneficiaryNode = {
	/** Guardian 节点 id */
	nodeId: number
	/** CoNET DePIN 节点 IP（实时来自 GuardianNodesInfoV6） */
	ip: string
	/** 节点运营钱包（GuardianNodesInfoV6.idOwner） */
	nodeWallet: string
	/** 该节点已登记的 validator BLS pubkey（0x...，未部署/登记则为空串） */
	validatorPubkey: string
	/** 该节点 validator 是否仍在运行（exit 后为 false） */
	validatorActive: boolean
}

/**
 * 受益人完整链上数据集（一次调用 resolveNodeBundle 返回）。
 * 节点之间可能在 Guardian 池中不连续（中间夹着其它受益人的节点），此处已按受益人维度聚合，
 * IP 列表 / 节点钱包列表与 guardianNodeIds 三者下标一一对应。
 */
export type BeneficiaryNodeBundle = {
	/** redeem 受益人地址；null = 输入未匹配到任何受益人 */
	beneficiary: string | null
	/** 受益人名下节点列表（id + IP + 节点钱包，已 zip 对齐） */
	nodes: BeneficiaryNode[]
	/** Guardian 节点 id 列表（与 nodes 对齐） */
	guardianNodeIds: number[]
	/** CoNET DePIN 节点 IP 一览表（与 nodes 对齐） */
	conetDepinNodeIps: string[]
	/** 节点运营钱包一览表（与 nodes 对齐） */
	nodeWallets: string[]
	/** 已登记 validator pubkey 一览表（与 nodes 对齐，空串=未登记） */
	validatorPubkeys: string[]
	/** validator 活跃状态一览表（与 nodes 对齐） */
	validatorActive: boolean[]
	/** 累计验证节点数量 */
	validatorNodeCount: number
	/** 累计 GB 挖矿节点数量 */
	gbMiningNodeCount: number
	/** 成功兑换次数 */
	claimCount: number
	nativeBalanceRaw: string
	gbBalanceRaw: string
	usdcBalanceRaw: string
	/** 人类可读余额（已按精度格式化） */
	nativeBalance: string
	gbBalance: string
	usdcBalance: string
}

export type BeneficiaryNodeBundleResult =
	| { ok: true; query: string; bundle: BeneficiaryNodeBundle }
	| { ok: false; error: string }

function emptyBundle(): BeneficiaryNodeBundle {
	return {
		beneficiary: null,
		nodes: [],
		guardianNodeIds: [],
		conetDepinNodeIps: [],
		nodeWallets: [],
		validatorPubkeys: [],
		validatorActive: [],
		validatorNodeCount: 0,
		gbMiningNodeCount: 0,
		claimCount: 0,
		nativeBalanceRaw: '0',
		gbBalanceRaw: '0',
		usdcBalanceRaw: '0',
		nativeBalance: '0',
		gbBalance: '0',
		usdcBalance: '0',
	}
}

/** 解析 NodeBundle struct（ethers v6 单 tuple 返回，既支持具名字段也兼容下标访问）。 */
function parseNodeBundle(r: ethers.Result | Record<string, unknown> | unknown[]): BeneficiaryNodeBundle {
	// 单 struct 返回时 ethers 直接返回 tuple；个别版本可能包一层数组。
	const top = r as unknown as Record<string, unknown>
	const t: Record<string, unknown> =
		top?.beneficiary !== undefined
			? top
			: ((top as unknown as unknown[])?.[0] as Record<string, unknown>) ?? top
	const arr = t as unknown as unknown[]
	const get = (name: string, idx: number): unknown => (t[name] !== undefined ? t[name] : arr[idx])

	const beneficiaryAddr = ethers.getAddress(String(get('beneficiary', 0)))
	const beneficiary = beneficiaryAddr === ethers.ZeroAddress ? null : beneficiaryAddr
	const guardianNodeIds = ((get('guardianNodeIds', 1) as bigint[]) || []).map((v) => Number(v))
	const conetDepinNodeIps = ((get('depinNodeIps', 2) as string[]) || []).map((ip) => normalizeDepinIp(ip))
	const nodeWallets = ((get('nodeWallets', 3) as string[]) || []).map((a) => {
		try {
			return ethers.getAddress(String(a))
		} catch {
			return String(a)
		}
	})
	const validatorPubkeys = ((get('validatorPubkeys', 4) as string[]) || []).map((pk) => {
		const s = String(pk ?? '')
		return s && s !== '0x' ? s.toLowerCase() : ''
	})
	const validatorActive = ((get('validatorActive', 5) as boolean[]) || []).map((v) => Boolean(v))
	const validatorNodeCount = Number((get('validatorNodeCount', 6) as bigint) ?? 0n)
	const gbMiningNodeCount = Number((get('gbMiningNodeCount', 7) as bigint) ?? 0n)
	const claimCount = Number((get('claimCount', 8) as bigint) ?? 0n)
	const nativeBalanceRaw = ((get('nativeBalance', 9) as bigint) ?? 0n).toString()
	const gbBalanceRaw = ((get('gbBalance', 10) as bigint) ?? 0n).toString()
	const usdcBalanceRaw = ((get('usdcBalance', 11) as bigint) ?? 0n).toString()

	const count = Math.max(guardianNodeIds.length, conetDepinNodeIps.length, nodeWallets.length)
	const nodes: BeneficiaryNode[] = []
	for (let i = 0; i < count; i++) {
		nodes.push({
			nodeId: guardianNodeIds[i] ?? 0,
			ip: conetDepinNodeIps[i] ?? '',
			nodeWallet: nodeWallets[i] ?? ethers.ZeroAddress,
			validatorPubkey: validatorPubkeys[i] ?? '',
			validatorActive: validatorActive[i] ?? false,
		})
	}

	return {
		beneficiary,
		nodes,
		guardianNodeIds,
		conetDepinNodeIps,
		nodeWallets,
		validatorPubkeys,
		validatorActive,
		validatorNodeCount,
		gbMiningNodeCount,
		claimCount,
		nativeBalanceRaw,
		gbBalanceRaw,
		usdcBalanceRaw,
		nativeBalance: ethers.formatUnits(nativeBalanceRaw, CONET_NATIVE_DECIMALS),
		gbBalance: ethers.formatUnits(gbBalanceRaw, CONET_GB_DECIMALS),
		usdcBalance: ethers.formatUnits(usdcBalanceRaw, CONET_USDC_DECIMALS),
	}
}

/**
 * 一步到位：传 CoNET DePIN 节点 IP / 节点运营钱包 / 受益人钱包中的**任意一个**，单次 RPC 调用
 * （合约 `resolveNodeBundle`）返回该受益人的**整套数据**：
 * - 受益人地址
 * - 节点 id / IP / 节点运营钱包三者对齐的列表（节点在 Guardian 池中不连续也已聚合）
 * - 累计验证节点 / GB 挖矿节点数量、兑换次数
 * - 实时 CNET / GB / USDC 余额
 *
 * 节点（IP / 节点钱包）与受益人为永久 1:1，合约保证一个节点不会同时属于两个受益人。
 * 读取失败为不可信结果，调用方应保留上一次可信值（见 beamio-trusted-vs-untrusted-fetch.mdc）。
 */
export async function fetchBeneficiaryNodeBundle(ipOrWallet: string): Promise<BeneficiaryNodeBundleResult> {
	const contract = resolveValidatorDepositRedeemAddress()
	if (!contract) return { ok: false, error: 'ValidatorDepositRedeem address not configured' }
	const raw = String(ipOrWallet ?? '').trim()
	if (!raw) return { ok: false, error: 'Enter a DePIN node IP or wallet address' }
	const isAddr = ethers.isAddress(raw)
	const maybeWallet = isAddr ? ethers.getAddress(raw) : ethers.ZeroAddress
	const ip = isAddr ? '' : normalizeDepinIp(raw)
	const redeem = new ethers.Contract(contract, VALIDATOR_WALLET_NODE_PROFILE_ABI, conetDepinProvider)
	try {
		const r = await redeem.resolveNodeBundle!(maybeWallet, ip)
		const bundle = parseNodeBundle(r as ethers.Result)
		return { ok: true, query: raw, bundle: bundle.beneficiary ? bundle : { ...emptyBundle() } }
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { ok: false, error: err?.shortMessage ?? err?.message ?? 'Beneficiary node bundle lookup failed' }
	}
}

/** GBToken paidPool 经 GBDepinAirdrop 转入受益人钱包的累计 GB（9 位定点）。 */
export type GbPaidDepinIncome = {
	cumulativeRaw: string
	cumulative: string
}

/** GB / CNET 收入桶（链上 18 位定点）。 */
export type IncomeTotals = {
	cumulativeRaw: string
	hourRaw: string
	dayRaw: string
	weekRaw: string
	monthRaw: string
	yearRaw: string
	cumulative: string
	hour: string
	day: string
	week: string
	month: string
	year: string
}

export type NodeIncomeRow = {
	nodeWallet: string
	depinNodeIp: string
	gb: IncomeTotals
	cnet: IncomeTotals
	/**
	 * 该节点 validator 是否 active（来自同源 resolveNodeBundle 的 validatorActive，按 nodeWallet+IP / 同序 join）。
	 * undefined = 本轮未能 join 到 bundle（视为非 active）；不影响 gb/cnet 收益的可信性。
	 */
	validatorActive?: boolean
	/** 48-byte BLS validator pubkey（hex）；未登记时为空，UI 可显示 Pending。 */
	validatorPubkey?: string
	/** Guardian node id（来自 resolveNodeBundle，与 NodeRewardSettled 事件的 guardianId 对齐）。 */
	guardianId?: number
	/** 该 guardian 节点累计收到的收费 GB（GBDepinAirdrop → 受益人；9 decimals）。 */
	gbPaidDepin?: GbPaidDepinIncome
}

/**
 * CNET airdrop（vesting）账本：airdrop-flagged redeem claim 累计的 CNET 授予额，
 * 来源 ValidatorDepositRedeem.airdropInfoOf(beneficiary)。
 * - accrued：累计授予；claimed：已领取；claimable：当前可领取额（vested − claimed）。
 * - 6 个月线性解锁：从链上 claimableAt 起 180 天内按比例 vest，满 180 天解锁全部 accrued；claimable 即当前已解锁未领取额。
 * UI「Vesting」展示为当前可领取额（claimable）。
 */
export type AirdropInfo = {
	accruedRaw: string
	claimedRaw: string
	claimableRaw: string
	accrued: string
	claimed: string
	claimable: string
	/** 全局可领取起始 unix 秒（0 = 未开放）。 */
	claimableAt: number
}

/** {resolveUnifiedIncomeStats} 解析结果：受益人 GB/CNET 总量 + 每节点明细。 */
export type UnifiedIncomeStats = {
	beneficiary: string | null
	gbBeneficiary: IncomeTotals
	cnetBeneficiary: IncomeTotals
	nodes: NodeIncomeRow[]
	/**
	 * 收费 GB 累计（GBDepinAirdrop.beneficiaryPaidGbTotal — 协议 cron mint + 用户收费 mintPaid）。
	 * 与 gbBeneficiary（legacy ConetGB1155 routing）相加为 BANDWIDTH PROVIDED 展示总量。
	 */
	gbPaidDepinReceived: GbPaidDepinIncome | null
	/** 本轮 GBDepinAirdrop 链上账本 view 是否可信成功（未配置合约地址视为可信零）。 */
	gbPaidDepinReadOk: boolean
	/** CNET airdrop（vesting）账本；本轮未能可信读取时为 null（不覆盖 UI 上次可信值）。 */
	airdrop: AirdropInfo | null
	/** Whether airdropInfoOf was trusted in this refresh. */
	airdropReadOk: boolean
}

export type UnifiedIncomeStatsResult =
	| { ok: true; query: string; stats: UnifiedIncomeStats }
	| { ok: false; error: string }

function parseIncomeTotals(raw: ethers.Result | Record<string, unknown> | unknown[]): IncomeTotals {
	const t = raw as Record<string, unknown>
	const arr = raw as unknown[]
	const get = (name: string, idx: number): bigint => BigInt(String(t?.[name] !== undefined ? t[name] : arr[idx] ?? 0))
	const cumulativeRaw = get('cumulative', 0).toString()
	const hourRaw = get('hour', 1).toString()
	const dayRaw = get('day', 2).toString()
	const weekRaw = get('week', 3).toString()
	const monthRaw = get('month', 4).toString()
	const yearRaw = get('year', 5).toString()
	const fmt = (v: string) => ethers.formatUnits(v, CONET_NATIVE_DECIMALS)
	return {
		cumulativeRaw,
		hourRaw,
		dayRaw,
		weekRaw,
		monthRaw,
		yearRaw,
		cumulative: fmt(cumulativeRaw),
		hour: fmt(hourRaw),
		day: fmt(dayRaw),
		week: fmt(weekRaw),
		month: fmt(monthRaw),
		year: fmt(yearRaw),
	}
}

function parseUnifiedIncomeStats(r: ethers.Result | Record<string, unknown> | unknown[]): UnifiedIncomeStats {
	const top = r as Record<string, unknown>
	const t: Record<string, unknown> =
		top?.beneficiary !== undefined ? top : ((top as unknown as unknown[])?.[0] as Record<string, unknown>) ?? top
	const arr = t as unknown as unknown[]
	const get = (name: string, idx: number): unknown => (t[name] !== undefined ? t[name] : arr[idx])
	const beneficiaryAddr = ethers.getAddress(String(get('beneficiary', 0)))
	const beneficiary = beneficiaryAddr === ethers.ZeroAddress ? null : beneficiaryAddr
	const gbBeneficiary = parseIncomeTotals(get('gbBeneficiary', 1) as ethers.Result)
	const cnetBeneficiary = parseIncomeTotals(get('cnetBeneficiary', 2) as ethers.Result)
	const nodeRows = (get('nodes', 3) as unknown[]) || []
	const nodes: NodeIncomeRow[] = nodeRows.map((row) => {
		const nr = row as Record<string, unknown>
		const nArr = row as unknown[]
		const nGet = (name: string, idx: number): unknown => (nr[name] !== undefined ? nr[name] : nArr[idx])
		let nodeWallet = String(nGet('nodeWallet', 0))
		try {
			nodeWallet = ethers.getAddress(nodeWallet)
		} catch {
			/* keep raw */
		}
		return {
			nodeWallet,
			depinNodeIp: normalizeDepinIp(String(nGet('depinNodeIp', 1))),
			gb: parseIncomeTotals(nGet('gb', 2) as ethers.Result),
			cnet: parseIncomeTotals(nGet('cnet', 3) as ethers.Result),
		}
	})
	return {
		beneficiary,
		gbBeneficiary,
		cnetBeneficiary,
		nodes,
		gbPaidDepinReceived: null,
		gbPaidDepinReadOk: true,
		airdrop: null,
		airdropReadOk: true,
	}
}

/** BANDWIDTH PROVIDED = legacy routing GB + 收费 GB（受益人钱包）。 */
export function gbBandwidthProvidedParts(stats: UnifiedIncomeStats | null | undefined): {
	totalGb: number
	legacyRoutingGb: number
	userFeeGb: number
} {
	if (!stats) return { totalGb: 0, legacyRoutingGb: 0, userFeeGb: 0 }
	const legacyRoutingGb = Number(stats.gbBeneficiary.cumulative) || 0
	const userFeeGb = Number(stats.gbPaidDepinReceived?.cumulative ?? '0') || 0
	return { totalGb: legacyRoutingGb + userFeeGb, legacyRoutingGb, userFeeGb }
}

export function gbBandwidthNodeTotalGb(node: NodeIncomeRow): number {
	const legacy = Number(node.gb.cumulative) || 0
	const paid = Number(node.gbPaidDepin?.cumulative ?? '0') || 0
	return legacy + paid
}

function resolveGbDepinAirdropAddress(): string | null {
	const raw = String(CONET_GB_DEPIN_AIRDROP ?? '').trim()
	if (!raw || !ethers.isAddress(raw)) return null
	return ethers.getAddress(raw)
}

const GB_DEPIN_AIRDROP_LEDGER_ABI = [
	'function paidGbReceivedOf(address beneficiary) view returns (uint256)',
	'function paidGbReceivedOfGuardianNode(uint256 guardianNodeId) view returns (uint256)',
] as const

/**
 * Read GBDepinAirdrop on-chain ledger (beneficiaryPaidGbTotal / guardianNodePaidGbTotal).
 * Single RPC per beneficiary + one per guardian node id — no historical event scan.
 */
async function readDepinPaidGbFromLedger(
	beneficiary: string | null,
	guardianIds: number[]
): Promise<{ total: bigint; byGuardian: Map<number, bigint>; ok: boolean }> {
	const airdrop = resolveGbDepinAirdropAddress()
	if (!airdrop || !beneficiary) return { total: 0n, byGuardian: new Map(), ok: true }
	try {
		const c = new ethers.Contract(airdrop, GB_DEPIN_AIRDROP_LEDGER_ABI, conetDepinProvider)
		const total = BigInt(String(await c.paidGbReceivedOf!(beneficiary)))
		const byGuardian = new Map<number, bigint>()
		const uniqueIds = [...new Set(guardianIds.filter((id) => Number.isFinite(id) && id > 0))]
		if (uniqueIds.length > 0) {
			const rows = await Promise.all(
				uniqueIds.map(async (id) => {
					const v = BigInt(String(await c.paidGbReceivedOfGuardianNode!(id)))
					return [id, v] as const
				})
			)
			for (const [id, v] of rows) {
				if (v > 0n) byGuardian.set(id, v)
			}
		}
		return { total, byGuardian, ok: true }
	} catch {
		return { total: 0n, byGuardian: new Map(), ok: false }
	}
}

function gbPaidDepinIncomeFromWei(amountWei: bigint): GbPaidDepinIncome {
	return {
		cumulativeRaw: amountWei.toString(),
		cumulative: ethers.formatUnits(amountWei, GB_ERC20_DECIMALS),
	}
}

function mergeDepinPaidGbIntoBeneficiary(stats: UnifiedIncomeStats, totalWei: bigint): void {
	if (totalWei <= 0n) {
		stats.gbPaidDepinReceived = { cumulativeRaw: '0', cumulative: '0' }
		return
	}
	stats.gbPaidDepinReceived = gbPaidDepinIncomeFromWei(totalWei)
}

function mergeDepinPaidGbIntoNodes(stats: UnifiedIncomeStats, byGuardian: Map<number, bigint>): void {
	if (byGuardian.size === 0) return
	for (const node of stats.nodes) {
		const guardianId = node.guardianId
		if (guardianId === undefined) continue
		const paidWei = byGuardian.get(guardianId)
		if (paidWei === undefined || paidWei <= 0n) continue
		node.gbPaidDepin = gbPaidDepinIncomeFromWei(paidWei)
	}
}

/** CL skim rewards actually paid to beneficiary via {settleNodeRewards} (wei). Indexer cumulative may lag. */
async function readClRewardPaidWei(redeem: ethers.Contract, beneficiary: string | null): Promise<bigint> {
	if (!beneficiary) return 0n
	try {
		return BigInt(String(await redeem.clRewardPaid!(beneficiary)))
	} catch {
		return 0n
	}
}

/**
 * Merge on-chain {clRewardPaid} into beneficiary CNET cumulative when it exceeds indexer totals.
 * L1 gas panels must reflect settled CL payouts, not indexer-only ledger (may be 0 while wallet already received CNET).
 */
function mergeClRewardPaidIntoCnetBeneficiary(stats: UnifiedIncomeStats, clPaidWei: bigint): void {
	if (clPaidWei <= 0n) return
	const idxRaw = BigInt(stats.cnetBeneficiary.cumulativeRaw || '0')
	if (clPaidWei <= idxRaw) return
	stats.cnetBeneficiary = {
		...stats.cnetBeneficiary,
		cumulativeRaw: clPaidWei.toString(),
		cumulative: ethers.formatUnits(clPaidWei, CONET_NATIVE_DECIMALS),
	}
}

/**
 * Per-node CL skim reward actually paid, grouped by guardianId.
 *
 * {settleNodeRewards} only stores the **beneficiary aggregate** `clRewardPaid[beneficiary]`; there is no
 * per-node view. The per-guardian breakdown is recoverable only from `NodeRewardSettled(guardianId, beneficiary, amount, eventKey)`
 * logs. ValidatorNodeRewardIndexer.getNodeRewardSummary is a separate ledger that may stay 0 while CL payouts
 * already hit the wallet, so the L1-nodes panel must read settled CL logs, not the indexer-only per-node summary.
 *
 * 返回 Map<guardianId, wei>；读取失败返回空 Map（不覆盖 UI 上次可信值，见 beamio-trusted-vs-untrusted-fetch.mdc）。
 */
const guardianClRewardPaidCache = new Map<string, Map<number, bigint>>()
const guardianClRewardPaidInFlight = new Map<string, Promise<void>>()

/**
 * Load the per-guardian breakdown without blocking the aggregate income panel.
 *
 * The historical event query can be slow for beneficiaries owning many nodes.
 * `clRewardPaid(beneficiary)` is the authoritative aggregate and is read
 * synchronously by the caller; this detail query is deliberately single-flight
 * and cached so it cannot turn a multi-node dashboard refresh into a 40+ second
 * request or start overlapping full-history scans every daemon tick.
 */
async function readClRewardPaidByGuardian(
	redeem: ethers.Contract,
	beneficiary: string | null,
): Promise<Map<number, bigint>> {
	if (!beneficiary) return new Map()
	const key = beneficiary.toLowerCase()

	let task = guardianClRewardPaidInFlight.get(key)
	if (!task) {
		task = (async () => {
			try {
				const filter = redeem.filters.NodeRewardSettled!(null, beneficiary)
				const logs = await redeem.queryFilter(filter, 0, 'latest')
				const out = new Map<number, bigint>()
				for (const log of logs) {
					let args = (log as ethers.EventLog).args
					if (!args) {
						try {
							const parsed = redeem.interface.parseLog({
								topics: log.topics,
								data: log.data,
							})
							if (parsed?.name === 'NodeRewardSettled') args = parsed.args
						} catch {
							/* Ignore malformed or provider-specific log records. */
						}
					}
					if (!args) continue
					const guardianId = Number(args.guardianId ?? args[0])
					const amount = BigInt(String(args.amount ?? args[2] ?? 0))
					if (!Number.isFinite(guardianId) || amount <= 0n) continue
					out.set(guardianId, (out.get(guardianId) ?? 0n) + amount)
				}
				guardianClRewardPaidCache.set(key, out)
			} catch {
				// Preserve the last trusted per-node cache on an untrusted read.
			} finally {
				guardianClRewardPaidInFlight.delete(key)
			}
		})()
		guardianClRewardPaidInFlight.set(key, task)
	}

	await task
	return guardianClRewardPaidCache.get(key) ?? new Map()
}

/**
 * Merge per-guardian settled CL rewards into each node row's CNET cumulative.
 * Node rows match settle events via their guardianId (threaded from resolveNodeBundle); when settled CL exceeds the
 * indexer per-node cumulative (often 0), the node's displayed CNET is bumped to the settled value.
 */
function mergeClRewardPaidIntoNodes(stats: UnifiedIncomeStats, guardianClPaid: Map<number, bigint>): void {
	if (guardianClPaid.size === 0) return
	for (const node of stats.nodes) {
		const guardianId = node.guardianId
		if (guardianId === undefined) continue
		const clPaidWei = guardianClPaid.get(guardianId)
		if (clPaidWei === undefined || clPaidWei <= 0n) continue
		const idxRaw = BigInt(node.cnet.cumulativeRaw || '0')
		if (clPaidWei <= idxRaw) continue
		node.cnet = {
			...node.cnet,
			cumulativeRaw: clPaidWei.toString(),
			cumulative: ethers.formatUnits(clPaidWei, CONET_NATIVE_DECIMALS),
		}
	}
}

/**
 * 用 resolveNodeBundle 的 guardianNodeIds ↔ nodeWallets 对齐，把 guardianId 回填到每个 NodeIncomeRow。
 * resolveUnifiedIncomeStats 的 node tuple 不含 guardianId，因此必须从 bundle join（按 nodeWallet 小写匹配）。
 */
function assignGuardianIdsToNodes(stats: UnifiedIncomeStats, bundle: BeneficiaryNodeBundle | null): void {
	if (!bundle) return
	const walletToGuardian = new Map<string, number>()
	const ipToGuardian = new Map<string, number>()
	for (const n of bundle.nodes) {
		const key = String(n.nodeWallet ?? '').toLowerCase()
		if (key && key !== ethers.ZeroAddress.toLowerCase()) walletToGuardian.set(key, n.nodeId)
		const ip = normalizeDepinIp(n.ip)
		if (ip) ipToGuardian.set(ip, n.nodeId)
	}
	for (const node of stats.nodes) {
		if (node.guardianId !== undefined) continue
		const ip = normalizeDepinIp(node.depinNodeIp)
		const gidFromIp = ip ? ipToGuardian.get(ip) : undefined
		if (gidFromIp !== undefined) {
			node.guardianId = gidFromIp
			continue
		}
		const gid = walletToGuardian.get(String(node.nodeWallet ?? '').toLowerCase())
		if (gid !== undefined) node.guardianId = gid
	}
}

/** 解析 airdropInfoOf(beneficiary) → (accrued, claimed, claimable, claimableAt)。 */
function parseAirdropInfo(raw: ethers.Result | unknown[] | Record<string, unknown>): AirdropInfo {
	const t = raw as Record<string, unknown>
	const arr = raw as unknown[]
	const get = (name: string, idx: number): bigint => BigInt(String(t?.[name] !== undefined ? t[name] : arr[idx] ?? 0))
	const accruedRaw = get('accrued', 0).toString()
	const claimedRaw = get('claimed', 1).toString()
	const claimableRaw = get('claimable', 2).toString()
	const claimableAt = Number(get('claimableAt', 3))
	const fmt = (v: string) => ethers.formatUnits(v, CONET_NATIVE_DECIMALS)
	return {
		accruedRaw,
		claimedRaw,
		claimableRaw,
		accrued: fmt(accruedRaw),
		claimed: fmt(claimedRaw),
		claimable: fmt(claimableRaw),
		claimableAt: Number.isFinite(claimableAt) ? claimableAt : 0,
	}
}

/** 6 个 GB income 子读数 → IncomeTotals（顺序 [cumulative,hour,day,week,month,year]）。失败的子项以 0 计。 */
async function readGbSubjectTotals(
	gb: ethers.Contract,
	subject: string,
	isBeneficiary: boolean
): Promise<IncomeTotals> {
	const z = async (p: Promise<unknown>): Promise<bigint> => {
		try {
			return BigInt(String((await p) ?? 0))
		} catch {
			return 0n
		}
	}
	const [cumulative, hour, day, week, month, year] = isBeneficiary
		? await Promise.all([
				z(gb.balanceOf!(subject, 0n)),
				z(gb.issuedThisHourOf!(subject)),
				z(gb.issuedTodayOf!(subject)),
				z(gb.issuedThisWeekOf!(subject)),
				z(gb.issuedThisMonthOf!(subject)),
				z(gb.issuedThisYearOf!(subject)),
			])
		: await Promise.all([
				z(gb.nodeTotalIssued!(subject)),
				z(gb.nodeIssuedThisHourOf!(subject)),
				z(gb.nodeIssuedTodayOf!(subject)),
				z(gb.nodeIssuedThisWeekOf!(subject)),
				z(gb.nodeIssuedThisMonthOf!(subject)),
				z(gb.nodeIssuedThisYearOf!(subject)),
			])
	return parseIncomeTotals([cumulative, hour, day, week, month, year])
}

/**
 * 客户端拼装 UnifiedIncomeStats（回退路径）。
 *
 * 当 redeem.resolveUnifiedIncomeStats 单调用因把「受益人 + 每个节点」的 ValidatorNodeRewardIndexer
 * 年度按小时聚合（单 subject ≈ 21M gas）合并进一次 eth_call 而超过节点 gasCap（~50M）OOG 时，
 * 改为**逐个 subject 独立 eth_call**：每次 idx 调用单独落在 gasCap 之内，互不叠加。
 *
 * 节点列表来自已可信返回的 resolveNodeBundle（不含昂贵聚合），因此即使 unified 失败也能显示节点。
 */
async function assembleUnifiedIncomeStatsClientSide(
	redeem: ethers.Contract,
	bundle: BeneficiaryNodeBundle,
	anchorTs: number
): Promise<UnifiedIncomeStats> {
	const ts = BigInt(Math.max(0, anchorTs))
	const [gbAddr, idxAddr] = await Promise.all([
		(redeem.gbToken!() as Promise<string>).catch(() => ethers.ZeroAddress),
		(redeem.rewardIndexer!() as Promise<string>).catch(() => ethers.ZeroAddress),
	])
	const gb =
		gbAddr && gbAddr !== ethers.ZeroAddress
			? new ethers.Contract(gbAddr, GB_INCOME_ABI, conetDepinProvider)
			: null
	const idx =
		idxAddr && idxAddr !== ethers.ZeroAddress
			? new ethers.Contract(idxAddr, REWARD_INDEXER_SUMMARY_ABI, conetDepinProvider)
			: null

	const zeroTotals = (): IncomeTotals => parseIncomeTotals([0n, 0n, 0n, 0n, 0n, 0n])
	const ben = bundle.beneficiary

	// 受益人维度（gb + cnet）。
	const [gbBeneficiary, cnetBeneficiary] = await Promise.all([
		gb && ben ? readGbSubjectTotals(gb, ben, true) : Promise.resolve(zeroTotals()),
		idx && ben
			? (idx.getBeneficiaryRewardSummary!(ben, ts) as Promise<ethers.Result>)
					.then((r) => parseIncomeTotals(r))
					.catch(() => zeroTotals())
			: Promise.resolve(zeroTotals()),
	])

	// 每节点维度：逐个 idx.getNodeRewardSummary（各 ~21M gas，独立 eth_call）。
	const nodes: NodeIncomeRow[] = []
	for (const n of bundle.nodes) {
		const wallet = n.nodeWallet
		const [gbNode, cnetNode] = await Promise.all([
			gb ? readGbSubjectTotals(gb, wallet, false) : Promise.resolve(zeroTotals()),
			idx
				? (idx.getNodeRewardSummary!(wallet, ts) as Promise<ethers.Result>)
						.then((r) => parseIncomeTotals(r))
						.catch(() => zeroTotals())
				: Promise.resolve(zeroTotals()),
		])
		nodes.push({
			nodeWallet: wallet,
			depinNodeIp: normalizeDepinIp(n.ip),
			gb: gbNode,
			cnet: cnetNode,
			guardianId: n.nodeId,
		})
	}

	const stats: UnifiedIncomeStats = {
		beneficiary: ben,
		gbBeneficiary,
		cnetBeneficiary,
		nodes,
		gbPaidDepinReceived: null,
		gbPaidDepinReadOk: true,
		airdrop: null,
		airdropReadOk: true,
	}
	if (ben) {
		const clPaid = await readClRewardPaidWei(redeem, ben)
		mergeClRewardPaidIntoCnetBeneficiary(stats, clPaid)
		const guardianClPaid = await readClRewardPaidByGuardian(redeem, ben)
		mergeClRewardPaidIntoNodes(stats, guardianClPaid)
		const guardianIds = stats.nodes.map((n) => n.guardianId).filter((id): id is number => id !== undefined)
		const depinPaid = await readDepinPaidGbFromLedger(ben, guardianIds)
		if (depinPaid.ok) {
			mergeDepinPaidGbIntoBeneficiary(stats, depinPaid.total)
			mergeDepinPaidGbIntoNodes(stats, depinPaid.byGuardian)
		} else {
			stats.gbPaidDepinReadOk = false
		}
	}
	return stats
}

/**
 * 单次 RPC：{resolveUnifiedIncomeStats} — 受益人 GB（ConetGB1155）+ CNET（ValidatorNodeRewardIndexer）
 * 收入统计；合约内部 staticcall gbToken + rewardIndexer，客户端不直连 GB/indexer API。
 *
 * 单调用因把受益人 + 每节点的年度按小时聚合合并进一次 eth_call 超过节点 gasCap 而 revert 时，
 * 回退到 resolveNodeBundle + 逐个 subject 客户端拼装（节点仍可显示，收益逐项独立读取）。
 *
 * @param ipOrWallet 受益人钱包 / 节点运营钱包 / DePIN IP（解析顺序同 resolveNodeBundle）
 * @param anchorTs CNET 周期锚点 unix 秒（0 = 链上 block.timestamp）
 */
export async function fetchUnifiedIncomeStats(
	ipOrWallet: string,
	anchorTs = 0
): Promise<UnifiedIncomeStatsResult> {
	const contract = resolveValidatorDepositRedeemAddress()
	if (!contract) return { ok: false, error: 'ValidatorDepositRedeem address not configured' }
	const raw = String(ipOrWallet ?? '').trim()
	if (!raw) return { ok: false, error: 'Enter a DePIN node IP or wallet address' }
	const isAddr = ethers.isAddress(raw)
	const maybeWallet = isAddr ? ethers.getAddress(raw) : ethers.ZeroAddress
	const ip = isAddr ? '' : normalizeDepinIp(raw)
	const redeem = new ethers.Contract(contract, VALIDATOR_WALLET_NODE_PROFILE_ABI, conetDepinProvider)
	try {
		// 收益统计与节点 bundle 同源（resolveUnifiedIncomeStats 内部本就基于 resolveNodeBundle）。
		// unified 单调用可能因把受益人+每节点的年度聚合合并进一次 eth_call 超过节点 gasCap 而 revert，
		// 因此对 unified 与 bundle 各自 catch：bundle 用于 join validator active，且是回退拼装的节点来源。
		const [r, bundleRaw] = await Promise.all([
			(redeem.resolveUnifiedIncomeStats!(maybeWallet, ip, BigInt(Math.max(0, anchorTs))) as Promise<ethers.Result>).catch(
				() => null,
			),
			(redeem.resolveNodeBundle!(maybeWallet, ip) as Promise<ethers.Result>).catch(() => null),
		])
		// bundle 优先解析（回退拼装与 validator-active join 都依赖它）。
		let parsedBundle: BeneficiaryNodeBundle | null = null
		if (bundleRaw) {
			try {
				parsedBundle = parseNodeBundle(bundleRaw)
			} catch {
				parsedBundle = null
			}
		}
		let stats: UnifiedIncomeStats
		if (r) {
			// 单调用成功：直接解析。
			stats = parseUnifiedIncomeStats(r as ethers.Result)
		} else if (parsedBundle && (parsedBundle.beneficiary || parsedBundle.nodes.length > 0)) {
			// 单调用因 gasCap OOG 失败，但 bundle 可信：逐个 subject 客户端拼装收益（节点仍可显示）。
			stats = await assembleUnifiedIncomeStatsClientSide(redeem, parsedBundle, anchorTs)
		} else {
			// 既无收益、又无可信节点：交由外层 catch 返回 ok:false（不覆盖 UI 上次可信值）。
			return { ok: false, error: 'resolveUnifiedIncomeStats read failed' }
		}
		// L1 CL gas earned: indexer cumulative may be 0 while settleNodeRewards already paid (clRewardPaid).
		// Beneficiary aggregate ← clRewardPaid; per-node ← NodeRewardSettled logs grouped by guardianId.
		// resolveUnifiedIncomeStats node tuples lack guardianId, so join it from the bundle by nodeWallet first.
		assignGuardianIdsToNodes(stats, parsedBundle)
		const incomeBeneficiary =
			stats.beneficiary ?? parsedBundle?.beneficiary ?? (isAddr ? maybeWallet : null)
		if (incomeBeneficiary) {
			// Merge the authoritative aggregate first. Do not wait for the
			// potentially slow historical per-guardian event scan.
			const clPaid = await readClRewardPaidWei(redeem, incomeBeneficiary)
			mergeClRewardPaidIntoCnetBeneficiary(stats, clPaid)
		}
		// airdrop（vesting）账本按 redeem **beneficiary** 查询（非 node operator 钱包）。
		// 登录 EOA 可能是 nodeWallet；须用 resolve 出的 beneficiary，否则 accrued 恒为 0。
		const airdropBeneficiary = stats.beneficiary ?? (isAddr ? maybeWallet : null)
		if (airdropBeneficiary) {
			try {
				const airdropRow = await (redeem.airdropInfoOf!(airdropBeneficiary) as Promise<ethers.Result>).catch(
					() => null,
				)
				if (airdropRow) {
					stats.airdrop = parseAirdropInfo(airdropRow)
					stats.airdropReadOk = true
				} else {
					stats.airdropReadOk = false
				}
			} catch {
				stats.airdropReadOk = false
			}
		} else {
			stats.airdropReadOk = true
		}
		if (incomeBeneficiary) {
			// Start the slow per-guardian history scan only after the
			// beneficiary-level airdrop read has completed.
			const guardianClPaid = await readClRewardPaidByGuardian(redeem, incomeBeneficiary)
			mergeClRewardPaidIntoNodes(stats, guardianClPaid)
			if (resolveGbDepinAirdropAddress()) {
				const guardianIds = stats.nodes.map((n) => n.guardianId).filter((id): id is number => id !== undefined)
				const depinPaid = await readDepinPaidGbFromLedger(incomeBeneficiary, guardianIds)
				if (depinPaid.ok) {
					mergeDepinPaidGbIntoBeneficiary(stats, depinPaid.total)
					mergeDepinPaidGbIntoNodes(stats, depinPaid.byGuardian)
					stats.gbPaidDepinReadOk = true
				} else {
					stats.gbPaidDepinReadOk = false
				}
			} else {
				stats.gbPaidDepinReceived = { cumulativeRaw: '0', cumulative: '0' }
				stats.gbPaidDepinReadOk = true
			}
		}
		if (parsedBundle) {
			try {
				const bundle = parsedBundle
				// guardian-id 绑定后，validator pubkey / active 按「每个 guardian 节点」聚合，
				// 同一 nodeWallet 可能拥有多个 guardian 节点（各自独立 validator）。
				// 因此 join key 必须是 **单个 guardian 节点**（DePIN IP，全局唯一），不能用 nodeWallet
				// （会把同钱包多个节点的 BLS pubkey 折叠成同一个）。IP 缺失时回退到下标对齐
				// （income 与 bundle 同源于 resolveNodeBundle 的同序 guardian 遍历）。
				const activeByIp = new Map<string, boolean>()
				const pubkeyByIp = new Map<string, string>()
				bundle.nodes.forEach((n) => {
					const ip = normalizeDepinIp(n.ip)
					if (!ip) return
					activeByIp.set(ip, n.validatorActive)
					if (n.validatorPubkey) pubkeyByIp.set(ip, n.validatorPubkey)
				})
				stats.nodes = stats.nodes.map((rowNode, i) => {
					const ip = normalizeDepinIp(rowNode.depinNodeIp)
					const active = ip && activeByIp.has(ip)
						? activeByIp.get(ip)!
						: bundle.validatorActive[i] ?? false
					const pubkey = (ip && pubkeyByIp.get(ip)) || bundle.validatorPubkeys[i] || ''
					return {
						...rowNode,
						validatorActive: Boolean(active),
						validatorPubkey: pubkey || undefined,
					}
				})
			} catch {
				// keep income stats without validator-active join
			}
		}
		return { ok: true, query: raw, stats }
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { ok: false, error: err?.shortMessage ?? err?.message ?? 'resolveUnifiedIncomeStats read failed' }
	}
}

// ----------------------------------------------------------------------------------------------------
//  转让授权：当前受益人挑选自己名下的若干 node 钱包，指定新受益人地址，离线 EIP-712 签名，
//  由 Beamio API 服务器代付 gas 写入合约（POST /api/validatorDepositRedeemTransfer）。
//  写入后：链上 node→受益人 / IP→受益人改指新受益人，GB 分发 gossip 服务按最新映射自动发往新受益人；
//  validator 监听节点据 exit 请求事件 exit 旧 validator 并以新受益人为 withdrawal 重部署。
//  读取（nonce / 归属校验）走 CoNET RPC；仅签名后的写交易经 API 代付 gas。
// ----------------------------------------------------------------------------------------------------

const CONET_MAINNET_CHAIN_ID = 224422
const BEAMIO_API_BASE = 'https://beamio.app'

const VALIDATOR_DEPOSIT_REDEEM_TRANSFER_ABI = [
	'function beneficiaryNonces(address account) view returns (uint256)',
	'function guardianIdBeneficiary(uint256 guardianId) view returns (address)',
] as const

export const validatorNodeTransferTypes: Record<string, { name: string; type: string }[]> = {
	TransferNodes: [
		{ name: 'fromBeneficiary', type: 'address' },
		{ name: 'toBeneficiary', type: 'address' },
		{ name: 'guardianIds', type: 'uint256[]' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
}

export type NodeTransferResult = { success: true; txHash?: string } | { success: false; error: string }

/**
 * 受益人离线签名并提交一笔「把所选 guardian 节点转让给新受益人」的请求。
 * @param privateKey 当前受益人 EOA 私钥（来自 CoNET_Data.profiles[0].privateKeyArmor）。
 * @param toBeneficiary 新受益人地址。
 * @param guardianIds 选中的 guardian 节点 id（必须当前都属于本人）。
 * @param validForSeconds 签名有效期（秒），默认 3600。
 */
export async function signAndSubmitNodeTransfer(args: {
	privateKey: string
	toBeneficiary: string
	guardianIds: (bigint | string | number)[]
	validForSeconds?: number
}): Promise<NodeTransferResult> {
	const contract = resolveValidatorDepositRedeemAddress()
	if (!contract) return { success: false, error: 'ValidatorDepositRedeem address not configured' }

	let wallet: ethers.Wallet
	try {
		wallet = new ethers.Wallet(args.privateKey)
	} catch {
		return { success: false, error: 'Invalid signing key' }
	}
	const fromBeneficiary = ethers.getAddress(wallet.address)

	let toBeneficiary: string
	try {
		toBeneficiary = ethers.getAddress(args.toBeneficiary)
	} catch {
		return { success: false, error: 'Invalid new beneficiary address' }
	}
	if (fromBeneficiary.toLowerCase() === toBeneficiary.toLowerCase()) {
		return { success: false, error: 'New beneficiary must differ from current' }
	}

	let guardianIds: bigint[]
	try {
		guardianIds = (args.guardianIds || []).map((g) => BigInt(g))
	} catch {
		return { success: false, error: 'Invalid guardian id' }
	}
	if (!guardianIds.length) return { success: false, error: 'Select at least one node to transfer' }

	const read = new ethers.Contract(contract, VALIDATOR_DEPOSIT_REDEEM_TRANSFER_ABI, conetDepinProvider)

	// 归属校验（每个 guardian 节点必须当前属于本人）+ 读取 nonce，均走 RPC。
	let nonce: bigint
	try {
		for (const gid of guardianIds) {
			const owner = ethers.getAddress(await read.guardianIdBeneficiary!(gid))
			if (owner.toLowerCase() !== fromBeneficiary.toLowerCase()) {
				return { success: false, error: `Guardian #${gid.toString()} is not owned by you` }
			}
		}
		nonce = (await read.beneficiaryNonces!(fromBeneficiary)) as bigint
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { success: false, error: err?.shortMessage ?? err?.message ?? 'On-chain precheck failed' }
	}

	const deadline = BigInt(Math.floor(Date.now() / 1000) + Math.max(60, args.validForSeconds ?? 3600))
	const domain = {
		name: 'ValidatorDepositRedeem',
		version: '1',
		chainId: CONET_MAINNET_CHAIN_ID,
		verifyingContract: ethers.getAddress(contract),
	}

	let signature: string
	try {
		signature = await wallet.signTypedData(domain, validatorNodeTransferTypes, {
			fromBeneficiary,
			toBeneficiary,
			guardianIds,
			nonce,
			deadline,
		})
	} catch (e: unknown) {
		const err = e as { message?: string }
		return { success: false, error: err?.message ?? 'Signing failed' }
	}

	try {
		const res = await fetch(`${BEAMIO_API_BASE}/api/validatorDepositRedeemTransfer`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				contract,
				fromBeneficiary,
				toBeneficiary,
				guardianIds: guardianIds.map((g) => g.toString()),
				nonce: nonce.toString(),
				deadline: deadline.toString(),
				signature,
			}),
		})
		const j = (await res.json().catch(() => null)) as { success?: boolean; txHash?: string; error?: string } | null
		if (!res.ok || !j?.success) return { success: false, error: j?.error ?? `HTTP ${res.status}` }
		return { success: true, txHash: j.txHash }
	} catch (e: unknown) {
		const err = e as { message?: string }
		return { success: false, error: err?.message ?? 'Transfer submit failed' }
	}
}

// ----------------------------------------------------------------------------------------------------
//  转让 Order（市场撮合）：受益人挂单（设 CoNET-USDC 价格）→ 买家付 CoNET-USDC 成交并接收 node+validator。
//  CoNET-USDC 已支持 EIP-3009，买家「零 approve」：离线签 TransferWithAuthorization（买家→卖家）+ fulfill 绑定签名，
//  由 API 代付 gas 调用 fulfillTransferOrder，合约内用 3009 授权直接转账并把 node 转给买家。
//  读取（nonce / 归属 / 订单 / 余额 / 代币名）走 CoNET RPC；仅签名后的写交易（create/cancel/fulfill）经 API 代付。
// ----------------------------------------------------------------------------------------------------

const VALIDATOR_DEPOSIT_REDEEM_ORDER_ABI = [
	'function beneficiaryNonces(address account) view returns (uint256)',
	'function guardianIdBeneficiary(uint256 guardianId) view returns (address)',
	'function nodeOrder(uint256 guardianId) view returns (uint256)',
	'function usdcToken() view returns (address)',
	'function getTransferOrder(uint256 orderId) view returns (address seller, uint256[] guardianIds, uint256 priceUsdc6, bool active, address buyer, uint64 createdAt, uint64 filledAt)',
] as const

const CONET_USDC_ABI = [
	'function balanceOf(address) view returns (uint256)',
	'function name() view returns (string)',
	'function authorizationState(address authorizer, bytes32 nonce) view returns (bool)',
] as const

/** CoNET-USDC（FactoryERC20 / EIP20Permit3009）的 EIP-3009 TransferWithAuthorization typed data。 */
export const usdcTransferWithAuthorizationTypes: Record<string, { name: string; type: string }[]> = {
	TransferWithAuthorization: [
		{ name: 'from', type: 'address' },
		{ name: 'to', type: 'address' },
		{ name: 'value', type: 'uint256' },
		{ name: 'validAfter', type: 'uint256' },
		{ name: 'validBefore', type: 'uint256' },
		{ name: 'nonce', type: 'bytes32' },
	],
}

/** CoNET-USDC EIP-712 domain（name 来自链上 `name()`，version 固定 "1"）。 */
function usdcTokenDomain(tokenName: string, tokenAddress: string) {
	return { name: tokenName, version: '1', chainId: CONET_MAINNET_CHAIN_ID, verifyingContract: ethers.getAddress(tokenAddress) }
}

export const validatorCreateTransferOrderTypes: Record<string, { name: string; type: string }[]> = {
	CreateTransferOrder: [
		{ name: 'seller', type: 'address' },
		{ name: 'guardianIds', type: 'uint256[]' },
		{ name: 'priceUsdc6', type: 'uint256' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
}

export const validatorCancelTransferOrderTypes: Record<string, { name: string; type: string }[]> = {
	CancelTransferOrder: [
		{ name: 'seller', type: 'address' },
		{ name: 'orderId', type: 'uint256' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
}

export const validatorFulfillTransferOrderTypes: Record<string, { name: string; type: string }[]> = {
	FulfillTransferOrder: [
		{ name: 'buyer', type: 'address' },
		{ name: 'orderId', type: 'uint256' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
}

export type TransferOrderResult = { success: true; txHash?: string; orderId?: string } | { success: false; error: string }

export type TransferOrderView = {
	orderId: string
	seller: string
	guardianIds: string[]
	priceUsdc6: string
	active: boolean
	buyer: string
	createdAt: number
	filledAt: number
}

function validatorRedeemDomain(contract: string) {
	return { name: 'ValidatorDepositRedeem', version: '1', chainId: CONET_MAINNET_CHAIN_ID, verifyingContract: ethers.getAddress(contract) }
}

/** 受益人离线签名挂单：选中的 node 钱包以 priceUsdc6（CoNET-USDC, 6 位精度）出售。 */
export async function signAndSubmitCreateTransferOrder(args: {
	privateKey: string
	guardianIds: (bigint | string | number)[]
	priceUsdc6: bigint | string
	validForSeconds?: number
}): Promise<TransferOrderResult> {
	const contract = resolveValidatorDepositRedeemAddress()
	if (!contract) return { success: false, error: 'ValidatorDepositRedeem address not configured' }
	let wallet: ethers.Wallet
	try {
		wallet = new ethers.Wallet(args.privateKey)
	} catch {
		return { success: false, error: 'Invalid signing key' }
	}
	const seller = ethers.getAddress(wallet.address)
	let guardianIds: bigint[]
	try {
		guardianIds = (args.guardianIds || []).map((g) => BigInt(g))
	} catch {
		return { success: false, error: 'Invalid guardian id' }
	}
	if (!guardianIds.length) return { success: false, error: 'Select at least one node to list' }
	let priceUsdc6: bigint
	try {
		priceUsdc6 = BigInt(args.priceUsdc6)
	} catch {
		return { success: false, error: 'Invalid price' }
	}
	if (priceUsdc6 <= 0n) return { success: false, error: 'Price must be greater than 0' }

	const read = new ethers.Contract(contract, VALIDATOR_DEPOSIT_REDEEM_ORDER_ABI, conetDepinProvider)
	let nonce: bigint
	try {
		for (const gid of guardianIds) {
			const owner = ethers.getAddress(await read.guardianIdBeneficiary!(gid))
			if (owner.toLowerCase() !== seller.toLowerCase()) return { success: false, error: `Guardian #${gid.toString()} is not owned by you` }
			const listed = (await read.nodeOrder!(gid)) as bigint
			if (listed !== 0n) return { success: false, error: `Guardian #${gid.toString()} is already listed (order ${listed.toString()})` }
		}
		nonce = (await read.beneficiaryNonces!(seller)) as bigint
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { success: false, error: err?.shortMessage ?? err?.message ?? 'On-chain precheck failed' }
	}

	const deadline = BigInt(Math.floor(Date.now() / 1000) + Math.max(60, args.validForSeconds ?? 3600))
	let signature: string
	try {
		signature = await wallet.signTypedData(validatorRedeemDomain(contract), validatorCreateTransferOrderTypes, {
			seller,
			guardianIds,
			priceUsdc6,
			nonce,
			deadline,
		})
	} catch (e: unknown) {
		return { success: false, error: (e as { message?: string })?.message ?? 'Signing failed' }
	}

	try {
		const res = await fetch(`${BEAMIO_API_BASE}/api/validatorCreateTransferOrder`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ contract, seller, guardianIds: guardianIds.map((g) => g.toString()), priceUsdc6: priceUsdc6.toString(), nonce: nonce.toString(), deadline: deadline.toString(), signature }),
		})
		const j = (await res.json().catch(() => null)) as { success?: boolean; txHash?: string; orderId?: string; error?: string } | null
		if (!res.ok || !j?.success) return { success: false, error: j?.error ?? `HTTP ${res.status}` }
		return { success: true, txHash: j.txHash, orderId: j.orderId }
	} catch (e: unknown) {
		return { success: false, error: (e as { message?: string })?.message ?? 'Create order submit failed' }
	}
}

/** 受益人离线签名取消自己的挂单。 */
export async function signAndSubmitCancelTransferOrder(args: {
	privateKey: string
	orderId: bigint | string
	validForSeconds?: number
}): Promise<TransferOrderResult> {
	const contract = resolveValidatorDepositRedeemAddress()
	if (!contract) return { success: false, error: 'ValidatorDepositRedeem address not configured' }
	let wallet: ethers.Wallet
	try {
		wallet = new ethers.Wallet(args.privateKey)
	} catch {
		return { success: false, error: 'Invalid signing key' }
	}
	const seller = ethers.getAddress(wallet.address)
	let orderId: bigint
	try {
		orderId = BigInt(args.orderId)
	} catch {
		return { success: false, error: 'Invalid order id' }
	}

	const read = new ethers.Contract(contract, VALIDATOR_DEPOSIT_REDEEM_ORDER_ABI, conetDepinProvider)
	let nonce: bigint
	try {
		const order = await read.getTransferOrder!(orderId)
		if (!Boolean(order[3])) return { success: false, error: 'Order is not active' }
		if (ethers.getAddress(order[0]).toLowerCase() !== seller.toLowerCase()) return { success: false, error: 'You are not the order seller' }
		nonce = (await read.beneficiaryNonces!(seller)) as bigint
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { success: false, error: err?.shortMessage ?? err?.message ?? 'On-chain precheck failed' }
	}

	const deadline = BigInt(Math.floor(Date.now() / 1000) + Math.max(60, args.validForSeconds ?? 3600))
	let signature: string
	try {
		signature = await wallet.signTypedData(validatorRedeemDomain(contract), validatorCancelTransferOrderTypes, { seller, orderId, nonce, deadline })
	} catch (e: unknown) {
		return { success: false, error: (e as { message?: string })?.message ?? 'Signing failed' }
	}

	try {
		const res = await fetch(`${BEAMIO_API_BASE}/api/validatorCancelTransferOrder`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ contract, orderId: orderId.toString(), seller, nonce: nonce.toString(), deadline: deadline.toString(), signature }),
		})
		const j = (await res.json().catch(() => null)) as { success?: boolean; txHash?: string; error?: string } | null
		if (!res.ok || !j?.success) return { success: false, error: j?.error ?? `HTTP ${res.status}` }
		return { success: true, txHash: j.txHash }
	} catch (e: unknown) {
		return { success: false, error: (e as { message?: string })?.message ?? 'Cancel order submit failed' }
	}
}

/**
 * 买家完成购买（零 approve / EIP-3009）：买家离线签两条消息——
 *  1) fulfill 绑定签名（本合约 EIP-712，绑定 orderId，防同卖家同价跨单替换）；
 *  2) CoNET-USDC EIP-3009 `TransferWithAuthorization`（买家→卖家，直接付款，无需 approve）。
 * 由 API 代付 gas 调用 `fulfillTransferOrder`，合约内用 3009 授权转账并把 node+validator 转给买家。
 */
export async function signAndSubmitFulfillTransferOrder(args: {
	privateKey: string
	orderId: bigint | string
	validForSeconds?: number
}): Promise<TransferOrderResult> {
	const contract = resolveValidatorDepositRedeemAddress()
	if (!contract) return { success: false, error: 'ValidatorDepositRedeem address not configured' }
	let signer: ethers.Wallet
	try {
		signer = new ethers.Wallet(args.privateKey)
	} catch {
		return { success: false, error: 'Invalid signing key' }
	}
	const buyer = ethers.getAddress(signer.address)
	let orderId: bigint
	try {
		orderId = BigInt(args.orderId)
	} catch {
		return { success: false, error: 'Invalid order id' }
	}

	const read = new ethers.Contract(contract, VALIDATOR_DEPOSIT_REDEEM_ORDER_ABI, conetDepinProvider)
	let seller: string
	let priceUsdc6: bigint
	let usdcAddr: string
	let nonce: bigint
	try {
		const order = await read.getTransferOrder!(orderId)
		if (!Boolean(order[3])) return { success: false, error: 'Order is not active' }
		seller = ethers.getAddress(order[0])
		if (seller.toLowerCase() === buyer.toLowerCase()) return { success: false, error: 'You cannot buy your own order' }
		priceUsdc6 = order[2] as bigint
		usdcAddr = ethers.getAddress(await read.usdcToken!())
		if (usdcAddr === ethers.ZeroAddress) return { success: false, error: 'CoNET-USDC token not configured' }
		nonce = (await read.beneficiaryNonces!(buyer)) as bigint
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { success: false, error: err?.shortMessage ?? err?.message ?? 'On-chain precheck failed' }
	}

	// 买家须持有足额 CoNET-USDC（不再需要 approve）。同时读取代币名用于 EIP-3009 domain。
	const usdc = new ethers.Contract(usdcAddr, CONET_USDC_ABI, conetDepinProvider)
	let tokenName: string
	try {
		const bal = (await usdc.balanceOf!(buyer)) as bigint
		if (bal < priceUsdc6) return { success: false, error: 'Insufficient CoNET-USDC balance' }
		tokenName = (await usdc.name!()) as string
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { success: false, error: err?.shortMessage ?? err?.message ?? 'CoNET-USDC precheck failed' }
	}

	const now = Math.floor(Date.now() / 1000)
	const windowSec = Math.max(60, args.validForSeconds ?? 3600)
	const deadline = BigInt(now + windowSec)
	// EIP-3009 授权窗口：validAfter < now < validBefore。payNonce 为随机 bytes32（token 侧防重放）。
	const payValidAfter = 0n
	const payValidBefore = BigInt(now + windowSec)
	const payNonce = ethers.hexlify(ethers.randomBytes(32))

	let signature: string
	let paySignature: string
	try {
		// 1) fulfill 绑定签名（本合约 domain）
		signature = await signer.signTypedData(
			validatorRedeemDomain(contract),
			validatorFulfillTransferOrderTypes,
			{ buyer, orderId, nonce, deadline },
		)
		// 2) EIP-3009 付款授权（CoNET-USDC domain）：买家 → 卖家 priceUsdc6
		paySignature = await signer.signTypedData(
			usdcTokenDomain(tokenName, usdcAddr),
			usdcTransferWithAuthorizationTypes,
			{ from: buyer, to: seller, value: priceUsdc6, validAfter: payValidAfter, validBefore: payValidBefore, nonce: payNonce },
		)
	} catch (e: unknown) {
		return { success: false, error: (e as { message?: string })?.message ?? 'Signing failed' }
	}

	try {
		const res = await fetch(`${BEAMIO_API_BASE}/api/validatorFulfillTransferOrder`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				contract,
				orderId: orderId.toString(),
				buyer,
				nonce: nonce.toString(),
				deadline: deadline.toString(),
				signature,
				payValidAfter: payValidAfter.toString(),
				payValidBefore: payValidBefore.toString(),
				payNonce,
				paySignature,
			}),
		})
		const j = (await res.json().catch(() => null)) as { success?: boolean; txHash?: string; error?: string } | null
		if (!res.ok || !j?.success) return { success: false, error: j?.error ?? `HTTP ${res.status}` }
		return { success: true, txHash: j.txHash }
	} catch (e: unknown) {
		return { success: false, error: (e as { message?: string })?.message ?? 'Fulfill order submit failed' }
	}
}

/** RPC 读取单个挂单详情（不依赖中心化 API）。 */
export async function readTransferOrder(orderId: bigint | string): Promise<TransferOrderView | null> {
	const contract = resolveValidatorDepositRedeemAddress()
	if (!contract) return null
	const read = new ethers.Contract(contract, VALIDATOR_DEPOSIT_REDEEM_ORDER_ABI, conetDepinProvider)
	try {
		const o = await read.getTransferOrder!(BigInt(orderId))
		return {
			orderId: BigInt(orderId).toString(),
			seller: ethers.getAddress(o[0]),
			guardianIds: (o[1] as bigint[]).map((g) => g.toString()),
			priceUsdc6: (o[2] as bigint).toString(),
			active: Boolean(o[3]),
			buyer: ethers.getAddress(o[4]),
			createdAt: Number(o[5] as bigint),
			filledAt: Number(o[6] as bigint),
		}
	} catch {
		return null
	}
}
