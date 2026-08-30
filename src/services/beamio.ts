//			beamio.ts

import { CoNET_Data, setCoNET_Data } from '@/utils/globals'
import { applyBeamioUiLanguageFromProfile } from '@/locale/i18n'
import {
	buildBrowserLocaleCurrencyDefaults,
	buildLocaleCurrencySetupPayload,
	encodeRegistryLastNameWithLocaleSetup,
	normalizeBeamioDisplayCurrency,
	normalizeBeamioUiLocale,
	parseBeamioAddedSetupFromRegistryLastName,
	readBeamioUiLanguageBootstrap,
	writeBeamioUiLanguageBootstrap,
	type BeamioUiLocale,
} from '@/utils/beamioProfileLocaleCurrency'
import {ethers, keccak256, toUtf8Bytes} from 'ethers' 
import usdc_abi from './ABI/usdc_abi.json'
import {
	customJsonStringify,
	initProfileTokens,
	isValidSolanaBase58PrivateKey,
	postToEndpoint,

} from "../utils/utils"

import {
	apiv4_endpoint,
	conetDepinProvider,
	localDatabaseName,

} from "../utils/constants"

import beamioAccountABI from '@/services/ABI/beamio-AccountRegistry.json'
import { randomBytes } from '@noble/hashes/utils.js'
import contracts from "../utils/contracts"
import { encode as cborEncode, decode as cborDecode } from 'cbor-x'
import { argon2idAsync } from '@/services/argon2WorkerBridge'
import { baseEndpoint, USDCContract_BASE } from '../utils/constants'
import { BASE_MAINNET_FACTORIES, CONET_ACCOUNT_REGISTRY, CONET_BUNIT_AIRDROP_ADDRESS, CONET_MAINNET_CHAIN_ID, CONET_RPC_URL } from '@/config/chainAddresses'
import { eip712ChainIdForBeamioUserCard, getCardFactoryGatewayForEip712 } from '@/utils/beamioUserCardChain'
import { isRpcDegraded, reportRpcFailure, isRpcQuotaOrNetworkError } from '@/utils/rpcStatus'
import { withBaseRpc } from '../utils/baseRpc'
import { tu } from '@/locale/beamioLocale'
import {
	peekBeamioTagBasicMetadataForQuery,
	rememberBeamioTagBasicMetadata,
	type BeamioTagBasicMetadata,
} from '@/utils/beamioTagBasicMetadataGlobalCache'
import { searchBeamioTagRemote } from '@/services/beamioTagWorkerBridge'

export type x402Response = {
	timestamp: string
	network: string
	payer: string
	success: boolean
	USDC_tx?: string
	SETTLE_tx?: string
}

const uuid62 = require('uuid62')
const PouchDB = require("pouchdb").default



const SC= new ethers.Contract(USDCContract_BASE, usdc_abi, baseEndpoint)
export type IBalance= {
	usdc: string
	eth: string
	oracle: {
		bnb: string
		eth: string
		usdc: string
	}
}

/** RPC 失败时从 API 获取余额（30s 缓存由服务端负责） */
const fetchBalanceFromApi = async (address: string): Promise<IBalance | null> => {
	try {
		const res = await fetch(`${beamioApi}/api/getBalance?address=${encodeURIComponent(address)}`)
		if (!res.ok) return null
		const data = await res.json().catch(() => ({}))
		if (data?.eth != null && data?.usdc != null) {
			return {
				eth: String(data.eth),
				usdc: String(data.usdc),
				oracle: data?.oracle ?? { bnb: '', eth: '', usdc: '1' },
			}
		}
		return null
	} catch {
		return null
	}
}

/** 从 API 获取指定地址 USDC 余额（RPC 熔断或失败时使用），失败返回 null 表示不可信 */
export const getUsdcBalanceFromApi = async (address: string): Promise<string | null> => {
	const b = await fetchBalanceFromApi(address)
	return b?.usdc != null ? String(b.usdc) : null
}

const getBalance = async (address: string) => {
	if (!address) return null
	// 熔断期跳过 RPC（不向 API 服务器请求）
	try {
		const [usdc, eth, oracle] = await Promise.all([
			withBaseRpc((p) => new ethers.Contract(USDCContract_BASE, usdc_abi as ethers.InterfaceAbi, p).balanceOf(address)),
			withBaseRpc((p) => p.getBalance(address)),
			getOracle(),
		])
		if (oracle) {
			// getBalanceProcess 期望 oracle.eth.usdc（USDC→USD 汇率）
			const oracleForBalance = { ...oracle, eth: { usdc: oracle.usdc ?? '1' } }
			return {
				eth: ethers.formatUnits(eth as bigint, 18).toString(),
				usdc: ethers.formatUnits(usdc as bigint, 6).toString(),
				oracle: oracleForBalance,
			}
		}
	} catch (err) {
		if (isRpcQuotaOrNetworkError(err)) reportRpcFailure()
		// 熔断期不请求 API；非熔断期用 API 兜底
		if (!isRpcDegraded()) return fetchBalanceFromApi(address)
		return null
	}
	return null
}

const duplicate = contracts.Duplicate
const duplicate_readOnly = new ethers.Contract(duplicate.address, duplicate.abi, conetDepinProvider)

const isLocal = false
const remote = 'https://api.settleonbase.xyz'
const local = 'http://localhost:4088'
const beamioApi = 'https://beamio.app'
const ipfsEndpoint = `https://ipfs.conet.network/api/`

const getFaucetEndpoint = isLocal ? `${local}/api/BeamioFaucet` : `${remote}/api/BeamioFaucet`

/** Base 主网 BeamioOracle 合约，直接读取链上汇率，不再使用 API 服务器 */
const BEAMIO_ORACLE_BASE = '0x77CB8358c5a37aB7190b0A2C7EaA7fEeDCF11008'
const BeamioOracleAbi = ['function getRate(uint8 c) view returns (uint256)'] as const

const storageNewUser = `${beamioApi}/api/addUser`
const followStatusUrl = `${beamioApi}/api/getFollowStatus`
const removeFollowingUrl = `${beamioApi}/api/removeFollow`
const addFollowingUrl = `${beamioApi}/api/addFollow`
const myFollowStatusUrl = `${beamioApi}/api/getMyFollowStatus`
const getFollowersUrl = `${beamioApi}/api/getMyFollowStatus`

/** CoNET 主网 chainId（BUnitAirdrop 部署链） */
const CONET_CHAIN_ID = CONET_MAINNET_CHAIN_ID

/** CoNET BUnitAirdrop 合约地址（与 deployments/conet-addresses.json 一致） */
const CONET_BUNIT_AIRDROP = CONET_BUNIT_AIRDROP_ADDRESS

/** 检查是否可领取 BeamioBUnits（Cluster 读链） */
export const checkBUnitClaimEligibility = async (
	address: string,
): Promise<{ canClaim: boolean; nonce?: string; deadline?: number; reason?: string | null; error?: string }> => {
	try {
		const res = await fetch(`${beamioApi}/api/checkBUnitClaimEligibility?address=${encodeURIComponent(address)}`)
		const data = await res.json().catch(() => ({}))
		if (!res.ok) return { canClaim: false, error: data?.error ?? res.statusText }
		return {
			canClaim: !!data.canClaim,
			nonce: data.nonce,
			deadline: data.deadline != null ? Number(data.deadline) : undefined,
			reason: data.reason ?? null,
		}
	} catch (e) {
		return { canClaim: false, error: (e as Error)?.message ?? tu('request_failed') }
	}
}

/** 使用 EOA 私钥签写 ClaimAirdrop 并提交 claimBUnits 请求（调用方须先 gateBUnitFreeClaimBeforeSubmit） */
export const signAndClaimBUnits = async (
	privateKey: string,
	claimant: string,
	nonce: string | number,
	deadline: number
): Promise<{ success: boolean; txHash?: string; error?: string; code?: string }> => {
	try {
		const wallet = new ethers.Wallet(privateKey)
		if (wallet.address.toLowerCase() !== ethers.getAddress(claimant).toLowerCase()) {
			return { success: false, error: 'Signer address does not match claimant' }
		}
		const domain = {
			name: 'BUnitAirdrop',
			version: '1',
			chainId: CONET_CHAIN_ID,
			verifyingContract: CONET_BUNIT_AIRDROP as `0x${string}`,
		}
		const types = {
			ClaimAirdrop: [
				{ name: 'claimant', type: 'address' },
				{ name: 'nonce', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' },
			],
		}
		const value = {
			claimant: ethers.getAddress(claimant),
			nonce: BigInt(nonce),
			deadline: BigInt(deadline),
		}
		const signature = await wallet.signTypedData(domain, types, value)
		const res = await fetch(`${beamioApi}/api/claimBUnits`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				claimant: ethers.getAddress(claimant),
				nonce: String(nonce),
				deadline: String(deadline),
				signature,
			}),
		})
		const data = await res.json().catch(() => ({}))
		if (!res.ok) {
			return {
				success: false,
				error: data?.error ?? res.statusText,
				code: typeof data?.code === 'string' ? data.code : undefined,
			}
		}
		return { success: true, txHash: data.txHash }
	} catch (e) {
		return { success: false, error: (e as Error)?.message ?? 'Claim failed' }
	}
}

export type BUnitAutoClaimOutcome = 'skipped_silent' | 'claimed_success' | 'noop'

/** 自动领：IDB + 链上 gate → API eligibility → claim；已领静默，不换钱包可链上复检 */
export async function runAutoBUnitFreeClaimIfEligible(
	privateKey: string,
	claimantRaw: string,
): Promise<BUnitAutoClaimOutcome> {
	const {
		gateBUnitFreeClaimBeforeSubmit,
		markBUnitFreeClaimSkippedInIdb,
		isBUnitClaimAlreadyClaimedError,
		readBUnitFreeClaimHasClaimedOnChain,
	} = await import('@/utils/bunitFreeClaimGate')
	const claimant = ethers.getAddress(claimantRaw)

	if ((await gateBUnitFreeClaimBeforeSubmit(claimant)) === 'skip_silent') {
		return 'skipped_silent'
	}

	const r = await checkBUnitClaimEligibility(claimant)
	if (!r.canClaim || r.reason === 'already_claimed') {
		await markBUnitFreeClaimSkippedInIdb(claimant, 'api')
		return 'skipped_silent'
	}
	if (r.nonce == null || r.deadline == null) return 'noop'

	const onChainBeforePost = await readBUnitFreeClaimHasClaimedOnChain(claimant)
	if (onChainBeforePost === true) {
		await markBUnitFreeClaimSkippedInIdb(claimant, 'chain')
		return 'skipped_silent'
	}

	const result = await signAndClaimBUnits(privateKey, claimant, r.nonce, r.deadline)
	if (result.success) {
		await markBUnitFreeClaimSkippedInIdb(claimant, 'api')
		return 'claimed_success'
	}
	if (isBUnitClaimAlreadyClaimedError(result.error, result.code)) {
		await markBUnitFreeClaimSkippedInIdb(claimant, 'api')
		return 'skipped_silent'
	}
	return 'noop'
}

/** 提交 Refuel B-Unit 请求到 API。Cluster 预检后转发 Master，Master 提交 BaseTreasury.purchaseBUnitWith3009Authorization。 */
export const purchaseBUnitFromBase = async (payload: import('./BeamioCard').IBUnitRefuelPayload): Promise<{ success: boolean; txHash?: string; error?: string }> => {
	try {
		const res = await fetch(`${beamioApi}/api/purchaseBUnitFromBase`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})
		const data = await res.json().catch(() => ({}))
		if (!res.ok) return { success: false, error: data?.error ?? res.statusText }
		return { success: true, txHash: data.txHash }
	} catch (e) {
		return { success: false, error: (e as Error)?.message ?? 'Refuel failed' }
	}
}

