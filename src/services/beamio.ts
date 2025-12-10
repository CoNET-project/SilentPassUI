import { CoNET_Data, setCoNET_Data } from '@/utils/globals'
import {ethers} from 'ethers' 
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
	conetProvider,
	localDatabaseName,

} from "../utils/constants"

import beamioAccountABI from '@/services/ABI/beamio-AccountRegistry.json'
import { randomBytes } from '@noble/hashes/utils.js'
import contracts from "../utils/contracts"
import { argon2id } from '@noble/hashes/argon2.js'
import { encode as cborEncode, decode as cborDecode } from 'cbor-x'


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

const USDCContract_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const baseEndpoint = new ethers.JsonRpcProvider(
	'https://1rpc.io/base',
	{
		name: "base",
		chainId: 8453
	}
)
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

const getBalance = async (address: string) => {
	if (!address) return null

	try {


		const [usdc, eth, req] = await Promise.all([
			SC.balanceOf(address),
			baseEndpoint.getBalance(address),
			fetch(getOraclesEndPoint, {method: 'GET'})
		])
		if (req.status == 200 ) {
			const oracle = await req.json()
			const ret = {
				eth: ethers.formatUnits(eth, 18).toString(),
				usdc: ethers.formatUnits(usdc, 6).toString(),
				oracle
				
			}
			return ret
		}
		

	} catch (err) {
		console.error('getBalance fetch error:', err)
		return null
	}
}

const duplicate = contracts.Duplicate
const duplicate_readOnly = new ethers.Contract(duplicate.address, duplicate.abi, conetDepinProvider)

const isLocal = false
const remote = 'https://api.settleonbase.xyz'
const local = 'http://localhost:4088'
const beamioApi = 'https://beamio.app'

const getOraclesEndPoint = `${beamioApi}/api/getOracle`
const getFaucetEndpoint = isLocal ? `${local}/api/BeamioFaucet` : `${remote}/api/BeamioFaucet`

const storageNewUser = `${beamioApi}/api/addUser`
const searchUrl = `${beamioApi}/api/search-users`
const followStatusUrl = `${beamioApi}/api/getFollowStatus`
const removeFollowingUrl = `${beamioApi}/api/removeFollow`
const addFollowingUrl = `${beamioApi}/api/addFollow`

