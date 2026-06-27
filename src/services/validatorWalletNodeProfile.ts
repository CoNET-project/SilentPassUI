import { ethers } from 'ethers'
import { CONET_GUARDIAN_NODES_INFO_V6, CONET_VALIDATOR_DEPOSIT_REDEEM } from '@/config/chainAddresses'
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
	'function referrerExtension() view returns (address)',
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
] as const

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

/** CoNET 原生代币 / GB 精度 */
const CONET_NATIVE_DECIMALS = 18
const CONET_GB_DECIMALS = 18
/** CoNET USDC 精度 */
const CONET_USDC_DECIMALS = 6

export type ValidatorWalletNodeProfile = {
	wallet: string
	/** 该钱包累计拥有的 CoNET 验证节点数量 */
	validatorNodeCount: number
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

/** 将 {resolveNodeBundle} 解析结果转为受益人钱包档案视图。 */
function bundleToWalletProfile(bundle: BeneficiaryNodeBundle): ValidatorWalletNodeProfile | null {
	if (!bundle.beneficiary) return null
	return {
		wallet: bundle.beneficiary,
		validatorNodeCount: bundle.validatorNodeCount,
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
}

/** {resolveUnifiedIncomeStats} 解析结果：受益人 GB/CNET 总量 + 每节点明细。 */
export type UnifiedIncomeStats = {
	beneficiary: string | null
	gbBeneficiary: IncomeTotals
	cnetBeneficiary: IncomeTotals
	nodes: NodeIncomeRow[]
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
	return { beneficiary, gbBeneficiary, cnetBeneficiary, nodes }
}

/**
 * 单次 RPC：{resolveUnifiedIncomeStats} — 受益人 GB（ConetGB1155）+ CNET（ValidatorNodeRewardIndexer）
 * 收入统计；合约内部 staticcall gbToken + rewardIndexer，客户端不直连 GB/indexer API。
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
		const r = await redeem.resolveUnifiedIncomeStats!(maybeWallet, ip, BigInt(Math.max(0, anchorTs)))
		const stats = parseUnifiedIncomeStats(r as ethers.Result)
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
	'function getBeneficiaryByNodeWallet(address nodeWallet) view returns (address)',
] as const

export const validatorNodeTransferTypes: Record<string, { name: string; type: string }[]> = {
	TransferNodes: [
		{ name: 'fromBeneficiary', type: 'address' },
		{ name: 'toBeneficiary', type: 'address' },
		{ name: 'nodeWallets', type: 'address[]' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
}

export type NodeTransferResult = { success: true; txHash?: string } | { success: false; error: string }

/**
 * 受益人离线签名并提交一笔「把所选 node 钱包转让给新受益人」的请求。
 * @param privateKey 当前受益人 EOA 私钥（来自 CoNET_Data.profiles[0].privateKeyArmor）。
 * @param toBeneficiary 新受益人地址。
 * @param nodeWallets 选中的 node 钱包地址（必须当前都属于本人）。
 * @param validForSeconds 签名有效期（秒），默认 3600。
 */
export async function signAndSubmitNodeTransfer(args: {
	privateKey: string
	toBeneficiary: string
	nodeWallets: string[]
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

	let nodeWallets: string[]
	try {
		nodeWallets = (args.nodeWallets || []).map((a) => ethers.getAddress(a))
	} catch {
		return { success: false, error: 'Invalid node wallet address' }
	}
	if (!nodeWallets.length) return { success: false, error: 'Select at least one node to transfer' }

	const read = new ethers.Contract(contract, VALIDATOR_DEPOSIT_REDEEM_TRANSFER_ABI, conetDepinProvider)

	// 归属校验（每个 node 必须当前属于本人）+ 读取 nonce，均走 RPC。
	let nonce: bigint
	try {
		for (const nw of nodeWallets) {
			const owner = ethers.getAddress(await read.getBeneficiaryByNodeWallet!(nw))
			if (owner.toLowerCase() !== fromBeneficiary.toLowerCase()) {
				return { success: false, error: `Node ${nw} is not owned by you` }
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
			nodeWallets,
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
				nodeWallets,
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
	'function getBeneficiaryByNodeWallet(address nodeWallet) view returns (address)',
	'function nodeOrder(address nodeWallet) view returns (uint256)',
	'function usdcToken() view returns (address)',
	'function getTransferOrder(uint256 orderId) view returns (address seller, address[] nodeWallets, uint256 priceUsdc6, bool active, address buyer, uint64 createdAt, uint64 filledAt)',
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
		{ name: 'nodeWallets', type: 'address[]' },
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
	nodeWallets: string[]
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
	nodeWallets: string[]
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
	let nodeWallets: string[]
	try {
		nodeWallets = (args.nodeWallets || []).map((a) => ethers.getAddress(a))
	} catch {
		return { success: false, error: 'Invalid node wallet address' }
	}
	if (!nodeWallets.length) return { success: false, error: 'Select at least one node to list' }
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
		for (const nw of nodeWallets) {
			const owner = ethers.getAddress(await read.getBeneficiaryByNodeWallet!(nw))
			if (owner.toLowerCase() !== seller.toLowerCase()) return { success: false, error: `Node ${nw} is not owned by you` }
			const listed = (await read.nodeOrder!(nw)) as bigint
			if (listed !== 0n) return { success: false, error: `Node ${nw} is already listed (order ${listed.toString()})` }
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
			nodeWallets,
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
			body: JSON.stringify({ contract, seller, nodeWallets, priceUsdc6: priceUsdc6.toString(), nonce: nonce.toString(), deadline: deadline.toString(), signature }),
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
			nodeWallets: (o[1] as string[]).map((a) => ethers.getAddress(a)),
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