/** 校验 Voucher 支付请求是否过期或已支付。用于 Smart Routing 前置校验。 */
export const checkRequestStatus = async (
	requestHash: string,
	validDays: number,
	payee: string
): Promise<{ expired: boolean; fulfilled: boolean; error?: string }> => {
	try {
		const params = new URLSearchParams({
			requestHash,
			validDays: String(Math.max(1, Math.floor(validDays))),
			payee: ethers.getAddress(payee),
		})
		const res = await fetch(`${beamioApi}/api/checkRequestStatus?${params}`)
		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))).error ?? res.statusText
			return { expired: false, fulfilled: false, error: err }
		}
		const { expired, fulfilled } = await res.json()
		return { expired: !!expired, fulfilled: !!fulfilled }
	} catch (e) {
		return { expired: false, fulfilled: false, error: (e as Error)?.message ?? tu('request_failed') }
	}
}

/** 查询 NTAG 424 DNA 卡状态（根据 UID）；若已登记则返回 address（AA/EOA） */
export const fetchNfcCardStatus = async (uid: string): Promise<{ registered: boolean; address?: string }> => {
	const res = await fetch(`${beamioApi}/api/nfcCardStatus`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ uid }),
	})
	if (!res.ok) {
		const err = (await res.json().catch(() => ({}))).error ?? res.statusText
		throw new Error(err)
	}
	return res.json()
}

/** 根据 UID 查询 NFC 卡资产（CCSA 点数 + USDC 余额），需卡已登记 */
export type UIDAssetsResponse = {
	ok: boolean
	address?: string
	cardAddress?: string
	points?: string
	points6?: string
	usdcBalance?: string
	cardCurrency?: string
	nfts?: { tokenId: string; attribute: string; tier: string; expiry: string; isExpired: boolean }[]
	error?: string
}
export const fetchUIDAssets = async (uid: string): Promise<UIDAssetsResponse> => {
	const res = await fetch(`${beamioApi}/api/getUIDAssets`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ uid: uid.trim() }),
	})
	const data = (await res.json().catch(() => ({}))) as UIDAssetsResponse
	if (!res.ok) return { ok: false, error: data.error ?? res.statusText ?? 'Query failed' }
	return data
}

/** Base 主网 BeamioUserCard 工厂地址（与 x402sdk chainAddresses 一致） */
const BASE_CARD_FACTORY = BASE_MAINNET_FACTORIES.CARD_FACTORY
const BASE_CHAIN_ID = 8453

/** NFC Topup Prepare：获取 executeForAdmin 所需的 cardAddr、data、deadline、nonce、factoryGateway（EIP-712 verifyingContract） */
export const nfcTopupPrepare = async (params: { uid: string; amount: string; currency?: string }): Promise<{
	cardAddr: string
	data: string
	deadline: number
	nonce: string
	factoryGateway: string
} | { error: string }> => {
	const res = await fetch(`${beamioApi}/api/nfcTopupPrepare`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(params),
	})
	const data = (await res.json().catch(() => ({}))) as {
		cardAddr?: string
		data?: string
		deadline?: number
		nonce?: string
		factoryGateway?: string
		error?: string
	}
	if (!res.ok || data.error) return { error: data.error ?? res.statusText ?? 'Prepare failed' }
	if (!data.cardAddr || !data.data || data.deadline == null || !data.nonce) return { error: 'Invalid prepare response' }
	let factoryGateway: string = BASE_CARD_FACTORY
	if (data.factoryGateway && ethers.isAddress(data.factoryGateway)) {
		factoryGateway = ethers.getAddress(data.factoryGateway)
	} else {
		try {
			factoryGateway = await getCardFactoryGatewayForEip712(data.cardAddr)
		} catch {
			/* keep BASE_CARD_FACTORY */
		}
	}
	return {
		cardAddr: data.cardAddr,
		data: data.data,
		deadline: Number(data.deadline),
		nonce: data.nonce,
		factoryGateway,
	}
}

/** NFC Topup：读取方 UI 用户用 profile 私钥签 ExecuteForAdmin，提交后 Master 调用 factory.executeForAdmin */
export const nfcTopup = async (params: { uid: string; amount: string; currency?: string }): Promise<{ success: boolean; txHash?: string; error?: string }> => {
	if (!CoNET_Data?.profiles?.length || !CoNET_Data.profiles[0]?.privateKeyArmor) {
		return { success: false, error: '请先登录 Beamio 账户' }
	}
	const prepare = await nfcTopupPrepare(params)
	if ('error' in prepare) return { success: false, error: prepare.error }
	const { cardAddr, data, deadline, nonce, factoryGateway } = prepare
	const privateKey = CoNET_Data.profiles[0].privateKeyArmor
	const wallet = new ethers.Wallet(privateKey)
	const dataHash = ethers.keccak256(data)
	const chainId = await eip712ChainIdForBeamioUserCard(cardAddr)
	const domain = {
		name: 'BeamioUserCardFactory',
		version: '1',
		chainId,
		verifyingContract: factoryGateway,
	}
	const types = {
		ExecuteForAdmin: [
			{ name: 'cardAddress', type: 'address' },
			{ name: 'dataHash', type: 'bytes32' },
			{ name: 'deadline', type: 'uint256' },
			{ name: 'nonce', type: 'bytes32' },
		],
	}
	const message = {
		cardAddress: cardAddr,
		dataHash,
		deadline: BigInt(deadline),
		nonce: nonce.startsWith('0x') ? nonce : '0x' + nonce,
	}
	const adminSignature = await wallet.signTypedData(domain, types, message)
	const res = await fetch(`${beamioApi}/api/nfcTopup`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ cardAddr, data, deadline, nonce, adminSignature, uid: params.uid }),
	})
	const dataRes = (await res.json().catch(() => ({}))) as { success?: boolean; txHash?: string; error?: string }
	return {
		success: res.ok && dataRes.success !== false,
		txHash: dataRes.txHash,
		error: dataRes.error,
	}
}

/** 以 UID 支付：服务端使用 NFC 卡私钥向 payee 转 USDC */
export const payByNfcUid = async (params: { uid: string; amountUsdc6: string; payee: string }): Promise<{ success: boolean; USDC_tx?: string; error?: string }> => {
	const res = await fetch(`${beamioApi}/api/payByNfcUid`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(params),
	})
	const data = (await res.json().catch(() => ({}))) as { success?: boolean; USDC_tx?: string; error?: string }
	return {
		success: res.ok && data.success !== false,
		USDC_tx: data.USDC_tx,
		error: data.error,
	}
}

export const toBase64 = (s: string) => {
	const bytes = new TextEncoder().encode(s)
	let binary = ''
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
	return btoa(binary)
}

export async function AuthorizationSign(
	amount: bigint,
	to: string,
	/** Prefer explicit key (e.g. resolved from mnemonic) over CoNET_Data alone. */
	privateKeyArmorOverride?: string,
): Promise<string> {
	const privateKey =
		(typeof privateKeyArmorOverride === 'string' && privateKeyArmorOverride.trim()) ||
		CoNET_Data?.profiles?.[0]?.privateKeyArmor ||
		''

	if (!privateKey) {
		return ''
	}

	const wallet = new ethers.Wallet(privateKey)
	const from = await wallet.getAddress()

	// 2) 金额 & 时间窗（现在 - 5min 到 1h 后，与注释一致，避免 facilitator 因过期拒绝）
	const value = amount
	const now = BigInt(Math.floor(Date.now() / 1000))
	const validAfter = now - BigInt(300)   // 5 分钟容错（时钟偏差）
	const validBefore = now + BigInt(3600) // 1 小时内有效    

	console.log(`AuthorizationSign validAfter = ${validAfter} validBefore ${validBefore}`)

	// 3) 随机 nonce（bytes32）
	const nonce = ethers.hexlify(ethers.randomBytes(32)) as `0x${string}`

	// 4) EIP-712 域 & 类型 & 数据（与你合约里的 TYPEHASH 字段严格一致）
	const domain = {
		name: "USD Coin",          // ERC20Permit(name) -> 你的合约构造里是 "USDC"
		version: "2",          // OpenZeppelin ERC20Permit 的默认版本是 "1"
		chainId: 8453,     // 必须与链实际 ID 一致
		verifyingContract: USDCContract_BASE,
	} as const;

	const AuthorizationTypes = {
		TransferWithAuthorization: [
		{ name: "from",        type: "address" },
		{ name: "to",          type: "address" },
		{ name: "value",       type: "uint256" },
		{ name: "validAfter",  type: "uint256" },
		{ name: "validBefore", type: "uint256" },
		{ name: "nonce",       type: "bytes32"  },
		],
	}

	const authorization = {
		from,
		to,
		value: value.toString(),
		validAfter: validAfter.toString(),
		validBefore: validBefore.toString(),
		nonce,
  	}

	// 5) 签名（返回 0x + 65 字节，合约的 bytes 接口可直接用
	try {
		const signature = await wallet.signTypedData(domain, AuthorizationTypes, authorization) as `0x${string}`
		const ret: AuthorizationPayload = {
			x402Version: 1,
			scheme: 'exact',
			network: 'base',
			payload: {
				signature,
				authorization
			}
		}
		console.log(ret)
		const testSig = await wallet.signMessage("test")
		console.log('Test signature:', testSig)

		// ✅ 安全方式：支持 UTF-8 字符
		const json = JSON.stringify(ret)
		const base64 = toBase64(json)
		return base64
	} catch (ex: any) {
		console.log(`wallet.signTypedData Error: ${ex.message}`)
		return ''
	}
	
}

function b64ToBytes(s: string): Uint8Array {
	if (typeof Buffer !== 'undefined') {
		return new Uint8Array(Buffer.from(s, 'base64'))
	}
	const bin = atob(s)
	const out = new Uint8Array(bin.length)
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
	return out
}

function bytesToB64(bytes: Uint8Array): string {
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(bytes).toString('base64')
	}
	let bin = ''
	for (let i = 0; i < bytes.length; i++) {
		bin += String.fromCharCode(bytes[i])
	}
	return btoa(bin)
}

// 把 string 转为 Uint8Array
const enc = new TextEncoder()


const b64encode = (bytes: Uint8Array): string => {
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(bytes).toString('base64')
	}
	let binary = ''
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i])
	}
	return btoa(binary)
}

const b64decode = (s: string): Uint8Array => {
	if (typeof Buffer !== 'undefined') {
		return new Uint8Array(Buffer.from(s, 'base64'))
	}
	const binary = atob(s)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i)
	}
	return bytes
}

const timingSafeEqualUint8 = (a: Uint8Array, b: Uint8Array): boolean => {
	if (a.length !== b.length) return false
	let diff = 0
	for (let i = 0; i < a.length; i++) {
		diff |= a[i] ^ b[i]
	}
	return diff === 0
}



export function encodeStoredCBOR(obj: any): string {
	const bytes = cborEncode(obj)  // 这里是 Uint8Array（真正的 CBOR 二进制）
  	return bytesToB64(bytes)       // 再转为 Base64 字符串
}

export function decodeStoredCBOR(b64: string): any {
	const bytes = b64ToBytes(b64)  // Base64 → Uint8Array
  	return cborDecode(bytes)       // CBOR → 原始对象
}

/** BeamioCurrency 枚举：与 BeamioCurrency.sol 一致 */
const BEAMIO_CURRENCY = { CAD: 0, USD: 1, JPY: 2, CNY: 3, USDC: 4, HKD: 5, EUR: 6, SGD: 7, TWD: 8 } as const