const toBase64 = (s: string) => {
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

	// 2) 金额 & 时间窗（现在 - 1s 到 24h 后）
	const value = amount
	const now = BigInt(Math.floor(Date.now() / 1000))
	const validAfter = now - BigInt(60)
	const validBefore = now + BigInt(60)    

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


export const estimateGasUSDC = async (amount: number, to: string) => {
	if (!CoNET_Data?.profiles?.length) {
		return null
	}
	const privateKey = CoNET_Data.profiles[0].privateKeyArmor
	const wallet = new ethers.Wallet(privateKey, baseEndpoint)
	const sc = new ethers.Contract(USDCContract_BASE, usdc_abi, wallet)
	const _amount = ethers.parseUnits(amount.toFixed(2), 6)
	try {
		const [gas, price, req] = await Promise.all([
			sc.transfer.estimateGas(to||contracts.beamioConet.address, _amount),
			baseEndpoint.getFeeData(),
			fetch(getOraclesEndPoint, {method: 'GET'})
		])

		if (req.status === 200) {
			const oracle = await req.json()
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
export const formatWithThousands = (n: string | number): string => {
	const num = Number(n)
	if (isNaN(num)) return "0.00"

	const [intPart, decPart = "00"] = num.toFixed(2).split(".")
	const intWithCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
	return `${intWithCommas}.${decPart}`
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
const initDuplicate = async (temp: encrypt_keys_object): Promise<encrypt_keys_object|null> => {
	
	temp._duplicateCode = temp?._duplicateCode || uuid62.v4()
	temp.duplicateCodeHash = ethers.solidityPackedKeccak256(['string'], [temp._duplicateCode])
	temp.duplicateMnemonicPhrase = temp.mnemonicPhrase


	if (!temp?.duplicateAccount) {
		const profiles = temp.profiles
		const message = JSON.stringify({ walletAddress: profiles[0].keyID, hash: temp.duplicateCodeHash, data: '', channelPartners: temp.ChannelPartners})
		const wallet = new ethers.Wallet(profiles[0].privateKeyArmor)
		const signMessage = await wallet.signMessage(message)
		const sendData = {
		  	message, signMessage
		}
	
		const result = await postToEndpoint(duplicateAPI, true, sendData)
		if (!result|| !result?.status) {
			console.log(`initDuplicate Error!`, result?.error)
			return temp
		}
		console.log(`initDuplicate success!`, result?.status)

		temp.duplicateAccount = {
			privateKeyArmor: profiles[0].privateKeyArmor,
			tokens: initProfileTokens(),
			publicKeyArmor: '',
			referrer: '',
			keyID: result.status,
			isNode: false,
			index: 0,
			hdPath: null
		}
		
	} else {
		const keyID = temp.profiles[0].keyID
		const duplicateStatus = await getDuplicateOwnership(temp.duplicateAccount.keyID, keyID)
		if (duplicateStatus === false) {
			
			return null
		}
	}

	if (!temp?.duplicatePassword) {
		temp.duplicateCode = ''
	}

	return temp

}

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
  


	tmpData = await initDuplicate(tmpData)
	if (!tmpData) {
			return
	}
  
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
  const database = PouchDB(localDatabaseName, { auto_compaction: true });

  try {
    const doc = await database.get("init", { latest: true });
    const data = JSON.parse(Buffer.from(doc.title, "base64").toString());
    setCoNET_Data(data);
	return data
  } catch (ex) {
    console.log(
      `checkStorage have no CoNET data in IndexDB, INIT CoNET data`
    )
	return null
  }
}

const storageHashData = async (docId: string, data: string) => {
  const database = PouchDB(localDatabaseName, { auto_compaction: true });

  let doc: any;
  try {
    doc = await database.get(docId, { latest: true });

    try {
      await database.put({ _id: docId, title: data, _rev: doc._rev });
    } catch (ex) {
      console.log(`put doc storageHashData Error!`, ex);
    }
  } catch (ex: any) {
    if (/^not_found/.test(ex.name)) {
      try {
        await database.post({ _id: docId, title: data });
      } catch (ex) {
        console.log(`create new doc storageHashData Error!`, ex);
      }
    } else {
      console.log(`get doc storageHashData Error!`, ex);
    }
  }
}

export const storeSystemData = async () => {
  if (!CoNET_Data) {
    return;
  }
  const temp = CoNET_Data

  try {
    await storageHashData(
		"init",
		Buffer.from(customJsonStringify(temp)).toString("base64")
    );
  } catch (ex) {
    console.log(`storeSystemData storageHashData Error!`, ex);
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

export	const isStandalone =
	window.matchMedia?.('(display-mode: standalone)').matches ||
	// iOS PWA
	(window.navigator as any).standalone === true;


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
	const usdcToUSD = usdc * Number(ba.oracle.eth.usdc)
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
	address: '0x09dfed722FBD199E9EC6ece19630DE02692eF572',
	network: 'CONET DePIN',
	abi: beamioAccountABI,
	provider: new ethers.JsonRpcProvider('https://mainnet-rpc.conet.network'),
	
}

const beamioAccountSC = new ethers.Contract(beamioAccountContract.address, beamioAccountContract.abi, beamioAccountContract.provider)



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

const verifyPasswordBrowser = (
	password: string,
	stored: Argon2idHash
): boolean => {
	if (stored.algo !== 'argon2id') return false

	const salt = b64decode(stored.salt)
	const target = b64decode(stored.hash)

	const hash = argon2id(
		enc.encode(password),
		salt,
		{
			m: stored.m,
			t: stored.t,
			p: stored.p,
			dkLen: target.length
		}
	)

	return timingSafeEqualUint8(hash, target)
}

function encodeStoredToBase64(stored: any): string {
	const json = JSON.stringify(stored)
	const bytes = new TextEncoder().encode(json)
	return btoa(String.fromCharCode(...bytes))
}

function decodeStoredFromBase64(b64: string): any {
	const binary = atob(b64)
	const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
	const json = new TextDecoder().decode(bytes)
	return JSON.parse(json)
}

export const checkBeamioAccountAPI = async(preBeamio: string): Promise<boolean> => {
	try {
		const isExits = await beamioAccountSC.isAccountNameAvailable(preBeamio)
		return isExits
	} catch (ex: any) {
		console.log(`checkBeamioAccount error ${ex.message}`)
		
	}
	return true
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

export const postBeamio = async (beamio: beamio, privateKey: string) => {
	const Url = storageNewUser
	const signWallet = new ethers.Wallet(privateKey)
	const signMessage = await signWallet.signMessage(signWallet.address)
	try {
		const body = {
			accountName: beamio.accountName,
			wallet: signWallet.address,
			image: beamio.image,
			isUSDCFaucet: beamio.isUSDCFaucet,
			darkTheme: beamio.darkTheme,
			isETHFaucet: beamio.isETHFaucet,
			firstName: beamio.firstName,
			lastName: beamio.lastName,
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

function fromBase64(b64: string): string {
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
	const stored = hashPasswordBrowser(pin)
	
	const phraseBase64 = toBase64(temp.mnemonicPhrase)
	
	const img = await aesGcmEncryptWithStored (phraseBase64, pin + recoverCode.code, stored)
	const img1 = await aesGcmEncryptWithStored (phraseBase64, pin, stored)

	const storageEncryptedImg = toBase64(JSON.stringify({stored, img}))
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
	await newUser(BeamioName, [{hash: recoverCode.hash, encrypto: storageEncryptedImg}, {hash, encrypto: storageEncryptedImg1}], wallet)

	return obj
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

export const getUserInfo = async (keyID: string) => {
	
	try {
		const userInfo = await beamioAccountSC.getAccount(keyID)
		const bo: beamio = {
			accountName: userInfo?.accountName,
			image: userInfo?.image,
			darkTheme: userInfo?.darkTheme,
			initialLoading: userInfo?.initialLoading,
			isUSDCFaucet: userInfo?.isUSDCFaucet,
			isETHFaucet: userInfo?.isETHFaucet,
			firstName: userInfo?.firstName,
			lastName: userInfo?.lastName,
			createdAt: Number(userInfo?.createdAt)
		}
		return bo
	} catch (ex: any) {
		return null
	}
}

export const restoreWithUserPin = async (username: string, pin: string) => {
	try {
		const hashedImg: string = await beamioAccountSC.getBase64ByAccountName(username)
		const objStr = fromBase64(hashedImg)
		const obj = JSON.parse(objStr)

		if (!obj?.img || !obj?.stored) {
			return false
		}

		const mnemonicPhrase = await aesGcmDecryptWithStored (obj.img, pin, obj.stored)
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