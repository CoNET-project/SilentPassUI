//			beamio.ts

import { CoNET_Data, setCoNET_Data } from '@/utils/globals'
import { applyBeamioUiLanguageFromProfile, getCurrentBeamioUiLocale } from '@/locale/i18n'
import {
	buildBrowserLocaleCurrencyDefaults,
	buildLocaleCurrencySetupPayload,
	encodeRegistryLastNameWithLocaleSetup,
	normalizeBeamioDisplayCurrency,
	normalizeBeamioUiLocale,
	parseBeamioAddedSetupFromRegistryLastName,
} from '@/utils/beamioProfileLocaleCurrency'
import {
	hydrateProfilesWithSessionSecrets,
	ingestSessionPrivateKeyFromProfiles,
	loadedDataHadPersistedSecrets,
	setSessionPrivateKeyArmor,
	stripSecretsForPersistence,
	stripSecretsFromLoadedData,
} from '@/utils/beamioSessionSecrets'
import { markWorkspaceSessionUnlocked } from '@/utils/beamioWorkspaceLock'
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
import { argon2id } from '@noble/hashes/argon2.js'
import { encode as cborEncode, decode as cborDecode } from 'cbor-x'
import beamioConetCoreABI from '@/services/ABI/beamioConetCoreABI.json'
import { parseNodeEX,ParsedNote } from "@/services/currency"
import { baseEndpoint, USDCContract_BASE } from '../utils/constants'
import { BASE_MAINNET_FACTORIES, BEAMIO_ORACLE_CONET, CONET_ACCOUNT_REGISTRY, CONET_RPC_URL } from '@/config/chainAddresses'
import { eip712ChainIdForBeamioUserCard, getCardFactoryGatewayForEip712 } from '@/utils/beamioUserCardChain'
import { isRpcDegraded, reportRpcFailure, isRpcQuotaOrNetworkError } from '@/utils/rpcStatus'
import { withBaseRpc } from '../utils/baseRpc'
import type { VerraBusinessProfileDraft } from '@/utils/verraBusinessProfileLocal'

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