/** 从 Base 链上 BeamioOracle 直接读取汇率，不再使用 API 服务器。getRate(c) 返回「1 单位该货币 = X USD」E18 */
export const getOracle = async (): Promise<{
	usdcad?: string; usdjpy?: string; usdcny?: string; usdc?: string;
	usdhkd?: string; usdtwd?: string; usdeur?: string; usdsgd?: string;
} | null> => {
	try {
		const res = await withBaseRpc(async (provider) => {
			const oracle = new ethers.Contract(BEAMIO_ORACLE_BASE, BeamioOracleAbi, provider)
			const ids = [BEAMIO_CURRENCY.CAD, BEAMIO_CURRENCY.JPY, BEAMIO_CURRENCY.CNY, BEAMIO_CURRENCY.USDC,
				BEAMIO_CURRENCY.HKD, BEAMIO_CURRENCY.EUR, BEAMIO_CURRENCY.SGD, BEAMIO_CURRENCY.TWD] as const
			const rates = await Promise.all(ids.map((c) => oracle.getRate(c)))
			const ratesNum = rates.map((r) => Number(ethers.formatUnits(r, 18)))
			// 链上：1 外币 = X USD；前端需 1 USD = Y 外币，故非 USD/USDC 用倒数
			return {
				usdcad: ratesNum[0] > 0 ? String(1 / ratesNum[0]) : undefined,
				usdjpy: ratesNum[1] > 0 ? String(1 / ratesNum[1]) : undefined,
				usdcny: ratesNum[2] > 0 ? String(1 / ratesNum[2]) : undefined,
				usdc: String(ratesNum[3] || 1),
				usdhkd: ratesNum[4] > 0 ? String(1 / ratesNum[4]) : undefined,
				usdeur: ratesNum[5] > 0 ? String(1 / ratesNum[5]) : undefined,
				usdsgd: ratesNum[6] > 0 ? String(1 / ratesNum[6]) : undefined,
				usdtwd: ratesNum[7] > 0 ? String(1 / ratesNum[7]) : undefined,
			}
		})
		return res
	} catch {
		return null
	}
}

/** 将 getOracle 返回的原始数据解析为 currencyData 格式，供全局 feeder 和各页面使用 */
export const parseOracleToCurrencyData = (data: { usdcad?: string | number; usdjpy?: string | number; usdcny?: string | number; usdc?: string | number; usdhkd?: string | number; usdtwd?: string | number; usdeur?: string | number; usdsgd?: string | number } | null): currencyData => {
	if (!data) {
		return { CAD: 1.35, USD: 1, JPY: 150, CNY: 7.2, USDC: 1, HKD: 7.8, SGD: 1.35, EUR: 0.92, TWD: 31 }
	}
	return {
		CAD: Number(data.usdcad) || 1.35,
		USD: 1,
		JPY: Number(data.usdjpy) || 150,
		CNY: Number(data.usdcny) || 7.2,
		USDC: Number(data.usdc) || 1,
		HKD: Number(data.usdhkd) || 7.8,
		TWD: Number(data.usdtwd) || 31,
		EUR: Number(data.usdeur) || 0.92,
		SGD: Number(data.usdsgd) || 1.35
	}
}

/** 全局 Oracle 刷新间隔：5 分钟 */
export const ORACLE_REFRESH_MS = 5 * 60 * 1000


export const estimateGasUSDC = async (amount: number, to: string) => {
	if (!CoNET_Data?.profiles?.length) {
		return null
	}
	const privateKey = CoNET_Data.profiles[0].privateKeyArmor
	const wallet = new ethers.Wallet(privateKey, baseEndpoint)
	const sc = new ethers.Contract(USDCContract_BASE, usdc_abi, wallet)
	const _amount = ethers.parseUnits(amount.toFixed(2), 6)
	try {
		const [gas, price, oracle] = await Promise.all([
			sc.transfer.estimateGas(to || ethers.ZeroAddress, _amount),
			baseEndpoint.getFeeData(),
			getOracle(),
		])

		if (oracle) {
			return {gas: gas * BigInt(3), price: price.gasPrice, oracle}
		}

		return null
	} catch (ex) {
		return null
	}
}

const CURRENCY_CN: Record<string, string> = {
  USD: "美元", USDC: "美元", USDT: "美元",
  EUR: "欧元",
  JPY: "日元",
  CNY: "人民币", CNH: "离岸人民币",
  HKD: "港元",
  GBP: "英镑",
  AUD: "澳元",
  CAD: "加元",
  SGD: "新元",
  TWD: "新台币",
}
/** 中文数字（整数部分），支持到兆 */
function toChineseNumber(input: number | string): string {
	// 输入清理
	let n: number
	if (typeof input === "number") n = input
	else {
		const cleaned = input.trim().replace(/[^\d.-]/g, "")
		const parsed = parseFloat(cleaned)
		n = Number.isFinite(parsed) ? parsed : 0
	}

	const negative = n < 0
	n = Math.abs(n)

	// 四舍五入到分
	const cents = Math.round(n * 100)
	const intPart = Math.floor(cents / 100)
	const jiao = Math.floor((cents % 100) / 10)
	const fen = cents % 10

	// 金融大写数字与单位
	const digits = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"]
	const unitsSmall = ["", "拾", "佰", "仟"]
	const unitsSection = ["", "万", "亿", "兆"]

	/** 0~9999 内的转换（节内简化规则：非最高位的“壹拾/佰/仟”可省略壹） */
	const sectionToCN = (num: number): string => {
		if (num === 0) return ""
		let s = ""
		const str = String(num)
		const len = str.length
		for (let i = 0; i < len; i++) {
		const d = parseInt(str[len - 1 - i])
		if (d === 0) {
			if (!s.startsWith("零") && s !== "") s = "零" + s
		} else {
			const isHighPos = i === len - 1 // 节最高位不省略
			const digitStr = (d === 1 && i > 0 && !isHighPos) ? "" : digits[d]
			s = digitStr + unitsSmall[i] + s
		}
		}
		return s.replace(/零+/g, "零").replace(/^零|零$/g, "")
	}

	// 整数部分
	let intCN = ""
	if (intPart === 0) {
		intCN = "零"
	} else {
		let nLeft = intPart
		let unitIndex = 0
		while (nLeft > 0 && unitIndex < unitsSection.length) {
		const section = nLeft % 10000
		if (section !== 0) {
			const head = sectionToCN(section)
			intCN = head + unitsSection[unitIndex] + intCN
		} else if (!intCN.startsWith("零") && intCN !== "") {
			intCN = "零" + intCN
		}
		nLeft = Math.floor(nLeft / 10000)
		unitIndex++
		}
		intCN = intCN.replace(/零+/g, "零").replace(/^零|零$/g, "")
	}

	// 小数部分（角/分）
	let fracCN = ""
	if (jiao === 0 && fen === 0) {
		fracCN = "整"
	} else if (jiao === 0 && fen !== 0) {
		fracCN = "零" + digits[fen] + "分"
	} else if (jiao !== 0 && fen === 0) {
		fracCN = digits[jiao] + "角"
	} else {
		fracCN = digits[jiao] + "角" + digits[fen] + "分"
	}

	const sign = negative ? "负" : ""
	return sign + intCN + "元" + fracCN
}


/** 日语金融漢数字（壱 弐 参 肆 伍 陸 漆 捌 玖 零），支持小数（角/分） */
function toJapaneseNumber(input: number | string): string {
	let n: number
	if (typeof input === "number") n = input
	else {
		const cleaned = input.trim().replace(/[^\d.-]/g, "")
		const parsed = parseFloat(cleaned)
		n = Number.isFinite(parsed) ? parsed : 0
	}

	const negative = n < 0
	n = Math.abs(n)

	const cents = Math.round(n * 100)
	const intPart = Math.floor(cents / 100)
	const jiao = Math.floor((cents % 100) / 10)
	const fen = cents % 10

	// ✅ 金融漢数字（日语）
	const digits = ["零", "壱", "弐", "参", "肆", "伍", "陸", "漆", "捌", "玖"]
	const unitsSmall = ["", "拾", "百", "千"]
	const unitsSection = ["", "万", "億", "兆"]

	const sectionToJP = (num: number): string => {
		if (num === 0) return ""
		let s = ""
		for (let i = 0; i < 4; i++) {
		const d = num % 10
		if (d !== 0) {
			const digitStr = (d === 1 && i > 0) ? "" : digits[d]
			s = digitStr + unitsSmall[i] + s
		} else if (!s.startsWith("零") && s !== "") {
			s = "零" + s
		}
		num = Math.floor(num / 10)
		if (num === 0) break
		}
		return s.replace(/零+/g, "零").replace(/^零|零$/g, "")
	}

	let intCN = ""
	if (intPart === 0) {
		intCN = "零"
	} else {
		let nLeft = intPart
		let unitIndex = 0
		while (nLeft > 0 && unitIndex < unitsSection.length) {
		const section = nLeft % 10000
		if (section !== 0) {
			const head = sectionToJP(section)
			intCN = head + unitsSection[unitIndex] + intCN
		} else if (!intCN.startsWith("零") && intCN !== "") {
			intCN = "零" + intCN
		}
		nLeft = Math.floor(nLeft / 10000)
		unitIndex++
		}
		intCN = intCN.replace(/零+/g, "零").replace(/^零|零$/g, "")
	}

	let fracCN = ""
	if (jiao === 0 && fen === 0) {
		fracCN = "整"
	} else if (jiao === 0 && fen !== 0) {
		fracCN = "零" + digits[fen] + "分"
	} else if (jiao !== 0 && fen === 0) {
		fracCN = digits[jiao] + "角"
	} else {
		fracCN = digits[jiao] + "角" + digits[fen] + "分"
	}

	const sign = negative ? "マイナス " : ""
	return sign + intCN + "ドル" + (fracCN ? fracCN : "")
}

export const redeemCodeHash = (redeemCode: string, passcode: string) => {
	const hash = ethers.solidityPackedKeccak256(['string', 'string'], [redeemCode, passcode])
	return hash
}

export const generateCODE = (passcode: string) => {
	const code: string = uuid62.v4()
	const hash = ethers.solidityPackedKeccak256(['string', 'string'], [code, passcode])
	return ({
		code, hash
	})
}

/**
 * NFC Link App（基础设施卡 redeem）：链上 `createRedeemBatch` 存 `keccak256(utf8(publicRedeemCode))`，
 * 与合约 `consumeRedeem` / `cancelRedeem` 对单一 code 字符串的 hash 一致。
 */
export const composeNfcLinkAppRedeemCodeForChain = (publicRedeemCode: string): string => publicRedeemCode

export const nfcLinkAppRedeemPackedHash = (publicRedeemCode: string): string =>
	ethers.keccak256(ethers.toUtf8Bytes(publicRedeemCode))

/** POS Link App 深链，如 https://beamio.app/app/?nftRedeemcode=...&tagid=...&uid=...&counter=... */
export type NfcLinkAppDeepLinkParsed = {
	nftRedeemcode: string
	tagid: string
	uid: string
	counter: string
}

export const parseNfcLinkAppDeepLink = (raw: string): NfcLinkAppDeepLinkParsed | null => {
	try {
		const u = raw.startsWith('http') ? new URL(raw) : new URL(raw, 'https://beamio.app')
		const code = (u.searchParams.get('nftRedeemcode') ?? u.searchParams.get('NFTREDEEMCODE') ?? '').trim()
		const tagid = (u.searchParams.get('tagid') ?? u.searchParams.get('tagId') ?? '').trim().replace(/^0x/i, '')
		const uid = (u.searchParams.get('uid') ?? '').trim().replace(/^0x/i, '')
		const counter = (u.searchParams.get('counter') ?? '').trim()
		if (!code || code.toLowerCase() === 'null') return null
		if (!/^[0-9A-Fa-f]{16}$/.test(tagid)) return null
		if (!/^[0-9A-Fa-f]{14}$/.test(uid)) return null
		if (!counter || !/^\d+$/.test(counter)) return null
		return {
			nftRedeemcode: decodeURIComponent(code),
			tagid: tagid.toUpperCase(),
			uid: uid.toLowerCase(),
			counter,
		}
	} catch {
		return null
	}
}

export const isNfcLinkAppDeepLink = (raw: string): boolean => parseNfcLinkAppDeepLink(raw) != null

/** 生成 request 唯一 hash（bytes32），供 URL 与链上 originalPaymentHash 使用 */
export const generateRequestHash = (): string => {
	const seed = uuid62.v4() + '-' + Date.now() + '-' + Math.random().toString(36).slice(2)
	return ethers.keccak256(ethers.toUtf8Bytes(seed))
}

//		https://beamio.app/app/?nftRedeemcode=null&tagid=${tagid}&uid=${uid}&counter=${counter}

/**
 * 将金额格式化为人类可读的文字形式
 * @param amount number | string
 * @param lang "cn" | "en" | "ja"
 * @param currency 货币代码，如 USDC、JPY
 */
export function formatAmountReadable(amount: number | string, lang='en', currency='USD'): string {
	const code = (currency || "").toUpperCase()

	// 统一解析数值（兼容 string）
	let n: number
	if (typeof amount === "number") n = amount
	else {
		const cleaned = amount.replace(/[^\d.-]/g, "")
		const parsed = parseFloat(cleaned)
		n = Number.isFinite(parsed) ? parsed : 0
	}

	if (lang === "cn") {
		// 中文：直接用 toChineseNumber（内含“元/角/分”），不要再额外拼 “元”
		const name = CURRENCY_CN[code] || code
		return `${name} ${toChineseNumber(n)}`
	}

	// 其它语言维持整数可读（如需带小数，可改为 n.toLocaleString）
	const intPart = Math.floor(Math.max(0, n))

	if (lang === "ja") {
		const CURRENCY_JA: Record<string, string> = {
			USD: "米", USDC: "米", USDT: "米",
			EUR: "ユーロ", JPY: "円", CNY: "人民元", HKD: "香港ドル",
			GBP: "英ポンド", AUD: "豪ドル", CAD: "カナダドル",
			SGD: "シンガポールドル", TWD: "ニュー台湾ドル",
		}
		const name = CURRENCY_JA[code] || code
		return `${name} ${toJapaneseNumber(n)}`
	}

	if (lang === "en") return toEnglishCheckWords(amount)

	return `${code} ${intPart.toLocaleString("en-US")}`
}

 // 千分位格式化（固定两位小数）
export const formatWithThousands = (n: string | number, fixed = 2): string => {
	const num = Number(n)
	if (isNaN(num)) return "0.00"

	const [intPart, decPart = "00"] = num.toFixed(fixed).split(".")
	const intWithCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
	return `${intWithCommas}${fixed ? '.' + decPart : ''}`
}

export const getUSDCFaucet = async (address: string) => {
	const params = new URLSearchParams({address}).toString()
	const url = `${getFaucetEndpoint}?${params}`
	try {
		const req = await fetch(url, {
			method: 'GET'
		})
		if (req.status !== 200) {
			console.log(`getFaucet status !== 200 Error!`)
			return false
		}

		return true

	} catch (ex) {
		console.log(`getFaucet Error`, ex)
	}
	return false
}

export function toEnglishCheckWords(input: number | string): string {
	// 1) 统一为字符串，清理除 0-9 . - 之外的字符
	let s = typeof input === "number" ? input.toFixed(10) : String(input || "");
	console.log("原始输入:", s);
	
	s = s.replace(/[^\d.-]/g, "").trim();
	if (!s || s === "-" || s === "." || s === "-.") s = "0";

	// 2) 处理负号
	const negative = s.startsWith("-");
	if (negative) s = s.slice(1);

	// 3) 只认**第一个**小数点为分隔，小数取两位（不足补零，超出截断）
	const dot = s.indexOf(".");
	const intRaw = dot >= 0 ? s.slice(0, dot) : s;
	const fracRaw = dot >= 0 ? s.slice(dot + 1) : "";
	
	console.log("intRaw:", intRaw, "fracRaw:", fracRaw);
	
	const intStr = (intRaw.replace(/^0+(?=\d)/, "") || "0"); // 去前导零但至少留一位
	const fracTwo = (fracRaw + "00").slice(0, 2);

	console.log("intStr:", intStr, "fracTwo:", fracTwo);

	// 4) 防御性：整数部分如果为空/非数字，按 0；用 BigInt 防止被截断
	const dollars = intStr === "" ? BigInt(0) : BigInt(intStr);
	const cents = Number(fracTwo); // 0..99

	console.log("dollars:", dollars, "cents:", cents);

	// 5) 转英文
	const words = intToEnglishBig(dollars);
	console.log("words:", words);
	
	const fraction = String(cents).padStart(2, "0");
	const sign = negative ? "Negative " : "";

	// 6) 首字母大写 + 支票尾巴
	const start = words ? words.charAt(0).toUpperCase() + words.slice(1) : "Zero";
	const result = `${sign}${start} and ${fraction}/100 dollars`;
	console.log("最终结果:", result);
	
	return result;
}


function intToEnglishBig(n: bigint): string {
	if (n === BigInt(0)) return "zero";

	const below20 = ["","one","two","three","four","five","six","seven","eight","nine","ten",
		"eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
	const tens = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
	const scales = ["","thousand","million","billion","trillion","quadrillion","quintillion"];

	const chunkToWords = (x: number): string => {
		const h = Math.floor(x / 100);
		const t = x % 100;
		const u = x % 10;
		const out: string[] = [];
		if (h) out.push(below20[h], "hundred");
		if (t) {
			if (t < 20) out.push(below20[t]);
			else {
				const tw = tens[Math.floor(t / 10)];
				out.push(u ? `${tw}-${below20[u]}` : tw);
			}
		}
		return out.join(" ").trim();
	};

	const parts: string[] = [];
	let i = 0;
	while (n > BigInt(0)) {
		const chunk = Number(n % BigInt(1000));
		if (chunk) {
			const w = chunkToWords(chunk);
			const s = scales[i];
			parts.unshift(s ? `${w} ${s}` : w);
		}
		n = n / BigInt(1000);
		i++;
	}
	return parts.join(" ").replace(/\s+/g, " ").trim();
}



const listeners = new Map<string, Handler[]>()

export function onWalletEvent(event: string, handler: Handler) {
  const arr = listeners.get(event) || []
  arr.push(handler)
  listeners.set(event, arr)

  // 返回 off 函数
  return () => {
    const arr = listeners.get(event)
    if (!arr) return
    const idx = arr.indexOf(handler)
    if (idx >= 0) arr.splice(idx, 1)
  }
}

export function emitWalletEvent(event: string, payload?: any) {
  const arr = listeners.get(event)
  if (!arr) return
  arr.forEach(h => h(payload))
}

const createKeyHDWallets = (secretPhrase: string | null) => {
  try {
    if (!secretPhrase) return ethers.Wallet.createRandom();

    return ethers.Wallet.fromPhrase(secretPhrase);
  } catch (ex) {
    return null;
  }
}

/**
 * Ensure `profiles[0].privateKeyArmor` exists in session `CoNET_Data`.
 * When IndexedDB has `mnemonicPhrase` but profile lost `privateKeyArmor`, re-derive from the 12-word phrase.
 * If both are missing, user must `restoreWithUserPin` (BeamioTag + password, CoNET recover) — see
 * `beamio-consumer-wallet-signing-storage.mdc` (bizSite must not persist keys; consumer/POS may).
 */
export const ensureProfilePrivateKeyArmorFromMnemonic = (
  data: encrypt_keys_object | null,
): encrypt_keys_object | null => {
  if (!data?.profiles?.length) return data
  const profiles = ensureFlatProfiles(data.profiles)
  const p0 = profiles[0]
  if (!p0) return data
  const existing = p0.privateKeyArmor?.trim() ?? ''
  if (existing) {
    if (profiles === data.profiles) return data
    return { ...data, profiles }
  }
  const phrase = data.mnemonicPhrase?.trim() ?? ''
  if (!phrase) return data
  const acc = createKeyHDWallets(phrase)
  if (!acc) return data
  const keyID = p0.keyID?.trim() ?? ''
  if (keyID && ethers.isAddress(keyID) && acc.address.toLowerCase() !== keyID.toLowerCase()) {
    console.warn('[ensureProfilePrivateKeyArmor] mnemonic does not match stored keyID')
    return data
  }
  const nextProfile: profile = {
    ...p0,
    privateKeyArmor: acc.signingKey.privateKey,
    publicKeyArmor: acc.publicKey,
    keyID: keyID || acc.address,
  }
  return { ...data, profiles: [nextProfile, ...profiles.slice(1)] }
}

const getDuplicateOwnership = async(duplicateAccount: string, keyID: string): Promise<boolean|null> => {
	try {
		const owner = await duplicate_readOnly.duplicateList(keyID)
		if (owner === ethers.ZeroAddress || duplicateAccount.toLowerCase() !== owner.toLowerCase()) {
			return false
		}
		return true
	} catch (ex) {
		return null
	}

}

const duplicateAPI = `${apiv4_endpoint}duplicate`
// const initDuplicate = async (temp: encrypt_keys_object): Promise<encrypt_keys_object|null> => {
	
// 	temp._duplicateCode = temp?._duplicateCode || uuid62.v4()
// 	temp.duplicateCodeHash = ethers.solidityPackedKeccak256(['string'], [temp._duplicateCode])
// 	temp.duplicateMnemonicPhrase = temp.mnemonicPhrase


// 	if (!temp?.duplicateAccount) {
// 		const profiles = temp.profiles
// 		const message = JSON.stringify({ walletAddress: profiles[0].keyID, hash: temp.duplicateCodeHash, data: '', channelPartners: temp.ChannelPartners})
// 		const wallet = new ethers.Wallet(profiles[0].privateKeyArmor)
// 		const signMessage = await wallet.signMessage(message)
// 		const sendData = {
// 		  	message, signMessage
// 		}
	
// 		const result = await postToEndpoint(duplicateAPI, true, sendData)
// 		if (!result|| !result?.status) {
// 			console.log(`initDuplicate Error!`, result?.error)
// 			return temp
// 		}
// 		console.log(`initDuplicate success!`, result?.status)

// 		temp.duplicateAccount = {
// 			privateKeyArmor: profiles[0].privateKeyArmor,
// 			tokens: initProfileTokens(),
// 			publicKeyArmor: '',
// 			referrer: '',
// 			keyID: result.status,
// 			isNode: false,
// 			index: 0,
// 			hdPath: null,
// 		}
		
// 	} else {
// 		const keyID = temp.profiles[0].keyID
// 		const duplicateStatus = await getDuplicateOwnership(temp.duplicateAccount.keyID, keyID)
// 		if (duplicateStatus === false) {
			
// 			return null
// 		}
// 	}

// 	if (!temp?.duplicatePassword) {
// 		temp.duplicateCode = ''
// 	}

// 	return temp

// }

export const createOrGetWallet = async (secretPhrase: string | null, initAccount = false, referrals = '', ChannelPartners = '' ) => {
	const hasIncomingMnemonic = typeof secretPhrase === 'string' && secretPhrase.length > 0
	// Restore / 临时券钱包：不依赖本地库；私密模式 IndexedDB 读可能永久挂起。
	if (!hasIncomingMnemonic && !initAccount) {
		await checkStorageWithTimeout()
	}

  if (secretPhrase|| initAccount ) setCoNET_Data(null)

  if (CoNET_Data?.profiles?.length) {
    const hydrated = ensureProfilePrivateKeyArmorFromMnemonic(CoNET_Data)
    if (hydrated) setCoNET_Data(hydrated)
  }

  if (!CoNET_Data || !CoNET_Data?.profiles) {
		const acc = createKeyHDWallets(secretPhrase);

		

		if (!acc) return null

		const profile: profile = {
			tokens: initProfileTokens(),
			publicKeyArmor: acc.publicKey,
			keyID: acc.address,
			isPrimary: true,
			referrer: null,
			isNode: false,
			privateKeyArmor: acc.signingKey.privateKey,
			hdPath: acc.path,
			index: acc.index,
			type: "ethereum",
			webFilter: true
		};

		const data: any = {
			mnemonicPhrase: acc?.mnemonic?.phrase,
			profiles: [profile],
			isReady: true,
			ver: 0,
			nonce: 0,
		};

		if (acc?.mnemonic?.phrase) {

		}

		
		
		setCoNET_Data(data)
	}



	let tmpData = CoNET_Data
	if (!tmpData) {
		return null
	}

  	tmpData.ChannelPartners = ChannelPartners
	tmpData.referrals = referrals
  


	// tmpData = await initDuplicate(tmpData)
	// if (!tmpData) {
	// 		return
	// }
  
	await setCoNET_Data(tmpData)

	await storeSystemData()

	if (tmpData === null) {
			setTimeout(() => {
				return window.location.reload()
			}, 5000)
		return null
	}

	return tmpData
}

export const checkStorage = async () => {
  try {
    const database = PouchDB(localDatabaseName, { auto_compaction: true });
    const doc = await database.get("init", { latest: true });
    const data = JSON.parse(Buffer.from(doc.title, "base64").toString());
    const hydrated = ensureProfilePrivateKeyArmorFromMnemonic(data);
    setCoNET_Data(hydrated);
    const storedLang = hydrated?.beamio?.language
    if (storedLang) {
      writeBeamioUiLanguageBootstrap(normalizeBeamioUiLocale(storedLang))
      await applyBeamioUiLanguageFromProfile(storedLang)
    }
    return hydrated
  } catch {
    // IndexedDB（_pouch_conet）取不到 init 文档即视为未注册，直接进入 onboarding；
    // 不再从 Cache Storage 回填：Cache 残留可能让用户以"空 EOA"或不完整账号
    // 误入 App，且用户主动清空 _pouch_conet 时也会被 cache 兜底覆盖。
    return null
  }
}

/** Safari 私密浏览等环境 IndexedDB 可能永不 resolve；超时按「无本地钱包」处理。 */
export const CHECK_STORAGE_TIMEOUT_MS = 8_000

export async function checkStorageWithTimeout(
  timeoutMs = CHECK_STORAGE_TIMEOUT_MS,
): Promise<encrypt_keys_object | null> {
  if (typeof window === 'undefined') return null
  return Promise.race([
    checkStorage().catch(() => null),
    new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), timeoutMs)
    }),
  ])
}