export const getBalance = async (address: string) => {
	if (!address) return null
	// 熔断期仅使用 CoNET 节点（不向 API 服务器请求），withBaseRpc 内部会走 CoNET-only
	try {
		const [usdc, eth, oracle] = await Promise.all([
			withBaseRpc((p) => new ethers.Contract(USDCContract_BASE, usdc_abi as ethers.InterfaceAbi, p).balanceOf(address)),
			withBaseRpc((p) => p.getBalance(address)),
			getOracle(),
		])
		// Always return USDC/ETH once RPC succeeded. Oracle is only for FX metadata; if getOracle() fails,
		// returning null here used to drop a valid balanceOf — Vault / Wallets showed wrong empty or stale values.
		const oracleSafe = oracle ?? { usdc: '1' }
		const oracleForBalance = { ...oracleSafe, eth: { usdc: oracleSafe.usdc ?? '1' } }
		return {
			eth: ethers.formatUnits(eth as bigint, 18).toString(),
			usdc: ethers.formatUnits(usdc as bigint, 6).toString(),
			oracle: oracleForBalance,
		}
	} catch (err) {
		if (isRpcQuotaOrNetworkError(err)) reportRpcFailure()
		// 限流时不再走 API，仅使用 CoNET 节点；非限流时可用 API 兜底
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
const searchUrl = `${beamioApi}/api/search-users`
const followStatusUrl = `${beamioApi}/api/getFollowStatus`
const removeFollowingUrl = `${beamioApi}/api/removeFollow`
const addFollowingUrl = `${beamioApi}/api/addFollow`
const myFollowStatusUrl = `${beamioApi}/api/getMyFollowStatus`
const getFollowersUrl = `${beamioApi}/api/getMyFollowStatus`

/** CoNET 主网 chainId（BUnitAirdrop 部署链） */
const CONET_CHAIN_ID = 224422

/** CoNET BUnitAirdrop 合约地址（与 deployments/conet-addresses.json 一致） */
const CONET_BUNIT_AIRDROP_ADDRESS = '0xFd60936707cb4583c08D8AacBA19E4bfaEE446B8'

/** 检查是否可领取 BeamioBUnits */
export const checkBUnitClaimEligibility = async (address: string): Promise<{ canClaim: boolean; nonce?: string; deadline?: number; error?: string }> => {
	try {
		const res = await fetch(`${beamioApi}/api/checkBUnitClaimEligibility?address=${encodeURIComponent(address)}`)
		const data = await res.json().catch(() => ({}))
		if (!res.ok) return { canClaim: false, error: data?.error ?? res.statusText }
		return {
			canClaim: !!data.canClaim,
			nonce: data.nonce,
			deadline: data.deadline != null ? Number(data.deadline) : undefined,
		}
	} catch (e) {
		return { canClaim: false, error: (e as Error)?.message ?? '请求失败' }
	}
}

/** 使用 EOA 私钥签写 ClaimAirdrop 并提交 claimBUnits 请求 */
export const signAndClaimBUnits = async (
	privateKey: string,
	claimant: string,
	nonce: string | number,
	deadline: number
): Promise<{ success: boolean; txHash?: string; error?: string }> => {
	try {
		const wallet = new ethers.Wallet(privateKey)
		if (wallet.address.toLowerCase() !== ethers.getAddress(claimant).toLowerCase()) {
			return { success: false, error: 'Signer address does not match claimant' }
		}
		const domain = {
			name: 'BUnitAirdrop',
			version: '1',
			chainId: CONET_CHAIN_ID,
			verifyingContract: CONET_BUNIT_AIRDROP_ADDRESS as `0x${string}`,
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
		if (!res.ok) return { success: false, error: data?.error ?? res.statusText }
		return { success: true, txHash: data.txHash }
	} catch (e) {
		return { success: false, error: (e as Error)?.message ?? 'Claim failed' }
	}
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
		return { expired: false, fulfilled: false, error: (e as Error)?.message ?? '请求失败' }
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
		return { success: false, error: 'Please log in to your Beamio account first' }
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
		cardAddress: ethers.getAddress(cardAddr),
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
): Promise<string> {

	if (!CoNET_Data||!CoNET_Data?.profiles?.length) {
		return ''
	}

	const profile = CoNET_Data?.profiles[0]


  	// 1) 签名者
	const privateKey = profile.privateKeyArmor

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

const BEAMIO_ORACLE_ABI = ['function getRate(uint8 c) view returns (uint256)'] as const
const BEAMIO_CURRENCY_CAD = 0

/** 从 CoNET 链上 BeamioOracle 读取 CAD 汇率。getRate(CAD) 返回「1 CAD = X USD」E18。用于顶部 bar 显示 1 CAD ≈ X USDC */
export const getOracleCadUsdcFromConet = async (): Promise<number | null> => {
	try {
		const oracle = new ethers.Contract(BEAMIO_ORACLE_CONET, BEAMIO_ORACLE_ABI, conetDepinProvider)
		const rateRaw = await oracle.getRate(BEAMIO_CURRENCY_CAD) as bigint
		const rate = Number(ethers.formatUnits(rateRaw, 18))
		return rate > 0 ? rate : null
	} catch {
		return null
	}
}


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
			sc.transfer.estimateGas(to||contracts.beamioConet.address, _amount),
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

/** 生成 request 唯一 hash（bytes32），供 URL 与链上 originalPaymentHash 使用 */
export const generateRequestHash = (): string => {
	const seed = uuid62.v4() + '-' + Date.now() + '-' + Math.random().toString(36).slice(2)
	return ethers.keccak256(ethers.toUtf8Bytes(seed))
}


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
	await checkStorage()

  if (secretPhrase|| initAccount ) setCoNET_Data(null)

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

		setSessionPrivateKeyArmor(acc.signingKey.privateKey)

		const mnemonicPhrase =
			acc.mnemonic?.phrase ??
			(secretPhrase && String(secretPhrase).trim() ? String(secretPhrase).trim() : undefined)

		const data = {
			...(mnemonicPhrase ? { mnemonicPhrase } : {}),
			profiles: [profile],
			isReady: true,
			ver: 0,
			nonce: 0,
		} as encrypt_keys_object

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

export const checkStorage = async (checkcacheStorage = true) => {
  try {
    const database = PouchDB(localDatabaseName, { auto_compaction: true });
    const doc = await database.get("init", { latest: true });
    const raw = JSON.parse(Buffer.from(doc.title, "base64").toString()) as encrypt_keys_object
    const hadLegacySecrets = loadedDataHadPersistedSecrets(raw)
    const stripped = stripSecretsFromLoadedData(raw)
    const hydrated: encrypt_keys_object = {
      ...stripped,
      profiles: hydrateProfilesWithSessionSecrets(stripped.profiles),
    }
    setCoNET_Data(hydrated)
    if (hadLegacySecrets) {
      void flushStoreSystemData()
    }
    return hydrated
  } catch {
   
    return null
  }
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

/** 从 Cache Storage 恢复（IndexedDB 为空时） */
const cacheStorageRestore = async (): Promise<string | null> => {
  try {
    if (typeof caches === 'undefined' || !CACHE_WALLET_URL) return null
    const cache = await caches.open('beamio-wallet-v1')
    const req = new Request(CACHE_WALLET_URL, { method: 'GET' })
    const res = await cache.match(req)
    if (!res) return null
    return await res.text()
  } catch {
    return null
  }
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
export const storeSystemData = async () => {
  if (!CoNET_Data) return
  const temp = stripSecretsForPersistence(CoNET_Data)
  if (!temp) return
  if (temp.profiles) temp.profiles = ensureFlatProfiles(temp.profiles)
  if ((CoNET_Data as any)?.cardRedeems) (temp as any).cardRedeems = (CoNET_Data as any).cardRedeems
  const dataB64 = Buffer.from(customJsonStringify(temp)).toString("base64")
  cacheStorageBackup(dataB64)
  if (storeSystemDataTimer) clearTimeout(storeSystemDataTimer)
  storeSystemDataTimer = setTimeout(async () => {
    storeSystemDataTimer = null
    try {
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
  const temp = stripSecretsForPersistence(CoNET_Data)
  if (!temp) return
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

const deriveAesKeyFromPassword = (
	password: string,
	stored: Argon2idHash
): Promise<CryptoKey> => {
	const passwordBytes = enc.encode(password)
	const salt = b64ToBytes(stored.salt)

	// 🔧 关键改动：把 noble 返回的 Uint8Array<ArrayBufferLike>
	//            转成标准 Uint8Array（buffer 类型为 ArrayBuffer）
	const keyBytes = Uint8Array.from(
		argon2id(passwordBytes, salt, {
		m: stored.m,
		t: stored.t,
		p: stored.p,
		dkLen: 32
		})
	)

	// 导入为 WebCrypto AES-GCM 密钥
	return crypto.subtle.importKey(
		'raw',
		keyBytes,                // 现在是合法的 BufferSource
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
export const getBalanceProcess = async (keyID: string,  setBalance: (val: number) => void, setUsdcToUsd: (val: number) => void) => {
	if (processing) {
		return
	}
	processing = true
	const ba = await getBalance(keyID)
	if (!ba) {
		processing = false
		return 
	}
	
	const usdc = Number(ba.usdc)

	setBalance(usdc)
	const ethUsdc = typeof ba.oracle?.eth === 'object' && ba.oracle.eth && 'usdc' in ba.oracle.eth
		? ba.oracle.eth.usdc
		: '1'
	const usdcToUSD = usdc * Number(ethUsdc)
	setUsdcToUsd(usdcToUSD)
	processing = false
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

/** 224422 迁移前 AccountRegistry（只读归档 RPC） */
const LEGACY_ACCOUNT_REGISTRY_RPC = 'https://rpc-old.conet.network'
const LEGACY_ACCOUNT_REGISTRY_ADDRESS = '0x4afaca09cf8307070a83836223Ae129073eC92e5'

const beamioAccountSC = new ethers.Contract(beamioAccountContract.address, beamioAccountContract.abi, beamioAccountContract.provider)
const legacyBeamioAccountSC = new ethers.Contract(
	LEGACY_ACCOUNT_REGISTRY_ADDRESS,
	beamioAccountABI,
	new ethers.JsonRpcProvider(LEGACY_ACCOUNT_REGISTRY_RPC)
)

type ValidRecoverStoragePayload = RecoverStoragePayload & {
	stored: Argon2idHash
	img: string
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

export const buildMinimalBeamioFromAccountName = (accountName: string): beamio => ({
	accountName,
	firstName: '',
	lastName: '',
	image: '',
	darkTheme: false,
	isUSDCFaucet: false,
	isETHFaucet: false,
	initialLoading: true,
	createdAt: Date.now(),
	language: getCurrentBeamioUiLocale(),
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

export const getUserInfoFromRegistry = async (
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



const defaultBrowserParams: Argon2idParams = {
	memoryKB: 32 * 1024, // 32 MB
	iterations: 3,
	parallelism: 1,
	hashLen: 32
}



const hashPasswordBrowser = (
	password: string,
	params: Argon2idParams = defaultBrowserParams
): Argon2idHash => {
	const salt = randomBytes(16)

	const hash = argon2id(
		enc.encode(password),
		salt,
		{
			m: params.memoryKB,
			t: params.iterations,
			p: params.parallelism,
			dkLen: params.hashLen
		}
	)

	return {
		algo: 'argon2id',
		v: 19,
		m: params.memoryKB,
		t: params.iterations,
		p: params.parallelism,
		salt: b64encode(salt),
		hash: b64encode(hash)
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

type RecoverBusinessDraft = Pick<
	VerraBusinessProfileDraft,
	'businessType' | 'onboardingTermsAccepted' | 'storeName' | 'category' | 'country' | 'city' | 'province'
> & {
	/** Full Lite onboarding snapshot JSON (stored in account recover payload / persistence layer). */
	onboardingFormJson?: string
}

type RecoverStoragePayload = {
	stored?: Argon2idHash
	img?: string
	recoverData?: RecoverBusinessDraft | null
}

const VERRA_LITE_FORM_JSON_MAX_LEN = 12_000

const sanitizeRecoverBusinessDraft = (
	input?: Partial<VerraBusinessProfileDraft> | null
): RecoverBusinessDraft | null => {
	if (!input || typeof input !== 'object') return null
	const next: RecoverBusinessDraft = {}
	if (input.businessType === 'solo' || input.businessType === 'chain' || input.businessType === 'ngo') {
		next.businessType = input.businessType
	}
	if (typeof input.onboardingTermsAccepted === 'boolean') {
		next.onboardingTermsAccepted = input.onboardingTermsAccepted
	}
	for (const key of ['storeName', 'category', 'country', 'city', 'province'] as const) {
		const value = input[key]
		if (typeof value === 'string') {
			const trimmed = value.trim()
			if (trimmed) next[key] = trimmed
		}
	}
	const formSnapshot = {
		schemaVersion: 'verra_lite_v1' as const,
		businessType:
			input.businessType === 'solo' || input.businessType === 'chain' || input.businessType === 'ngo'
				? input.businessType
				: null,
		onboardingTermsAccepted: typeof input.onboardingTermsAccepted === 'boolean' ? input.onboardingTermsAccepted : null,
		storeName: typeof input.storeName === 'string' ? input.storeName : '',
		category: typeof input.category === 'string' ? input.category : '',
		country: typeof input.country === 'string' ? input.country : '',
		city: typeof input.city === 'string' ? input.city : '',
		province: typeof input.province === 'string' ? input.province : '',
	}
	try {
		const raw = JSON.stringify(formSnapshot)
		if (raw.length <= VERRA_LITE_FORM_JSON_MAX_LEN) {
			next.onboardingFormJson = raw
		}
	} catch {
		/* ignore */
	}
	return Object.keys(next).length > 0 ? next : null
}

const encodeRecoverStoragePayload = (
	stored: Argon2idHash,
	img: string,
	recoverData?: Partial<VerraBusinessProfileDraft> | null
): string => {
	const payload: RecoverStoragePayload = {
		stored,
		img,
		recoverData: sanitizeRecoverBusinessDraft(recoverData),
	}
	return toBase64(JSON.stringify(payload))
}

const decodeRecoverStoragePayload = (encoded: string): RecoverStoragePayload | null => {
	try {
		const obj = JSON.parse(fromBase64(encoded)) as RecoverStoragePayload
		if (!obj || typeof obj !== 'object') return null
		return {
			stored: obj.stored,
			img: typeof obj.img === 'string' ? obj.img : undefined,
			recoverData: sanitizeRecoverBusinessDraft(obj.recoverData),
		}
	} catch {
		return null
	}
}

const getRecoverPayloadByHash = async (hash: string): Promise<RecoverStoragePayload | null> => {
	try {
		const encoded: string = await beamioAccountSC.getBase64ByNameHash(hash)
		return decodeRecoverStoragePayload(encoded)
	} catch {
		return null
	}
}

export const recoverData = async (hash: string): Promise<RecoverBusinessDraft | null> => {
	const payload = await getRecoverPayloadByHash(hash)
	return payload?.recoverData ?? null
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
	await storeSystemData()
	await applyBeamioUiLanguageFromProfile(bo.language)
	return bo
}

export async function bootstrapProfileLocaleCurrencyIfUnset(
	beamio: beamio,
	privateKeyArmor: string,
): Promise<beamio> {
	if (beamio.localeCurrencyConfigured) {
		await applyBeamioUiLanguageFromProfile(beamio.language)
		return beamio
	}
	const defaults = buildBrowserLocaleCurrencyDefaults()
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


export const createRecover = async (
	BeamioName: string,
	pin: string,
	recoverData?: Partial<VerraBusinessProfileDraft> | null
) => {
	const temp = await createOrGetWallet('', true)
	if (!temp || !temp?.mnemonicPhrase || !temp?.profiles?.length) {
		return null
	}
	const wallet = temp.profiles[0].privateKeyArmor
	const recoverCode =  generateCODE('')
	const stored = hashPasswordBrowser(pin)
	
	const phraseBase64 = toBase64(temp.mnemonicPhrase)
	
	const img = await aesGcmEncryptWithStored (phraseBase64, recoverCode.code, stored)
	const img1 = await aesGcmEncryptWithStored (phraseBase64, pin, stored)

	const storageEncryptedImg = encodeRecoverStoragePayload(stored, img, recoverData)
	temp.encryptedString = recoverCode.code
	const obj = { pin, recoverCode: recoverCode.code, qrCode: recoverCode.code, temp}
	const hash = ethers.solidityPackedKeccak256(['string'], [BeamioName])
	const storageEncryptedImg1 = encodeRecoverStoragePayload(stored, img1, recoverData)
	const registered = await newUser(
		BeamioName,
		[
			{ hash: recoverCode.hash, encrypto: storageEncryptedImg },
			{ hash, encrypto: storageEncryptedImg1 },
		],
		wallet,
	)
	if (!registered) {
		return null
	}

	ingestSessionPrivateKeyFromProfiles(temp.profiles)
	if (!temp.beamio) {
		temp.beamio = buildMinimalBeamioFromAccountName(BeamioName)
	}
	await flushStoreSystemData()

	return obj
}


export const restoreWithRedeem = async (recoveryCode: string, pin: string) => {
	const hash = ethers.solidityPackedKeccak256(['string'], [recoveryCode])

	try {
		const obj = await getRecoverPayloadByHash(hash)

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
		if (obj.recoverData) {
			;(temp as any).recoveredBusinessDraft = obj.recoverData
		}
		
		return temp
	} catch (ex: any) {
		console.log(`checkBeamioAccount error ${ex.message}`)
		return false
	}
}

export const getUserInfo = async (keyID: string) => getUserInfoFromRegistry(beamioAccountSC, keyID)

/** Bounded registry poll; falls back to minimal profile when accountName is known (fresh onboarding). */
export const fetchUserInfoWithRetry = async (
	keyID: string,
	options?: { maxAttempts?: number; intervalMs?: number; accountNameFallback?: string },
): Promise<beamio | null> => {
	const maxAttempts = options?.maxAttempts ?? 25
	const intervalMs = options?.intervalMs ?? 1000
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const info = await getUserInfo(keyID)
		if (info) return info
		if (attempt < maxAttempts - 1) {
			await new Promise((resolve) => setTimeout(resolve, intervalMs))
		}
	}
	const name = options?.accountNameFallback?.trim()
	return name ? buildMinimalBeamioFromAccountName(name) : null
}

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

		ingestSessionPrivateKeyFromProfiles(temp.profiles)
		markWorkspaceSessionUnlocked()
		temp.profiles = hydrateProfilesWithSessionSecrets(temp.profiles)
		setCoNET_Data(temp)
		
		return temp
	} catch (ex: any) {
		console.log(`checkBeamioAccount error ${ex.message}`)
		return false
	}
}

export const searchUsername = async (keyward: string) => {
	const params = new URLSearchParams({keyward}).toString()
	const requestUrl = `${searchUrl}?${params}`
	try {
		const res = await fetch(requestUrl, {method: 'GET'})

		
		if (res.status !== 200) {
			return null
		}
		return await res.json()
		

	} catch (ex) {
		
	}
	return null
}

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

export const RegenerateUser = async (beamio: beamio, recoverData:IAccountRecover[], privateKey: string) => {
	
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

/**
 * Update recover payload for the account-name keyed blob only (PIN restore path), embedding new business draft.
 * Re-wraps existing `stored` + `img` so the user keeps the same encryption; only `recoverData` changes.
 */
export const pushAccountRecoverBusinessDraft = async (
	beamioAccount: beamio,
	privateKey: string,
	businessDraft: Partial<VerraBusinessProfileDraft>
): Promise<{ ok: boolean; error?: string }> => {
	try {
		const userName = beamioAccount.accountName?.trim()
		if (!userName) return { ok: false, error: 'Account name missing' }
		const hashedImg: string = await beamioAccountSC.getBase64ByAccountName(userName)
		const obj = decodeRecoverStoragePayload(hashedImg)
		if (!obj?.stored || !obj.img) return { ok: false, error: 'Recover payload not found' }
		const nextEnc = encodeRecoverStoragePayload(obj.stored, obj.img, businessDraft)
		const nameHash = ethers.solidityPackedKeccak256(['string'], [userName])
		const ok = await RegenerateUser(beamioAccount, [{ hash: nameHash, encrypto: nextEnc }], privateKey)
		return ok ? { ok: true } : { ok: false, error: 'Server rejected recover update' }
	} catch (e: any) {
		return { ok: false, error: e?.shortMessage || e?.message || '未知错误' }
	}
}

export const RegenerateRecover = async (mnemonicPhrase: string, beamio: beamio, pin: string, privateKey: string) => {
	await new Promise(executor => setTimeout(() => executor(true), 1000))
	const recoverCode =  generateCODE('')
	const stored = hashPasswordBrowser(pin)
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

		if (respText) {
			try {
				const data = JSON.parse(respText)
				if (data?.error) {
					console.error("postToIPFS error:", data.error)
					throw new Error(data.error)
				}
			} catch (e: any) {
				if (e instanceof SyntaxError) {
					// Non-JSON body, treat as success
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
		const msg = err?.message ?? String(err)
		if (/failed to fetch|networkerror|load failed/i.test(msg)) {
			throw new Error(
				'Background upload failed: network error reaching ipfs.conet.network. Check your connection and try again.'
			)
		}
		throw err instanceof Error ? err : new Error(msg || "IPFS upload failed")
	}
}

//			pgp workflow
//			regiest node				keyID to node KeyID	{hash: ethers.solidityPackedKeccak256(['string'], [keyID]), encrypto: nodeKeyID} 
//			regiest publicKey			keyID to pgpKey		{hash: ethers.solidityPackedKeccak256(['string'], [keyID + 'armor']), encrypto: pgpKeyArmor}
//			regiest keyID in beamio	

const beamioConetContract = {
	address: '0xCE8e2Cda88FfE2c99bc88D9471A3CBD08F519FEd',
	network: 'CONET DePIN',
	abi: beamioConetCoreABI,
	provider: new ethers.JsonRpcProvider(CONET_RPC_URL),
	
}

const CoreContract = new ethers.Contract(beamioConetContract.address, beamioConetContract.abi, beamioConetContract.provider)
export const getCashcodeData = async (cashcodeUrl: string) => {	

	
		if (!cashcodeUrl || typeof cashcodeUrl !== "string") return
	  
		let searchParams: URLSearchParams
	  
		try {
			// 尝试作为完整 URL 解析
			const u = new URL(cashcodeUrl)
			searchParams = u.searchParams
		} catch {
			// 再尝试作为 query string 解析
			try {
				searchParams = new URLSearchParams(cashcodeUrl)
			} catch {
				// 两种都失败 → 非 URL
				return
			}
		}
	  
		const secureCode =
		  searchParams.get("secureCode") ||""
		const cashcode = searchParams.get("cashcode") || ""
		
		if (!secureCode || !cashcode) return 
		
	  
	try {
		const check: IGtCheckMemooo = await CoreContract.getCheckMemo(secureCode)

		if (!check.payHash || check.from === ethers.ZeroAddress) {
			
			return 
		}

		const {noteText, card, payme}:ParsedNote = parseNodeEX(check.node)

		
	
		
		
		if (check.depositHash !== ethers.ZeroHash && payme) {
			payme.depositHash = check.depositHash
		}
		

		return {card, payme}
		
		
	} catch (ex: any) {
		return
		
	}
}

export {
	wipeSessionSecrets,
	hasSessionPrivateKeyArmor,
	getSessionPrivateKeyArmor,
	setSessionPrivateKeyArmor,
	hydrateProfilesWithSessionSecrets,
	ingestSessionPrivateKeyFromProfiles,
} from '@/utils/beamioSessionSecrets'