/** Cache 用的绝对 URL（Safari / PWA 路径不同，必须用 origin 级别 key 确保一致）
 * 注意：iOS 上 Cache API 与 IndexedDB 同样与 Safari 隔离，PWA 无法读取。仅对 Android 等平台可能有效。 */
const CACHE_WALLET_URL = typeof window !== 'undefined'
  ? new URL('/__beamio_wallet_backup__', window.location.origin).href
  : ''

/** 写入 Cache Storage（iOS Safari→PWA 迁移备份，Cache API 在部分环境下共享） */
const cacheStorageBackup = async (data: string) => {
  try {
    if (typeof caches === 'undefined' || !CACHE_WALLET_URL) return
    const cache = await caches.open('beamio-wallet-v1')
    const req = new Request(CACHE_WALLET_URL, { method: 'GET' })
    await cache.put(req, new Response(data, { headers: { 'Content-Type': 'text/plain' } }))
  } catch (_) {}
}

const storageHashData = async (docId: string, data: string) => {
  const database = PouchDB(localDatabaseName, { auto_compaction: true });
  const putWithRev = (rev: string) => database.put({ _id: docId, title: data, _rev: rev });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const doc = await database.get(docId, { latest: true });
      await putWithRev(doc._rev);
      await cacheStorageBackup(data)
      return;
    } catch (ex: any) {
      if (ex?.status === 409 || ex?.name === 'conflict') {
        await new Promise((r) => setTimeout(r, 30 + attempt * 50));
        continue;
      }
      if (/^not_found/.test(ex?.name ?? '')) {
        try {
          await database.post({ _id: docId, title: data });
          await cacheStorageBackup(data)
          return;
        } catch (postEx: any) {
          if (postEx?.status === 409 || postEx?.name === 'conflict') {
            await new Promise((r) => setTimeout(r, 30));
            continue;
          }
          console.warn(`[storageHashData] post Error:`, postEx?.message ?? postEx);
          return;
        }
      }
      console.warn(`[storageHashData] Error:`, ex?.message ?? ex);
      return;
    }
  }
}

const ensureFlatProfiles = (p: any): profile[] => {
  if (!p || !Array.isArray(p)) return []
  if (p.length === 0) return []
  const first = p[0]
  if (Array.isArray(first)) return p.flat()
  return p
}

let storeSystemDataTimer: ReturnType<typeof setTimeout> | null = null
/**
 * Persist CoNET_Data. Heavy JSON.stringify + base64 MUST run inside the deferred
 * timer — doing it synchronously froze the UI for seconds after chat history
 * restore / large profile writes ("app frozen ~10s after launch").
 */
export const storeSystemData = async () => {
  if (!CoNET_Data) return
  if (storeSystemDataTimer) clearTimeout(storeSystemDataTimer)
  storeSystemDataTimer = setTimeout(async () => {
    storeSystemDataTimer = null
    if (!CoNET_Data) return
    try {
      const temp = { ...CoNET_Data }
      if (temp.profiles) temp.profiles = ensureFlatProfiles(temp.profiles)
      if ((CoNET_Data as any)?.cardRedeems) (temp as any).cardRedeems = (CoNET_Data as any).cardRedeems
      const dataB64 = Buffer.from(customJsonStringify(temp)).toString("base64")
      cacheStorageBackup(dataB64)
      await storageHashData("init", dataB64)
    } catch (ex) {
      console.warn(`[storeSystemData] Error:`, ex)
    }
  }, 200)
}

/** 立即将当前 CoNET_Data 写入存储（用于 cardRedeems 等需马上落盘的数据），并取消待执行的 storeSystemData 定时器 */
export const flushStoreSystemData = async () => {
  if (storeSystemDataTimer) {
    clearTimeout(storeSystemDataTimer)
    storeSystemDataTimer = null
  }
  if (!CoNET_Data) return
  const temp = { ...CoNET_Data }
  if (temp.profiles) temp.profiles = ensureFlatProfiles(temp.profiles)
  if ((CoNET_Data as any)?.cardRedeems) (temp as any).cardRedeems = (CoNET_Data as any).cardRedeems
  const dataB64 = Buffer.from(customJsonStringify(temp)).toString("base64")
  cacheStorageBackup(dataB64)
  try {
    await storageHashData("init", dataB64)
  } catch (ex) {
    console.warn(`[flushStoreSystemData] Error:`, ex)
  }
}


export const MobileType = () => {
	const iOS = 'ios'
	const android = 'android'
	const deskyop = 'desktop'
	const ua = navigator.userAgent
	const platform = navigator.platform
	const macLike = /Macintosh/i.test(platform)
	const touch = navigator.maxTouchPoints && navigator.maxTouchPoints > 1

	if (/iPhone|iPad|iPod/i.test(ua)) return iOS
	if (macLike && touch) return iOS
	if (/Android/i.test(ua)) return android

	return deskyop
}

export const isStandalone = (() => {
	try {
		// Android / Desktop PWA
		if (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches) {
			return true
		}
		// iOS Safari PWA (added to home screen)
		if (typeof navigator !== 'undefined' && (navigator as any).standalone === true) {
			return true
		}
	} catch {}
	return false
})()


export const aesGcmEncrypt = async (plaintext: string, password: string) => {
	const pwUtf8 = new TextEncoder().encode(password)                                 // encode password as UTF-8
	const pwHash = await crypto.subtle.digest('SHA-256', pwUtf8)                      // hash the password

	const iv = crypto.getRandomValues(new Uint8Array(12))                             // get 96-bit random iv
	const ivStr = Array.from(iv).map(b => String.fromCharCode(b)).join('')            // iv as utf-8 string

	const alg = { name: 'AES-GCM', iv: iv }                                           // specify algorithm to use

	const key = await crypto.subtle.importKey('raw', pwHash, alg, false, ['encrypt']) // generate key from pw

	const ptUint8 = new TextEncoder().encode(plaintext)                               // encode plaintext as UTF-8
	const ctBuffer = await crypto.subtle.encrypt(alg, key, ptUint8)                   // encrypt plaintext using key

	const ctArray = Array.from(new Uint8Array(ctBuffer))                              // ciphertext as byte array
	const ctStr = ctArray.map(byte => String.fromCharCode(byte)).join('')             // ciphertext as string

	return btoa(ivStr+ctStr)   
}

export const aesGcmDecrypt= async (ciphertext: string, password: string) => {
	const pwUtf8 = new TextEncoder().encode(password)                                 // encode password as UTF-8
	const pwHash = await crypto.subtle.digest('SHA-256', pwUtf8)                      // hash the password

	const ivStr = atob(ciphertext).slice(0,12)                                        // decode base64 iv
	const iv = new Uint8Array(Array.from(ivStr).map(ch => ch.charCodeAt(0)))          // iv as Uint8Array

	const alg = { name: 'AES-GCM', iv: iv }                                           // specify algorithm to use

	const key = await crypto.subtle.importKey('raw', pwHash, alg, false, ['decrypt']) // generate key from pw

	const ctStr = atob(ciphertext).slice(12)                                          // decode base64 ciphertext
	const ctUint8 = new Uint8Array(Array.from(ctStr).map(ch => ch.charCodeAt(0)))     // ciphertext as Uint8Array
	// note: why doesn't ctUint8 = new TextEncoder().encode(ctStr) work?

	try {
		const plainBuffer = await crypto.subtle.decrypt(alg, key, ctUint8)            // decrypt ciphertext using key
		const plaintext = new TextDecoder().decode(plainBuffer)                       // plaintext from ArrayBuffer
		return plaintext                                                              // return the plaintext
	} catch (e) {
		throw new Error('Decrypt failed')
	}
}

const deriveAesKeyFromPassword = async (
	password: string,
	stored: Argon2idHash
): Promise<CryptoKey> => {
	const passwordBytes = enc.encode(password)
	const salt = b64ToBytes(stored.salt)

	// Argon2id runs in a Web Worker so Create-ID loading CSS keeps animating
	const keyBytes = await argon2idAsync(passwordBytes, salt, {
		m: stored.m,
		t: stored.t,
		p: stored.p,
		dkLen: 32,
	})

	return crypto.subtle.importKey(
		'raw',
		keyBytes,
		{ name: 'AES-GCM' },
		false,
		['encrypt', 'decrypt']
	)
}
const dec = new TextDecoder()
export const aesGcmDecryptWithStored = async (
	cipherB64: string,
	password: string,
	stored: Argon2idHash
): Promise<string> => {
	const key = await deriveAesKeyFromPassword(password, stored)

	const combined = b64ToBytes(cipherB64)
	const iv = combined.slice(0, 12)
	const cipherBytes = combined.slice(12)

	const decrypted = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv },
		key,
		cipherBytes
	)

	return dec.decode(decrypted)
}

export const isBeamioAndroidWebView = () => {
    const ua = navigator.userAgent.toLowerCase()
    return /wv|webview|beamioappwebview/i.test(ua)
}

let processing = false
export const getBalanceProcess = async (
	keyID: string,
	setBalance: (val: number) => void,
	setUsdcToUsd: (val: number) => void
): Promise<{ success: boolean; balance?: number; usdcToUSD?: number }> => {
	if (processing) {
		return { success: false }
	}
	processing = true
	try {
		const ba = await getBalance(keyID)
		if (!ba) {
			return { success: false }
		}
		
		const usdc = Number(ba.usdc)
		setBalance(usdc)
		const ethUsdc = typeof ba.oracle?.eth === 'object' && ba.oracle.eth && 'usdc' in ba.oracle.eth
			? ba.oracle.eth.usdc
			: '1'
		const usdcToUSD = usdc * Number(ethUsdc)
		setUsdcToUsd(usdcToUSD)
		return { success: true, balance: usdc, usdcToUSD }
	} finally {
		processing = false
	}
}

const listenning = async (listenningProcess: boolean, setListenningProcess: (val: boolean) => void, keyID: string, setBalance: (val: number) => void, setUsdcToUsd: (val: number) => void) => {
	if (listenningProcess) return
	setListenningProcess(true)
	await getBalanceProcess(keyID, setBalance, setUsdcToUsd)

	// conetDepinProvider.on ('block', async (block: number) => {
	// 	console.log (block)
	// 	if (!(block % 5)) {
	// 		getBalanceProcess(keyID, setBalance, setUsdcToUsd)
	// 	}
	// })
}

const beamioAccountContract = {
	address: CONET_ACCOUNT_REGISTRY,
	network: 'CONET DePIN',
	abi: beamioAccountABI,
	provider: new ethers.JsonRpcProvider(CONET_RPC_URL),
	
}

const beamioAccountSC = new ethers.Contract(beamioAccountContract.address, beamioAccountContract.abi, beamioAccountContract.provider)

/** 224422 迁移前 AccountRegistry（只读归档 RPC） */
const LEGACY_ACCOUNT_REGISTRY_RPC = 'https://rpc-old.conet.network'
const LEGACY_ACCOUNT_REGISTRY_ADDRESS = '0x4afaca09cf8307070a83836223Ae129073eC92e5'

const legacyBeamioAccountSC = new ethers.Contract(
	LEGACY_ACCOUNT_REGISTRY_ADDRESS,
	beamioAccountABI,
	new ethers.JsonRpcProvider(LEGACY_ACCOUNT_REGISTRY_RPC)
)

type RecoverStoragePayload = {
	stored?: Argon2idHash
	img?: string
	recoverData?: unknown
}

type ValidRecoverStoragePayload = RecoverStoragePayload & {
	stored: Argon2idHash
	img: string
}

const decodeRecoverStoragePayload = (encoded: string): RecoverStoragePayload | null => {
	try {
		const obj = JSON.parse(fromBase64(encoded)) as RecoverStoragePayload
		if (!obj || typeof obj !== 'object') return null
		return {
			stored: obj.stored,
			img: typeof obj.img === 'string' ? obj.img : undefined,
			recoverData: obj.recoverData,
		}
	} catch {
		return null
	}
}

const isValidRecoverStoragePayload = (obj: RecoverStoragePayload | null): obj is ValidRecoverStoragePayload =>
	!!obj?.img && !!obj?.stored

/** 从指定 AccountRegistry 读取 @tag 对应的 PIN recover blob */
const fetchRecoverPayloadByAccountName = async (
	accountName: string,
	registry: ethers.Contract
): Promise<{ encoded: string; payload: ValidRecoverStoragePayload } | null> => {
	try {
		const encoded: string = await registry.getBase64ByAccountName(accountName)
		if (!encoded?.trim()) return null
		const payload = decodeRecoverStoragePayload(encoded)
		if (!isValidRecoverStoragePayload(payload)) return null
		return { encoded, payload }
	} catch {
		return null
	}
}

const buildMinimalBeamioFromAccountName = (accountName: string): beamio => ({
	accountName,
	firstName: '',
	lastName: '',
	image: '',
	darkTheme: false,
	isUSDCFaucet: false,
	isETHFaucet: false,
	initialLoading: true,
	createdAt: Date.now(),
	language: 'en',
	currency: 'USD',
	tax: '0',
})

const parseRegistryAccountToBeamio = (userInfo: {
	accountName?: string
	image?: string
	darkTheme?: boolean
	isUSDCFaucet?: boolean
	isETHFaucet?: boolean
	initialLoading?: boolean
	firstName?: string
	lastName?: string
	createdAt?: bigint | number
	exists?: boolean
	pgpKeyID?: string
	pgpKey?: string
} | null): beamio | null => {
	if (!userInfo?.exists || !userInfo.accountName?.trim()) return null
	const { displayLastName, setup } = parseBeamioAddedSetupFromRegistryLastName(userInfo.lastName || '')
	const addedSetup: beamioAddedSetup = setup ?? { language: 'en', currency: 'USD', tax: '0' }
	return {
		accountName: userInfo.accountName,
		image: userInfo.image ?? '',
		darkTheme: userInfo.darkTheme ?? false,
		initialLoading: userInfo.initialLoading ?? false,
		isUSDCFaucet: userInfo.isUSDCFaucet ?? false,
		isETHFaucet: userInfo.isETHFaucet ?? false,
		firstName: userInfo.firstName ?? '',
		lastName: displayLastName,
		createdAt: Number(userInfo.createdAt),
		language: normalizeBeamioUiLocale(addedSetup.language) as ILanguage,
		currency: normalizeBeamioDisplayCurrency(addedSetup.currency) as ICurrency,
		tax: addedSetup.tax || '0',
		localeCurrencyConfigured: setup !== null,
		pgpPublicKeyID: userInfo.pgpKeyID ?? '',
		pgpPublicKeyArmor: userInfo.pgpKey ?? '',
	}
}

const getUserInfoFromRegistry = async (
	registry: ethers.Contract,
	keyID: string
): Promise<beamio | null> => {
	try {
		const userInfo = await registry.getAccount(keyID)
		return parseRegistryAccountToBeamio(userInfo)
	} catch {
		return null
	}
}

const defaultBrowserParams: Argon2idParams = {
	memoryKB: 32 * 1024, // 32 MB
	iterations: 3,
	parallelism: 1,
	hashLen: 32
}



const hashPasswordBrowser = async (
	password: string,
	params: Argon2idParams = defaultBrowserParams
): Promise<Argon2idHash> => {
	const salt = randomBytes(16)

	const hash = await argon2idAsync(enc.encode(password), salt, {
		m: params.memoryKB,
		t: params.iterations,
		p: params.parallelism,
		dkLen: params.hashLen,
	})

	return {
		algo: 'argon2id',
		v: 19,
		m: params.memoryKB,
		t: params.iterations,
		p: params.parallelism,
		salt: b64encode(salt),
		hash: b64encode(hash),
	}
}


export const checkBeamioAccountAPI = async (preBeamio: string): Promise<boolean> => {
	try {
		const isExits = await beamioAccountSC.isAccountNameAvailable(preBeamio)
		return isExits
	} catch (ex: any) {
		// On-chain probe failed (RPC down, contract missing, ABI mismatch, decode error, ...).
		// MUST NOT default to "available" — that lets the user finish onboarding on a broken
		// chain and silently take an already-taken handle. Surface to caller's catch instead.
		console.warn(`checkBeamioAccountAPI: on-chain probe failed for "${preBeamio}": ${ex?.shortMessage || ex?.message || ex}`)
		throw new Error('UNABLE_TO_VERIFY_HANDLE_ONCHAIN')
	}
}

type IAccountRecover = {
	hash: string
	encrypto: string
}

const newUser = async (BeamioName: string, recoverData:IAccountRecover[], privateKey: string) => {
	
	const signWallet = new ethers.Wallet(privateKey)
	const signMessage = await signWallet.signMessage(signWallet.address)
	const Url = storageNewUser
	try {
		const body = {
			accountName: BeamioName,
			recover: recoverData,
			wallet: signWallet.address,
			signMessage
		}

		const resp = await fetch(Url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(body)
		})

		if (!resp.ok) {
			return false
		}

		const json = await resp.json()
		return true
	} catch (err) {
		console.error("newUser error:", err)
	}
	return false
}

const isValidEthersPrivateKey = (pk: unknown): pk is string => {
	if (!pk || typeof pk !== 'string') return false
	const s = String(pk).trim().replace(/^0x/i, '')
	return /^[0-9a-fA-F]{64}$/.test(s)
}

const migrateLegacyRecoverToNewRegistry = async (
	accountName: string,
	encodedRecover: string,
	privateKey: string,
	wallet: string
): Promise<{ ok: boolean; beamio: beamio }> => {
	const nameHash = ethers.solidityPackedKeccak256(['string'], [accountName])
	const recover: IAccountRecover[] = [{ hash: nameHash, encrypto: encodedRecover }]
	const fallbackBeamio = buildMinimalBeamioFromAccountName(accountName)

	const legacyProfile = await getUserInfoFromRegistry(legacyBeamioAccountSC, wallet)
	const beamioForEnqueue = legacyProfile ?? fallbackBeamio
	beamioForEnqueue.accountName = accountName

	const ok = legacyProfile
		? await RegenerateUser(beamioForEnqueue, recover, privateKey)
		: await newUser(accountName, recover, privateKey)

	return { ok, beamio: beamioForEnqueue }
}

export const postNfcLinkAppClaimWithKey = async (
	params: NfcLinkAppDeepLinkParsed & { privateKey: string }
): Promise<{ success: boolean; address?: string; redeemTxHash?: string | null; error?: string }> => {
	const res = await fetch(`${beamioApi}/api/nfcLinkAppClaimWithKey`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			nftRedeemcode: params.nftRedeemcode,
			tagid: params.tagid,
			uid: params.uid,
			counter: params.counter,
			privateKey: params.privateKey.trim(),
		}),
	})
	const data = (await res.json().catch(() => ({}))) as {
		success?: boolean
		address?: string
		redeemTxHash?: string | null
		error?: string
	}
	return {
		success: res.ok && data.success === true,
		address: data.address,
		redeemTxHash: data.redeemTxHash,
		error: data.error ?? (!res.ok ? tu('request_failed') : undefined),
	}
}

/** 使用当前登录 Beamio 档案私钥完成 NFC Link App 换绑（须已登录） */
export const claimNfcLinkAppWithCurrentWallet = async (
	parsed: NfcLinkAppDeepLinkParsed
): Promise<{ success: boolean; address?: string; redeemTxHash?: string | null; error?: string }> => {
	if (!CoNET_Data?.profiles?.length || !CoNET_Data.profiles[0]?.privateKeyArmor) {
		return { success: false, error: 'Please sign in first.' }
	}
	const pk = CoNET_Data.profiles[0].privateKeyArmor
	if (!isValidEthersPrivateKey(pk)) {
		return { success: false, error: 'Wallet key unavailable.' }
	}
	return postNfcLinkAppClaimWithKey({ ...parsed, privateKey: pk })
}

/** 若 raw 为 Link App 深链则发起换绑并返回结果；否则返回 null */
export const handleNfcLinkAppDeepLinkScan = async (
	raw: string
): Promise<{ success: boolean; address?: string; redeemTxHash?: string | null; error?: string } | null> => {
	const p = parseNfcLinkAppDeepLink(raw)
	if (!p) return null
	return claimNfcLinkAppWithCurrentWallet(p)
}

export const postBeamio = async (beamio: beamio, privateKey: string) => {
	if (!isValidEthersPrivateKey(privateKey)) {
		console.warn('[postBeamio] invalid privateKey, skipping')
		return false
	}
	const Url = storageNewUser
	let signWallet: ethers.Wallet
	try {
		signWallet = new ethers.Wallet(privateKey)
	} catch (ex: any) {
		console.warn('[postBeamio] Wallet creation failed:', ex?.message || ex)
		return false
	}
	const signMessage = await signWallet.signMessage(signWallet.address)


	const lastname = encodeRegistryLastNameWithLocaleSetup(
		beamio.lastName ?? '',
		buildLocaleCurrencySetupPayload(beamio),
	)
	try {
		const body = {
			accountName: beamio.accountName,
			wallet: signWallet.address,
			image: beamio.image,
			isUSDCFaucet: beamio.isUSDCFaucet,
			darkTheme: beamio.darkTheme,
			isETHFaucet: beamio.isETHFaucet,
			firstName: beamio.firstName,
			lastName: lastname,
			pgpKeyID: beamio.pgpPublicKeyID ?? '',
			pgpKey: beamio.pgpPublicKeyArmor ?? '',
			signMessage
		}

		const resp = await fetch(Url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(body)
		})

		if (!resp.ok) {
			return false
		}

		
		return true
	} catch (err) {
		console.error("newUser error:", err)
	}
	return false
}

/** Single path: profile language / currency / tax → chain + local + UI i18n */
export async function persistBeamioProfileLocaleCurrency(
	beamio: beamio,
	privateKeyArmor: string,
	patch?: Partial<Pick<beamio, 'language' | 'currency' | 'tax'>>,
): Promise<beamio | null> {
	if (!isValidEthersPrivateKey(privateKeyArmor)) return null
	const bo: beamio = {
		...beamio,
		...patch,
		language: normalizeBeamioUiLocale(patch?.language ?? beamio.language) as ILanguage,
		currency: normalizeBeamioDisplayCurrency(patch?.currency ?? beamio.currency) as ICurrency,
		tax: String(patch?.tax ?? beamio.tax ?? '0'),
		localeCurrencyConfigured: true,
	}
	const ok = await postBeamio(bo, privateKeyArmor)
	if (!ok) return null
	if (CoNET_Data) {
		CoNET_Data.beamio = bo
		setCoNET_Data(CoNET_Data)
	}
	writeBeamioUiLanguageBootstrap(bo.language as BeamioUiLocale)
	await storeSystemData()
	await applyBeamioUiLanguageFromProfile(bo.language)
	return bo
}

/** Local CoNET_Data + bootstrap mirror when chain save unavailable or wallet locked. */
export async function persistBeamioLanguageLocally(
	beamio: beamio | null | undefined,
	language: unknown,
): Promise<beamio | null> {
	const nextLang = normalizeBeamioUiLocale(language) as ILanguage
	writeBeamioUiLanguageBootstrap(nextLang)
	await applyBeamioUiLanguageFromProfile(nextLang)
	if (!CoNET_Data && !beamio) return null
	const base = beamio ?? CoNET_Data?.beamio
	if (!base?.accountName?.trim()) return null
	const bo: beamio = { ...base, language: nextLang }
	if (CoNET_Data) {
		CoNET_Data.beamio = bo
		setCoNET_Data(CoNET_Data)
	}
	await flushStoreSystemData()
	return bo
}

export function mergeLocalLocaleLanguageOntoChainProfile(
	chainBeamio: beamio,
	localBeamio?: beamio | null,
): beamio {
	if (chainBeamio.localeCurrencyConfigured) return chainBeamio
	const localLang = localBeamio?.language ?? readBeamioUiLanguageBootstrap()
	if (!localLang) return chainBeamio
	return { ...chainBeamio, language: normalizeBeamioUiLocale(localLang) as ILanguage }
}

/** First launch when chain has no locale JSON: browser defaults → chain + local + UI */
export async function bootstrapProfileLocaleCurrencyIfUnset(
	beamio: beamio,
	privateKeyArmor: string,
): Promise<beamio> {
	if (beamio.localeCurrencyConfigured) {
		writeBeamioUiLanguageBootstrap(normalizeBeamioUiLocale(beamio.language))
		await applyBeamioUiLanguageFromProfile(beamio.language)
		return beamio
	}
	const localLang = CoNET_Data?.beamio?.language ?? readBeamioUiLanguageBootstrap()
	const defaults = localLang
		? {
				...buildBrowserLocaleCurrencyDefaults(),
				language: normalizeBeamioUiLocale(localLang),
			}
		: buildBrowserLocaleCurrencyDefaults()
	const next = await persistBeamioProfileLocaleCurrency(beamio, privateKeyArmor, defaults)
	if (next) return next
	const fallback: beamio = {
		...beamio,
		...defaults,
		localeCurrencyConfigured: true,
	}
	if (CoNET_Data) {
		CoNET_Data.beamio = fallback
		setCoNET_Data(CoNET_Data)
	}
	writeBeamioUiLanguageBootstrap(normalizeBeamioUiLocale(fallback.language))
	await flushStoreSystemData()
	await applyBeamioUiLanguageFromProfile(fallback.language)
	return fallback
}

const aesGcmEncryptWithStored = async (
		plaintext: string,
		password: string,
		stored: Argon2idHash
	): Promise<string> => {
	const key = await deriveAesKeyFromPassword(password, stored)

	// 12 字节随机 IV（GCM 推荐长度）
	const iv = crypto.getRandomValues(new Uint8Array(12))

	const data = enc.encode(plaintext)

	const encrypted = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		key,
		data
	)

	const cipherBytes = new Uint8Array(encrypted)

	// 拼成 iv || ciphertext
	const combined = new Uint8Array(iv.length + cipherBytes.length)
	combined.set(iv, 0)
	combined.set(cipherBytes, iv.length)

	return bytesToB64(combined)
}

export function fromBase64(b64: string): string {
	const bin = atob(b64)
	const bytes = new Uint8Array(bin.length)
	for (let i = 0; i < bin.length; i++) {
		bytes[i] = bin.charCodeAt(i)
	}
	return new TextDecoder().decode(bytes)
}


export const createRecover = async (BeamioName: string, pin: string) => {
	const temp = await createOrGetWallet('')
	if (!temp|| !temp?.mnemonicPhrase|| !temp?.profiles?.length) {
		return null
	}
	const wallet = temp.profiles[0].privateKeyArmor
	const recoverCode =  generateCODE('')
	const stored = await hashPasswordBrowser(pin)

	const phraseBase64 = toBase64(temp.mnemonicPhrase)

	const img = await aesGcmEncryptWithStored(phraseBase64, recoverCode.code, stored)
	const img1 = await aesGcmEncryptWithStored(phraseBase64, pin, stored)

	const storageEncryptedImg = toBase64(JSON.stringify({stored, img}))
	temp.encryptedString = recoverCode.code
	const obj = { pin, recoverCode: recoverCode.code, qrCode: recoverCode.code, temp}
	// const kkk = decodeStoredCBOR(qrCode)
	// const ks = verifyPasswordBrowser(passcode, stored)
	const hash = ethers.solidityPackedKeccak256(['string'], [BeamioName])
	const storageEncryptedImg1 = toBase64(JSON.stringify({stored, img: img1}))
	// const dddd = fromBase64(storageEncryptedImg)
	// const kkk = JSON.parse(dddd)
	// const mnemonicPhraseBase64 = await aesGcmDecryptWithStored (kkk.img, pin + recoverCode.code, kkk.stored)
	// const mnemonicPhraseB = fromBase64(mnemonicPhraseBase64)
	// console.log (mnemonicPhraseB)
	const registered = await newUser(BeamioName, [{hash: recoverCode.hash, encrypto: storageEncryptedImg}, {hash, encrypto: storageEncryptedImg1}], wallet)
	if (!registered) return null

	return obj
}

/**
 * Coupon open-claim deep link: auto 12-word wallet + `temp_${uuid}` registry, no user PIN/tag input.
 * Replaces incomplete local wallet (no mnemonic) via `createOrGetWallet(null, true)`.
 */
export const provisionTempCouponClaimWallet = async (): Promise<encrypt_keys_object | null> => {
	const temp = await createOrGetWallet(null, true)
	if (!temp?.mnemonicPhrase || !temp?.profiles?.length) return null

	const wallet = temp.profiles[0].privateKeyArmor
	if (!isValidEthersPrivateKey(wallet)) return null

	const beamioTag = `temp_${uuid62.v4()}`
	const recoverCode = generateCODE('')
	const pin = uuid62.v4()
	const stored = await hashPasswordBrowser(pin)
	const phraseBase64 = toBase64(temp.mnemonicPhrase)
	const img = await aesGcmEncryptWithStored(phraseBase64, recoverCode.code, stored)
	const img1 = await aesGcmEncryptWithStored(phraseBase64, pin, stored)
	const storageEncryptedImg = toBase64(JSON.stringify({ stored, img }))
	temp.encryptedString = recoverCode.code
	const hash = ethers.solidityPackedKeccak256(['string'], [beamioTag])
	const storageEncryptedImg1 = toBase64(JSON.stringify({ stored, img: img1 }))

	const registered = await newUser(
		beamioTag,
		[
			{ hash: recoverCode.hash, encrypto: storageEncryptedImg },
			{ hash, encrypto: storageEncryptedImg1 },
		],
		wallet,
	)
	if (!registered) return null

	const keyID = temp.profiles[0].keyID
	let userInfo: beamio | null = null
	for (let attempt = 0; attempt < 20; attempt++) {
		userInfo = await getUserInfo(keyID)
		if (userInfo) break
		await new Promise((resolve) => setTimeout(resolve, 1000))
	}

	temp.beamio = userInfo ?? buildMinimalBeamioFromAccountName(beamioTag)
	temp.beamio.accountName = beamioTag
	setCoNET_Data(temp)
	await storeSystemData()
	return temp
}


export const restoreWithRedeem = async (recoveryCode: string, pin: string) => {
	const hash = ethers.solidityPackedKeccak256(['string'], [recoveryCode])

	try {
		const hashedImg: string = await beamioAccountSC.getBase64ByNameHash(hash)
		const objStr = fromBase64(hashedImg)
		const obj = JSON.parse(objStr)

		if (!obj?.img || !obj?.stored) {
			return false
		}

		const mnemonicPhrase = await aesGcmDecryptWithStored (obj.img, pin + recoveryCode, obj.stored)
		const mnemonicPhraseB = fromBase64(mnemonicPhrase)
		const temp = await createOrGetWallet(mnemonicPhraseB)
		if (!temp||!temp?.profiles?.length) {
			return false
		}
		const profile: profile = temp.profiles[0]
		const beamio = await getUserInfo(profile.keyID)
		if (beamio) {
			temp.beamio = beamio
		}
		
		return temp
	} catch (ex: any) {
		console.log(`checkBeamioAccount error ${ex.message}`)
		return false
	}
}

export const getUserInfo = async (keyID: string) => getUserInfoFromRegistry(beamioAccountSC, keyID)

export const restoreWithUserPin = async (username: string, pin: string, test = false) => {
	try {
		const accountName = username.trim()
		if (!accountName) return false

		let recoverHit = await fetchRecoverPayloadByAccountName(accountName, beamioAccountSC)
		let legacyEncodedForMigrate: string | undefined

		if (!recoverHit) {
			const legacyHit = await fetchRecoverPayloadByAccountName(accountName, legacyBeamioAccountSC)
			if (!legacyHit) {
				return false
			}
			recoverHit = legacyHit
			legacyEncodedForMigrate = legacyHit.encoded
		}

		const obj = recoverHit.payload

		const mnemonicPhrase = await aesGcmDecryptWithStored (obj.img, pin, obj.stored)
		const mnemonicPhraseB = fromBase64(mnemonicPhrase)

		const key = createKeyHDWallets(mnemonicPhraseB)
		if (!key) {
			return
		}
		if (test) {
			return true
		}
		const temp = await createOrGetWallet(mnemonicPhraseB)

		if (!temp||!temp?.profiles?.length) {
			return false
		}

		const profile: profile = temp.profiles[0]

		if (legacyEncodedForMigrate) {
			const privateKey = temp.profiles[0].privateKeyArmor
			if (isValidEthersPrivateKey(privateKey)) {
				const { ok, beamio: migratedBeamio } = await migrateLegacyRecoverToNewRegistry(
					accountName,
					legacyEncodedForMigrate,
					privateKey,
					profile.keyID
				)
				temp.beamio = migratedBeamio
				if (!ok) {
					console.warn(`[restoreWithUserPin] legacy AccountRegistry migrate (addUser) failed for @${accountName}`)
				}
			} else if (!temp.beamio) {
				temp.beamio = buildMinimalBeamioFromAccountName(accountName)
			}
		}

		const onchainBeamio = await getUserInfo(profile.keyID)
		if (onchainBeamio) {
			temp.beamio = onchainBeamio
		} else if (!temp.beamio) {
			temp.beamio = buildMinimalBeamioFromAccountName(accountName)
		}
		if (obj.recoverData) {
			;(temp as any).recoveredBusinessDraft = obj.recoverData
		}

		return temp
	} catch (ex: any) {
		console.log(`checkBeamioAccount error ${ex.message}`)
		return false
	}
}

function workerHitToSearchResult(hit: Record<string, unknown>): searchResult {
	return {
		username: String(hit.username ?? hit.accountName ?? ''),
		address: String(hit.address ?? ''),
		image: String(hit.image ?? ''),
		first_name: String(hit.first_name ?? hit.firstName ?? ''),
		last_name: String(hit.last_name ?? hit.lastName ?? ''),
		created_at: typeof hit.created_at === 'number' ? hit.created_at : Number(hit.created_at) || 0,
		follow_count: String(hit.follow_count ?? ''),
		follower_count: String(hit.follower_count ?? ''),
	} as searchResult
}

function searchResultToBeamioTagBasicMetadata(r: searchResult): BeamioTagBasicMetadata {
	return {
		username: String(r.username ?? ''),
		address: String(r.address ?? ''),
		image: String(r.image ?? ''),
		first_name: String(r.first_name ?? ''),
		last_name: String(r.last_name ?? ''),
		created_at: typeof r.created_at === 'number' ? r.created_at : Number(r.created_at) || 0,
		follow_count: String(r.follow_count ?? ''),
		follower_count: String(r.follower_count ?? ''),
	}
}

function beamioTagBasicMetadataToSearchResult(m: BeamioTagBasicMetadata): searchResult {
	return {
		username: m.username,
		address: m.address,
		image: m.image,
		first_name: m.first_name,
		last_name: m.last_name,
		created_at: m.created_at,
		follow_count: m.follow_count,
		follower_count: m.follower_count,
	} as searchResult
}

/**
 * @deprecated Prefer BeamioTag Worker IDB. Kept only for one-shot read of old LS during migration.
 */
function rememberSearchUsersIfTrustworthy(keyword: string, live: { results?: searchResult[] } | null) {
	const q = keyword.trim()
	if (!q || !live?.results?.length) return
	if (!ethers.isAddress(q)) return
	const first = live.results[0]
	if (!first?.address) return
	const qAddrNorm = ethers.getAddress(q).toLowerCase()
	if (first.address.toLowerCase() === qAddrNorm) {
		rememberBeamioTagBasicMetadata(searchResultToBeamioTagBasicMetadata(first))
	}
}

/**
 * search-users via BeamioTag Worker serverDB (IndexedDB local-first).
 * All UI call sites keep `searchUsername` — network + IDB live in the Worker when ready.
 */
export async function searchUsernameStaleWhileRevalidate(
	keyward: string,
	opts?: { forceNetwork?: boolean },
): Promise<{ results?: searchResult[] } | null> {
	const raw = (keyward ?? '').trim()
	if (!raw) return { results: [] }

	if (!opts?.forceNetwork && ethers.isAddress(raw)) {
		const cached = peekBeamioTagBasicMetadataForQuery(raw)
		if (cached) {
			void searchBeamioTagRemote(raw).then((live) => {
				if (live?.results?.length) {
					rememberSearchUsersIfTrustworthy(raw, {
						results: live.results.map((h) => workerHitToSearchResult(h)),
					})
				}
			})
			return { results: [beamioTagBasicMetadataToSearchResult(cached)] }
		}
	}

	const viaWorker = await searchBeamioTagRemote(raw)
	if (!viaWorker) return null
	const results = (viaWorker.results ?? []).map((h) => workerHitToSearchResult(h))
	if (raw && results.length) {
		rememberSearchUsersIfTrustworthy(raw, { results })
	}
	return { results }
}

export const searchUsername = (keyward: string) => searchUsernameStaleWhileRevalidate(keyward)

export { peekBeamioTagBasicMetadataForQuery, rememberBeamioTagBasicMetadata }
export type { BeamioTagBasicMetadata }

export const getFollowStatus = async (wallet: string, followAddress: string) => {
	//		isFollowingAddress

	const params = new URLSearchParams({wallet, followAddress}).toString()
	const Url = `${followStatusUrl}?${params}`
	try {
		const res = await fetch(Url, {method: 'GET'})
		if (res.status !== 200) {
			return null
		}
		return await res.json()
	} catch (ex: any) {
		return null
	}
	
}

export const removeFollowing = async (privateKey: string, followAddress: string) => {
	const Url = removeFollowingUrl
	const wallet = new ethers.Wallet(privateKey)

	try {
		const body = {
			wallet: wallet.address,
			followAddress,
			signMessage: await wallet.signMessage(wallet.address)
		}

		const resp = await fetch(Url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(body)
		})

		if (!resp.ok) {
			return false
		}

		const json = await resp.json()
		return true
	} catch (err) {
		console.error("removeFollowing error:", err)
	}
	return false
}

export const addFollowing = async (privateKey: string, followAddress: string) => {
	const Url = addFollowingUrl
	const wallet = new ethers.Wallet(privateKey)

	try {
		const body = {
			wallet: wallet.address,
			followAddress,
			signMessage: await wallet.signMessage(wallet.address)
		}

		const resp = await fetch(Url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(body)
		})

		if (!resp.ok) {
			return false
		}

		const json = await resp.json()
		return true
	} catch (err) {
		console.error("addFollowing error:", err)
	}
	return false
}

export const getMyFollowStatus = async (wallet: string) => {
	const params = new URLSearchParams({wallet}).toString()
	const Url = `${myFollowStatusUrl}?${params}`
	try {
		const res = await fetch(Url, {method: 'GET'})
		const data = await res.json()
		if (res.status !== 200) {
			console.log(`getMyFollowStatus Error!, status code: ${data}`)
			return null
		}
		return data
	} catch (ex: any) {
		return null
	}
}

const RegenerateUser = async (beamio: beamio, recoverData:IAccountRecover[], privateKey: string) => {
	
	const signWallet = new ethers.Wallet(privateKey)
	const signMessage = await signWallet.signMessage(signWallet.address)
	const Url = storageNewUser
	const lastName = encodeRegistryLastNameWithLocaleSetup(
		beamio.lastName ?? '',
		buildLocaleCurrencySetupPayload({ ...beamio, tax: beamio.tax ?? '0' }),
	)
	try {
		const body = {
			accountName: beamio.accountName,
			recover: recoverData,
			wallet: signWallet.address,
			signMessage,
			isUSDCFaucet: beamio.isUSDCFaucet,
			darkTheme: beamio.darkTheme,
			isETHFaucet: beamio.isETHFaucet,
			firstName: beamio.firstName,
			lastName: lastName,
			pgpKeyID: beamio.pgpPublicKeyID ?? '',
			pgpKey: beamio.pgpPublicKeyArmor ?? ''
		}

		const resp = await fetch(Url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(body)
		})

		if (!resp.ok) {
			return false
		}

		const json = await resp.json()
		return true
	} catch (err) {
		console.error("newUser error:", err)
	}
	return false
}

export const RegenerateRecover = async (mnemonicPhrase: string, beamio: beamio, pin: string, privateKey: string) => {
	await new Promise(executor => setTimeout(() => executor(true), 1000))
	const recoverCode =  generateCODE('')
	const stored = await hashPasswordBrowser(pin)
	const phraseBase64 = toBase64(mnemonicPhrase)
	const img = await aesGcmEncryptWithStored (phraseBase64, recoverCode.code, stored)
	const img1 = await aesGcmEncryptWithStored (phraseBase64, pin, stored)

	const storageEncryptedImg = toBase64(JSON.stringify({stored, img}))
	const obj = { pin, recoverCode: recoverCode.code, qrCode: recoverCode.code}
	const hash = ethers.solidityPackedKeccak256(['string'], [beamio.accountName])
	const storageEncryptedImg1 = toBase64(JSON.stringify({stored, img: img1}))
	const result = await RegenerateUser(beamio, [{hash: recoverCode.hash, encrypto: storageEncryptedImg}, {hash, encrypto: storageEncryptedImg1}], privateKey)
	if (!result) {
		return null
	}
	return obj
}


export const getFololowsData = async (wallet: string) => {
	const params = new URLSearchParams({wallet}).toString()
	const Url = `${getFollowersUrl}?${params}`
	try {
		const res = await fetch(Url, {method: 'GET'})
		const data = await res.json()
		if (res.status !== 200) {
			console.log(`getMyFollowStatus Error!, status code: ${data}`)
			return null
		}
		return data
	} catch (ex: any) {
		return null
	}
	
}

//		curl -v "https://ipfs.conet.network/api/getFragment?hash=0x5de59d1bc6d7e11ef2c304163773d80089f39802cc77a9b3944fa4ea8fdbe42c"

export const postToIPFS = async (profile: profile, image: string): Promise<string | null> => {
	const url = `${ipfsEndpoint}storageFragment`
	const wallet = new ethers.Wallet(profile.privateKeyArmor)
	const hash = keccak256(toUtf8Bytes(image))
	try {
		const body = {
			wallet: wallet.address,
			image,
			signMessage: await wallet.signMessage(wallet.address)
		}

		const resp = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(body)
		})

		const respText = await resp.text()

		if (!resp.ok) {
			let errMsg = `IPFS upload failed: ${resp.status} ${resp.statusText}`
			try {
				const parsed = respText ? JSON.parse(respText) : null
				if (parsed?.error) errMsg = parsed.error
			} catch (_) {
				if (respText) errMsg += ` - ${respText.slice(0, 200)}`
			}
			console.error("postToIPFS error:", errMsg)
			throw new Error(errMsg)
		}

		// Server returns 200 with empty body on success; parse JSON only if body present
		if (respText) {
			try {
				const data = JSON.parse(respText)
				if (data?.error) {
					console.error("postToIPFS error:", data.error)
					throw new Error(data.error)
				}
			} catch (e: any) {
				if (e instanceof SyntaxError) {
					// Non-JSON body, treat as success (e.g. empty or plain text)
				} else {
					throw e
				}
			}
		}

		// Permanent local cache keyed by hash (local-first library).
		void import('@/utils/ipfsImageLibrary')
			.then(({ putLocalIpfsImageFromDataUrl }) => putLocalIpfsImageFromDataUrl(hash, image))
			.catch(() => {})

		return hash
	} catch (err: any) {
		console.error("postToIPFS error:", err)
		throw err instanceof Error ? err : new Error(err?.message ?? "IPFS upload failed")
	}
}
