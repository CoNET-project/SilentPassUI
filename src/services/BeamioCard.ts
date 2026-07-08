import { ethers } from "ethers";
import contracts from "../utils/contracts";
import { baseEndpoint, USDCContract_BASE, beamioApi, BeamioCardFactorySC, conetDepinProvider, CCSA_Card_Address, ASSET_CARD_ADDRESSES } from "../utils/constants";
import { BASE_MAINNET_FACTORIES, BASE_TREASURY, CONET_BUINT, CONET_BUNIT_AIRDROP_ADDRESS, BEAMIO_INDEXER_DIAMOND, CONET_AA_FACTORY } from "@/config/chainAddresses";
import {
	CONET_MAINNET_CHAIN_ID,
	eip712ChainIdForBeamioUserCard,
	getCardFactoryGatewayForEip712,
	providerForBeamioUserCard,
} from "@/utils/beamioUserCardChain";
import { resolveBeamioAaForEoaWithFallback, resolveBeamioAaOnConet } from "@/utils/resolveBeamioAaFromCardFactory";
import { CONET_RPC_URL } from "@/config/chainAddresses";
import { isRpcDegraded, reportRpcFailure, isRpcQuotaOrNetworkError } from "@/utils/rpcStatus";
import {
	peekCardBasicMetadata,
	rememberCardBasicMetadataTrusted,
} from "@/utils/cardBasicMetadataGlobalCache";
import { discoverCategoryFieldsFromMetadataRoot } from "@/utils/discoverMerchantCategory";
import { isApiExcludedUserCard, loadApiExcludedUserCards } from "@/utils/apiExcludedUserCards";
import {
	fetchCardLevelStatNftHoldings,
	userHasAnyCardLevelStatBalance,
	userHasAnyProgramAssetOnCard,
} from "@/utils/beamioCardUserCumulativeStatHoldings";
import { CoNET_Data, setCoNET_Data } from "@/utils/globals";
import { storeSystemData } from "./beamio";
import { cardAbi } from "../utils/abis";
import { searchUsername} from "./beamio"
import usdc_abi from './ABI/usdc_abi.json'
import { tu } from '@/locale/beamioLocale'
import { readSocialExchangeFromMetadata, REWARD_VOUCHER_TOKEN_ID } from '@/utils/socialExchangeMetadata'
import { dispatchDiscoverLikeReward13IfNeeded } from '@/utils/discoverMerchantLikeReward'
//		UID 044073D2151990

/** 购卡请求体：仅允许 string/number，禁止 BigInt，以便 JSON 序列化发给后端 */
export type Icard = { cardAddress: string, userSignature: string, nonce: string, usdcAmount: string, from: string, validAfter: number, validBefore: number }



/**
 * 
 * 	const now = BigInt(Math.floor(Date.now() / 1000))
	const validAfter = now - BigInt(60)
	const validBefore = now + BigInt(60)   
 */
/** 业务 API 返回的卡列表上做防御性二次过滤（exclude 表来自 GET /api/excludedUserCards）。 */
export const filterDisplayUserCards = (cards: UserCardInfo[]): UserCardInfo[] =>
	cards.filter((c) => !isApiExcludedUserCard(c.cardAddress))

const filterUserCardsFromApiLists = filterDisplayUserCards

/** @deprecated 使用 `isApiExcludedUserCard`；保留旧导出名。 */
export const isCardExcludedFromDisplay = (cardAddress: string): boolean =>
	isApiExcludedUserCard(cardAddress)

export { loadApiExcludedUserCards } from "@/utils/apiExcludedUserCards";

export const signOfflineTransferERC3009 = async (
	userPrivateKey: string,
	pointsHuman: string,
	cardAddress: string,
	toEOA?: string
) => {
	const signer = new ethers.Wallet(userPrivateKey)
	const card = ethers.getAddress(cardAddress)
	const to =
		toEOA && ethers.isAddress(toEOA) ? ethers.getAddress(toEOA) : ethers.ZeroAddress
	const { chainId } = await providerForBeamioUserCard(card)
	const factoryGateway = await getCardFactoryGatewayForEip712(card)

	const now = Math.floor(Date.now() / 1000)
	const validAfter = BigInt(now - 60)
	const validBefore = BigInt(now + 360)

	const nonce = ethers.hexlify(ethers.randomBytes(32)) as `0x${string}`

	const tokenID = 0n
	const amount6 = ethers.parseUnits(pointsHuman, 6)
	const maxAmount = amount6
  
	// 1) 对齐 Solidity: keccak256(abi.encode(...))
	const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
	  ["string","address","address","uint256","address","uint256","uint256","uint256","uint256","bytes32"],
	  [
		"OpenTransfer",
		factoryGateway,
		card,
		BigInt(chainId),
		signer.address,
		tokenID,
		maxAmount,
		validAfter,
		validBefore,
		nonce,
	  ]
	)

	const hash = ethers.keccak256(encoded)
	const signature = await signer.signMessage(ethers.getBytes(hash))

	return {
		fromEOA: signer.address,
		to,
		id: tokenID.toString(),
		amount: amount6.toString(),
		maxAmount: maxAmount.toString(),
		validAfter: validAfter.toString(),
		validBefore: validBefore.toString(),
		nonce,
		signature,
		digest: hash,
		cardAddress: card,
	}
}

const cardOpenTransferEndpoint = `${beamioApi}/api/cardOpenTransfer`
const cardOpenTransferPreCheckEndpoint = `${beamioApi}/api/cardOpenTransferPreCheck`

export type CardOpenTransferSignPayload = Awaited<ReturnType<typeof signOfflineTransferERC3009>>

export const postCardOpenTransferPreCheck = async (
	payload: CardOpenTransferSignPayload
): Promise<{ success: boolean; error?: string }> => {
	try {
		const res = await fetch(cardOpenTransferPreCheckEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})
		const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
		if (!res.ok) return { success: false, error: data.error ?? `HTTP ${res.status}` }
		return { success: data.success !== false, error: data.error }
	} catch (e) {
		return { success: false, error: (e as Error)?.message ?? 'Pre-check failed' }
	}
}

export const postCardOpenTransfer = async (
	payload: CardOpenTransferSignPayload
): Promise<{ success: boolean; tx?: string; error?: string }> => {
	try {
		const res = await fetch(cardOpenTransferEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})
		const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; tx?: string }
		if (!res.ok) return { success: false, error: data.error ?? `HTTP ${res.status}` }
		if (data.success === false) return { success: false, error: data.error ?? 'Gift transfer failed' }
		return { success: true, tx: data.tx }
	} catch (e) {
		return { success: false, error: (e as Error)?.message ?? 'Gift transfer failed' }
	}
}

const GIFT_OPEN_CONTAINER_DEADLINE_SEC = 300

async function readOpenRelayedNonce(aaAccount: string, provider: ethers.Provider): Promise<bigint> {
	const base = BigInt(ethers.keccak256(ethers.toUtf8Bytes('beamio.container.module.storage.v07')))
	const raw = await provider.getStorage(ethers.getAddress(aaAccount), base + 1n)
	return BigInt(raw)
}

export type MerchantGiftOpenContainerPayload = {
	account: string
	to: string
	items: { kind: number; asset: string; amount: string; tokenId: string; data: string }[]
	currencyType: number
	maxAmount: string
	nonce: string
	deadline: string
	signature: string
}

/** Merchant Gift：OpenContainer 离线签（EIP-712 OpenContainerMain），由 AA Factory relay 代付 gas。 */
export const signMerchantGiftOpenContainer = async (opts: {
	userPrivateKey: string
	senderAA: string
	recipientEOA: string
	cardAddress: string
	amountHuman: string
	currencyCode: string
}): Promise<MerchantGiftOpenContainerPayload> => {
	const wallet = new ethers.Wallet(opts.userPrivateKey)
	const senderAA = ethers.getAddress(opts.senderAA)
	const card = ethers.getAddress(opts.cardAddress)
	const to = ethers.getAddress(opts.recipientEOA)
	const cur = CURRENCY_TO_ENUM[opts.currencyCode.toUpperCase()]
	if (cur === undefined) throw new Error(`Unsupported currency: ${opts.currencyCode}`)
	const amount6 = ethers.parseUnits(opts.amountHuman, 6)
	if (amount6 <= 0n) throw new Error('Amount must be greater than zero')

	const { provider, chainId } = await providerForBeamioUserCard(card)
	const nonce = await readOpenRelayedNonce(senderAA, provider)
	const deadline = BigInt(Math.floor(Date.now() / 1000) + GIFT_OPEN_CONTAINER_DEADLINE_SEC)
	const domain = {
		name: 'BeamioAccount',
		version: '1',
		chainId,
		verifyingContract: senderAA as `0x${string}`,
	}
	const types = {
		OpenContainerMain: [
			{ name: 'account', type: 'address' },
			{ name: 'currencyType', type: 'uint8' },
			{ name: 'maxAmount', type: 'uint256' },
			{ name: 'nonce', type: 'uint256' },
			{ name: 'deadline', type: 'uint256' },
		],
	}
	const message = {
		account: senderAA,
		currencyType: cur,
		maxAmount: 0n,
		nonce,
		deadline,
	}
	const signature = await wallet.signTypedData(domain, types, message)
	return {
		account: senderAA,
		to,
		items: [{ kind: 1, asset: card, amount: amount6.toString(), tokenId: '0', data: '0x' }],
		currencyType: cur,
		maxAmount: '0',
		nonce: nonce.toString(),
		deadline: deadline.toString(),
		signature,
	}
}

const merchantGiftAatoEoaEndpoint = `${beamioApi}/api/AAtoEOA`

export const postMerchantGiftAAtoEOA = async (opts: {
	openContainerPayload: MerchantGiftOpenContainerPayload
	currency: string
	currencyAmount: string
	cardAddress: string
}): Promise<{ success: boolean; tx?: string; error?: string }> => {
	try {
		const res = await fetch(merchantGiftAatoEoaEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				openContainerPayload: opts.openContainerPayload,
				currency: opts.currency,
				currencyAmount: opts.currencyAmount,
				merchantCardAddress: ethers.getAddress(opts.cardAddress),
				forText: 'Merchant gift',
			}),
		})
		const data = (await res.json().catch(() => ({}))) as {
			success?: boolean
			error?: string
			USDC_tx?: string
			txHash?: string
			tx?: string
		}
		if (!res.ok) return { success: false, error: data.error ?? `HTTP ${res.status}` }
		if (data.success === false) return { success: false, error: data.error ?? 'Gift transfer failed' }
		const tx = data.USDC_tx ?? data.txHash ?? data.tx
		return { success: true, tx }
	} catch (e) {
		return { success: false, error: (e as Error)?.message ?? 'Gift transfer failed' }
	}
}

/**
 * 构造购卡请求：用户支付 usdcAmountHuman USDC（该 USDC 已由链上 currency→USD→USDC 得到）。
 * 后端用 quotePointsForUSDC(cardAddress, usdcAmount) 得到应铸造的 points。
 */
export const USDC2Token = async (
    userPrivateKey: string,
    usdcAmountHuman: string,
    cardAddress: string
) => {
	const usdcAmount6 = ethers.parseUnits(usdcAmountHuman, 6)
	if (usdcAmount6 <= 0n) throw new Error("usdcAmount must be > 0")
    try {
        const userWallet = new ethers.Wallet(userPrivateKey, baseEndpoint);
        const chainId = (await baseEndpoint.getNetwork()).chainId;
      

        

        // 1. 获取受益人 (Owner)
        const card = new ethers.Contract(
            cardAddress,
            [
                "function owner() view returns (address)"
            ],userWallet
        );

        const cardOwner = await card.owner();

        // 2. 构造 ERC-3009 用户签名
        const validBefore = Math.floor(Date.now() / 1000) + 3600;
        const userNonce = ethers.hexlify(ethers.randomBytes(32));

        const userSignature = await userWallet.signTypedData(
            { name: "USD Coin", version: "2", chainId, verifyingContract: USDCContract_BASE },
            {
                TransferWithAuthorization: [
                    { name: "from", type: "address" },
                    { name: "to", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "validAfter", type: "uint256" },
                    { name: "validBefore", type: "uint256" },
                    { name: "nonce", type: "bytes32" }
                ]
            },
            {
                from: userWallet.address,
                to: cardOwner,
                value: usdcAmount6,
                validAfter: 0,
                validBefore,
                nonce: userNonce
            }
        );

		const ret: Icard = {
			cardAddress: cardAddress,
			userSignature: userSignature,
			nonce: userNonce,
			usdcAmount: usdcAmount6.toString(),
			from: userWallet.address,
			validAfter: 0,
			validBefore: Number(validBefore)
		}

        return ret;

    } catch (error: any) {
        console.log(`❌ Direct Purchase Failed: ${error.message}`);
        throw error;
    }
}

/** Refuel B-Unit 请求体：EIP-3009 签名购买 B-Unit，提交给 /api/purchaseBUnitFromBase */
export type IBUnitRefuelPayload = {
	from: string
	amount: string
	validAfter: number
	validBefore: number
	nonce: string
	signature: string
}

/**
 * 为 Refuel Now 生成 EIP-3009 签名：USDC 转至 BaseTreasury 购买 B-Unit。
 * 用户离线签字，服务端提交 BaseTreasury.purchaseBUnitWith3009Authorization。
 */
export const signBUnitRefuel3009 = async (
	userPrivateKey: string,
	usdcAmountHuman: string
): Promise<IBUnitRefuelPayload> => {
	const usdcAmount6 = ethers.parseUnits(usdcAmountHuman, 6)
	if (usdcAmount6 < 1_000_000n) throw new Error("Minimum purchase is 1 USDC")
	const userWallet = new ethers.Wallet(userPrivateKey, baseEndpoint)
	const chainId = (await baseEndpoint.getNetwork()).chainId
	const now = Math.floor(Date.now() / 1000)
	const validAfter = 0
	const validBefore = now + 3600
	const nonce = ethers.hexlify(ethers.randomBytes(32))
	const signature = await userWallet.signTypedData(
		{ name: "USD Coin", version: "2", chainId, verifyingContract: USDCContract_BASE },
		{
			TransferWithAuthorization: [
				{ name: "from", type: "address" },
				{ name: "to", type: "address" },
				{ name: "value", type: "uint256" },
				{ name: "validAfter", type: "uint256" },
				{ name: "validBefore", type: "uint256" },
				{ name: "nonce", type: "bytes32" },
			],
		},
		{
			from: userWallet.address,
			to: BASE_TREASURY,
			value: usdcAmount6,
			validAfter: BigInt(validAfter),
			validBefore: BigInt(validBefore),
			nonce,
		}
	)
	return {
		from: userWallet.address,
		amount: usdcAmount6.toString(),
		validAfter,
		validBefore,
		nonce,
		signature,
	}
}

/** 当前使用的 Card Factory 地址（与 config/chainAddresses CARD_FACTORY / contracts.BeamioCardFactory 一致） */
const CARD_FACTORY_ADDRESS = contracts.BeamioCardFactory.address;

export const quoteUSDCForPoints = async (
	cardAddress: string,
	pointsHuman: string   // ✅ 人类可读，例如 "10" / "1.5"
  ) => {
	const factory = BeamioCardFactorySC;

	if (!pointsHuman || Number(pointsHuman) <= 0) {
	  throw new Error("points must be > 0 (human readable)");
	}

	// 1️⃣ 人类可读 → 6 位 points（链上单位）
	let points6: bigint;
	try {
	  points6 = ethers.parseUnits(pointsHuman, 6);
	} catch {
	  throw new Error(`invalid points format: ${pointsHuman}`);
	}

	if (points6 <= 0n) {
	  throw new Error("points6 must be > 0");
	}

	try {
	  // 2️⃣ 单价（1e6 points 对应 USDC6）；当前 Factory 无 quotePointsInUSDC6，用单价×数量计算
	  const unitPriceUSDC6: bigint =
	    await factory.quoteUnitPointInUSDC6(cardAddress);
	  if (unitPriceUSDC6 === 0n) {
	    throw new Error("quote=0 (oracle not configured or card invalid). Ensure BeamioOracle has CAD rate set (e.g. npm run set:oracle-cad:base).");
	  }

	  // 3️⃣ 总价 USDC6 = points6 * unitPriceUSDC6 / 1e6
	  const POINTS_ONE = 1_000_000n;
	  const usdc6: bigint = (points6 * unitPriceUSDC6) / POINTS_ONE;

	  return {
	    points: pointsHuman,
	    points6,
	    usdc6,
	    usdc: ethers.formatUnits(usdc6, 6),
	    unitPriceUSDC6,
	    unitPriceUSDC: ethers.formatUnits(unitPriceUSDC6, 6),
	  };
	} catch (err: unknown) {
	  const msg = err instanceof Error ? err.message : String(err);
	  if (msg.includes("quote=0") || msg.includes("oracle") || msg.includes("card invalid")) {
	    throw err;
	  }
	  throw new Error(
	    `quoteUSDCForPoints failed: ${msg}. ` +
	    `Ensure cardAddress is a card from the current Card Factory (${CARD_FACTORY_ADDRESS}) and uses E6 pricing.`
	  );
	}
  }

const POINTS_ONE = 1_000_000n

/** 链上货币 id（与 BeamioCurrency 一致）：全部汇率经 USD，再经 USD-USDC 换算。 */
const CURRENCY_TO_ENUM: Record<string, number> = { CAD: 0, USD: 1, JPY: 2, CNY: 3, USDC: 4, HKD: 5, EUR: 6, SGD: 7, TWD: 8 }

/**
 * 链上报价：显示货币金额 → USDC（设计：currency → USD → USDC，与 Oracle/QuoteHelper 一致）。
 * 用于 payUSDCProcess：用户输入 X CAD/USD，用此函数得到应付 USDC 数量。
 */
export const quoteCurrencyAmountInUSDC = async (
	cardAddress: string,
	currencyCode: string,
	amountHuman: string
): Promise<{ usdc6: bigint; usdc: string }> => {
	const factory = BeamioCardFactorySC
	const cur = CURRENCY_TO_ENUM[currencyCode.toUpperCase()]
	if (cur === undefined) throw new Error(`Unsupported currency: ${currencyCode}`)
	const amount6 = ethers.parseUnits(amountHuman, 6)
	if (amount6 <= 0n) throw new Error("amount must be > 0")
	const usdc6 = await factory.quoteCurrencyAmountInUSDC6(cur, amount6)
	return { usdc6, usdc: ethers.formatUnits(usdc6, 6) }
}

/** 唯一规则：原始 currency amount 按排价转 USDC → +0.0002 USDC → 三位小数四舍五入。用于 Confirm 签名。 */
export const currencyAmountToSafeUsdc6 = async (
	cardAddress: string,
	cardCurrency: string,
	amountHuman: string
): Promise<bigint> => {
	const normalized = amountHuman.replace(/,/g, '').trim()
	if (!normalized || Number(normalized) <= 0) return 0n
	const { usdc6 } = await quoteCurrencyAmountInUSDC(cardAddress, cardCurrency, normalized)
	const BUFFER_USDC6 = 200n // +0.0002 USDC
	const MILLI_USDC6 = 1_000n // 0.001 USDC (3 decimals)
	const ROUND_HALF_USDC6 = 500n // half-up
	const buffered = usdc6 + BUFFER_USDC6
	return ((buffered + ROUND_HALF_USDC6) / MILLI_USDC6) * MILLI_USDC6
}

/** 将 usdc6 格式化为三位小数字符串（与 currencyAmountToSafeUsdc6 输出一致） */
export const safeUsdc6ToAmountString = (usdc6: bigint): string =>
	Number(ethers.formatUnits(usdc6, 6)).toFixed(3)

/**
 * Convert USDC amount (human-readable string) to CAD using chain oracle.
 * Uses quoteCurrencyAmountInUSDC(CARD, 'CAD', '1') to get USDC per 1 CAD, then CAD = usdcAmount / thatRate.
 */
export const quoteUSDCToCAD = async (
	cardAddress: string,
	usdcAmountHuman: string
): Promise<string> => {
	const { usdc: usdcPer1Cad } = await quoteCurrencyAmountInUSDC(cardAddress, 'CAD', '1')
	const rate = Number(usdcPer1Cad)
	if (!rate || Number.isNaN(rate)) return usdcAmountHuman
	const cad = Number(usdcAmountHuman) / rate
	return cad.toFixed(2)
}

/**
 * Given a required USDC amount (e.g. from TenKeyInput), returns the equivalent ERC1155 points (points6)
 * needed on a CCSA card. Uses the card's currency and current oracle rate via factory.quoteUnitPointInUSDC6.
 * Formula: points6 = requiredUSDC6 * POINTS_ONE / unitPriceUSDC6 (inverse of quoteUSDCForPoints).
 */
export const quotePointsForUSDC = async (
	cardAddress: string,
	usdcAmountHuman: string
): Promise<{ points6: bigint; points: string; usdc6: bigint; unitPriceUSDC6: bigint }> => {
	const factory = BeamioCardFactorySC
	const amount = Number(usdcAmountHuman)
	if (!usdcAmountHuman || Number.isNaN(amount) || amount <= 0) {
		throw new Error("usdcAmountHuman must be a positive number string")
	}
	let usdc6: bigint
	try {
		usdc6 = ethers.parseUnits(usdcAmountHuman, 6)
	} catch {
		throw new Error(`invalid USDC amount format: ${usdcAmountHuman}`)
	}
	if (usdc6 <= 0n) throw new Error("usdc6 must be > 0")

	const unitPriceUSDC6: bigint = await factory.quoteUnitPointInUSDC6(cardAddress)
	if (unitPriceUSDC6 === 0n) {
		throw new Error("quote=0 (oracle not configured or card invalid). Ensure BeamioOracle has CAD rate set (e.g. npm run set:oracle-cad:base).")
	}
	// points6 = requiredUSDC6 * (1e6 points) / unitPriceUSDC6
	const points6 = (usdc6 * POINTS_ONE) / unitPriceUSDC6
	return {
		points6,
		points: ethers.formatUnits(points6, 6),
		usdc6,
		unitPriceUSDC6,
	}
}

const purchasingCardEndpoint = `${beamioApi}/api/purchasingCard`
const usdcTopupEndpoint = `${beamioApi}/api/usdcTopup`
const usdcTopupPreviewEndpoint = `${beamioApi}/api/usdcTopupPreview`
const createCardEndpoint = `${beamioApi}/api/createCard`

/** Logs the exact JSON body sent to POST /api/createCard when: NODE_ENV=development (CRA), localStorage BEAMIO_DEBUG_CREATE_CARD=1, or URL ?debugCreateCard=1 */
function shouldLogCreateCardRequestBody(): boolean {
	if (typeof window !== 'undefined') {
		try {
			if (window.localStorage?.getItem('BEAMIO_DEBUG_CREATE_CARD') === '1') return true
			if (/(?:^|[?&])debugCreateCard=1(?:&|$)/.test(window.location.search || '')) return true
		} catch {
			/* storage blocked */
		}
	}
	if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') return true
	return false
}

function logCreateCardRequestBody(endpoint: string, body: string): void {
	if (!shouldLogCreateCardRequestBody() || typeof console === 'undefined' || !console.info) return
	try {
		console.info('[createCard] POST /api/createCard — URL:', endpoint)
		console.info('[createCard] POST /api/createCard — JSON body (as sent to endpoint):', JSON.parse(body))
	} catch {
		console.info('[createCard] POST /api/createCard — URL:', endpoint, 'raw:', body)
	}
}

const executeForOwnerEndpoint = `${beamioApi}/api/executeForOwner`
const cardCreateRedeemEndpoint = `${beamioApi}/api/cardCreateRedeem`
const cardRedeemEndpoint = `${beamioApi}/api/cardRedeem`
const cardCouponOpenClaimEndpoint = `${beamioApi}/api/cardCouponOpenClaim`
const cardRecordUserLikeEndpoint = `${beamioApi}/api/cardRecordUserLike`
const cardAddAdminEndpoint = `${beamioApi}/api/cardAddAdmin`
const cardCreateRedeemAdminEndpoint = `${beamioApi}/api/cardCreateRedeemAdmin`
const cardRedeemAdminEndpoint = `${beamioApi}/api/cardRedeemAdmin`

export type CardActiveIssuedCouponSeriesItem = {
	cardAddress: string
	tokenId: string
	metadata?: Record<string, unknown> | null
	issuedNftValidBefore?: string
}

export function readCouponIdFromMetadata(meta: Record<string, unknown> | null | undefined): string {
	if (!meta || typeof meta !== 'object') return ''
	const root = meta as Record<string, unknown>
	const rootId = root.couponId
	if (typeof rootId === 'string' && rootId.trim()) return rootId.trim()
	const properties = root.properties
	if (!properties || typeof properties !== 'object') return ''
	const beamioCoupon = (properties as Record<string, unknown>).beamioCoupon
	if (!beamioCoupon || typeof beamioCoupon !== 'object') return ''
	const nestedId = (beamioCoupon as Record<string, unknown>).couponId
	return typeof nestedId === 'string' && nestedId.trim() ? nestedId.trim() : ''
}

function readProductionIdFromMetadata(meta: Record<string, unknown> | null | undefined): string {
	if (!meta || typeof meta !== 'object') return ''
	const root = meta as Record<string, unknown>
	const rootProductionId = root.productionId
	if (typeof rootProductionId === 'string' && rootProductionId.trim()) return rootProductionId.trim()
	const rootId = root.id
	if (typeof rootId === 'string' && rootId.trim()) return rootId.trim()
	const properties = root.properties
	if (!properties || typeof properties !== 'object') return ''
	const beamioProduction = (properties as Record<string, unknown>).beamioProduction
	if (!beamioProduction || typeof beamioProduction !== 'object') return ''
	const nestedId = (beamioProduction as Record<string, unknown>).productionId
	return typeof nestedId === 'string' && nestedId.trim() ? nestedId.trim() : ''
}

/** Align `cardCouponOpenClaimPreCheck` / issued NFT series tokenId floor. */
const ISSUED_NFT_START_ID_MEMBER = 100_000_000_000n

const OPEN_CLAIM_ONCHAIN_READ_ABI = [
	'function issuedNftPriceInCurrency6(uint256 tokenId) view returns (uint256)',
	'function issuedNftUserSigClaimUsed(address userEOA, uint256 tokenId) view returns (bool)',
	'function issuedNftMaxSupply(uint256 tokenId) view returns (uint256)',
	'function issuedNftMintedCount(uint256 tokenId) view returns (uint256)',
] as const

/** Same semantics as x402sdk `readCouponRequiresRedeemCode`. */
export function readCouponRequiresRedeemCode(meta: Record<string, unknown> | null | undefined): boolean {
	if (!meta || typeof meta !== 'object') return false
	const root = meta as Record<string, unknown>
	const toBool = (v: unknown): boolean =>
		v === true || v === 1 || v === '1' || v === 'true'
	if (toBool(root.requiresRedeemCode) || toBool(root.redeemCodeRequired)) return true
	const properties = root.properties
	if (!properties || typeof properties !== 'object') return false
	const beamioCoupon = (properties as Record<string, unknown>).beamioCoupon
	if (!beamioCoupon || typeof beamioCoupon !== 'object') return false
	const nested = beamioCoupon as Record<string, unknown>
	return toBool(nested.requiresRedeemCode) || toBool(nested.redeemCodeRequired)
}

const openClaimCardReadContracts = new Map<string, ethers.Contract>()

function openClaimCardReadContract(cardAddress: string): ethers.Contract {
	const cardNorm = ethers.getAddress(cardAddress)
	const key = cardNorm.toLowerCase()
	let c = openClaimCardReadContracts.get(key)
	if (!c) {
		c = new ethers.Contract(cardNorm, OPEN_CLAIM_ONCHAIN_READ_ABI, baseEndpoint)
		openClaimCardReadContracts.set(key, c)
	}
	return c
}

/**
 * Cluster `cardCouponOpenClaimPreCheck` list-side filters (metadata + on-chain price/claimed/supply).
 * Does not require AA — Master `ensureAAForEOAOnCard` creates AA during claim if missing.
 * `false` = hide row; `true` = show; `null` = RPC uncertain — keep row (do not treat failure as non-claimable).
 */
export type CouponOpenClaimEligibility =
	| 'claimable'
	| 'already_claimed'
	| 'not_open_claim'
	| 'insufficient_social_points'
	| 'unknown'

/** User #13 social reward voucher balance on a merchant program card (CoNET RPC). */
export async function readUserSocialPoints13BalanceOnCard(
	cardNorm: string,
	userNorm: string,
): Promise<bigint | null> {
	try {
		const card = ethers.getAddress(cardNorm)
		const user = ethers.getAddress(userNorm)
		const { provider } = await providerForBeamioUserCard(card)
		const cardContract = new ethers.Contract(
			card,
			['function balanceOf(address account, uint256 id) view returns (uint256)'],
			provider,
		)
		let total = 0n
		try {
			total += (await cardContract.balanceOf(user, REWARD_VOUCHER_TOKEN_ID)) as bigint
		} catch {
			return null
		}
		// Social promotion mints via dispatchEventReward13 land on EOA; AA is used for exchange burn.
		const aa = await resolveBeamioAaOnConet(provider, user).catch(() => null)
		if (aa) {
			try {
				total += (await cardContract.balanceOf(aa, REWARD_VOUCHER_TOKEN_ID)) as bigint
			} catch {
				/* keep EOA portion */
			}
		}
		return total
	} catch {
		return null
	}
}

/**
 * Discover / coupon list UI: whether the current wallet may use open-claim for this series row.
 * `not_open_claim` = redeem-code or paid coupon (no Claim button).
 */
export async function resolveCouponOpenClaimEligibility(
	row: CardActiveIssuedCouponSeriesItem,
	userEOA: string | null | undefined,
): Promise<CouponOpenClaimEligibility> {
	if (readCouponRequiresRedeemCode(row.metadata ?? null)) return 'not_open_claim'
	if (!readCouponIdFromMetadata(row.metadata ?? null)) return 'not_open_claim'
	let tokenIdN: bigint
	try {
		tokenIdN = BigInt(row.tokenId)
	} catch {
		return 'not_open_claim'
	}
	if (tokenIdN < ISSUED_NFT_START_ID_MEMBER) return 'not_open_claim'
	if (!row.cardAddress || !ethers.isAddress(row.cardAddress)) return 'not_open_claim'
	const validBeforeNum = Number(row.issuedNftValidBefore ?? 0)
	if (Number.isFinite(validBeforeNum) && validBeforeNum > 0 && validBeforeNum <= Math.floor(Date.now() / 1000)) {
		return 'already_claimed'
	}
	if (!userEOA || !ethers.isAddress(userEOA)) return 'unknown'
	try {
		const cardRead = openClaimCardReadContract(row.cardAddress)
		const userNorm = ethers.getAddress(userEOA)
		const [priceInCurrency6, alreadyClaimed, maxSupply, mintedCount] = await Promise.all([
			cardRead.issuedNftPriceInCurrency6(tokenIdN) as Promise<bigint>,
			cardRead.issuedNftUserSigClaimUsed(userNorm, tokenIdN) as Promise<boolean>,
			cardRead.issuedNftMaxSupply(tokenIdN) as Promise<bigint>,
			cardRead.issuedNftMintedCount(tokenIdN) as Promise<bigint>,
		])
		if (alreadyClaimed) return 'already_claimed'
		if (priceInCurrency6 !== 0n) return 'not_open_claim'
		if (maxSupply > 0n && mintedCount >= maxSupply) return 'already_claimed'
		const socialExchange = readSocialExchangeFromMetadata(row.metadata ?? null)
		if (socialExchange) {
			const pointsBal = await readUserSocialPoints13BalanceOnCard(row.cardAddress, userNorm)
			if (pointsBal == null) return 'unknown'
			if (pointsBal < BigInt(socialExchange.pointsCost)) return 'insufficient_social_points'
		}
		return 'claimable'
	} catch {
		return 'unknown'
	}
}

async function passesOpenClaimListFiltersForUser(
	row: CardActiveIssuedCouponSeriesItem,
	userEOA: string
): Promise<boolean | null> {
	if (!readCouponIdFromMetadata(row.metadata ?? null)) return false
	if (readCouponRequiresRedeemCode(row.metadata ?? null)) return false
	let tokenIdN: bigint
	try {
		tokenIdN = BigInt(row.tokenId)
	} catch {
		return false
	}
	if (tokenIdN < ISSUED_NFT_START_ID_MEMBER) return false
	if (!row.cardAddress || !ethers.isAddress(row.cardAddress)) return false
	try {
		const cardRead = openClaimCardReadContract(row.cardAddress)
		const userNorm = ethers.getAddress(userEOA)
		const [priceInCurrency6, alreadyClaimed, maxSupply, mintedCount] = await Promise.all([
			cardRead.issuedNftPriceInCurrency6(tokenIdN) as Promise<bigint>,
			cardRead.issuedNftUserSigClaimUsed(userNorm, tokenIdN) as Promise<boolean>,
			cardRead.issuedNftMaxSupply(tokenIdN) as Promise<bigint>,
			cardRead.issuedNftMintedCount(tokenIdN) as Promise<bigint>,
		])
		if (priceInCurrency6 !== 0n) return false
		if (alreadyClaimed) return false
		if (maxSupply > 0n && mintedCount >= maxSupply) return false
		return true
	} catch {
		return null
	}
}

const stripHash13UserCopy = (text: string): string =>
	text
		.replace(/\s*\(#13\)/gi, '')
		.replace(/#13/gi, '')
		.replace(/\s{2,}/g, ' ')
		.trim()

const mapCouponOpenClaimApiError = (raw: string | undefined): string => {
	const msg = (raw ?? '').trim()
	if (!msg) return 'Coupon claim failed'
	if (/Failed to create AA|ensureAAForEOAOnCard/i.test(msg)) {
		return 'Failed to create Smart Account. Please try again shortly.'
	}
	if (/UC_ResolveAccountFailed|ResolveAccountFailed|ad12d341/i.test(msg)) {
		return 'Smart Account setup failed. Please try again shortly.'
	}
	if (/already claimed|UC_IssuedNftSigClaimAlreadyUsed/i.test(msg)) {
		return 'This wallet already claimed this coupon.'
	}
	if (/fully claimed|InsufficientBalance|supply/i.test(msg)) {
		return 'Coupon supply has been fully claimed.'
	}
	if (/redeemCode|open claim is disabled/i.test(msg)) {
		return 'This coupon requires a redeem code.'
	}
	if (/inactive|expired|InvalidTimeWindow/i.test(msg)) {
		return 'This coupon is inactive or expired.'
	}
	if (/Insufficient social points|UC_InsufficientBalance/i.test(msg)) {
		return 'Not enough social points for this exchange.'
	}
	if (/Insufficient USDC escrow|UC_RewardBudgetInsufficient/i.test(msg)) {
		return 'This exchange is temporarily unavailable. The merchant USDC pool needs funding.'
	}
	return stripHash13UserCopy(msg) || 'Coupon claim failed'
}

async function filterCouponSeriesForOpenClaim(
	rows: CardActiveIssuedCouponSeriesItem[],
	userEOA: string | null | undefined
): Promise<CardActiveIssuedCouponSeriesItem[]> {
	if (!userEOA || !ethers.isAddress(userEOA)) return rows
	const userNorm = ethers.getAddress(userEOA)
	const out: CardActiveIssuedCouponSeriesItem[] = []
	for (const row of rows) {
		const verdict = await passesOpenClaimListFiltersForUser(row, userNorm)
		if (verdict === false) continue
		out.push(row)
	}
	return out
}

/** null = 请求不可信；[] = 可信空。Discover 可见性由服务端 Featured Brands gate 统一过滤。 */
export async function fetchCardActiveIssuedCouponSeriesTrusted(
	cardAddress: string,
	limit = 50
): Promise<CardActiveIssuedCouponSeriesItem[] | null> {
	if (!cardAddress || !ethers.isAddress(cardAddress)) return []
	const normalizedLimit = Math.min(50, Math.max(1, Math.floor(Number(limit) || 50)))
	try {
		const res = await fetch(
			`${beamioApi}/api/cardActiveIssuedCouponSeries?card=${encodeURIComponent(ethers.getAddress(cardAddress))}&limit=${normalizedLimit}`
		)
		if (!res.ok) return null
		const json = (await res.json().catch(() => ({}))) as { items?: CardActiveIssuedCouponSeriesItem[] }
		return Array.isArray(json.items) ? json.items : []
	} catch {
		return null
	}
}

export async function getCardActiveIssuedCouponSeries(cardAddress: string, limit = 50): Promise<CardActiveIssuedCouponSeriesItem[]> {
	const trusted = await fetchCardActiveIssuedCouponSeriesTrusted(cardAddress, limit)
	return trusted ?? []
}

/** null = untrusted; [] = trusted empty. */
export async function fetchCardActiveIssuedProductionSeriesTrusted(
	cardAddress: string,
	limit = 50
): Promise<CardActiveIssuedCouponSeriesItem[] | null> {
	if (!cardAddress || !ethers.isAddress(cardAddress)) return []
	const normalizedLimit = Math.min(50, Math.max(1, Math.floor(Number(limit) || 50)))
	try {
		const res = await fetch(
			`${beamioApi}/api/cardActiveIssuedProductionSeries?card=${encodeURIComponent(ethers.getAddress(cardAddress))}&limit=${normalizedLimit}`
		)
		if (!res.ok) return null
		const json = (await res.json().catch(() => ({}))) as { items?: CardActiveIssuedCouponSeriesItem[] }
		return Array.isArray(json.items) ? json.items : []
	} catch {
		return null
	}
}

export async function getCardActiveIssuedProductionSeries(
	cardAddress: string,
	limit = 50
): Promise<CardActiveIssuedCouponSeriesItem[]> {
	const trusted = await fetchCardActiveIssuedProductionSeriesTrusted(cardAddress, limit)
	return trusted ?? []
}

/** 从全站 recent 系列 API 拉取完整行（含 metadata），供 My Brands 已持有券检测 */
async function fetchRecentIssuedCouponSeriesTrusted(
	limit = 50
): Promise<CardActiveIssuedCouponSeriesItem[] | null> {
	const normalizedLimit = Math.min(50, Math.max(1, Math.floor(Number(limit) || 50)))
	try {
		const res = await fetch(`${beamioApi}/api/recentIssuedCouponSeries?limit=${normalizedLimit}`)
		if (!res.ok) return null
		const json = (await res.json().catch(() => ({}))) as {
			items?: Array<CardActiveIssuedCouponSeriesItem & { cardAddress?: string; tokenId?: string }>
		}
		if (!Array.isArray(json.items)) return []
		const out: CardActiveIssuedCouponSeriesItem[] = []
		for (const row of json.items) {
			const raw = row.cardAddress?.trim()
			if (!raw || !ethers.isAddress(raw)) continue
			const cardAddress = ethers.getAddress(raw)
			const tokenId = String(row.tokenId ?? '').trim()
			if (!tokenId) continue
			out.push({
				...row,
				cardAddress,
				tokenId,
				metadata: row.metadata ?? null,
				issuedNftValidBefore: row.issuedNftValidBefore,
			})
		}
		return out
	} catch {
		return null
	}
}

/** 从全站最近登记的优惠券系列提取卡地址（用于 onboarding 列表，避免只扫基础设施卡） */
async function fetchRecentIssuedCouponCardAddresses(limit = 50): Promise<string[] | null> {
	const normalizedLimit = Math.min(50, Math.max(1, Math.floor(Number(limit) || 50)))
	try {
		const res = await fetch(`${beamioApi}/api/recentIssuedCouponSeries?limit=${normalizedLimit}`)
		if (!res.ok) return null
		const json = (await res.json().catch(() => ({}))) as { items?: Array<{ cardAddress?: string }> }
		const seen = new Set<string>()
		for (const row of json.items ?? []) {
			const raw = row.cardAddress?.trim()
			if (!raw || !ethers.isAddress(raw)) continue
			seen.add(ethers.getAddress(raw).toLowerCase())
		}
		return [...seen]
	} catch {
		return null
	}
}

/**
 * 进行中、可 open-claim 的优惠券：全站 recent 系列所属商户卡，逐卡链上 isIssuedNftValid 过滤。
 * 若提供 `userEOA`，再按 Cluster `cardCouponOpenClaimPreCheck` 规则过滤（无 redeemCode、免费券、未领取）。
 * null = 全部卡请求均不可信。
 */
export async function fetchOngoingClaimableCouponSeries(
	limit = 50,
	userEOA?: string | null
): Promise<CardActiveIssuedCouponSeriesItem[] | null> {
	const normalizedLimit = Math.min(50, Math.max(1, Math.floor(Number(limit) || 50)))
	const cardSet = new Set<string>()
	const recentCards = await fetchRecentIssuedCouponCardAddresses(normalizedLimit)
	if (recentCards) {
		for (const c of recentCards) cardSet.add(c.toLowerCase())
	}
	if (cardSet.size === 0) return []

	const cardList = [...cardSet]
	const responses = await Promise.all(
		cardList.map((cardLower) => fetchCardActiveIssuedCouponSeriesTrusted(cardLower, normalizedLimit))
	)
	if (!responses.some((r) => r !== null)) return null

	const merged = new Map<string, CardActiveIssuedCouponSeriesItem>()
	for (let i = 0; i < cardList.length; i++) {
		const rows = responses[i]
		if (!rows) continue
		const cardAddress = ethers.getAddress(cardList[i])
		for (const row of rows) {
			merged.set(`${cardList[i]}:${row.tokenId}`, { ...row, cardAddress })
		}
	}
	const sorted = [...merged.values()].sort((a, b) => {
		const av = Number(a.issuedNftValidBefore ?? 0)
		const bv = Number(b.issuedNftValidBefore ?? 0)
		const aFinite = Number.isFinite(av) && av > 0
		const bFinite = Number.isFinite(bv) && bv > 0
		if (aFinite !== bFinite) return aFinite ? -1 : 1
		if (aFinite && bFinite && av !== bv) return av - bv
		return String(a.tokenId).localeCompare(String(b.tokenId), 'en')
	})
	return filterCouponSeriesForOpenClaim(sorted, userEOA)
}

const MY_BRANDS_COUPON_BALANCE_ABI = [
	'function balanceOf(address account,uint256 id) view returns (uint256)',
] as const

/**
 * Redeem / open-claim mint to the user's Beamio AA (`cardSelfToAccount`), not EOA.
 * Merge profile AA + factory-resolved AA so My Brands detects owned coupon NFTs.
 */
async function resolveMyBrandsCouponHolderAccounts(
	userEOA?: string | null,
	userAA?: string | null,
): Promise<string[]> {
	return resolveMyBrandsCouponHolderAccountsForCard(null, userEOA, userAA)
}

async function resolveMyBrandsCouponHolderAccountsForCard(
	cardAddress?: string | null,
	userEOA?: string | null,
	userAA?: string | null,
): Promise<string[]> {
	const seen = new Set<string>()
	const out: string[] = []
	const push = (raw?: string | null) => {
		const trimmed = raw?.trim() ?? ''
		if (!trimmed || !ethers.isAddress(trimmed)) return
		const addr = ethers.getAddress(trimmed)
		const key = addr.toLowerCase()
		if (seen.has(key)) return
		seen.add(key)
		out.push(addr)
	}
	push(userAA)
	push(userEOA)
	const eoaNorm = userEOA?.trim()
	if (eoaNorm && ethers.isAddress(eoaNorm)) {
		let factoryAa: string | null = null
		try {
			if (cardAddress && ethers.isAddress(cardAddress)) {
				const { provider, chainId } = await providerForBeamioUserCard(cardAddress)
				factoryAa =
					chainId === CONET_MAINNET_CHAIN_ID
						? await resolveBeamioAaOnConet(provider, ethers.getAddress(eoaNorm))
						: await resolveBeamioAaForEoaWithFallback(provider, ethers.getAddress(eoaNorm))
			} else {
				factoryAa = await resolveBeamioAaForEoaWithFallback(baseEndpoint, ethers.getAddress(eoaNorm))
			}
		} catch {
			factoryAa = null
		}
		push(factoryAa)
	}
	return out
}

function sortOwnedCouponSeriesRows(rows: CardActiveIssuedCouponSeriesItem[]): CardActiveIssuedCouponSeriesItem[] {
	return [...rows].sort((a, b) => {
		const av = Number(a.issuedNftValidBefore ?? 0)
		const bv = Number(b.issuedNftValidBefore ?? 0)
		const aFinite = Number.isFinite(av) && av > 0
		const bFinite = Number.isFinite(bv) && bv > 0
		if (aFinite !== bFinite) return aFinite ? -1 : 1
		if (aFinite && bFinite && av !== bv) return av - bv
		return String(a.tokenId).localeCompare(String(b.tokenId), 'en')
	})
}

async function scanOwnedCouponSeriesWithBalanceCheck(
	cardList: string[],
	normalizedLimit: number,
	userEOA?: string | null,
	userAA?: string | null
): Promise<CardActiveIssuedCouponSeriesItem[] | null> {
	if (!cardList.length) return []

	const responses = await Promise.all(
		cardList.map((cardLower) => fetchCardActiveIssuedCouponSeriesTrusted(cardLower, normalizedLimit))
	)
	if (!responses.some((r) => r !== null)) return null

	type BalanceCheckJob = {
		cardLower: string
		cardAddress: string
		row: CardActiveIssuedCouponSeriesItem
		tokenId: bigint
	}
	const jobs: BalanceCheckJob[] = []
	for (let i = 0; i < cardList.length; i++) {
		const rows = responses[i]
		if (!rows) continue
		const cardLower = cardList[i]!
		const cardAddress = ethers.getAddress(cardLower)
		for (const row of rows) {
			let tokenId: bigint
			try {
				tokenId = BigInt(row.tokenId)
			} catch {
				continue
			}
			jobs.push({ cardLower, cardAddress, row: { ...row, cardAddress }, tokenId })
		}
	}
	if (!jobs.length) return []

	const merged = new Map<string, CardActiveIssuedCouponSeriesItem>()
	let balanceCheckFailures = 0
	let balanceCheckSuccesses = 0
	const ctxByCard = new Map<string, { contract: ethers.Contract; accounts: string[] }>()
	for (const job of jobs) {
		let ctx = ctxByCard.get(job.cardLower)
		if (!ctx) {
			const { provider } = await providerForBeamioUserCard(job.cardAddress)
			ctx = {
				contract: new ethers.Contract(job.cardAddress, MY_BRANDS_COUPON_BALANCE_ABI, provider),
				accounts: await resolveMyBrandsCouponHolderAccountsForCard(job.cardAddress, userEOA, userAA),
			}
			ctxByCard.set(job.cardLower, ctx)
		}
		if (!ctx.accounts.length) {
			continue
		}
		for (const account of ctx.accounts) {
			try {
				const bal = (await ctx.contract.balanceOf(account, job.tokenId)) as bigint
				balanceCheckSuccesses++
				if (bal > 0n) {
					merged.set(`${job.cardLower}:${job.row.tokenId}`, job.row)
					break
				}
			} catch {
				balanceCheckFailures++
			}
		}
	}

	if (merged.size === 0 && balanceCheckSuccesses === 0 && balanceCheckFailures > 0) return null

	return sortOwnedCouponSeriesRows([...merged.values()])
}

async function filterOwnedCouponRowsByBalance(
	rows: CardActiveIssuedCouponSeriesItem[],
	userEOA?: string | null,
	userAA?: string | null
): Promise<CardActiveIssuedCouponSeriesItem[] | null> {
	if (!rows.length) return []
	const merged = new Map<string, CardActiveIssuedCouponSeriesItem>()
	let balanceCheckFailures = 0
	let balanceCheckSuccesses = 0
	const ctxByCard = new Map<string, { contract: ethers.Contract; accounts: string[] }>()
	for (const row of rows) {
		const raw = row.cardAddress?.trim()
		if (!raw || !ethers.isAddress(raw)) continue
		const cardAddress = ethers.getAddress(raw)
		const cardLower = cardAddress.toLowerCase()
		let tokenId: bigint
		try {
			tokenId = BigInt(row.tokenId)
		} catch {
			continue
		}
		let ctx = ctxByCard.get(cardLower)
		if (!ctx) {
			const { provider } = await providerForBeamioUserCard(cardAddress)
			ctx = {
				contract: new ethers.Contract(cardAddress, MY_BRANDS_COUPON_BALANCE_ABI, provider),
				accounts: await resolveMyBrandsCouponHolderAccountsForCard(cardAddress, userEOA, userAA),
			}
			ctxByCard.set(cardLower, ctx)
		}
		if (!ctx.accounts.length) {
			continue
		}
		for (const account of ctx.accounts) {
			try {
				const bal = (await ctx.contract.balanceOf(account, tokenId)) as bigint
				balanceCheckSuccesses++
				if (bal > 0n) {
					merged.set(`${cardLower}:${row.tokenId}`, { ...row, cardAddress })
					break
				}
			} catch {
				balanceCheckFailures++
			}
		}
	}

	if (merged.size === 0 && balanceCheckSuccesses === 0 && balanceCheckFailures > 0) return null

	return sortOwnedCouponSeriesRows([...merged.values()])
}

/**
 * My Brands primary path: one recentIssuedCouponSeries request (includes metadata), then serial balanceOf.
 * Redeem mints to AA — resolveMyBrandsCouponHolderAccounts checks AA before EOA.
 */
export async function fetchOwnedCouponsFromRecentSeriesForUser(
	userEOA?: string | null,
	userAA?: string | null,
	cardAddresses?: string[] | null,
	limit = 50
): Promise<CardActiveIssuedCouponSeriesItem[] | null> {
	const recent = await fetchRecentIssuedCouponSeriesTrusted(limit)
	if (recent === null) return null
	let rows = recent
	if (cardAddresses?.length) {
		const filter = new Set(
			cardAddresses
				.map((a) => a?.trim())
				.filter((a): a is string => Boolean(a && ethers.isAddress(a)))
				.map((a) => ethers.getAddress(a).toLowerCase())
		)
		if (filter.size > 0) {
			rows = rows.filter((r) => filter.has(r.cardAddress.toLowerCase()))
		}
	}
	return filterOwnedCouponRowsByBalance(rows, userEOA, userAA)
}

type WalletAssetsCouponBalanceRow = {
	cardAddress?: string
	couponId?: string
	tokenId?: string
	title?: string
	balance?: string
	requiresRedeemCode?: boolean
}

/**
 * Server-side trusted path for My Brands coupons.
 * `/api/getWalletAssets` can query a merchant card via `merchantInfraCard` and returns
 * `merchantCouponBalances`, avoiding browser-side RPC failures on `balanceOf`.
 */
export async function fetchOwnedCouponsFromWalletAssetsForCards(
	wallet?: string | null,
	cardAddresses?: string[] | null,
	limit = 50
): Promise<CardActiveIssuedCouponSeriesItem[] | null> {
	const walletRaw = wallet?.trim() ?? ''
	if (!walletRaw || !ethers.isAddress(walletRaw)) return []
	const normalizedLimit = Math.min(50, Math.max(1, Math.floor(Number(limit) || 50)))
	const recent = await fetchRecentIssuedCouponSeriesTrusted(normalizedLimit)
	if (recent === null) return null

	const cardSet = new Set<string>()
	for (const raw of cardAddresses ?? []) {
		const trimmed = raw?.trim() ?? ''
		if (trimmed && ethers.isAddress(trimmed)) cardSet.add(ethers.getAddress(trimmed).toLowerCase())
	}
	if (cardSet.size === 0) {
		for (const row of recent) {
			if (row.cardAddress && ethers.isAddress(row.cardAddress)) {
				cardSet.add(ethers.getAddress(row.cardAddress).toLowerCase())
			}
		}
	}
	if (cardSet.size === 0) return []

	const recentByKey = new Map<string, CardActiveIssuedCouponSeriesItem>()
	for (const row of recent) {
		if (!row.cardAddress || !ethers.isAddress(row.cardAddress)) continue
		recentByKey.set(`${ethers.getAddress(row.cardAddress).toLowerCase()}:${row.tokenId}`, row)
	}

	const merged = new Map<string, CardActiveIssuedCouponSeriesItem>()
	let trustedResponses = 0
	for (const cardLower of cardSet) {
		try {
			const cardAddress = ethers.getAddress(cardLower)
			const res = await fetch(`${beamioApi}/api/getWalletAssets`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					wallet: ethers.getAddress(walletRaw),
					merchantInfraCard: cardAddress,
				}),
			})
			if (!res.ok) continue
			const json = (await res.json().catch(() => ({}))) as {
				ok?: boolean
				merchantCouponBalances?: WalletAssetsCouponBalanceRow[]
			}
			if (json.ok !== true || !Array.isArray(json.merchantCouponBalances)) continue
			trustedResponses++
			for (const row of json.merchantCouponBalances) {
				const tokenId = String(row.tokenId ?? '').trim()
				if (!tokenId) continue
				const balance = Number(row.balance ?? 0)
				if (!Number.isFinite(balance) || balance <= 0) continue
				const key = `${cardLower}:${tokenId}`
				const fromRecent = recentByKey.get(key)
				merged.set(key, {
					...(fromRecent ?? {}),
					cardAddress,
					tokenId,
					metadata:
						fromRecent?.metadata ??
						({
							name: String(row.title ?? 'Coupon').trim() || 'Coupon',
							title: String(row.title ?? 'Coupon').trim() || 'Coupon',
							couponId: String(row.couponId ?? tokenId).trim() || tokenId,
							requiresRedeemCode: row.requiresRedeemCode === true,
						} satisfies Record<string, unknown>),
					issuedNftValidBefore: fromRecent?.issuedNftValidBefore,
				})
			}
		} catch {
			/* try next card */
		}
	}

	if (trustedResponses === 0) return null
	return sortOwnedCouponSeriesRows([...merged.values()])
}

/** Fast path: only scan cards the user already holds (holder / owner list). */
export async function fetchOwnedCouponsForKnownCards(
	cardAddresses: string[],
	userEOA?: string | null,
	userAA?: string | null,
	limit = 50
): Promise<CardActiveIssuedCouponSeriesItem[] | null> {
	const normalizedLimit = Math.min(50, Math.max(1, Math.floor(Number(limit) || 50)))
	const cardSet = new Set<string>()
	for (const raw of cardAddresses ?? []) {
		const trimmed = raw?.trim() ?? ''
		if (trimmed && ethers.isAddress(trimmed)) cardSet.add(ethers.getAddress(trimmed).toLowerCase())
	}
	if (cardSet.size === 0) return []
	const fromRecent = await fetchOwnedCouponsFromRecentSeriesForUser(
		userEOA,
		userAA,
		[...cardSet].map((c) => ethers.getAddress(c)),
		normalizedLimit
	)
	if (fromRecent?.length) return fromRecent
	if (fromRecent === null) {
		return scanOwnedCouponSeriesWithBalanceCheck([...cardSet], normalizedLimit, userEOA, userAA)
	}
	return scanOwnedCouponSeriesWithBalanceCheck([...cardSet], normalizedLimit, userEOA, userAA)
}

/**
 * My Brands should only include coupon brands for issued coupon NFTs the user already owns.
 * Claimable-but-not-owned coupons belong in discovery/claim surfaces, not in My Brands.
 */
export async function fetchMyBrandsCouponSeriesForUser(
	limit = 50,
	userEOA?: string | null,
	userAA?: string | null,
	extraCardAddresses?: string[] | null
): Promise<CardActiveIssuedCouponSeriesItem[] | null> {
	const normalizedLimit = Math.min(50, Math.max(1, Math.floor(Number(limit) || 50)))
	const prioritySet = new Set<string>()
	for (const raw of extraCardAddresses ?? []) {
		const trimmed = raw?.trim() ?? ''
		if (trimmed && ethers.isAddress(trimmed)) prioritySet.add(ethers.getAddress(trimmed).toLowerCase())
	}

	const cardSet = new Set<string>(prioritySet)
	const recentCards = await fetchRecentIssuedCouponCardAddresses(normalizedLimit)
	if (recentCards) {
		for (const c of recentCards) cardSet.add(c)
	}
	if (cardSet.size === 0) {
		for (const a of ASSET_CARD_ADDRESSES) {
			if (ethers.isAddress(a)) cardSet.add(a.toLowerCase())
		}
	}
	if (cardSet.size === 0) return []

	if (prioritySet.size > 0) {
		const priorityResult = await scanOwnedCouponSeriesWithBalanceCheck(
			[...prioritySet],
			normalizedLimit,
			userEOA,
			userAA
		)
		if (priorityResult && priorityResult.length > 0) return priorityResult
	}

	return scanOwnedCouponSeriesWithBalanceCheck([...cardSet], normalizedLimit, userEOA, userAA)
}

async function scanOwnedProductionSeriesWithBalanceCheck(
	cardList: string[],
	normalizedLimit: number,
	userEOA?: string | null,
	userAA?: string | null
): Promise<CardActiveIssuedCouponSeriesItem[] | null> {
	if (!cardList.length) return []

	const responses = await Promise.all(
		cardList.map((cardLower) => fetchCardActiveIssuedProductionSeriesTrusted(cardLower, normalizedLimit))
	)
	if (!responses.some((r) => r !== null)) return null

	type BalanceCheckJob = {
		cardLower: string
		cardAddress: string
		row: CardActiveIssuedCouponSeriesItem
		tokenId: bigint
	}
	const jobs: BalanceCheckJob[] = []
	for (let i = 0; i < cardList.length; i++) {
		const rows = responses[i]
		if (!rows) continue
		const cardLower = cardList[i]!
		const cardAddress = ethers.getAddress(cardLower)
		for (const row of rows) {
			let tokenId: bigint
			try {
				tokenId = BigInt(row.tokenId)
			} catch {
				continue
			}
			jobs.push({ cardLower, cardAddress, row: { ...row, cardAddress }, tokenId })
		}
	}
	if (!jobs.length) return []

	const merged = new Map<string, CardActiveIssuedCouponSeriesItem>()
	let balanceCheckFailures = 0
	let balanceCheckSuccesses = 0
	const ctxByCard = new Map<string, { contract: ethers.Contract; accounts: string[] }>()
	for (const job of jobs) {
		let ctx = ctxByCard.get(job.cardLower)
		if (!ctx) {
			const { provider } = await providerForBeamioUserCard(job.cardAddress)
			ctx = {
				contract: new ethers.Contract(job.cardAddress, MY_BRANDS_COUPON_BALANCE_ABI, provider),
				accounts: await resolveMyBrandsCouponHolderAccountsForCard(job.cardAddress, userEOA, userAA),
			}
			ctxByCard.set(job.cardLower, ctx)
		}
		if (!ctx.accounts.length) {
			continue
		}
		for (const account of ctx.accounts) {
			try {
				const bal = (await ctx.contract.balanceOf(account, job.tokenId)) as bigint
				balanceCheckSuccesses++
				if (bal > 0n) {
					merged.set(`${job.cardLower}:${job.row.tokenId}`, job.row)
					break
				}
			} catch {
				balanceCheckFailures++
			}
		}
	}

	if (merged.size === 0 && balanceCheckSuccesses === 0 && balanceCheckFailures > 0) return null

	return sortOwnedCouponSeriesRows([...merged.values()])
}

/** My Brands: owned catalog / production NFTs (Global Category ≠ Coupon). */
export async function fetchMyBrandsProductionSeriesForUser(
	limit = 50,
	userEOA?: string | null,
	userAA?: string | null,
	extraCardAddresses?: string[] | null
): Promise<CardActiveIssuedCouponSeriesItem[] | null> {
	const normalizedLimit = Math.min(50, Math.max(1, Math.floor(Number(limit) || 50)))
	const prioritySet = new Set<string>()
	for (const raw of extraCardAddresses ?? []) {
		const trimmed = raw?.trim() ?? ''
		if (trimmed && ethers.isAddress(trimmed)) prioritySet.add(ethers.getAddress(trimmed).toLowerCase())
	}
	if (prioritySet.size === 0) return []

	if (prioritySet.size > 0) {
		const priorityResult = await scanOwnedProductionSeriesWithBalanceCheck(
			[...prioritySet],
			normalizedLimit,
			userEOA,
			userAA
		)
		if (priorityResult && priorityResult.length > 0) return priorityResult
	}

	return scanOwnedProductionSeriesWithBalanceCheck([...prioritySet], normalizedLimit, userEOA, userAA)
}

async function resolveOpenClaimTokenIdByCouponId(cardAddress: string, couponId: string): Promise<string | null> {
	const wanted = couponId.trim()
	if (!wanted) return null
	const rows = await getCardActiveIssuedCouponSeries(cardAddress)
	for (const row of rows) {
		const id = readCouponIdFromMetadata(row.metadata ?? null)
		if (id && id === wanted) return String(row.tokenId)
	}
	const productionRows = await getCardActiveIssuedProductionSeries(cardAddress)
	for (const row of productionRows) {
		const id = readProductionIdFromMetadata(row.metadata ?? null)
		if (id && id === wanted) return String(row.tokenId)
	}
	return null
}

/** 用户离线签字 + 直连 `POST /api/cardCouponOpenClaim`（Cluster 预检后 Master 执行）。 */
export const postCardCouponOpenClaimWithCurrentWallet = async (params: {
	cardAddress: string
	couponId: string
	/** When known from list row, skip re-scanning card series by couponId. */
	tokenId?: string
	privateKeyArmor: string
	/** Share referrer EOA from coupon deep link (`ref=`). */
	referrerEoa?: string | null
}): Promise<{ success: boolean; tx?: string; tokenId?: string; error?: string; status?: number }> => {
	const cardAddress = params.cardAddress?.trim() ?? ''
	const couponId = params.couponId?.trim() ?? ''
	const tokenIdParam = params.tokenId?.trim() ?? ''
	const privateKeyArmor = params.privateKeyArmor?.trim() ?? ''
	if (!cardAddress || !couponId || !privateKeyArmor || !ethers.isAddress(cardAddress)) {
		return { success: false, error: 'Invalid cardAddress, couponId, or privateKey' }
	}
	try {
		const signer = new ethers.Wallet(privateKeyArmor)
		const userEOA = ethers.getAddress(signer.address)
		const cardNorm = ethers.getAddress(cardAddress)
		const tokenId =
			tokenIdParam ||
			(await resolveOpenClaimTokenIdByCouponId(cardNorm, couponId))
		if (!tokenId) return { success: false, error: 'Coupon not found or inactive on this card.' }

		const refRaw = params.referrerEoa?.trim() ?? ''
		const refWallet =
			refRaw && ethers.isAddress(refRaw) && ethers.getAddress(refRaw) !== userEOA
				? ethers.getAddress(refRaw)
				: undefined

		let socialExchange = null as ReturnType<typeof readSocialExchangeFromMetadata>
		const seriesRows = await getCardActiveIssuedCouponSeries(cardNorm, 50)
		for (const seriesRow of seriesRows) {
			if (String(seriesRow.tokenId) === tokenId || readCouponIdFromMetadata(seriesRow.metadata ?? null) === couponId) {
				socialExchange = readSocialExchangeFromMetadata(seriesRow.metadata ?? null)
				break
			}
		}

		const verifyingContract = await getCardFactoryGatewayForEip712(cardNorm)
		const chainId = await eip712ChainIdForBeamioUserCard(cardNorm)
		const deadline = Math.floor(Date.now() / 1000) + 15 * 60
		const nonce = ethers.hexlify(ethers.randomBytes(32))

		let userSignature: string
		let requestBody: Record<string, unknown>

		if (socialExchange) {
			const pointsCost = BigInt(socialExchange.pointsCost)
			const usdcReward6 = socialExchange.kind === 'usdc' ? socialExchange.usdcReward6 : 0n
			userSignature = await signer.signTypedData(
				{
					name: 'BeamioUserCardFactory',
					version: '1',
					chainId,
					verifyingContract,
				},
				{
					ClaimSocialExchange: [
						{ name: 'cardAddress', type: 'address' },
						{ name: 'tokenId', type: 'uint256' },
						{ name: 'pointsCost', type: 'uint256' },
						{ name: 'usdcReward6', type: 'uint256' },
						{ name: 'deadline', type: 'uint256' },
						{ name: 'nonce', type: 'bytes32' },
					],
				},
				{
					cardAddress: cardNorm,
					tokenId: BigInt(tokenId),
					pointsCost,
					usdcReward6,
					deadline: BigInt(deadline),
					nonce,
				},
			)
			requestBody = {
				cardAddress: cardNorm,
				couponId,
				userEOA,
				tokenId,
				deadline,
				nonce,
				userSignature,
				pointsCost: String(pointsCost),
				usdcReward6: String(usdcReward6),
				...(refWallet ? { refWallet } : {}),
			}
		} else {
			userSignature = await signer.signTypedData(
				{
					name: 'BeamioUserCardFactory',
					version: '1',
					chainId,
					verifyingContract,
				},
				{
					ClaimIssuedNft: [
						{ name: 'cardAddress', type: 'address' },
						{ name: 'tokenId', type: 'uint256' },
						{ name: 'deadline', type: 'uint256' },
						{ name: 'nonce', type: 'bytes32' },
					],
				},
				{
					cardAddress: cardNorm,
					tokenId: BigInt(tokenId),
					deadline: BigInt(deadline),
					nonce,
				},
			)
			requestBody = {
				cardAddress: cardNorm,
				couponId,
				userEOA,
				tokenId,
				deadline,
				nonce,
				userSignature,
				...(refWallet ? { refWallet } : {}),
			}
		}

		const res = await fetch(cardCouponOpenClaimEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(requestBody),
		})
		const data = (await res.json().catch(() => ({}))) as { success?: boolean; tx?: string; error?: string; tokenId?: string }
		if (!res.ok || data.success === false) {
			return {
				success: false,
				error: mapCouponOpenClaimApiError(data.error ?? `HTTP ${res.status}`),
				status: res.status,
			}
		}
		return { success: true, tx: data.tx, tokenId: data.tokenId ?? tokenId }
	} catch (e: any) {
		return { success: false, error: mapCouponOpenClaimApiError(e?.shortMessage ?? e?.message ?? String(e)) }
	}
}

/** User EIP-712 like / unlike — burns like stat token on unlike (≈ transfer to 0x0). */
function mapCardRecordUserLikeApiError(error?: string, code?: string): string {
	if (
		code === 'UC_FACTORY_GATEWAY_INVOKE_NOT_DEPLOYED' ||
		(error && /gatewayInvokeCard not deployed/i.test(error))
	) {
		return 'Likes are temporarily unavailable on this network. Please try again later.'
	}
	if (error && /already liked/i.test(error)) return 'You already liked this item.'
	if (error && /has not liked/i.test(error)) return 'You have not liked this item yet.'
	return error?.trim() || 'Like update failed'
}

export const postCardRecordUserLikeWithCurrentWallet = async (params: {
	cardAddress: string
	privateKeyArmor: string
	liked: boolean
	targetKind?: number
	issuedParentId?: string
	referrerEoa?: string | null
}): Promise<{ success: boolean; tx?: string; error?: string; status?: number; rewardTxQueued?: boolean }> => {
	const cardAddress = params.cardAddress?.trim() ?? ''
	const privateKeyArmor = params.privateKeyArmor?.trim() ?? ''
	const liked = Boolean(params.liked)
	const targetKind = Number(params.targetKind ?? 1)
	const issuedParentId = String(params.issuedParentId ?? '0')
	if (!cardAddress || !privateKeyArmor || !ethers.isAddress(cardAddress)) {
		return { success: false, error: 'Invalid cardAddress or privateKey' }
	}
	try {
		const signer = new ethers.Wallet(privateKeyArmor)
		const userEOA = ethers.getAddress(signer.address)
		const cardNorm = ethers.getAddress(cardAddress)
		const verifyingContract = await getCardFactoryGatewayForEip712(cardNorm)
		const chainId = await eip712ChainIdForBeamioUserCard(cardNorm)
		const deadline = Math.floor(Date.now() / 1000) + 15 * 60
		const nonce = ethers.hexlify(ethers.randomBytes(32))
		const userSignature = await signer.signTypedData(
			{
				name: 'BeamioUserCardFactory',
				version: '1',
				chainId,
				verifyingContract,
			},
			{
				RecordUserLike: [
					{ name: 'cardAddress', type: 'address' },
					{ name: 'userEOA', type: 'address' },
					{ name: 'targetKind', type: 'uint8' },
					{ name: 'issuedParentId', type: 'uint256' },
					{ name: 'liked', type: 'bool' },
					{ name: 'deadline', type: 'uint256' },
					{ name: 'nonce', type: 'bytes32' },
				],
			},
			{
				cardAddress: cardNorm,
				userEOA,
				targetKind,
				issuedParentId: BigInt(issuedParentId),
				liked,
				deadline: BigInt(deadline),
				nonce,
			},
		)

		const res = await fetch(cardRecordUserLikeEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				cardAddress: cardNorm,
				userEOA,
				targetKind,
				issuedParentId,
				liked,
				deadline,
				nonce,
				userSignature,
			}),
		})
		const data = (await res.json().catch(() => ({}))) as {
			success?: boolean
			tx?: string
			error?: string
			code?: string
		}
		if (!res.ok || data.success === false) {
			return {
				success: false,
				error: mapCardRecordUserLikeApiError(data.error, data.code),
				status: res.status,
			}
		}
		let rewardTxQueued = false
		if (liked) {
			try {
				rewardTxQueued = await dispatchDiscoverLikeReward13IfNeeded({
					cardAddress: cardNorm,
					actorEOA: userEOA,
					referrerEoa: params.referrerEoa,
					targetKind,
					issuedParentId,
				})
			} catch {
				/* optional reward — like already recorded */
			}
		}
		return { success: true, tx: data.tx, rewardTxQueued }
	} catch (e: any) {
		return { success: false, error: e?.shortMessage ?? e?.message ?? String(e) }
	}
}

/** 用户兑换 redeem 码：提交到 API，服务端调用 redeemForUser，将点数 mint 到用户 AA */
export const postCardRedeem = async (
	cardAddress: string,
	redeemCode: string,
	toUserEOA: string
): Promise<{ success: boolean; tx?: string; error?: string; status?: number }> => {
	if (!cardAddress || !redeemCode?.trim() || !toUserEOA || !ethers.isAddress(toUserEOA) || !ethers.isAddress(cardAddress)) {
		return { success: false, error: 'Invalid cardAddress, redeemCode, or toUserEOA' }
	}
	const trimmedCode = redeemCode.trim()
	try {
		const res = await fetch(cardRedeemEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ cardAddress, redeemCode: trimmedCode, toUserEOA }),
		})
		let data: { success?: boolean; error?: string; tx?: string } = {}
		try {
			const text = await res.text()
			if (text) data = JSON.parse(text) as typeof data
		} catch {
			// response might be HTML (e.g. 404 page)
		}
		if (!res.ok) {
			const errMsg = data.error ?? (data as { message?: string }).message ?? `HTTP ${res.status}`
			if (typeof console !== 'undefined' && console.warn) {
				console.warn('[postCardRedeem] failed:', { status: res.status, url: cardRedeemEndpoint, error: errMsg })
			}
			return { success: false, error: errMsg, status: res.status }
		}
		if (data.success !== false && data.tx) {
			return { success: true, tx: data.tx }
		}
		return { success: false, error: data.error ?? 'Redeem failed (no tx returned)', status: res.status }
	} catch (e) {
		const msg = (e as Error)?.message ?? 'Redeem request failed'
		if (typeof console !== 'undefined' && console.error) {
			console.error('[postCardRedeem] fetch error:', e)
		}
		return { success: false, error: msg }
	}
}

/** 用户拥有的 BeamioUserCard 详情（来自 cardsOfOwner + 链上 currency/price） */
export type UserCardInfo = {
	cardAddress: string
	name: string
	currency: string
	/** pointsUnitPriceInCurrencyE6：1 pt 对应多少 currency（E6），用于推导汇率 */
	priceE6: string
	/** 1 单位 currency 可换多少 pts（人类可读，token 数位 10**6） */
	ptsPer1Currency: string
}

const cardAbiSlice = [
	'function currency() view returns (uint8)',
	'function pointsUnitPriceInCurrencyE6() view returns (uint256)',
]

async function fetchCardsForOwner(ownerAddress: string): Promise<UserCardInfo[]> {
	if (!ownerAddress || !ethers.isAddress(ownerAddress)) return []
	const cards: string[] = await BeamioCardFactorySC.cardsOfOwner(ownerAddress)
	if (!cards?.length) return []
	const results: UserCardInfo[] = []
	for (const addr of cards) {
		const card = new ethers.Contract(addr, cardAbiSlice, baseEndpoint)
		const [currencyNum, priceE6Raw] = await Promise.all([
			card.currency(),
			card.pointsUnitPriceInCurrencyE6(),
		])
		const currency = getICurrency(BigInt(currencyNum))
		const priceE6 = Number(priceE6Raw)
		const ptsPer1Currency = priceE6 > 0 ? (1_000_000 / priceE6) : 0
		results.push({
			cardAddress: addr,
			name: 'User Card',
			currency,
			priceE6: String(priceE6),
			ptsPer1Currency: String(ptsPer1Currency),
		})
	}
	return results
}

/** 通过 factory.cardsOfOwner 检测用户是否拥有 BeamioUserCard，若有则返回卡列表及详情 */
export const getCardsOfOwnerWithDetails = async (ownerAddress: string): Promise<UserCardInfo[]> =>
	fetchCardsForOwner(ownerAddress)

/** 从 API 拉取 myCards。!res.ok 时抛出，不可将空 [] 当作成功。 */
async function fetchMyCardsFromApi(owners: string[]): Promise<UserCardInfo[]> {
	const qs = owners.length === 1 ? `owner=${encodeURIComponent(owners[0])}` : `owners=${owners.map((o) => encodeURIComponent(o)).join(',')}`
	const res = await fetch(`${beamioApi}/api/myCards?${qs}`)
	if (!res.ok) {
		const err = await res.text().catch(() => '') || `HTTP ${res.status}`
		throw new Error(`myCards API error: ${err}`)
	}
	const data = await res.json().catch(() => ({}))
	const items = (Array.isArray(data?.items) ? data.items : []) as UserCardInfo[]
	return filterUserCardsFromApiLists(items)
}

export type GetCardsResult = {
	cards: UserCardInfo[]
	ownerCards: UserCardInfo[]
	holderCards: UserCardInfo[]
	trusted: boolean
	/** getWalletAssets 同源余额快照（key = cardAddress lower） */
	walletAssetsByCardKey?: Record<string, MyCardAssets>
	/** getWalletAssets 解析出的 AA，profile 未写入时供 coupon / assets 使用 */
	walletResolvedAaAddress?: string | null
}

type LatestCardApiItem = {
	cardAddress?: string
	currency?: string
	priceInCurrencyE6?: string | number
	metadata?: {
		shareTokenMetadata?: {
			name?: string
		}
	}
}

type WalletAssetsCardRow = {
	cardAddress?: string
	cardName?: string
	cardCurrency?: string
	cardType?: string
	points?: string
	points6?: string
	chargeRewardPoints?: string
	chargeRewardPoints6?: string
	socialRewardPoints?: string
	socialRewardPoints6?: string
	nfts?: Array<{
		tokenId?: string | number
		attribute?: string | number
		tier?: string | number
		expiry?: string
		isExpired?: boolean
	}>
}

export type MyBrandsWalletAssetsSnapshot = {
	holderCards: UserCardInfo[]
	assetsByCardKey: Record<string, MyCardAssets>
	aaAddress: string | null
}

type GetWalletAssetsResponse = {
	ok?: boolean
	aaAddress?: string
	cards?: WalletAssetsCardRow[]
	error?: string
}

const GET_WALLET_ASSETS_HOLDER_TIMEOUT_MS = 20_000
const DEFAULT_CARD_PRICE_E6 = 1_000_000

function walletAssetsRowHasHoldings(row: WalletAssetsCardRow): boolean {
	const pts = Number(row.points ?? 0)
	const crp = Number(row.chargeRewardPoints ?? 0)
	const srp = Number(row.socialRewardPoints ?? 0)
	if (Number.isFinite(pts) && pts > 0) return true
	if (Number.isFinite(crp) && crp > 0) return true
	if (Number.isFinite(srp) && srp > 0) return true
	const nfts = row.nfts ?? []
	return nfts.some((n) => Number(n?.tokenId ?? 0) > 0)
}

/** 与 getWalletAssets holder 判定一致：点数 / charge-reward / social-reward / 任意 tokenId>0 NFT。 */
export function myCardAssetsHasHoldings(assets: MyCardAssets | null | undefined): boolean {
	if (!assets) return false
	const pts = Number(assets.points ?? 0)
	const crp = Number(assets.chargeRewardPoints ?? 0)
	const srp = Number(assets.socialRewardPoints ?? 0)
	if (Number.isFinite(pts) && pts > 0) return true
	if (Number.isFinite(crp) && crp > 0) return true
	if (Number.isFinite(srp) && srp > 0) return true
	return (assets.nfts ?? []).some((n) => Number(n?.tokenId ?? 0) > 0)
}

/** My Brands feeder：getMyAssets 空 NFT 时保留 wallet 快照中的持仓。 */
export function resolveMyCardAssetsForFeedRow(
	fromMyAssets: MyCardAssets | null,
	fromWallet: MyCardAssets | null | undefined,
	prev: MyCardAssets | null | undefined
): MyCardAssets | null {
	const wallet = fromWallet ?? null
	const prevAssets = prev ?? null
	if (fromMyAssets) {
		if (wallet) {
			const myHasNft = (fromMyAssets.nfts ?? []).some((n) => Number(n?.tokenId ?? 0) > 0)
			const walletHasNft = (wallet.nfts ?? []).some((n) => Number(n?.tokenId ?? 0) > 0)
			if (!myHasNft && walletHasNft) {
				return { ...fromMyAssets, nfts: wallet.nfts }
			}
			if (!myCardAssetsHasHoldings(fromMyAssets) && myCardAssetsHasHoldings(wallet)) {
				return wallet
			}
		}
		return fromMyAssets
	}
	return wallet ?? prevAssets
}

/** Merge social / user-cumulative stat ERC-1155 (#3–#30 on EOA) into assets.nfts for wallet display. */
export async function enrichMyCardAssetsWithProgramStatHoldings(
	assets: MyCardAssets | null,
	cardAddress: string,
	eoa: string,
	aa?: string | null
): Promise<MyCardAssets | null> {
	const statNfts = await fetchCardLevelStatNftHoldings(cardAddress, eoa, aa)
	if (!statNfts.length) return assets
	const existingIds = new Set((assets?.nfts ?? []).map((n) => String(n.tokenId)))
	const mergedNfts = [...(assets?.nfts ?? [])]
	for (const n of statNfts) {
		if (!existingIds.has(n.tokenId)) mergedNfts.push(n)
	}
	if (assets) return { ...assets, nfts: mergedNfts }
	let cardCurrency: ICurrency = 'CAD'
	try {
		const { provider } = await providerForBeamioUserCard(cardAddress)
		const c = new ethers.Contract(cardAddress, ['function currency() view returns (uint8)'], provider)
		cardCurrency = getICurrency(await c.currency())
	} catch {
		/* keep default */
	}
	return {
		address: aa && ethers.isAddress(aa) ? ethers.getAddress(aa) : '',
		cardAddress: ethers.getAddress(cardAddress),
		cardOwner: null,
		points: '0',
		cardCurrency,
		nfts: mergedNfts,
	}
}

function userCardInfoFromWalletAssetsRow(row: WalletAssetsCardRow): UserCardInfo | null {
	const rawAddr = String(row.cardAddress ?? '').trim()
	if (!rawAddr || !ethers.isAddress(rawAddr)) return null
	if (isCardExcludedFromDisplay(rawAddr)) return null
	const cardType = String(row.cardType ?? 'beamio-user-card').trim().toLowerCase()
	if (cardType && cardType !== 'beamio-user-card') return null
	if (!walletAssetsRowHasHoldings(row)) return null
	const addr = ethers.getAddress(rawAddr)
	const currency = String(row.cardCurrency ?? 'CAD').toUpperCase()
	const priceE6 = DEFAULT_CARD_PRICE_E6
	const ptsPer1Currency = priceE6 > 0 ? String(1_000_000 / priceE6) : '0'
	const name = String(row.cardName ?? 'User Card').trim() || 'User Card'
	return {
		cardAddress: addr,
		name,
		currency,
		priceE6: String(priceE6),
		ptsPer1Currency,
	}
}

function myCardAssetsFromWalletAssetsRow(
	row: WalletAssetsCardRow,
	cardAddress: string,
	aaAddress?: string | null
): MyCardAssets {
	const addr = ethers.getAddress(cardAddress)
	const aa =
		aaAddress && ethers.isAddress(aaAddress) ? ethers.getAddress(aaAddress) : ''
	const currency = String(row.cardCurrency ?? 'CAD').toUpperCase() as ICurrency
	return {
		address: aa,
		cardAddress: addr,
		points: String(row.points ?? '0'),
		cardOwner: null,
		cardCurrency: currency,
		chargeRewardPoints: row.chargeRewardPoints,
		chargeRewardPoints6: row.chargeRewardPoints6,
		socialRewardPoints: row.socialRewardPoints,
		socialRewardPoints6: row.socialRewardPoints6,
		nfts: (row.nfts ?? []).map((n) => ({
			tokenId: String(n?.tokenId ?? '0'),
			attribute: String(n?.attribute ?? '0'),
			tier: String(n?.tier ?? '0'),
			expiry: String(n?.expiry ?? ''),
			isExpired: Boolean(n?.isExpired),
		})),
	}
}

/**
 * My Brands holder 卡 + 余额：服务端 getWalletAssets（与 getUIDAssets 同源）。
 * null = 不可信失败（调用方应回退 latestCards 扫描）；holderCards=[] = 可信空。
 */
export async function fetchMyBrandsWalletAssetsSnapshot(
	eoa: string,
	existingCardAddresses: Set<string>
): Promise<MyBrandsWalletAssetsSnapshot | null> {
	if (!eoa || !ethers.isAddress(eoa)) {
		return { holderCards: [], assetsByCardKey: {}, aaAddress: null }
	}
	const ac = new AbortController()
	const to =
		typeof window !== 'undefined'
			? window.setTimeout(() => ac.abort(), GET_WALLET_ASSETS_HOLDER_TIMEOUT_MS)
			: setTimeout(() => ac.abort(), GET_WALLET_ASSETS_HOLDER_TIMEOUT_MS)
	try {
		const res = await fetch(`${beamioApi}/api/getWalletAssets`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			signal: ac.signal,
			body: JSON.stringify({
				wallet: ethers.getAddress(eoa),
				cardsScope: 'all',
				includeZeroBalanceCards: true,
			}),
		})
		if (!res.ok) return null
		const json = (await res.json().catch(() => null)) as GetWalletAssetsResponse | null
		if (!json || json.ok !== true || !Array.isArray(json.cards)) return null
		const aaAddress =
			json.aaAddress && ethers.isAddress(json.aaAddress)
				? ethers.getAddress(json.aaAddress)
				: null
		const holderCards: UserCardInfo[] = []
		const assetsByCardKey: Record<string, MyCardAssets> = {}
		const seen = new Set(existingCardAddresses)
		for (const row of json.cards) {
			const rawAddr = String(row.cardAddress ?? '').trim()
			if (!rawAddr || !ethers.isAddress(rawAddr)) continue
			if (isApiExcludedUserCard(rawAddr)) continue
			const addr = ethers.getAddress(rawAddr)
			const key = addr.toLowerCase()
			assetsByCardKey[key] = myCardAssetsFromWalletAssetsRow(row, addr, aaAddress)
			const mapped = userCardInfoFromWalletAssetsRow(row)
			if (!mapped) continue
			if (seen.has(key)) continue
			seen.add(key)
			holderCards.push(mapped)
		}
		return { holderCards, assetsByCardKey, aaAddress }
	} catch {
		return null
	} finally {
		clearTimeout(to)
	}
}

function mergeDiscoveredHolderCards(
	discovered: UserCardInfo[],
	seen: Set<string>,
	merged: UserCardInfo[],
	holderCards: UserCardInfo[]
): void {
	for (const c of discovered) {
		const key = c.cardAddress.toLowerCase()
		if (seen.has(key)) continue
		seen.add(key)
		holderCards.push(c)
		merged.push(c)
	}
}

/** latestCards 大 limit 易触发网关 504 / 长时间挂起，拖住整个 My Brands 首屏 */
const LATEST_CARDS_HOLDER_SCAN_LIMIT = 48
const LATEST_CARDS_FETCH_TIMEOUT_MS = 14_000
/** 避免对 Base RPC 同时发起数百次 getOwnershipByEOA */
const HOLDER_SCAN_RPC_CONCURRENCY = 8

async function mapPool<T, R>(items: T[], poolSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	if (!items.length) return []
	const results: R[] = new Array(items.length)
	let next = 0
	const worker = async () => {
		for (;;) {
			const i = next++
			if (i >= items.length) return
			results[i] = await fn(items[i]!)
		}
	}
	const n = Math.max(1, Math.min(poolSize, items.length))
	await Promise.all(Array.from({ length: n }, () => worker()))
	return results
}

async function fetchHeldCardsFromLatestForEOA(
	eoa: string,
	existingCardAddresses: Set<string>,
	aa?: string | null
): Promise<UserCardInfo[]> {
	if (!eoa || !ethers.isAddress(eoa)) return []
	const ac = new AbortController()
	const to =
		typeof window !== 'undefined'
			? window.setTimeout(() => ac.abort(), LATEST_CARDS_FETCH_TIMEOUT_MS)
			: setTimeout(() => ac.abort(), LATEST_CARDS_FETCH_TIMEOUT_MS)
	try {
		const res = await fetch(
			`${beamioApi}/api/latestCards?limit=${LATEST_CARDS_HOLDER_SCAN_LIMIT}`,
			{ signal: ac.signal }
		)
		if (!res.ok) return []
		const data = await res.json().catch(() => ({}))
		const items = (Array.isArray(data?.items) ? data.items : []) as LatestCardApiItem[]
		if (!items.length) return []

		const ownershipAbi = [
			'function getOwnershipByEOA(address userEOA) view returns (uint256 pt, (uint256 tokenId, uint256 attribute, uint256 tierIndexOrMax, uint256 expiry, bool isExpired)[] nfts)',
		]

		/** Card resolves EOA → AA internally; passing AA directly reverts on many cards. */
		const holderAccountsForCoupons = await resolveMyBrandsCouponHolderAccounts(eoa, aa)
		const checks = await mapPool(items, HOLDER_SCAN_RPC_CONCURRENCY, async (it) => {
			const rawAddr = String(it?.cardAddress ?? '').trim()
			if (!rawAddr || !ethers.isAddress(rawAddr)) return null
			if (isCardExcludedFromDisplay(rawAddr)) return null
			const addr = ethers.getAddress(rawAddr)
			const key = addr.toLowerCase()
			if (existingCardAddresses.has(key)) return null
			try {
				const { provider } = await providerForBeamioUserCard(addr)
				const chainHasAsset = await userHasAnyProgramAssetOnCard(addr, eoa)
				if (chainHasAsset === true) {
					const currency = String(it?.currency ?? 'CAD').toUpperCase()
					const priceNum = Number(it?.priceInCurrencyE6 ?? 0)
					const priceE6 = Number.isFinite(priceNum) && priceNum >= 0 ? priceNum : 0
					const ptsPer1Currency = priceE6 > 0 ? (1_000_000 / priceE6) : 0
					const cardName =
						String(it?.metadata?.shareTokenMetadata?.name ?? 'User Card').trim() || 'User Card'
					return {
						cardAddress: addr,
						name: cardName,
						currency,
						priceE6: String(priceE6),
						ptsPer1Currency: String(ptsPer1Currency),
					} as UserCardInfo
				}

				const card = new ethers.Contract(addr, ownershipAbi, provider)
				let hasPoints = false
				let hasNft = false
				try {
					const [pt, nftsRaw] = (await card.getOwnershipByEOA(eoa)) as [
						bigint,
						Array<{ tokenId: bigint }>,
					]
					hasPoints = (pt ?? 0n) > 0n
					hasNft =
						Array.isArray(nftsRaw) && nftsRaw.some((n) => Number(n?.tokenId ?? 0n) > 0)
				} catch {
					/* fall through to stat / issued-coupon balance scan */
				}
				let hasStatNft = false
				if (!hasPoints && !hasNft && chainHasAsset === null) {
					hasStatNft = await userHasAnyCardLevelStatBalance(addr, eoa, aa)
				}
				let hasIssuedCoupon = false
				if (!hasPoints && !hasNft && !hasStatNft) {
					const series = await fetchCardActiveIssuedCouponSeriesTrusted(addr, 10)
					if (series?.length) {
						const balContract = new ethers.Contract(addr, MY_BRANDS_COUPON_BALANCE_ABI, provider)
						for (const row of series) {
							let tokenId: bigint
							try {
								tokenId = BigInt(row.tokenId)
							} catch {
								continue
							}
							for (const acct of holderAccountsForCoupons) {
								try {
									const bal = (await balContract.balanceOf(acct, tokenId)) as bigint
									if (bal > 0n) {
										hasIssuedCoupon = true
										break
									}
								} catch {
									/* keep scanning */
								}
							}
							if (hasIssuedCoupon) break
						}
					}
				}
				if (!hasPoints && !hasNft && !hasStatNft && !hasIssuedCoupon) return null

				const currency = String(it?.currency ?? 'CAD').toUpperCase()
				const priceNum = Number(it?.priceInCurrencyE6 ?? 0)
				const priceE6 = Number.isFinite(priceNum) && priceNum >= 0 ? priceNum : 0
				const ptsPer1Currency = priceE6 > 0 ? (1_000_000 / priceE6) : 0
				const cardName = String(it?.metadata?.shareTokenMetadata?.name ?? 'User Card').trim() || 'User Card'
				return {
					cardAddress: addr,
					name: cardName,
					currency,
					priceE6: String(priceE6),
					ptsPer1Currency: String(ptsPer1Currency),
				} as UserCardInfo
			} catch {
				return null
			}
		})
		return checks.filter((v): v is UserCardInfo => Boolean(v))
	} catch {
		return []
	} finally {
		clearTimeout(to)
	}
}

/** 同时查询 aaAccount 与 keyID 下的卡（去重合并）。用于 CardManager：展示用户自己发行的 BeamioUserCard，不耦合 CCSA。
 * 当 keyID 缺失时，会从 privateKeyArmor 推导 EOA 地址作为 fallback。
 * 若 CCSA 的 owner 与用户 EOA 匹配，则始终包含 CCSA（兜底：cardsOfOwner 有时因链上/格式问题不返回）。
 * - trusted=true：RPC 或 API 明确成功，可更新 profile.issuedCards。
 * - trusted=false：RPC 与 API 均失败，返回 profile.issuedCards 作为缓存，UI 不可信空 []。
 *
 * 重要：Factory.cardsOfOwner(cardOwner) 按创建时的 cardOwner 索引。CLI 创建时 CARD_OWNER 为 EOA，
 * 则必须用 profile.keyID（或 privateKeyArmor 推导的 EOA）查询；App 创建时 cardOwner 为 aaAccount ?? keyID，
 * 则需同时查询两者。若卡由 CLI 以某 EOA 创建，但 App 登录的是不同钱包，则不会显示。 */
export const getCardsOfOwnerWithDetailsForProfile = async (
	profile: { aaAccount?: string | null; keyID?: string | null; privateKeyArmor?: string | null; issuedCards?: UserCardInfo[] }
): Promise<GetCardsResult> => {
	const aa = profile?.aaAccount?.trim()
	let eoa = profile?.keyID?.trim()
	if (!eoa && profile?.privateKeyArmor) {
		try {
			const w = new ethers.Wallet(profile.privateKeyArmor)
			eoa = w.address
		} catch (_) {}
	}
	const owners: string[] = []
	if (aa && ethers.isAddress(aa)) owners.push(ethers.getAddress(aa))
	if (eoa && ethers.isAddress(eoa)) owners.push(ethers.getAddress(eoa))
	// 去重：aa 与 eoa 可能相同（罕见）
	const uniqueOwners = [...new Set(owners)]
	if (typeof console !== 'undefined' && console.log) {
		console.log('[getCardsOfOwnerWithDetailsForProfile] 查询 owners:', uniqueOwners, '| keyID:', eoa ?? '(空)', '| aaAccount:', aa ?? '(空)')
	}
	if (uniqueOwners.length === 0) {
		if (typeof console !== 'undefined' && console.warn) {
			console.warn('[getCardsOfOwnerWithDetailsForProfile] 无有效 owner（keyID/aaAccount 均空）')
		}
		return {
			cards: [],
			ownerCards: [],
			holderCards: [],
			trusted: false,
			walletAssetsByCardKey: undefined,
			walletResolvedAaAddress: null,
		}
	}

	const cached = profile?.issuedCards ?? []
	await loadApiExcludedUserCards()

	let walletAssetsByCardKey: Record<string, MyCardAssets> | undefined
	let walletResolvedAaAddress: string | null = null
	let walletSnapshot: MyBrandsWalletAssetsSnapshot | null = null

	if (eoa && ethers.isAddress(eoa)) {
		walletSnapshot = await fetchMyBrandsWalletAssetsSnapshot(ethers.getAddress(eoa), new Set())
		if (walletSnapshot !== null) {
			walletAssetsByCardKey = walletSnapshot.assetsByCardKey
			walletResolvedAaAddress = walletSnapshot.aaAddress
		}
	}

	try {
		const ownerCardsFromApi = await fetchMyCardsFromApi(uniqueOwners)
		const seen = new Set<string>()
		const merged: UserCardInfo[] = []
		const holderCards: UserCardInfo[] = []

		for (const c of ownerCardsFromApi) {
			const key = c.cardAddress.toLowerCase()
			if (seen.has(key)) continue
			seen.add(key)
			merged.push(c)
		}

		if (eoa && ethers.isAddress(eoa)) {
			if (walletSnapshot !== null) {
				mergeDiscoveredHolderCards(walletSnapshot.holderCards, seen, merged, holderCards)
			}
			const discoveredHolderCards = await fetchHeldCardsFromLatestForEOA(
				ethers.getAddress(eoa),
				seen,
				aa ?? walletResolvedAaAddress
			)
			mergeDiscoveredHolderCards(discoveredHolderCards, seen, merged, holderCards)
		}

		const ownerCards = merged.filter(
			(c) => !holderCards.some((h) => h.cardAddress.toLowerCase() === c.cardAddress.toLowerCase())
		)
		if (merged.length === 0 && typeof console !== 'undefined' && console.warn) {
			console.warn('[getCardsOfOwnerWithDetailsForProfile] API 返回 0 张卡。owners:', uniqueOwners)
		}
		return {
			cards: filterUserCardsFromApiLists(merged),
			ownerCards: filterUserCardsFromApiLists(ownerCards),
			holderCards: filterUserCardsFromApiLists(holderCards),
			trusted: true,
			walletAssetsByCardKey,
			walletResolvedAaAddress,
		}
	} catch (apiErr) {
		if (typeof console !== 'undefined' && console.warn) {
			console.warn(
				'[getCardsOfOwnerWithDetailsForProfile] API 失败，返回缓存。owners:',
				uniqueOwners,
				'cached:',
				cached.length,
				(apiErr as Error)?.message ?? apiErr
			)
		}
		return {
			cards: filterUserCardsFromApiLists(cached),
			ownerCards: [],
			holderCards: [],
			trusted: false,
			walletAssetsByCardKey: undefined,
			walletResolvedAaAddress: null,
		}
	}
}

/** ERC-1155 shareTokenMetadata，写入 0x{owner}.json */
export type ShareTokenMetadata = {
	name: string
	description?: string
	image?: string
	pointSystem?: CardPointSystemMetadata
}

/** Tier 类型 metadata，存于 0x{owner}.json，回送 {NFT}.json 时包含；image 为 IPFS URL，backgroundColor 为 CSS 颜色（如 #hex）。升级模式由卡级 upgradeType（链上）决定。 */
export type TierMetadata = {
	index: number
	minUsdc6: string
	attr: number
	/** 0 => 使用卡全局 expirySeconds */
	tierExpirySeconds?: number
	name?: string
	description?: string
	image?: string
	backgroundColor?: string
}

/** createCardCollectionWithInitCode 所需关键参数 */
export type CreateBeamioCardParams = {
	/** 卡归属地址（cardOwner） */
	cardOwner: string
	/** 币种：CAD | USD | JPY | CNY | USDC | HKD | EUR | SGD | TWD */
	currency: 'CAD' | 'USD' | 'JPY' | 'CNY' | 'USDC' | 'HKD' | 'EUR' | 'SGD' | 'TWD'
	/** Human-readable: X currency units = 1 point. e.g. 1 means "1 CAD = 1 point". Backend converts to priceInCurrencyE6. */
	unitPriceHuman: string | number
	/** metadata URI（可选），默认 0x{owner}.json 由后端生成 */
	uri?: string
	/** When true, card is deployed with points transfer whitelist enforcement enabled */
	transferWhitelistEnabled?: boolean
	upgradeType?: 0 | 1 | 2
	/** ERC-1155 shareTokenMetadata，用于创建 0x{owner}.json */
	shareTokenMetadata?: ShareTokenMetadata
	/** Tier 类型 metadata（如 Gold Card 说明），存于 0x{owner}.json，回送 NFT metadata 时包含 */
	tiers?: TierMetadata[]
}

/** 创建 BeamioUserCard，调用后端 /api/createCard。Cluster 预检后转发 master 排队，daemon 上链后回传 cardAddress 和 hash。 */
export const createBeamioCard = async (params: CreateBeamioCardParams): Promise<{ success: boolean; cardAddress?: string; hash?: string; error?: string }> => {
	try {
		const body = JSON.stringify({
			cardOwner: params.cardOwner,
			currency: params.currency,
			unitPriceHuman: String(params.unitPriceHuman),
			...(params.uri && { uri: params.uri }),
			...(typeof params.transferWhitelistEnabled === 'boolean' && {
				transferWhitelistEnabled: params.transferWhitelistEnabled,
			}),
			...(params.upgradeType === 1 || params.upgradeType === 2 ? { upgradeType: params.upgradeType } : {}),
			...(params.shareTokenMetadata && { shareTokenMetadata: params.shareTokenMetadata }),
			...(params.tiers && params.tiers.length > 0 && { tiers: params.tiers }),
		})
		logCreateCardRequestBody(createCardEndpoint, body)
		const response = await fetch(createCardEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body,
		})
		const data = await response.json()
		if (response.ok && data.success) {
			return { success: true, cardAddress: data.cardAddress, hash: data.hash }
		}
		return { success: false, error: data.error ?? 'Create card failed' }
	} catch (e: any) {
		return { success: false, error: e?.message ?? String(e) }
	}
}

/** 互斥锁：同一时间只允许一个 postBuyCardPoints 执行 */
let postBuyCardPointsLock = false

/** @param usdcAmount 应付 USDC 数量（人类可读，如 "10.5"），须由链上 currency→USD→USDC 得到（quoteCurrencyAmountInUSDC） */
export const postBuyCardPoints = async (
    usdcAmount: number | string,
    profile: profile,
    cardAddress: string
) => {
        if (postBuyCardPointsLock) {
            return {
                success: false,
                error: "Another purchase is in progress. Please wait for it to complete.",
                txHash: null
            }
        }
        postBuyCardPointsLock = true
        try {
            const usdcStr = typeof usdcAmount === "number" ? String(usdcAmount) : usdcAmount
            const request = await USDC2Token(profile.privateKeyArmor, usdcStr, cardAddress)
            // 请求体禁止 BigInt，确保 JSON 可序列化（与 Icard 类型一致）
            const body = JSON.stringify(request, (_k, v) => (typeof v === 'bigint' ? String(v) : v))
            const response = await fetch(purchasingCardEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body
            })
            const data: {
				error: string, USDC_tx: string, success: boolean
			} = await response.json()
            if (response.ok) {
                const assets = await getMyAssets(profile, cardAddress)
				return { success: true, assets: assets, txHash: data.USDC_tx }
            } else {
                return { success: false, error: data.error, txHash: data.USDC_tx }
            }

        } catch (error: any) {
            console.log(`❌ Direct Purchase Failed: ${error.message}`);
            return { success: false, error: error.message, txHash: null }
        } finally {
            postBuyCardPointsLock = false
        }
    }

export type USDCUserCardTopupIntent = 'first_purchase' | 'upgrade' | 'topup'
export type USDCUserCardTopupPreviewIntent = 'auto' | USDCUserCardTopupIntent

export type USDCUserCardTopupPreviewPayload = {
	intent: USDCUserCardTopupIntent
	hasMembership: boolean
	currentPoints6: string
	currentTierIndex: number
	minTierUsdc6: string
	nextTierMinUsdc6?: string
	requiredMinUsdc6: string
	recommendedUsdc6: string
}

export const postUSDCUserCardTopupPreview = async (params: {
	cardAddress: string
	from: string
	intent?: USDCUserCardTopupPreviewIntent
	usdcAmount?: string
}): Promise<{
	success: boolean
	error?: string
	preview?: USDCUserCardTopupPreviewPayload
	amountCheck?: { ok: boolean; requiredMinUsdc6: string; providedUsdc6: string }
}> => {
	const { cardAddress, from, intent = 'auto', usdcAmount } = params
	try {
		const response = await fetch(usdcTopupPreviewEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				cardAddress,
				from,
				intent,
				...(typeof usdcAmount === 'string' && usdcAmount.trim() !== '' && { usdcAmount: usdcAmount.trim() }),
			}),
		})
		const data = await response.json().catch(() => ({}))
		if (!response.ok) {
			return { success: false, error: data?.error ?? 'USDC topup preview failed' }
		}
		return {
			success: true,
			preview: data?.preview,
			amountCheck: data?.amountCheck,
		}
	} catch (e: any) {
		return { success: false, error: e?.message ?? String(e) }
	}
}

/** 通用 USDC Topup：用户离线签 EIP-3009，提交到新接口 /api/usdcTopup（Cluster 预检后转发 Master）。 */
export const postUSDCUserCardTopup = async (params: {
	profile: profile
	cardAddress: string
	usdcAmount: string | number
	intent: USDCUserCardTopupIntent
}): Promise<{ success: boolean; error?: string; txHash?: string; assets?: MyCardAssets | null }> => {
	const { profile, cardAddress, usdcAmount, intent } = params
	const usdcStr = typeof usdcAmount === 'number' ? String(usdcAmount) : String(usdcAmount ?? '')
	if (!usdcStr || Number(usdcStr) <= 0) {
		return { success: false, error: 'Invalid usdcAmount' }
	}
	try {
		const request = await USDC2Token(profile.privateKeyArmor, usdcStr, cardAddress)
		const body = JSON.stringify({ ...request, intent }, (_k, v) => (typeof v === 'bigint' ? String(v) : v))
		const response = await fetch(usdcTopupEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body,
		})
		const data = await response.json().catch(() => ({}))
		if (!response.ok) {
			return { success: false, error: data?.error ?? 'USDC topup failed' }
		}
		const assets = await getMyAssets(profile, cardAddress)
		return { success: true, txHash: data?.USDC_tx, assets }
	} catch (e: any) {
		return { success: false, error: e?.message ?? String(e) }
	}
}

/** 获取卡的 owner 地址。executeForOwner 要求签名者必须等于 card.owner()，AA 为 owner 时需用 EOA 签会失败。 */
export const getCardOwner = async (cardAddress: string): Promise<string> => {
	const { provider } = await providerForBeamioUserCard(cardAddress)
	const card = new ethers.Contract(cardAddress, ['function owner() view returns (address)'], provider)
	return ethers.getAddress(await card.owner())
}

/** EIP-712 签名：Owner 授权 executeForOwner(cardAddr, data, deadline, nonce)。通用接口，支持 createRedeem、cancelRedeem 等。
 * 注意：签名者（从 privateKey 恢复的 EOA）必须等于 card.owner()。若卡 owner 为 AA 地址，用 EOA 签会 revert UC_InvalidSignature。 */
export const signExecuteForOwner = async (
    ownerPrivateKey: string,
    cardAddress: string,
    data: string,
    deadline: number,
    nonce: string
): Promise<string> => {
    const { provider } = await providerForBeamioUserCard(cardAddress)
    const wallet = new ethers.Wallet(ownerPrivateKey, provider)
    const factoryAddress = await getCardFactoryGatewayForEip712(cardAddress)
    const chainId = await eip712ChainIdForBeamioUserCard(cardAddress)
    const domain = {
        name: 'BeamioUserCardFactory',
        version: '1',
        chainId,
        verifyingContract: factoryAddress,
    }
    const types = {
        ExecuteForOwner: [
            { name: 'cardAddress', type: 'address' },
            { name: 'dataHash', type: 'bytes32' },
            { name: 'deadline', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' },
        ],
    }
    const dataHash = ethers.keccak256(data)
    const value = { cardAddress, dataHash, deadline, nonce }
    return wallet.signTypedData(domain, types, value)
}

const createRedeemInterface = new ethers.Interface([
    'function createRedeem(bytes32 hash,uint256 points6,uint256 attr,uint64 validAfter,uint64 validBefore,uint256[] tokenIds,uint256[] amounts)',
])

const createRedeemBatchInterface = new ethers.Interface([
    'function createRedeemBatch(bytes32[] hashes,uint256 points6,uint256 attr,uint64 validAfter,uint64 validBefore,uint256[] tokenIds,uint256[] amounts)',
])

/** 构建 createRedeemBatch 的 calldata（供 executeForOwner 使用）。codes 经 keccak256 得到 hashes。points6 仅放 bundle，top-level points6 传 0 避免兑换时双倍 mint */
export const encodeCreateRedeemBatch = (
    codes: string[],
    points6: bigint,
    validAfter: number,
    validBefore: number
): string => {
    const hashes = codes.map((c) => ethers.keccak256(ethers.toUtf8Bytes(c)))
    const tokenIds = [0n]
    const amounts = [points6]
    return createRedeemBatchInterface.encodeFunctionData('createRedeemBatch', [hashes, 0n, 0n, validAfter, validBefore, tokenIds, amounts])
}

/** 构建 createRedeem 的 calldata（供 executeForOwner 使用）。hash 来自 generateCODE(passcode)。points6 仅放 bundle，top-level 传 0 避免兑换时双倍 mint */
export const encodeCreateRedeem = (
    hash: string,
    points6: bigint,
    validAfter: number,
    validBefore: number
): string => {
    const tokenIds = [0n]
    const amounts = [points6]
    return createRedeemInterface.encodeFunctionData('createRedeem', [
        hash,
        0n,
        0n,
        validAfter,
        validBefore,
        tokenIds,
        amounts,
    ])
}

/** 提交批量创建 redeem 到 API cardCreateRedeem。使用 createRedeemBatch，无需 toUserEOA。 */
export const postCardCreateRedeem = async (payload: {
    cardAddress: string
    codes: string[]
    points6: string | number
    validAfter: number
    validBefore: number
    deadline: number
    nonce: string
    ownerSignature: string
}): Promise<{ success: boolean; error?: string; codes?: string[] }> => {
    try {
        const body = {
            cardAddress: payload.cardAddress,
            codes: payload.codes,
            points6: String(payload.points6),
            attr: 0,
            validAfter: payload.validAfter,
            validBefore: payload.validBefore,
            tokenIds: ['0'],
            amounts: [String(payload.points6)],
            deadline: payload.deadline,
            nonce: payload.nonce,
            ownerSignature: payload.ownerSignature,
        }
        const res = await fetch(cardCreateRedeemEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) return { success: false, error: data.error ?? 'cardCreateRedeem failed' }
        return { success: true, codes: payload.codes }
    } catch (e: any) {
        return { success: false, error: e?.message ?? String(e) }
    }
}

const cancelRedeemInterface = new ethers.Interface([
    'function cancelRedeem(string code)',
])

/** 构建 cancelRedeem 的 calldata（供 executeForOwner 使用） */
export const encodeCancelRedeem = (code: string): string =>
    cancelRedeemInterface.encodeFunctionData('cancelRedeem', [code])

const adminManagerInterface = new ethers.Interface([
    'function adminManager(address to, bool admin, uint256 newThreshold, string metadata)',
])

/** 构建 adminManager 的 calldata。admin=true 添加并写入 metadata，admin=false 移除（metadata 可传空，移除时 metadata 保留可查） */
export const encodeAdminManager = (to: string, admin: boolean, newThreshold: number | bigint, metadata: string = ''): string =>
    adminManagerInterface.encodeFunctionData('adminManager', [to, admin, BigInt(newThreshold), metadata])

/** 便捷：添加 admin（带 metadata） */
export const encodeAddAdmin = (newAdmin: string, newThreshold: number | bigint, metadata: string = ''): string =>
    encodeAdminManager(newAdmin, true, newThreshold, metadata)

/** 便捷：移除 admin */
export const encodeRemoveAdmin = (adminToRemove: string, newThreshold: number | bigint): string =>
    encodeAdminManager(adminToRemove, false, newThreshold, '')

const createRedeemAdminInterface = new ethers.Interface([
    'function createRedeemAdmin(bytes32 hash, string metadata, uint64 validAfter, uint64 validBefore)',
    'function createRedeemAdmin(bytes32 hash, string metadata, uint64 validAfter, uint64 validBefore, uint256 mintLimit)',
])

/** 构建 createRedeemAdmin 的 calldata（供 executeForOwner 使用）。hash=keccak256(secretCode)，owner 离线签字后由 API 代付 gas 执行。mintLimitPoints6 可选，0 或省略表示无限制。 */
export const encodeCreateRedeemAdmin = (
    hash: string,
    metadata: string,
    validAfter: number,
    validBefore: number,
    mintLimitPoints6?: bigint
): string => {
    const hashBytes32 = hash.length === 66 && hash.startsWith('0x') ? hash as `0x${string}` : ethers.keccak256(ethers.toUtf8Bytes(hash))
    if (mintLimitPoints6 != null && mintLimitPoints6 > 0n) {
        return createRedeemAdminInterface.encodeFunctionData('createRedeemAdmin(bytes32,string,uint64,uint64,uint256)', [
            hashBytes32,
            metadata,
            BigInt(validAfter),
            BigInt(validBefore),
            mintLimitPoints6,
        ])
    }
    return createRedeemAdminInterface.encodeFunctionData('createRedeemAdmin(bytes32,string,uint64,uint64)', [
        hashBytes32,
        metadata,
        BigInt(validAfter),
        BigInt(validBefore),
    ])
}

const appendTierInterface = new ethers.Interface([
    'function appendTier(uint256 minUsdc6, uint256 attr, uint256 tierExpirySeconds)',
])

/** 构建 appendTier 的 calldata（供 executeForOwner 或 appendTierForCardWithOwnerSignature 使用）。tierExpirySeconds=0 表示使用卡全局 expirySeconds */
export const encodeAppendTier = (
    minUsdc6: number | bigint | string,
    attr: number | bigint,
    tierExpirySeconds: number | bigint
): string =>
    appendTierInterface.encodeFunctionData('appendTier', [
        BigInt(minUsdc6),
        BigInt(attr),
        BigInt(tierExpirySeconds),
    ])

const createIssuedNftInterface = new ethers.Interface([
    'function createIssuedNft(bytes32 title, uint64 validAfter, uint64 validBefore, uint256 maxSupply, uint256 priceInCurrency6, bytes32 sharedMetadataHash)',
])

/** 构建 createIssuedNft 的 calldata（供 executeForOwner 使用）。title 为字符串时用 keccak256(toUtf8Bytes(title))；sharedMetadataHash 省略或 "0" 表示无，由服务端组装 EIP-1155 metadata */
export const encodeCreateIssuedNft = (
    title: string,
    validAfter: number,
    validBefore: number,
    maxSupply: number | bigint,
    priceInCurrency6: number | bigint,
    sharedMetadataHash?: string
): string => {
    const titleHash = title.startsWith('0x') && title.length === 66
        ? title as `0x${string}`
        : ethers.keccak256(ethers.toUtf8Bytes(title))
    const hashBytes32 = !sharedMetadataHash || sharedMetadataHash === '0' || sharedMetadataHash === '0x0'
        ? ethers.ZeroHash
        : sharedMetadataHash.length === 66 && sharedMetadataHash.startsWith('0x')
            ? sharedMetadataHash as `0x${string}`
            : ethers.keccak256(ethers.toUtf8Bytes(sharedMetadataHash))
    return createIssuedNftInterface.encodeFunctionData('createIssuedNft', [
        titleHash,
        BigInt(validAfter),
        BigInt(validBefore),
        BigInt(maxSupply),
        BigInt(priceInCurrency6),
        hashBytes32,
    ])
}

const cardCreateIssuedNftEndpoint = `${beamioApi}/api/cardCreateIssuedNft`

/** 提交 createIssuedNft 到 API cardCreateIssuedNft。Cluster 预检后转发 Master executeForOwner 代付 gas 上链。可选 description、image（IPFS/fragment link）、background_color 用于服务端组装 EIP-1155 metadata */
export const postCardCreateIssuedNft = async (payload: {
    cardAddress: string
    data: string
    deadline: number
    nonce: string
    ownerSignature: string
    description?: string
    image?: string
    background_color?: string
}): Promise<{ success: boolean; hash?: string; error?: string }> => {
    try {
        const res = await fetch(cardCreateIssuedNftEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) return { success: false, error: data.error ?? 'cardCreateIssuedNft failed' }
        return { success: true, hash: data.hash }
    } catch (e: any) {
        return { success: false, error: e?.message ?? String(e) }
    }
}

/** 提交 adminManager 到 API cardAdminManager。Cluster 预检后转发 Master executeForOwner 排队，返回 tx hash */
export const postCardAddAdmin = async (payload: {
    cardAddress: string
    data: string
    deadline: number
    nonce: string
    ownerSignature: string
}): Promise<{ success: boolean; hash?: string; error?: string }> => {
    try {
        const body = {
            cardAddress: payload.cardAddress,
            data: payload.data,
            deadline: payload.deadline,
            nonce: payload.nonce,
            ownerSignature: payload.ownerSignature,
        }
        const res = await fetch(cardAddAdminEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) return { success: false, error: data.error ?? 'cardAddAdmin failed' }
        return { success: true, hash: data.hash }
    } catch (e: any) {
        return { success: false, error: e?.message ?? String(e) }
    }
}

/** 提交 createRedeemAdmin 到 API cardCreateRedeemAdmin。Cluster 预检后转发 Master executeForOwner 代付 gas 上链。 */
export const postCardCreateRedeemAdmin = async (payload: {
    cardAddress: string
    data: string
    deadline: number
    nonce: string
    ownerSignature: string
}): Promise<{ success: boolean; hash?: string; error?: string }> => {
    try {
        const res = await fetch(cardCreateRedeemAdminEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) return { success: false, error: data.error ?? 'cardCreateRedeemAdmin failed' }
        return { success: true, hash: data.hash }
    } catch (e: any) {
        return { success: false, error: e?.message ?? String(e) }
    }
}

/** 用户兑换 redeem-admin 码：提交到 API，服务端调用 redeemAdminForUser，将 to 添加为 admin */
export const postCardRedeemAdmin = async (
    cardAddress: string,
    redeemCode: string,
    to: string
): Promise<{ success: boolean; tx?: string; error?: string; status?: number }> => {
    if (!cardAddress || !redeemCode?.trim() || !to || !ethers.isAddress(to) || !ethers.isAddress(cardAddress)) {
        return { success: false, error: 'Invalid cardAddress, redeemCode, or to' }
    }
    const trimmedCode = redeemCode.trim()
    try {
        const res = await fetch(cardRedeemAdminEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cardAddress, redeemCode: trimmedCode, to }),
        })
        let data: { success?: boolean; error?: string; tx?: string } = {}
        try {
            const text = await res.text()
            if (text) data = JSON.parse(text) as typeof data
        } catch {
            // response might be HTML (e.g. 404 page)
        }
        if (!res.ok) {
            const errMsg = data.error ?? (data as { message?: string }).message ?? `HTTP ${res.status}`
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[postCardRedeemAdmin] failed:', { status: res.status, url: cardRedeemAdminEndpoint, error: errMsg })
            }
            return { success: false, error: errMsg, status: res.status }
        }
        if (data.success !== false && data.tx) {
            return { success: true, tx: data.tx }
        }
        return { success: false, error: data.error ?? 'Redeem admin failed (no tx returned)', status: res.status }
    } catch (e) {
        const msg = (e as Error)?.message ?? 'Redeem admin request failed'
        if (typeof console !== 'undefined' && console.error) {
            console.error('[postCardRedeemAdmin] fetch error:', e)
        }
        return { success: false, error: msg }
    }
}

const getRedeemStatusAbi = [
	'function getRedeemStatus(bytes32 hash) view returns (bool active, uint256 totalPoints6)',
	'function getRedeemStatusBatch(string[] codes) view returns (bool[] active, uint256[] totalPoints6)',
	'function getRedeemStatusBatch(bytes32[] hashes) view returns (bool[] active, uint256[] totalPoints6)',
]

export type RedeemStatusChain = 'redeemed' | 'cancelled' | 'pending' | 'not_found'

/** Redeem batch 项（code + hash） */
export type CardRedeemItem = { code: string; hash: string }

/** Redeem batch：owner 创建的 redeem 列表，存于 CoNET_Data.cardRedeems */
export type CardRedeemBatch = {
	batchId: string
	cardAddress: string
	cardName?: string
	currency?: string
	points6?: string
	pointsHuman: string
	ptsPer1Currency?: string
	createdAt: number
	items: CardRedeemItem[]
}

/** 从 CoNET_Data.cardRedeems 中移除合约返回 not_found 的 redeem，并持久化 */
export const removeNotFoundRedeems = (hashesToRemove: Set<string>) => {
	if (hashesToRemove.size === 0) return
	const temp = CoNET_Data
	if (!temp?.cardRedeems?.length) return
	const next = temp.cardRedeems
		.map((b) => ({
			...b,
			items: b.items.filter((i) => !hashesToRemove.has(i.hash)),
		}))
		.filter((b) => b.items.length > 0)
	temp.cardRedeems = next
	setCoNET_Data(temp)
	storeSystemData()
}

/** 通过 BeamioUserCard.getRedeemStatus(bytes32) 从合约直接读取 RedeemStorage，无需扫描区块或事件 */
function _decodeRedeemStatus(active: boolean): RedeemStatusChain {
    if (active) return 'pending'
    // active=false：查无此 redeem 或已结束，合约返回空值，需从本地列表删除
    return 'not_found'
}

/** 单次查询：通过 getRedeemStatus(bytes32) 从合约直接读取，不做区块/事件扫描 */
export const getRedeemStatusFromChain = async (
    cardAddress: string,
    hash: string
): Promise<RedeemStatusChain> => {
    const hashBytes32 = hash.length === 66 && hash.startsWith('0x') ? hash as `0x${string}` : ethers.keccak256(ethers.toUtf8Bytes(hash))
    try {
        const card = new ethers.Contract(cardAddress, getRedeemStatusAbi, baseEndpoint)
        const [active] = await card.getRedeemStatus(hashBytes32)
        return _decodeRedeemStatus(active)
    } catch (e) {
        if (isRpcQuotaOrNetworkError(e)) reportRpcFailure()
        return 'pending'
    }
}

/** RedeemStorage.layout().redeems — verified against BeamioUserCard delegatecall storage. */
const REDEEM_STORAGE_LAYOUT_SLOT = ethers.keccak256(ethers.toUtf8Bytes('beamio.usercard.redeem.storage.v1'))
/** Redeem struct field offset for `tokenIds.length` (slot base + 2). */
const REDEEM_TOKEN_IDS_FIELD_OFFSET = 2n
const REDEEM_BUNDLE_TOKEN_IDS_MAX = 32

/**
 * Read one-time redeem bundle tokenIds from card storage (preview only; does not consume).
 * Returns `null` when RPC/storage read is untrusted; `[]` when redeem exists but bundle is empty.
 */
export async function fetchRedeemBundleTokenIdsFromChain(
	cardAddress: string,
	redeemCode: string,
): Promise<string[] | null> {
	const cardNorm = cardAddress?.trim() ?? ''
	const code = redeemCode?.trim() ?? ''
	if (!cardNorm || !code || !ethers.isAddress(cardNorm)) return null
	try {
		const hash = ethers.keccak256(ethers.toUtf8Bytes(code))
		const baseSlot = ethers.keccak256(
			ethers.AbiCoder.defaultAbiCoder().encode(['bytes32', 'bytes32'], [hash, REDEEM_STORAGE_LAYOUT_SLOT]),
		)
		const tokenIdsArrSlot = ethers.toBeHex(BigInt(baseSlot) + REDEEM_TOKEN_IDS_FIELD_OFFSET, 32)
		const lenHex = await baseEndpoint.getStorage(cardNorm, tokenIdsArrSlot)
		const len = BigInt(lenHex)
		if (len <= 0n) return []
		if (len > BigInt(REDEEM_BUNDLE_TOKEN_IDS_MAX)) return []
		const dataBase = BigInt(ethers.keccak256(tokenIdsArrSlot))
		const tokenIds: string[] = []
		for (let i = 0n; i < len; i++) {
			const slot = ethers.toBeHex(dataBase + i, 32)
			const v = await baseEndpoint.getStorage(cardNorm, slot)
			tokenIds.push(BigInt(v).toString())
		}
		return tokenIds
	} catch (e) {
		if (isRpcQuotaOrNetworkError(e)) reportRpcFailure()
		return null
	}
}

/** Redeem 详情（用于 Redeem 窗口展示）：status、points、card 信息、owner 的 beamio 档案 */
export type RedeemDetailsForDisplay = {
    status: RedeemStatusChain
    points6: string
    pointsHuman: string
    currency: string
    ptsPer1Currency: string
    cardName?: string
    ownerProfile: searchResult | null
}

/** 检测是否为合约 revert、RPC 非标准错误或网络错误 */
function isContractRevertOrUpstreamError(e: unknown): boolean {
    const msg = String((e as Error)?.message ?? e)
    return (
        /execution reverted/i.test(msg) ||
        /invalid BytesLike value/i.test(msg) ||
        /upstream_error/i.test(msg) ||
        /Failed to fetch/i.test(msg) ||
        /fetch failed/i.test(msg)
    )
}

/** CCSA 卡地址（getRedeemStatus 正常）；非 CCSA UserCard 优先用 getRedeemStatusEx 避免 revert */
function isCcsaCardForRedeem(addr: string): boolean {
    const a = (addr || '').trim().toLowerCase()
    if (!a) return false
    return (
        a === BASE_MAINNET_FACTORIES.BeamioCardCCSA_ADDRESS.toLowerCase() ||
        a === CCSA_Card_Address.toLowerCase()
    )
}

/** 从 RPC 拉取 redeem 详细信息：状态、资产、卡信息、发行者 profile */
export const getRedeemDetailsForDisplay = async (
    cardAddress: string,
    code: string
): Promise<RedeemDetailsForDisplay | null> => {
    if (!cardAddress || !code?.trim() || !ethers.isAddress(cardAddress)) return null
    const hash = ethers.keccak256(ethers.toUtf8Bytes(code.trim()))
    try {
        const cardAbiExtended = [
            ...getRedeemStatusAbi,
            'function getRedeemStatusEx(bytes32 hash, address claimer) view returns (bool active, uint128 points6, bool isPool)',
            'function owner() view returns (address)',
            'function currency() view returns (uint8)',
            'function pointsUnitPriceInCurrencyE6() view returns (uint256)',
        ]

		const rpcEndpoint = baseEndpoint
        const card = new ethers.Contract(cardAddress, cardAbiExtended, rpcEndpoint)
        const hashBytes32 = hash.length === 66 && hash.startsWith('0x') ? hash as `0x${string}` : hash as `0x${string}`

        // 1) 获取 redeem 状态：CCSA 卡用 getRedeemStatus（正常）；非 CCSA UserCard 优先用 getRedeemStatusEx（不遍历 bundle，避免 revert）
        let active: boolean
        let totalPoints6: bigint
        let statusFromApi: RedeemStatusChain | null = null
        if (isCcsaCardForRedeem(cardAddress)) {
            try {
                const [a, t] = await card.getRedeemStatus(hashBytes32)
                active = a
                totalPoints6 = t
            } catch (revertErr) {
                if (isContractRevertOrUpstreamError(revertErr)) {
                    try {
                        const [aList, tList] = await card.getRedeemStatusBatch([code.trim()])
                        active = aList[0]
                        totalPoints6 = tList[0]
                    } catch {
                        const apiStatuses = await getRedeemStatusBatchFromApi([{ cardAddress, hash, code }])
                        const apiStatus = apiStatuses?.[hash]
                        if (apiStatus) {
                            active = apiStatus === 'pending'
                            totalPoints6 = 0n
                            statusFromApi = apiStatus as RedeemStatusChain
                            console.warn('[getRedeemDetailsForDisplay] CCSA 合约 revert，使用 API 状态:', cardAddress, apiStatus)
                        } else {
                            console.warn('[getRedeemDetailsForDisplay] CCSA getRedeemStatus/Batch revert:', cardAddress, (revertErr as Error)?.message)
                            return null
                        }
                    }
                } else throw revertErr
            }
        } else {
            // 非 CCSA：优先 getRedeemStatusEx，避免 _redeemTotalPoints 迭代 revert
            try {
                const [aEx, ptsEx, isPool] = await card.getRedeemStatusEx(hashBytes32, ethers.ZeroAddress)
                active = aEx
                if (isPool) {
                    totalPoints6 = 0n
                } else if (aEx && ptsEx === 0n) {
                    // createRedeemBatch 将 points 仅放 bundle，r.points6=0；需用 getRedeemStatus 取 _redeemTotalPoints
                    try {
                        const [, total] = await card.getRedeemStatus(hashBytes32)
                        totalPoints6 = total
                    } catch {
                        totalPoints6 = 0n
                    }
                } else {
                    totalPoints6 = BigInt(ptsEx)
                }
            } catch (exErr) {
                if (isContractRevertOrUpstreamError(exErr)) {
                    try {
                        const [a, t] = await card.getRedeemStatus(hashBytes32)
                        active = a
                        totalPoints6 = t
                    } catch {
                        try {
                            const [aList, tList] = await card.getRedeemStatusBatch([code.trim()])
                            active = aList[0]
                            totalPoints6 = tList[0]
                        } catch {
                            // 合约全部 revert 时，尝试 API：服务端 catch revert 后返回 pending
                            const apiStatuses = await getRedeemStatusBatchFromApi([{ cardAddress, hash, code }])
                            const apiStatus = apiStatuses?.[hash]
                            if (apiStatus) {
                                active = apiStatus === 'pending'
                                totalPoints6 = 0n
                                statusFromApi = apiStatus as RedeemStatusChain
                                console.warn('[getRedeemDetailsForDisplay] 合约 revert，使用 API 状态:', cardAddress, apiStatus)
                            } else {
                                console.warn('[getRedeemDetailsForDisplay] UserCard getRedeemStatusEx/Status/Batch 均 revert:', cardAddress, (exErr as Error)?.message)
                                return null
                            }
                        }
                    }
                } else throw exErr
            }
        }

        // 2) owner、currency、price：任一 revert 时使用默认值，仍返回 redeem 状态
        let owner = ethers.ZeroAddress
        let currencyNum = 0n
        let priceE6Raw = 0n
        try {
            const [o, c] = await Promise.all([card.owner(), card.currency()])
            owner = o
            currencyNum = BigInt(c)
            try {
                const p = await card.pointsUnitPriceInCurrencyE6()
                priceE6Raw = p
            } catch {
                const cardLegacy = new ethers.Contract(
                    cardAddress,
                    ['function pointsUnitPriceInCurrencyE18() view returns (uint256)'],
                    baseEndpoint
                )
                const priceE18 = await cardLegacy.pointsUnitPriceInCurrencyE18()
                priceE6Raw = BigInt(Math.round(Number(priceE18) / 1e12))
            }
        } catch (metaErr) {
            if (isContractRevertOrUpstreamError(metaErr)) {
                console.warn('[getRedeemDetailsForDisplay] owner/currency/price revert，使用默认值:', (metaErr as Error)?.message)
            } else throw metaErr
        }

        // 合约仅存储 active，无法区分 redeemed/cancelled；API 有缓存且同样依赖合约。
        // 以链上 active 为唯一可信来源，避免 API 缓存导致“已取消仍显示 Valid”的不一致。
        // 若来自 API fallback（合约 revert），直接使用 API 返回的 status
        const status = statusFromApi ?? _decodeRedeemStatus(active)

        const currency = getICurrency(BigInt(currencyNum))
        const priceE6 = Number(priceE6Raw)
        const ptsPer1Currency = priceE6 > 0 ? (1_000_000 / priceE6) : 0
        const pointsHuman = (Number(ethers.formatUnits(totalPoints6, 6))).toFixed(6).replace(/\.?0+$/, '')

        let ownerProfile: searchResult | null = null
        if (owner && owner !== ethers.ZeroAddress) {
            const search = await searchUsername(owner)
            ownerProfile = search?.results?.[0] ?? null
        }

        let cardName: string | undefined
        try {
            const res = await fetch(`${beamioApi}/api/myCards?owner=${encodeURIComponent(owner)}`)
            if (res.ok) {
                const data = await res.json().catch(() => ({}))
                const items = (data?.items ?? []) as Array<{ cardAddress: string; name?: string }>
                const match = items.find((c: any) => (c.cardAddress || '').toLowerCase() === cardAddress.toLowerCase())
                if (match?.name) cardName = match.name
            }
        } catch {}

        return {
            status,
            points6: String(totalPoints6),
            pointsHuman,
            currency,
            ptsPer1Currency: String(ptsPer1Currency),
            cardName,
            ownerProfile,
        }
    } catch (e) {
        if (isRpcQuotaOrNetworkError(e)) reportRpcFailure()
        console.warn('[getRedeemDetailsForDisplay] RPC/API 失败:', cardAddress, code?.slice(0, 8) + '…', (e as Error)?.message ?? e)
        return null
    }
}

/**
 * 通过 API 批量查询 redeem 状态（仅支持批量）。优先使用，可减轻前端 RPC 压力。
 */
export const getRedeemStatusBatchFromApi = async (
    items: { cardAddress: string; hash: string; code?: string }[]
): Promise<Record<string, 'redeemed' | 'cancelled' | 'pending'> | null> => {
    if (items.length === 0) return {}
    try {
        const res = await fetch(`${beamioApi}/api/redeemStatusBatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: items.map(({ cardAddress, hash }) => ({ cardAddress, hash })) }),
        })
        if (!res.ok) return null
        const data = await res.json()
        if (!data?.success || !data?.statuses) return null
        return data.statuses as Record<string, 'redeemed' | 'cancelled' | 'pending'>
    } catch {
        return null
    }
}

/**
 * 批量查询 redeem 状态：以链上 getRedeemStatusBatch 为唯一可信来源。
 * API 有 30 秒缓存且同样依赖合约，无法区分 redeemed/cancelled，易导致状态不一致。
 * RPC 成功且合约返回 active=false 时，返回 'not_found'，调用方应从本地列表删除该 redeem。
 */
export const getRedeemStatusBatchFromChain = async (
    items: { cardAddress: string; hash: string; code?: string }[]
): Promise<Record<string, RedeemStatusChain>> => {
    const result: Record<string, RedeemStatusChain> = {}
    if (items.length === 0) return result
    try {
        const byCard = new Map<string, { hash: string; code?: string }[]>()
        for (const it of items) {
            const arr = byCard.get(it.cardAddress) ?? []
            arr.push({ hash: it.hash, code: it.code })
            byCard.set(it.cardAddress, arr)
        }
        for (const [cardAddress, cardItems] of byCard) {
            const card = new ethers.Contract(cardAddress, getRedeemStatusAbi, baseEndpoint)
            const hashes = cardItems.map((i) =>
                i.hash.length === 66 && i.hash.startsWith('0x') ? i.hash as `0x${string}` : ethers.keccak256(ethers.toUtf8Bytes(i.hash))
            )
            const [activeList] = await card.getRedeemStatusBatch(hashes)
            cardItems.forEach((it, idx) => {
                result[it.hash] = _decodeRedeemStatus(activeList[idx])
            })
        }
        return result
    } catch (e) {
        if (isRpcQuotaOrNetworkError(e)) reportRpcFailure()
        // RPC 失败时回退到 API（有缓存，但比无结果好）
        const fromApi = !isRpcDegraded() ? await getRedeemStatusBatchFromApi(items) : null
        if (fromApi && Object.keys(fromApi).length > 0) {
            items.forEach(({ hash }) => {
                result[hash] = (fromApi[hash] === 'cancelled' ? 'not_found' : (fromApi[hash] ?? 'pending')) as RedeemStatusChain
            })
            return result
        }
        items.forEach(({ hash }) => { result[hash] = 'pending' })
        return result
    }
}

/** 提交 owner 签名的 executeForOwner 请求。可选 redeemCode+toUserEOA：空投场景下 API 会额外执行 redeemForUser。 */
export const postExecuteForOwner = async (payload: {
    cardAddress: string
    data: string
    deadline: number
    nonce: string
    ownerSignature: string
    redeemCode?: string
    toUserEOA?: string
}): Promise<{ success: boolean; error?: string; code?: string }> => {
    try {
        const body: Record<string, unknown> = {
            cardAddress: payload.cardAddress,
            data: payload.data,
            deadline: payload.deadline,
            nonce: payload.nonce,
            ownerSignature: payload.ownerSignature,
        }
        if (payload.redeemCode != null && payload.toUserEOA != null) {
            body.redeemCode = payload.redeemCode
            body.toUserEOA = payload.toUserEOA
        }
        const res = await fetch(executeForOwnerEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) return { success: false, error: data.error ?? 'executeForOwner failed' }
        return { success: true, code: data.code }
    } catch (e: any) {
        return { success: false, error: e?.message ?? String(e) }
    }
}

const GET_MY_ASSETS_CACHE_TTL_MS = 15 * 1000
const getMyAssetsCache = new Map<string, { result: MyCardAssets; timestamp: number }>()
/** 同 key 并发合并；不同 cardAddress 可并行（避免旧版全局 mutex 把 N 张卡串成 N 倍耗时） */
const getMyAssetsInflight = new Map<string, Promise<MyCardAssets | null>>()

const getMyAssetsCacheKey = (profile: profile, cardAddress: string) =>
	`${profile.keyID ?? ''}-${cardAddress.toLowerCase()}`

export const getEOAUSDCBalance = async (profile: profile): Promise<string> => {
	const eoa = profile?.keyID?.trim()
	if (!eoa || !ethers.isAddress(eoa)) {
		throw new Error("getEOAUSDCBalance: profile.keyID (EOA) is required")
	}
	const usdcContract = new ethers.Contract(USDCContract_BASE, usdc_abi, baseEndpoint)
	const usdcBalanceRaw = await usdcContract.balanceOf(eoa)
	return ethers.formatUnits(usdcBalanceRaw, 6)
}

export type GetMyAssetsOptions = { bypassCache?: boolean }

export const getMyAssets = async (
	profile: profile,
	cardAddress: string,
	opts?: GetMyAssetsOptions
): Promise<MyCardAssets | null> => {
	if (isApiExcludedUserCard(cardAddress)) return null
	const key = getMyAssetsCacheKey(profile, cardAddress)
	if (!opts?.bypassCache) {
		const cached = getMyAssetsCache.get(key)
		if (cached && Date.now() - cached.timestamp < GET_MY_ASSETS_CACHE_TTL_MS) {
			return cached.result
		}
	}

	const inflight = getMyAssetsInflight.get(key)
	if (inflight) return inflight

	const p = (async (): Promise<MyCardAssets | null> => {
		try {
			const cachedAgain = getMyAssetsCache.get(key)
			if (!opts?.bypassCache && cachedAgain && Date.now() - cachedAgain.timestamp < GET_MY_ASSETS_CACHE_TTL_MS) {
				return cachedAgain.result
			}

			if (!profile.aaAccount) {
				const aa = await getAAAccount(profile)
				if (!aa) {
					return null
				}
				profile.aaAccount = aa
			}
			// 1. 实例化卡合约（CoNET 商户卡须用 providerForBeamioUserCard，非 Base RPC）
			const { provider: cardProvider } = await providerForBeamioUserCard(cardAddress)
			const cardContract = new ethers.Contract(
            cardAddress,
            [
                'function getOwnershipByEOA(address userEOA) view returns (uint256 pt, (uint256 tokenId, uint256 attribute, uint256 tierIndexOrMax, uint256 expiry, bool isExpired)[] nfts)',
                'function currency() view returns (uint8)',
                'function balanceOf(address account, uint256 id) view returns (uint256)',
            ],
            cardProvider
        );

        const eoa = profile.keyID;
        if (!eoa || !ethers.isAddress(eoa)) {
            throw new Error('getMyAssets: profile.keyID (EOA) is required');
        }

        // 2. 用 EOA 查资产，由卡合约内部 _resolveAccount(EOA) 得到 AA，与购卡/发 NFT 时一致
        const [pointsBalance, nfts] = await cardContract.getOwnershipByEOA(eoa);
        const currency = getICurrency(await cardContract.currency());

        // 3. 确保前端使用的 AA 与卡内解析一致；无 AA 时不把 aaAccount 设为 EOA（AA→EOA 要求 sender 为合约）
        if (!profile.aaAccount) {
            const aa = await getAAAccount(profile)
            if (aa) profile.aaAccount = aa
        }
        const usdcContract = new ethers.Contract(USDCContract_BASE, usdc_abi, baseEndpoint);
        const balanceAddress = profile.aaAccount ?? eoa;
        const metaPeek = peekCardBasicMetadata(cardAddress)
        const rewardTokenId =
            typeof metaPeek?.pointSystem?.rewardTokenId === 'number' &&
            Number.isFinite(metaPeek.pointSystem.rewardTokenId) &&
            metaPeek.pointSystem.rewardTokenId >= 0
                ? Math.trunc(metaPeek.pointSystem.rewardTokenId)
                : 2
        const [usdcBalanceRaw, chargeRewardBalance] = await Promise.all([
            usdcContract.balanceOf(balanceAddress),
            cardContract.balanceOf(balanceAddress, rewardTokenId),
        ]);
        const usdcBalance = ethers.formatUnits(usdcBalanceRaw, 6);

        // 4. 格式化数据并返回
        const result = {
            address: profile.aaAccount,
            cardAddress: cardAddress,
			cardOwner: await getCardOwnerByCardAddress(cardAddress),
            // 积分余额（从 1e6 格式化回人类可读数值）
            points: ethers.formatUnits(pointsBalance, 6),
            chargeRewardPoints: ethers.formatUnits(chargeRewardBalance, 6),
            chargeRewardPoints6: chargeRewardBalance.toString(),

            // NFT 列表处理
            nfts: nfts.map((nft: any) => ({
                tokenId: nft.tokenId.toString(),
                attribute: nft.attribute.toString(),
                tier: nft.tierIndexOrMax === ethers.MaxUint256 ? "Default/Max" : nft.tierIndexOrMax.toString(),
                expiry: nft.expiry === 0n ? "Never" : new Date(Number(nft.expiry) * 1000).toLocaleString(),
                isExpired: nft.isExpired
            })),
			cardCurrency: currency,
			usdcBalance: usdcBalance
        }

			const enriched = await enrichMyCardAssetsWithProgramStatHoldings(
				result,
				cardAddress,
				eoa,
				profile.aaAccount
			)
			const finalResult = enriched ?? result

			// 打印结果
			console.table(finalResult.nfts)

			getMyAssetsCache.set(key, { result: finalResult, timestamp: Date.now() })
			return finalResult
		} catch (error: unknown) {
			if (isRpcQuotaOrNetworkError(error)) reportRpcFailure()
			throw error
		} finally {
			getMyAssetsInflight.delete(key)
		}
	})()

	getMyAssetsInflight.set(key, p)
	return p
}

/** 聚合查询用户程序卡资产（废弃全局 CCSA 已 exclude）。 */
export const getMyAssetsAggregated = async (profile: profile): Promise<MyCardAssets | null> => {
	await loadApiExcludedUserCards()
	const key = `aggregated-${profile.keyID ?? ''}`
	const cached = getMyAssetsCache.get(key)
	if (cached && Date.now() - cached.timestamp < GET_MY_ASSETS_CACHE_TTL_MS) {
		return cached.result
	}
	const cardAddrs = ASSET_CARD_ADDRESSES.filter((addr) => !isApiExcludedUserCard(addr))
	if (cardAddrs.length === 0) return null
	const results = await Promise.all(
		cardAddrs.map((addr) => getMyAssets(profile, addr))
	)
	const valid = results.filter((r): r is MyCardAssets => r != null)
	if (valid.length === 0) return null
	const first = valid[0]
	const totalPoints = valid.reduce((sum, r) => sum + Number(r.points || 0), 0)
	const mergedNfts = valid.flatMap((r) => r.nfts)
	const result: MyCardAssets = {
		...first,
		cardAddress: first.cardAddress,
		points: String(totalPoints),
		nfts: mergedNfts,
	}
	getMyAssetsCache.set(key, { result, timestamp: Date.now() })
	return result
}

/** 卡 metadata 中的充值奖励规则（与 bizSite program metadata 对齐） */
export type CardBonusRuleMetadata = {
	paymentAmount: number
	bonusValue: number
	bonusProportional?: boolean
}

export type CardPointSystemMetadata = {
	enabled: boolean
	chargeRewardRatioE6?: string
	rewardTokenId?: number
}

/** 卡 metadata 中的 tier 项（创建卡时由 cardManager 提交，存于 0x{owner}.json） */
export type CardTierMetadata = { index: number; minUsdc6?: string; attr?: number; name?: string; description?: string; image?: string; backgroundColor?: string }

function parsePositiveMetadataNumber(raw: unknown): number | null {
	if (typeof raw === 'number') {
		return Number.isFinite(raw) && raw > 0 ? raw : null
	}
	if (typeof raw === 'string') {
		const n = Number(raw.trim())
		return Number.isFinite(n) && n > 0 ? n : null
	}
	return null
}

function normalizeCardBonusRuleMetadata(raw: unknown): CardBonusRuleMetadata | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
	const rec = raw as Record<string, unknown>
	const paymentAmount = parsePositiveMetadataNumber(rec.paymentAmount)
	const bonusValue = parsePositiveMetadataNumber(rec.bonusValue)
	if (paymentAmount == null || bonusValue == null) return null
	return {
		paymentAmount,
		bonusValue,
		...(typeof rec.bonusProportional === 'boolean'
			? { bonusProportional: rec.bonusProportional }
			: {}),
	}
}

function normalizeCardBonusRulesMetadata(raw: unknown): CardBonusRuleMetadata[] | undefined {
	if (!Array.isArray(raw)) return undefined
	const rules = raw
		.map((row) => normalizeCardBonusRuleMetadata(row))
		.filter((row): row is CardBonusRuleMetadata => row != null)
	return rules.length > 0 ? rules : undefined
}

function parseMetadataBoolean(raw: unknown): boolean | undefined {
	if (typeof raw === 'boolean') return raw
	if (typeof raw === 'number' && Number.isFinite(raw)) return raw !== 0
	if (typeof raw === 'string') {
		const t = raw.trim().toLowerCase()
		if (['true', '1', 'yes', 'on', 'enabled'].includes(t)) return true
		if (['false', '0', 'no', 'off', 'disabled'].includes(t)) return false
	}
	return undefined
}

function parseMetadataRatioE6(raw: unknown): string | undefined {
	if (typeof raw === 'bigint') return raw >= 0n ? raw.toString() : undefined
	if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return String(Math.trunc(raw))
	if (typeof raw === 'string') {
		const t = raw.replace(/,/g, '').trim()
		if (/^\d+$/.test(t)) return t
	}
	return undefined
}

function recordFromUnknown(raw: unknown): Record<string, unknown> | null {
	if (!raw) return null
	if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
	if (typeof raw === 'string') {
		try {
			const parsed = JSON.parse(raw) as unknown
			return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
				? (parsed as Record<string, unknown>)
				: null
		} catch {
			return null
		}
	}
	return null
}

function readCardMetadataStringField(base: Record<string, unknown> | null, keys: string[]): string {
	if (!base) return ''
	for (const k of keys) {
		const v = base[k]
		if (typeof v === 'string' && v.trim()) return v.trim()
	}
	return ''
}

const MERCHANT_BACKGROUND_IMAGE_KEYS = [
	'background',
	'backgroundImage',
	'backgroundImageUrl',
	'cover',
	'coverImage',
] as const

function merchantMetadataImageUrl(raw: string): string | undefined {
	const t = raw.trim()
	if (!t) return undefined
	if (/^https?:\/\//i.test(t) || t.startsWith('ipfs://') || t.startsWith('data:image/')) {
		return t
	}
	return undefined
}

/** Program-level icon missing: first coupon / production row `icon` only (not coupon banner / couponImage). */
function merchantFallbackIconFromShareCatalog(share: Record<string, unknown> | null): string | undefined {
	if (!share) return undefined
	const coupons = share.coupons
	if (Array.isArray(coupons)) {
		for (const row of coupons) {
			const o = recordFromUnknown(row)
			if (!o) continue
			const url = merchantMetadataImageUrl(
				readCardMetadataStringField(o, ['icon', 'iconUrl', 'logoUrl', 'logo', 'image'])
			)
			if (url) return url
		}
	}
	const productions = share.productions
	if (Array.isArray(productions)) {
		for (const row of productions) {
			const o = recordFromUnknown(row)
			if (!o) continue
			const url = merchantMetadataImageUrl(
				readCardMetadataStringField(o, ['icon', 'iconUrl', 'logoUrl', 'logo', 'image'])
			)
			if (url) return url
		}
	}
	return undefined
}

/** Merchant program icon — metadata `icon` first; legacy `image`; then first catalog row icon (not coupon background). */
export function merchantIconUrlFromMetadataRoot(
	metaJson: Record<string, unknown> | null | undefined
): string | undefined {
	if (!metaJson || typeof metaJson !== 'object') return undefined
	const share = recordFromUnknown(metaJson.shareTokenMetadata)
	const icon =
		readCardMetadataStringField(metaJson, ['icon', 'iconUrl', 'logoUrl', 'logo']) ||
		readCardMetadataStringField(share, ['icon', 'iconUrl', 'logoUrl', 'logo'])
	if (icon) {
		const url = merchantMetadataImageUrl(icon)
		if (url) return url
	}
	const image =
		readCardMetadataStringField(metaJson, ['image']) ||
		readCardMetadataStringField(share, ['image'])
	const programImage = image ? merchantMetadataImageUrl(image) : undefined
	if (programImage) return programImage
	return merchantFallbackIconFromShareCatalog(share)
}

/** Wide Discover / pass hero — program `background*` only (not coupon images); `merchantImage` is resolved separately in Discover. */
export function merchantBackgroundImageFromMetadataRoot(
	metaJson: Record<string, unknown> | null | undefined
): string | undefined {
	if (!metaJson || typeof metaJson !== 'object') return undefined
	const share = recordFromUnknown(metaJson.shareTokenMetadata)
	for (const src of [metaJson, share]) {
		if (!src) continue
		for (const key of MERCHANT_BACKGROUND_IMAGE_KEYS) {
			const v = src[key]
			if (typeof v === 'string') {
				const url = merchantMetadataImageUrl(v)
				if (url) return url
			}
		}
	}
	return undefined
}

/** biz Business Name / storeName — 与 Discover Featured Brands `title: businessName ?? name` 一致 */
export function merchantBusinessNameFromMetadataRoot(
	metaJson: Record<string, unknown> | null | undefined
): string {
	if (!metaJson || typeof metaJson !== 'object') return ''
	const share = recordFromUnknown(metaJson.shareTokenMetadata)
	const businessMetadata = recordFromUnknown(metaJson.businessMetadata)
	const businessProfile = recordFromUnknown(metaJson.businessProfile)
	const ownerBusinessMetadata = recordFromUnknown(metaJson.ownerBusinessMetadata)
	const cardBusiness = recordFromUnknown(metaJson.businessCard)
	return (
		readCardMetadataStringField(ownerBusinessMetadata, ['storeName', 'businessName']) ||
		readCardMetadataStringField(businessMetadata, ['storeName', 'businessName']) ||
		readCardMetadataStringField(businessProfile, ['storeName', 'businessName']) ||
		readCardMetadataStringField(cardBusiness, ['storeName', 'businessName', 'merchantName', 'brandName']) ||
		readCardMetadataStringField(share, ['storeName', 'businessName', 'merchantName', 'brandName', 'displayName']) ||
		readCardMetadataStringField(metaJson, ['storeName', 'businessName', 'merchantName', 'brandName', 'displayName'])
	)
}

/** BeamioUserCard 商户展示名：businessName 优先，否则 program `shareTokenMetadata.name` */
export function merchantProgramCardDisplayNameFromMetadataRoot(
	metaJson: Record<string, unknown> | null | undefined
): string {
	if (!metaJson || typeof metaJson !== 'object') return ''
	const business = merchantBusinessNameFromMetadataRoot(metaJson)
	if (business) return business
	const share = recordFromUnknown(metaJson.shareTokenMetadata)
	return String(share?.name ?? metaJson.name ?? '').trim()
}

function normalizeCardPointSystemMetadata(raw: unknown): CardPointSystemMetadata | undefined {
	const direct = recordFromUnknown(raw)
	const share = recordFromUnknown(direct?.shareTokenMetadata)
	const pointSystem = recordFromUnknown(share?.pointSystem) ?? recordFromUnknown(direct?.pointSystem)
	const enabledRaw =
		pointSystem?.enabled ??
		pointSystem?.pointSystemEnabled ??
		pointSystem?.pointsEnabled ??
		share?.pointSystemEnabled ??
		share?.pointsEnabled ??
		direct?.pointSystemEnabled ??
		direct?.pointsEnabled
	const ratioRaw =
		pointSystem?.chargeRewardRatioE6 ??
		pointSystem?.pointRewardRatioE6 ??
		pointSystem?.consumptionRewardRatioE6 ??
		share?.chargeRewardRatioE6 ??
		share?.pointRewardRatioE6 ??
		share?.consumptionRewardRatioE6 ??
		direct?.chargeRewardRatioE6 ??
		direct?.pointRewardRatioE6 ??
		direct?.consumptionRewardRatioE6
	const enabled = parseMetadataBoolean(enabledRaw)
	const chargeRewardRatioE6 = parseMetadataRatioE6(ratioRaw)
	const tokenRaw = pointSystem?.rewardTokenId ?? share?.pointRewardTokenId ?? direct?.pointRewardTokenId
	let rewardTokenId: number | undefined
	if (typeof tokenRaw === 'number' && Number.isFinite(tokenRaw) && tokenRaw >= 0) {
		rewardTokenId = Math.trunc(tokenRaw)
	} else if (typeof tokenRaw === 'string' && /^\d+$/.test(tokenRaw.trim())) {
		rewardTokenId = Number.parseInt(tokenRaw.trim(), 10)
	}
	if (enabled == null && chargeRewardRatioE6 == null && rewardTokenId == null) return undefined
	return {
		enabled: enabled ?? (chargeRewardRatioE6 != null ? BigInt(chargeRewardRatioE6) > 0n : true),
		...(chargeRewardRatioE6 != null ? { chargeRewardRatioE6 } : {}),
		...(rewardTokenId != null ? { rewardTokenId } : {}),
	}
}

function bonusFieldsFromMetadataRoot(raw: unknown): {
	bonusRule?: CardBonusRuleMetadata
	bonusRules?: CardBonusRuleMetadata[]
	pointSystem?: CardPointSystemMetadata
} {
	const direct = recordFromUnknown(raw)
	const share = recordFromUnknown(direct?.shareTokenMetadata)
	const pointSystem = normalizeCardPointSystemMetadata(raw)
	const directRules = normalizeCardBonusRulesMetadata(direct?.bonusRules)
	const directRule = normalizeCardBonusRuleMetadata(direct?.bonusRule) ?? directRules?.[0]
	if (directRule || directRules) {
		return {
			...(directRule && { bonusRule: directRule }),
			...(directRules && { bonusRules: directRules }),
			...(pointSystem && { pointSystem }),
		}
	}
	const shareRules = normalizeCardBonusRulesMetadata(share?.bonusRules)
	const shareRule = normalizeCardBonusRuleMetadata(share?.bonusRule) ?? shareRules?.[0]
	return {
		...(shareRule && { bonusRule: shareRule }),
		...(shareRules && { bonusRules: shareRules }),
		...(pointSystem && { pointSystem }),
	}
}

/** 从 BeamioUserCard 合约读取 tiers（getTiersCount + getTierAt），用于根据 redeem 金额确定 tier */
export const getCardTiersFromContract = async (cardAddress: string): Promise<{ minUsdc6: string; attr: number }[]> => {
	try {
		const card = new ethers.Contract(
			cardAddress,
			[
				'function getTiersCount() view returns (uint256)',
				'function getTierAt(uint256 idx) view returns (uint256 minUsdc6, uint256 attr, uint256 tierExpirySeconds)',
			],
			baseEndpoint
		)
		const count = Number(await card.getTiersCount())
		if (count === 0) return []
		const tiers: { minUsdc6: string; attr: number }[] = []
		for (let i = 0; i < count; i++) {
			const [minUsdc6, attr] = await card.getTierAt(i)
			tiers.push({ minUsdc6: minUsdc6.toString(), attr: Number(attr) })
		}
		return tiers
	} catch {
		return []
	}
}

export const getCardUpgradeTypeFromContract = async (cardAddress: string): Promise<0 | 1 | 2> => {
	try {
		const card = new ethers.Contract(cardAddress, ['function upgradeType() view returns (uint8)'], baseEndpoint)
		const v = Number(await card.upgradeType())
		if (v === 1 || v === 2) return v
		return 0
	} catch {
		return 0
	}
}

/** 根据 redeem 金额（points6）确定 tier index：与合约 _issueCardByPointsDelta 逻辑一致，选 minUsdc6 最大且 <= points6 的档。
 * 注意：tiers 不按 minUsdc6 顺序排列，需遍历全部 tier 比较。 */
export const getTierIndexForRedeemAmount = (
	contractTiers: { minUsdc6: string }[],
	points6: string
): number => {
	if (contractTiers.length === 0) return 0
	const pts = BigInt(points6)
	let bestIdx = -1
	let bestMin = 0n
	for (let i = 0; i < contractTiers.length; i++) {
		const min = BigInt(contractTiers[i].minUsdc6)
		if (pts >= min && (bestIdx === -1 || min > bestMin)) {
			bestIdx = i
			bestMin = min
		}
	}
	return bestIdx >= 0 ? bestIdx : 0
}

/** 卡级 metadata（getCardMetadataFromApi / getCardMetadataFromUri）；cardOwner 用于请求 per-NFT metadata */
export type CardMetadataFromUri = {
	name?: string
	/** Merchant logo URL — metadata `icon` (preferred) or legacy `image`. */
	icon?: string
	image?: string
	tiers?: CardTierMetadata[]
	cardOwner?: string
	bonusRule?: CardBonusRuleMetadata
	bonusRules?: CardBonusRuleMetadata[]
	pointSystem?: CardPointSystemMetadata
	/** First id from `shareTokenMetadata.categories` (Discover / biz issuance). */
	categoryId?: string | null
	programDescription?: string
}

/** 单张成员 NFT 的 tier metadata（GET /metadata/0x{owner}{NFT#}.json） */
export type NftTierMetadata = { name?: string; description?: string; image?: string; tierIndex?: number; minUsdc6?: string; backgroundColor?: string }

/** ERC1155 metadata 缓存：cardAddress -> metadata + timestamp，TTL 5 分钟 */
const cardMetadataCache = new Map<string, CardMetadataFromUri & { timestamp: number }>()
const CARD_METADATA_CACHE_TTL_MS = 5 * 60 * 1000

/** per-NFT metadata 缓存：cardOwner_tokenId -> { name?, description?, image?, timestamp }，TTL 5 分钟 */
const nftMetadataCache = new Map<string, { name?: string; description?: string; image?: string; timestamp: number }>()
const NFT_METADATA_CACHE_TTL_MS = 5 * 60 * 1000

/** 从 beamioApi 拉取卡级 1155 JSON（metadata/0x{cardAddress}0.json），获取 tiers。BeamioUserCard uri(0) 返回该格式。 */
export const getCardMetadataFrom1155Json = async (cardAddress: string): Promise<CardMetadataFromUri | null> => {
	const normalized = cardAddress.startsWith('0x') ? cardAddress.slice(2).toLowerCase() : cardAddress.toLowerCase()
	if (normalized.length !== 40) return null
	const cacheKey = `1155_${normalized}`
	const cached = cardMetadataCache.get(cacheKey)
	if (cached && Date.now() - cached.timestamp < CARD_METADATA_CACHE_TTL_MS) {
		const { timestamp, ...meta } = cached
		return meta
	}
	try {
		const filename = `0x${normalized}0.json`
		const res = await fetch(`${beamioApi}/metadata/${filename}`)
		if (!res.ok) return null
		const json = (await res.json()) as {
			name?: string
			image?: string
			description?: string
			shareTokenMetadata?: { name?: string; image?: string; description?: string }
			tiers?: CardTierMetadata[]
			properties?: Record<string, unknown>
			bonusRule?: unknown
			bonusRules?: unknown
		}
		const bonusFields = bonusFieldsFromMetadataRoot(json)
		const share = json?.shareTokenMetadata
		const iconUrl = merchantIconUrlFromMetadataRoot(json)
		const meta: CardMetadataFromUri = {
			name: (share?.name ?? json?.name) as string | undefined,
			...(iconUrl ? { icon: iconUrl } : {}),
			image: (share?.image ?? json?.image) as string | undefined,
			...(Array.isArray(json?.tiers) && json.tiers.length > 0 && { tiers: json.tiers }),
			...bonusFields,
		}
		cardMetadataCache.set(cacheKey, { ...meta, timestamp: Date.now() })
		return meta
	} catch {
		return null
	}
}

/** Recent Activity Charge 行 title：拉卡 metadata 解析商户名（businessName ?? programName） */
export async function getMerchantProgramCardDisplayName(cardAddress: string): Promise<string> {
	const raw = cardAddress?.trim()
	if (!raw || !ethers.isAddress(raw)) return ''
	const normalized = ethers.getAddress(raw)
	try {
		const res = await fetch(`${beamioApi}/api/cardMetadata?cardAddress=${encodeURIComponent(normalized)}`)
		if (res.ok) {
			const data = (await res.json()) as { metadata?: Record<string, unknown> | null }
			const name = merchantProgramCardDisplayNameFromMetadataRoot(data?.metadata ?? null)
			if (name) return name
		}
	} catch {
		/* ignore */
	}
	const from1155 = await getCardMetadataFrom1155Json(normalized)
	if (from1155?.name) return String(from1155.name).trim()
	try {
		const filename = `0x${normalized.slice(2).toLowerCase()}0.json`
		const res1155 = await fetch(`${beamioApi}/metadata/${filename}`)
		if (res1155.ok) {
			const json = (await res1155.json()) as Record<string, unknown>
			const name = merchantProgramCardDisplayNameFromMetadataRoot(json)
			if (name) return name
		}
	} catch {
		/* ignore */
	}
	return ''
}

export type GetCardMetadataOptions = { bypassMemoryCache?: boolean }

/** EIP-1155 `uri()` 模板中的 `{id}`：64 位小写十六进制（tokenId=0 为全零）。与 `beamioServer` `ERC1155_METADATA_PATH_RE` 一致。 */
export function erc1155MetadataIdHex(tokenId: bigint | number | string = 0): string {
	return BigInt(tokenId).toString(16).padStart(64, '0').toLowerCase()
}

/** 将链上 `…/api/metadata/0x{40hex}{id}.json` 模板展开为可请求的 URL。 */
export function resolveBeamioErc1155MetadataUrl(baseUri: string, tokenId: bigint | number = 0): string {
	if (!baseUri.includes('{id}')) return baseUri
	return baseUri.replace(/{id}/gi, erc1155MetadataIdHex(tokenId))
}

/** `GET /api/metadata/0x{card}{64hexTokenId}.json`（卡级 metadata 用 tokenId=0）。 */
export function beamioApiErc1155MetadataUrl(cardAddress: string, tokenId: bigint | number = 0): string {
	const hex40 = ethers.getAddress(cardAddress).slice(2).toLowerCase()
	return `${beamioApi}/api/metadata/0x${hex40}${erc1155MetadataIdHex(tokenId)}.json`
}

/** 从 beamioApi 拉取 card_owner + metadata_json，转为 CardMetadataFromUri。优先用此接口，不依赖链上 uri 与 RPC。 */
export const getCardMetadataFromApi = async (
	cardAddress: string,
	opts?: GetCardMetadataOptions
): Promise<CardMetadataFromUri | null> => {
	const key = cardAddress.toLowerCase()
	const cacheKey = `api:${key}`
	if (!opts?.bypassMemoryCache) {
		const cached = cardMetadataCache.get(cacheKey)
		if (cached && Date.now() - cached.timestamp < CARD_METADATA_CACHE_TTL_MS) {
			const { timestamp, ...meta } = cached
			return meta
		}
	}
	try {
		const res = await fetch(`${beamioApi}/api/cardMetadata?cardAddress=${encodeURIComponent(cardAddress)}`)
		if (!res.ok) return null
		const data = (await res.json()) as { cardOwner?: string; metadata?: Record<string, unknown> | null }
		const metaJson = data?.metadata
		if (!metaJson || typeof metaJson !== 'object') return null
		const share = recordFromUnknown(metaJson.shareTokenMetadata)
		const cardOwner = data?.cardOwner && typeof data.cardOwner === 'string' ? data.cardOwner : undefined
		const bonusFields = bonusFieldsFromMetadataRoot(metaJson)
		const categoryFields = discoverCategoryFieldsFromMetadataRoot(metaJson)
		const iconUrl = merchantIconUrlFromMetadataRoot(metaJson)
		const meta: CardMetadataFromUri = {
			name: (share?.name ?? metaJson.name) as string | undefined,
			...(iconUrl ? { icon: iconUrl } : {}),
			image: (share?.image ?? metaJson.image) as string | undefined,
			...(Array.isArray(metaJson.tiers) && metaJson.tiers.length > 0 && { tiers: metaJson.tiers as CardTierMetadata[] }),
			...(cardOwner && { cardOwner }),
			...bonusFields,
			...(categoryFields.categoryId != null && { categoryId: categoryFields.categoryId }),
			...(categoryFields.programDescription && { programDescription: categoryFields.programDescription }),
		}
		cardMetadataCache.set(cacheKey, { ...meta, timestamp: Date.now() })
		return meta
	} catch {
		return null
	}
}

/** 从 beamioApi 拉取单张成员 NFT 的 tier metadata（GET /metadata/0x{cardAddress}{NFT#}.json），符合 EIP-1155/Base Explorer 约定（40hex = 合约地址） */
export const getNftMetadataFromApi = async (cardAddress: string, tokenId: number | string): Promise<NftTierMetadata | null> => {
	const tid = String(Number(tokenId))
	const normalized = cardAddress.startsWith('0x') ? cardAddress.slice(2).toLowerCase() : cardAddress.toLowerCase()
	if (normalized.length !== 40) return null
	const cacheKey = `card_${normalized}_${tid}`
	const cached = nftMetadataCache.get(cacheKey)
	if (cached && Date.now() - cached.timestamp < NFT_METADATA_CACHE_TTL_MS) {
		const { timestamp, ...meta } = cached
		return meta
	}
	try {
		const filename = `0x${normalized}${tid}.json`
		const res = await fetch(`${beamioApi}/metadata/${filename}`)
		if (!res.ok) return null
		const json = (await res.json()) as {
			name?: string
			description?: string
			image?: string
			tierIndex?: number
			minUsdc6?: string
			properties?: { tier_index?: number; min_usdc6?: string; tier_name?: string; tier_description?: string; background_color?: string }
		}
		const meta = parseNftTierMetadataJson(json)
		nftMetadataCache.set(cacheKey, { ...meta, timestamp: Date.now() })
		return meta
	} catch {
		return null
	}
}

function parseNftTierMetadataJson(json: {
	name?: string
	description?: string
	image?: string
	tierIndex?: number
	minUsdc6?: string
	properties?: { tier_index?: number; min_usdc6?: string; tier_name?: string; tier_description?: string; background_color?: string }
}): NftTierMetadata {
	return {
		name: json?.name,
		description: json?.description,
		image: json?.image,
		...(json?.tierIndex != null && { tierIndex: json.tierIndex }),
		...(json?.minUsdc6 != null && { minUsdc6: json.minUsdc6 }),
		...(json?.properties?.background_color != null && { backgroundColor: json.properties.background_color }),
		...(json?.properties?.tier_index != null && json?.tierIndex == null && { tierIndex: json.properties.tier_index }),
		...(json?.properties?.min_usdc6 != null && json?.minUsdc6 == null && { minUsdc6: json.properties.min_usdc6 }),
	}
}

/** 从 BeamioUserCard 的 uri 获取 metadata（name、image、tiers）。创建卡时传入的 uri 如 https://api.beamio.io/metadata/{id}.json；tiers 含创建卡时配置的 name/description */
export const getCardMetadataFromUri = async (
	cardAddress: string,
	opts?: GetCardMetadataOptions
): Promise<CardMetadataFromUri | null> => {
	const key = cardAddress.toLowerCase()
	const cacheKey = `uri:${key}`
	if (!opts?.bypassMemoryCache) {
		const cached = cardMetadataCache.get(cacheKey)
		if (cached && Date.now() - cached.timestamp < CARD_METADATA_CACHE_TTL_MS) {
			const { timestamp, ...meta } = cached
			return meta
		}
	}
	try {
		const card = new ethers.Contract(
			cardAddress,
			['function uri(uint256) view returns (string)'],
			baseEndpoint
		)
		const baseUri = await card.uri(0)
		if (!baseUri || typeof baseUri !== 'string') return null
		// ERC1155: `{id}` → 64 位 hex（勿用字面量 "0"，否则 /api/metadata 路由 404）
		const primaryUrl = resolveBeamioErc1155MetadataUrl(baseUri, 0)
		const canonicalUrl = beamioApiErc1155MetadataUrl(cardAddress, 0)
		let res = await fetch(primaryUrl)
		if (!res.ok && primaryUrl !== canonicalUrl) {
			res = await fetch(canonicalUrl)
		}
		if (!res.ok) {
			const hex40 = ethers.getAddress(cardAddress).slice(2).toLowerCase()
			res = await fetch(`${beamioApi}/metadata/0x${hex40}0.json`)
		}
		if (!res.ok) return null
		const json = (await res.json()) as Record<string, unknown>
		// 兼容顶层 ERC1155 与服务器写入的 shareTokenMetadata 嵌套结构；API 返回 shared 时带 tiers
		const bonusFields = bonusFieldsFromMetadataRoot(json)
		const categoryFields = discoverCategoryFieldsFromMetadataRoot(json)
		const share = recordFromUnknown(json.shareTokenMetadata)
		const iconUrl = merchantIconUrlFromMetadataRoot(json)
		const meta: CardMetadataFromUri = {
			name: (json?.name ?? share?.name) as string | undefined,
			...(iconUrl ? { icon: iconUrl } : {}),
			image: (json?.image ?? share?.image) as string | undefined,
			...(Array.isArray(json?.tiers) && json.tiers.length > 0 && { tiers: json.tiers as CardTierMetadata[] }),
			...bonusFields,
			...(categoryFields.categoryId != null && { categoryId: categoryFields.categoryId }),
			...(categoryFields.programDescription && { programDescription: categoryFields.programDescription }),
		}
		cardMetadataCache.set(cacheKey, { ...meta, timestamp: Date.now() })
		return meta
	} catch {
		return null
	}
}

/**
 * 卡级基础 metadata：全局 localStorage 表优先（一次可信写入后长期复用），并后台 API→URI 刷新落盘。
 * 与 5 分钟内存 TTL 并存；页面应优先用此接口以跨会话、跨页面共享「卡基本设定」。
 */
export async function getCardBasicMetadataStaleWhileRevalidate(
	cardAddress: string
): Promise<CardMetadataFromUri | null> {
	const raw = (cardAddress || '').trim()
	if (!raw || !ethers.isAddress(raw)) return null

	const local = peekCardBasicMetadata(raw)
	if (local) {
		void (async () => {
			try {
				const fresh =
					(await getCardMetadataFromApi(raw, { bypassMemoryCache: true })) ??
					(await getCardMetadataFromUri(raw, { bypassMemoryCache: true }))
				if (fresh) {
					rememberCardBasicMetadataTrusted(raw, fresh)
					const k = raw.toLowerCase()
					cardMetadataCache.set(`api:${k}`, { ...fresh, timestamp: Date.now() })
					cardMetadataCache.set(`uri:${k}`, { ...fresh, timestamp: Date.now() })
				}
			} catch {
				/* ignore */
			}
		})()
		return local
	}

	const fresh =
		(await getCardMetadataFromApi(raw, { bypassMemoryCache: true })) ??
		(await getCardMetadataFromUri(raw, { bypassMemoryCache: true }))
	if (fresh) {
		rememberCardBasicMetadataTrusted(raw, fresh)
		const k = raw.toLowerCase()
		cardMetadataCache.set(`api:${k}`, { ...fresh, timestamp: Date.now() })
		cardMetadataCache.set(`uri:${k}`, { ...fresh, timestamp: Date.now() })
	}
	return fresh
}

export { peekCardBasicMetadata, rememberCardBasicMetadataTrusted } from '@/utils/cardBasicMetadataGlobalCache'

const getICurrency = (currency: bigint | number): ICurrency => {
	const n = typeof currency === 'number' ? BigInt(currency) : currency
	switch (n) {
		case 0n:
			return 'CAD'
		case 1n:
			return 'USD'
		case 2n:
			return 'JPY'
		case 3n:
			return 'CNY'
		case 4n:
			return 'USDC'
		case 5n:
			return 'HKD'
		case 6n:
			return 'EUR'
		case 7n:
			return 'SGD'
		case 8n:
			return 'TWD'
		default:
			return 'USDC'
	}
}



/** RPC 失败时从 API 获取 AA 地址 */
async function fetchAAAccountFromApi(eoa: string): Promise<string | null> {
	try {
		const res = await fetch(`${beamioApi}/api/getAAAccount?eoa=${encodeURIComponent(eoa)}`)
		if (!res.ok) return null
		const data = await res.json().catch(() => ({}))
		return data?.account ?? null
	} catch {
		return null
	}
}

export const getAAAccount = async (profile: profile): Promise<string | null> => {
	const eoa = profile?.keyID?.trim()
	if (!eoa || !ethers.isAddress(eoa)) return null
	const conetProvider = new ethers.JsonRpcProvider(CONET_RPC_URL)
	try {
		const eoaAddr = ethers.getAddress(eoa)
		const f = new ethers.Contract(CONET_AA_FACTORY, [
			'function beamioAccountOf(address) view returns (address)',
			'function primaryAccountOf(address) view returns (address)'
		], conetProvider)

		let account = await f.beamioAccountOf(eoaAddr).catch((err: any) => {
			const msg = String(err?.message ?? '').toLowerCase()
			if (msg.includes('network') || msg.includes('timeout') || msg.includes('abort') || msg.includes('fetch') || msg.includes('quota') || msg.includes('rate limit')) {
				throw err
			}
			return ethers.ZeroAddress
		})

		if (!account || account === ethers.ZeroAddress) {
			account = await f.primaryAccountOf(eoaAddr).catch((err: any) => {
				const msg = String(err?.message ?? '').toLowerCase()
				if (msg.includes('network') || msg.includes('timeout') || msg.includes('abort') || msg.includes('fetch') || msg.includes('quota') || msg.includes('rate limit')) {
					throw err
				}
				return ethers.ZeroAddress
			})
		}

		if (!account || account === ethers.ZeroAddress) {
			return null
		}

		const code = await conetProvider.getCode(account)
		const hasCode = code && code !== '0x' && code.length > 2
		if (!hasCode) {
			return null
		}

		try {
			const aa = new ethers.Contract(account, ['function factory() view returns (address)'], conetProvider)
			await aa.factory()
		} catch (e: any) {
			throw new Error(`getAAAccount: factory() not available: ${e?.shortMessage ?? e?.message}`)
		}
		return account
	} catch (error: any) {
		console.warn(`[getAAAccount] CoNET RPC failed: ${error.message}`)
		throw error
	}
}

const mapActionToBeamioResponse = (
	raw: {
	  action: any
	  meta: any
	}
  ): BeamioActionResponse => {
	const { action, meta } = raw;
  
	// note 里你是 JSON.stringify(payMe)
	let payMeParsed: payMe | undefined = undefined;
	if (meta.note) {
	  try {
		payMeParsed = JSON.parse(meta.note);
	  } catch {
		payMeParsed = undefined;
	  }
	}
  
	return {
	  action: Number(action.actionType) as BeamioActionTypeEnum,
  
	  cardAddress: action.card,
	  from: action.from,
	  to: action.to,
  
	  // points / token amount（6 decimals）→ string
	  amount: ethers.formatUnits(action.amount, 6),
  
	  timestamp: Number(action.timestamp),
  
	  title: meta.title,
	  note: meta.note,
  
	  tax: Number(meta.tax),
	  tip: Number(meta.tip),
	  beamioFee1: Number(meta.beamioFee1),
	  beamioFee2: Number(meta.beamioFee2),
	  cardServiceFee: Number(meta.cardServiceFee),
  
	  afterTatchNoteByFrom: meta.afterTatchNoteByFrom,
	  afterTatchNoteByTo: meta.afterTatchNoteByTo,
	  afterTatchNoteByCardOwner: meta.afterTatchNoteByCardOwner,
  
	  payMe: payMeParsed,
	};
};

export const getLatest20UserActions_Lite = async (
	profile: profile,
	cardAddress: string,
	currentCCSAAddress?: string
) => {
	const facet = new ethers.Contract(contracts.BeamioDiamond.address, contracts.BeamioDiamond.abi.ActionFacet, conetDepinProvider);
  
	// 获取 AA 账号（如果存在）
	let aaAccount: string | null = null
	if (!profile.aaAccount) {
		aaAccount = await getAAAccount(profile)
	} else {
		aaAccount = profile.aaAccount
	}

	// 查询 EOA 和 AA 账号的记录
	const addressesToQuery: string[] = [profile.keyID]
	if (aaAccount && ethers.isAddress(aaAccount)) {
		addressesToQuery.push(aaAccount)
	}

	const allRows: BeamioActionResponse[] = []

	// 为每个地址查询记录
	for (const address of addressesToQuery) {
		try {
			const total: bigint = await facet.getUserActionsCount(address)
			if (total === 0n) continue

			const limit = 20n
			const offset = total > limit ? total - limit : 0n

			const idsRaw = await facet.getUserActionIdsPaged(address, offset, limit)
			// ethers 返回的 Result 为只读，需复制为可变数组再 reverse
			const ids: bigint[] = [...idsRaw].reverse() // 最新在前

			const rows: BeamioActionResponse[] = await Promise.all(
				ids.map(async (id) => {
					const [action, meta] = await facet.getActionWithMeta(id)
					return mapActionToBeamioResponse({ action, meta })
				})
			)

			allRows.push(...rows)
		} catch (error) {
			console.warn(`[getLatest20UserActions_Lite] Failed to query actions for ${address}:`, error)
		}
	}

	// 按 cardAddress 过滤
	const cardLower = cardAddress.toLowerCase()
	let filtered = allRows.filter((r) => (r.cardAddress).toLowerCase() === cardLower)
	
	// 如果查询的是 CCSA 卡地址，并且提供了 currentCCSAAddress，则过滤不符合当前 CCSA 地址的 1155 转账记录
	// 注意：当查询 CCSA 卡时，cardAddress 参数是 CCSA_Card_Address（合约地址），
	// 但实际记录中的 cardAddress 可能是不同的 CCSA 卡实例地址
	// 因此需要过滤，只保留 cardAddress 等于 currentCCSAAddress 的记录
	if (CCSA_Card_Address && cardLower === CCSA_Card_Address.toLowerCase() && currentCCSAAddress) {
		const currentCCSAAddressLower = currentCCSAAddress.toLowerCase()
		filtered = filtered.filter((action) => {
			const actionCardAddress = action.cardAddress?.toLowerCase()
			// 对于 CCSA 卡（ERC-1155）转账记录，cardAddress 必须匹配当前 CCSA 地址
			return actionCardAddress === currentCCSAAddressLower
		})
	}
	
	filtered.sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
	
	// 去重：基于 cardAddress + from + to + amount + timestamp 的组合
	// 如果 payMe 中有 parentHash，优先使用 parentHash 去重
	const seen = new Set<string>()
	const uniqueFiltered = filtered.filter((action) => {
		// 优先使用 parentHash（如果存在）
		if (action.payMe?.parentHash) {
			const key = action.payMe.parentHash.toLowerCase()
			if (seen.has(key)) return false
			seen.add(key)
			return true
		}
		
		// 否则使用 cardAddress + from + to + amount + timestamp 组合
		const key = `${action.cardAddress.toLowerCase()}-${action.from.toLowerCase()}-${action.to.toLowerCase()}-${action.amount}-${action.timestamp}`
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})
	
	return uniqueFiltered.slice(0, 20)
};


const BUINT_BALANCE_OF_ALL_ABI = [
  "function balanceOfAll(address account) external view returns (uint256 total, uint256 free, uint256 paid)"
];

const BUNIT_AIRDROP_BALANCE_ABI = [
  "function getBUnitBalance(address account) view returns (uint256)"
] as const;

export type BUnitBalanceOnConet = {
  total: number;
  free: number;
  paid: number;
  legacyDeprecatedTotal?: number;
};

/**
 * 直接从 CoNET RPC 查询 B-Unit（扣费可用 total + free/paid 明细）。6 位精度。
 */
export const getBUnitBalanceFromConetRpc = async (account: string): Promise<BUnitBalanceOnConet> => {
  if (!account || !ethers.isAddress(account)) return { total: 0, free: 0, paid: 0 };
  const decimals = 6;
  try {
    const airdrop = new ethers.Contract(CONET_BUNIT_AIRDROP_ADDRESS, BUNIT_AIRDROP_BALANCE_ABI, conetDepinProvider);
    const feeRaw = (await airdrop.getBUnitBalance(account)) as bigint;
    const contract = new ethers.Contract(CONET_BUINT, BUINT_BALANCE_OF_ALL_ABI, conetDepinProvider);
    const [totalAll, free, paid] = await contract.balanceOfAll(account);
    const feeUsable = feeRaw > 0n ? feeRaw : totalAll;
    return {
      total: Number(feeUsable) / 10 ** decimals,
      free: Number(free) / 10 ** decimals,
      paid: Number(paid) / 10 ** decimals,
    };
  } catch (e) {
    if (typeof console !== 'undefined' && console.error) console.error('[getBUnitBalanceFromConetRpc] RPC failed:', e);
    return { total: 0, free: 0, paid: 0 };
  }
};

/**
 * 查询 CoNET 主网 BUint 余额（扣费可用 total + free/paid）。6 位精度。
 * 优先通过 beamio API（含 legacyDeprecatedTotal），失败时回退 RPC。
 */
export const getBUnitBalanceOnConet = async (account: string): Promise<BUnitBalanceOnConet> => {
  if (!account || !ethers.isAddress(account)) return { total: 0, free: 0, paid: 0 };
  try {
    const res = await fetch(`${beamioApi}/api/getBUnitBalance?address=${encodeURIComponent(account)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.total === 'number' && typeof data.free === 'number' && typeof data.paid === 'number') {
        return {
          total: data.feeUsable ?? data.total,
          free: data.free,
          paid: data.paid,
          legacyDeprecatedTotal: typeof data.legacyDeprecatedTotal === 'number' ? data.legacyDeprecatedTotal : undefined,
        };
      }
    }
  } catch (e) {
    if (typeof console !== 'undefined' && console.error) console.error('[getBUnitBalanceOnConet] API fallback failed:', e);
  }
  return getBUnitBalanceFromConetRpc(account);
};

const INDEXER_GET_ACCOUNT_TX_ABI = [
  "function getAccountTransactionsPaged(address account, uint256 offset, uint256 limit) view returns ((bytes32 id, bytes32 originalPaymentHash, uint256 chainId, bytes32 txCategory, string displayJson, uint64 timestamp, address payer, address payee, uint256 finalRequestAmountFiat6, uint256 finalRequestAmountUSDC6, bool isAAAccount, (uint16 gasChainType, uint256 gasWei, uint256 gasUSDC6, uint256 serviceUSDC6, uint256 bServiceUSDC6, uint256 bServiceUnits6, address feePayer) fees, (uint256 requestAmountFiat6, uint256 requestAmountUSDC6, uint8 currencyFiat, uint256 discountAmountFiat6, uint16 discountRateBps, uint256 taxAmountFiat6, uint16 taxRateBps, string afterNotePayer, string afterNotePayee) meta, bool exists)[] page)"
];

/** BUnit 相关 txCategory（keccak256） */
const TX_BUINT_CLAIM = ethers.keccak256(ethers.toUtf8Bytes("buintClaim"));
const TX_BUINT_USDC = ethers.keccak256(ethers.toUtf8Bytes("buintUSDC"));
const TX_REQUEST_ACCOUNTING = ethers.keccak256(ethers.toUtf8Bytes("requestAccounting"));
const TX_SEND_USDC = ethers.keccak256(ethers.toUtf8Bytes("sendUSDC"));
const TX_X402_SEND = ethers.keccak256(ethers.toUtf8Bytes("x402Send"));

export type BUnitLedgerEntry = {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  time: string;
  timestamp: number;
  type: "refuel" | "fee" | "gas" | "reward";
  status: string;
  linkedUsdc: string;
  txHash: string;
  network: string;
  /** Base mainnet tx hash for USDC refuel (when available from displayJson) */
  baseTxHash?: string;
  /** CoNET originalPaymentHash (e.g. requestHash for requestAccounting), link to mainnet.conet.network/tx/ */
  originalPaymentHash?: string;
  /** Raw transaction from indexer (for View Smart Receipt), unchanged fields */
  rawTx: Record<string, unknown>;
};

function serializeJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map((item) => serializeJsonSafe(item));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeJsonSafe(v);
    }
    return out;
  }
  return value;
}

/** Serialize raw tx from ethers to JSON-safe object (bigint -> string), keep original transaction fields */
function serializeRawTx(tx: unknown): Record<string, unknown> {
  if (tx == null || typeof tx !== "object") return {};
  const t = tx as Record<string, unknown>;
  return {
    id: serializeJsonSafe(t.id),
    originalPaymentHash: serializeJsonSafe(t.originalPaymentHash),
    chainId: serializeJsonSafe(t.chainId),
    txCategory: serializeJsonSafe(t.txCategory),
    displayJson: serializeJsonSafe(t.displayJson),
    timestamp: serializeJsonSafe(t.timestamp),
    payer: serializeJsonSafe(t.payer),
    payee: serializeJsonSafe(t.payee),
    finalRequestAmountFiat6: serializeJsonSafe(t.finalRequestAmountFiat6),
    finalRequestAmountUSDC6: serializeJsonSafe(t.finalRequestAmountUSDC6),
    isAAAccount: serializeJsonSafe(t.isAAAccount),
    fees: serializeJsonSafe(t.fees),
    meta: serializeJsonSafe(t.meta),
    exists: serializeJsonSafe(t.exists),
  };
}

/** rawTx must contain the core on-chain Transaction fields */
function hasRequiredRawTxFields(rawTx: Record<string, unknown>): boolean {
  return (
    typeof rawTx.id === "string" &&
    typeof rawTx.txCategory === "string" &&
    typeof rawTx.payer === "string" &&
    typeof rawTx.payee === "string" &&
    (typeof rawTx.timestamp === "number" || typeof rawTx.timestamp === "string")
  );
}

/**
 * 从 BeamioIndexerDiamond 获取 B-Unit 记账明细（claim、USDC 购买、焚烧）
 * 优先通过 beamio API 获取（避免浏览器 CORS），失败时回退到直接 RPC。
 */
export const getBUnitLedgerFromIndexer = async (
  account: string,
  options?: { throwOnError?: boolean }
): Promise<BUnitLedgerEntry[]> => {
  if (!account || !ethers.isAddress(account)) return [];
  try {
    const res = await fetch(`${beamioApi}/api/getBUnitLedger?address=${encodeURIComponent(account)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.every((e: unknown) => e && typeof e === 'object' && 'id' in (e as object))) {
        const entries = data as BUnitLedgerEntry[];
        // Ledger entries are valid only when bound to rawTx. Any missing/malformed rawTx triggers on-chain rebuild.
        const allEntriesBoundToRawTx = entries.every((entry) =>
          !!entry &&
          !!entry.rawTx &&
          typeof entry.rawTx === "object" &&
          hasRequiredRawTxFields(entry.rawTx)
        );
        if (allEntriesBoundToRawTx) return entries;
      }
    }
  } catch (e) {
    if (typeof console !== 'undefined' && console.error) console.error('[getBUnitLedgerFromIndexer] API fallback failed:', e);
  }
  const accountLower = account.toLowerCase();
  const buintLower = CONET_BUINT.toLowerCase();
  try {
    const indexer = new ethers.Contract(BEAMIO_INDEXER_DIAMOND, INDEXER_GET_ACCOUNT_TX_ABI, conetDepinProvider);
    const page = await indexer.getAccountTransactionsPaged(account, 0, 100);
    const decimals = 6;

    // Build lookup: hash (id or originalPaymentHash) -> original USDC amount from Recent Activity–style records
    const linkedPaymentUsdcByHash = new Map<string, number>();
    const TX_BUINT_EXCLUDE_FOR_LINK = new Set([
      TX_BUINT_CLAIM.toLowerCase(),
      TX_BUINT_USDC.toLowerCase(),
      TX_REQUEST_ACCOUNTING.toLowerCase(),
      TX_SEND_USDC.toLowerCase(),
      TX_X402_SEND.toLowerCase(),
      ethers.keccak256(ethers.toUtf8Bytes("buintBurn")).toLowerCase(),
      ...["sendUSDC", "cardTopup", "issueCard", "x402Send"].map((n) => ethers.keccak256(ethers.toUtf8Bytes(n)).toLowerCase()),
    ]);
    for (const tx of page) {
      if (!tx?.exists) continue;
      const cat = (typeof tx.txCategory === "string" ? tx.txCategory : tx.txCategory != null ? "0x" + BigInt(tx.txCategory).toString(16).padStart(64, "0") : "").toLowerCase();
      if (TX_BUINT_EXCLUDE_FOR_LINK.has(cat)) continue;
      const usdc6 = Number(tx.finalRequestAmountUSDC6 ?? 0);
      const idHex = typeof tx.id === "string" ? tx.id : tx.id != null ? "0x" + BigInt(tx.id).toString(16).padStart(64, "0") : "";
      const ophRaw = (tx as { originalPaymentHash?: string | bigint })?.originalPaymentHash;
      const ophHex = ophRaw != null && ophRaw !== ethers.ZeroHash
        ? (typeof ophRaw === "string" ? ophRaw : "0x" + BigInt(ophRaw).toString(16).padStart(64, "0"))
        : "";
      if (idHex && ethers.isHexString(idHex) && ethers.dataLength(idHex) === 32) {
        linkedPaymentUsdcByHash.set(idHex.toLowerCase(), usdc6);
      }
      if (ophHex && ethers.isHexString(ophHex) && ethers.dataLength(ophHex) === 32) {
        linkedPaymentUsdcByHash.set(ophHex.toLowerCase(), usdc6);
      }
      try {
        const dj = (tx as { displayJson?: string })?.displayJson ?? "";
        if (dj) {
          const j = JSON.parse(dj) as { requestHash?: string };
          if (j?.requestHash && ethers.isHexString(j.requestHash) && ethers.dataLength(j.requestHash) === 32) {
            linkedPaymentUsdcByHash.set(j.requestHash.toLowerCase(), usdc6);
          }
        }
      } catch {}
    }

    const entries: BUnitLedgerEntry[] = [];
    for (const tx of page) {
      if (!tx?.exists) continue;
      const txCategory = String(tx.txCategory);
      const payer = String(tx.payer).toLowerCase();
      const payee = String(tx.payee).toLowerCase();
      const amountFiat6 = Number(tx.finalRequestAmountFiat6 ?? 0);
      const amountUSDC6 = Number(tx.finalRequestAmountUSDC6 ?? 0);
      const amountBUnits = Math.round(amountFiat6 / 10 ** decimals);
      const ts = Number(tx.timestamp ?? 0);
      const timeStr = ts ? formatBUnitLedgerTime(ts) : "—";
      const rawId = tx.id;
      const txIdHex = typeof rawId === "string" ? rawId : rawId != null ? "0x" + BigInt(rawId).toString(16).padStart(64, "0") : "0x";
      const txHashShort = txIdHex.length > 10 ? `${txIdHex.slice(0, 6)}...${txIdHex.slice(-4)}` : txIdHex;

      const baseEntry = { time: timeStr, timestamp: ts, txHash: txHashShort, network: "CoNET L1" as const, status: "Completed" as const };
      const rawTx = serializeRawTx(tx);
      if (!hasRequiredRawTxFields(rawTx)) continue;

      if (txCategory === TX_BUINT_CLAIM && payee === accountLower) {
        entries.push({
          ...baseEntry,
          id: txIdHex,
          title: "BUnit Claim",
          subtitle: "Free claim",
          amount: amountBUnits,
          type: "reward",
          linkedUsdc: "N/A",
          rawTx,
        });
      } else if (txCategory === TX_BUINT_USDC && payee === accountLower) {
        const usdcAmount = amountUSDC6 > 0 ? amountUSDC6 / 10 ** decimals : amountBUnits / 100;
        const usdcStr = usdcAmount > 0 ? `-${usdcAmount.toFixed(2)} USDC` : "N/A";
        let baseTxHash: string | undefined;
        try {
          const displayJson = (tx as { displayJson?: string })?.displayJson ?? "";
          if (displayJson) {
            const parsed = JSON.parse(displayJson) as { baseTxHash?: string };
            if (parsed?.baseTxHash && ethers.isHexString(parsed.baseTxHash)) baseTxHash = parsed.baseTxHash;
          }
        } catch {}
        entries.push({
          ...baseEntry,
          id: txIdHex,
          title: tu('fuel_yield_1_100'),
          subtitle: "System Top-up",
          amount: amountBUnits,
          type: "refuel",
          linkedUsdc: usdcStr,
          baseTxHash,
          rawTx,
        });
      } else if (payee === buintLower && payer === accountLower) {
        const rawOphVal = (tx as { originalPaymentHash?: string | bigint })?.originalPaymentHash;
        const rawOph = rawOphVal != null
          ? (typeof rawOphVal === "string" ? rawOphVal : "0x" + BigInt(rawOphVal).toString(16).padStart(64, "0"))
          : undefined;
        const txCatNorm = (typeof txCategory === "string" ? txCategory : txCategory != null ? "0x" + BigInt(txCategory).toString(16).padStart(64, "0") : "").toLowerCase();
        const isRequestAccounting = txCatNorm === TX_REQUEST_ACCOUNTING.toLowerCase();
        const isSendUSDC = txCatNorm === TX_SEND_USDC.toLowerCase();
        const isX402Send = txCatNorm === TX_X402_SEND.toLowerCase();
        // requestAccounting 的 originalPaymentHash 是 requestHash，用 CoNET 链接；其他用 Base 链接
        const ophHex = rawOph && rawOph !== ethers.ZeroHash && ethers.isHexString(rawOph) && ethers.dataLength(rawOph) === 32
          ? (rawOph.startsWith("0x") ? rawOph : "0x" + rawOph)
          : "";
        const baseTxHash = !isRequestAccounting && ophHex && ethers.dataLength(ophHex) === 32 ? ophHex : undefined;
        const originalPaymentHash = isRequestAccounting && ophHex && ethers.dataLength(ophHex) === 32 ? ophHex : undefined;
        // TX_SEND_USDC / TX_X402_SEND: fixed 2 buint → Network Fee; requestAccounting: 0.8% protocol → Service Fee (0.8%)
        const title = (isSendUSDC || isX402Send) ? tu('network_fee') : isRequestAccounting ? "Service Fee (0.8%)" : "B-Unit Burn";
        const subtitle = isRequestAccounting
          ? `Payment Request ${ophHex ? ophHex.slice(-3) : "—"}`
          : (isSendUSDC || isX402Send)
            ? ""
            : (amountUSDC6 > 0 ? `Paid ${(amountUSDC6 / 10 ** decimals).toFixed(2)} USDC` : "Gas / Fee");
        const isServiceFee = amountUSDC6 > 0 || isRequestAccounting || isSendUSDC || isX402Send;
        // Resolve linked USDC from Recent Activity: match by originalPaymentHash or baseTxHash
        let linkedUsdcStr = amountUSDC6 > 0 ? `${(amountUSDC6 / 10 ** decimals).toFixed(2)} USDC` : "N/A";
        const lookupHash = (baseTxHash ?? originalPaymentHash ?? "").toLowerCase();
        if (lookupHash && linkedPaymentUsdcByHash.has(lookupHash)) {
          const linkedUsdc6 = linkedPaymentUsdcByHash.get(lookupHash)!;
          linkedUsdcStr = linkedUsdc6 > 0 ? `${(linkedUsdc6 / 10 ** decimals).toFixed(2)} USDC` : "N/A";
        }
        entries.push({
          ...baseEntry,
          id: txIdHex,
          title,
          subtitle,
          amount: -amountBUnits,
          type: isServiceFee ? "fee" : "gas",
          linkedUsdc: linkedUsdcStr,
          baseTxHash,
          originalPaymentHash,
          rawTx,
        });
      }
    }
    entries.sort((a, b) => b.timestamp - a.timestamp);
    return entries.filter((entry) => hasRequiredRawTxFields(entry.rawTx));
  } catch (e) {
    if (typeof console !== 'undefined' && console.error) console.error('[getBUnitLedgerFromIndexer] RPC failed:', e);
    if (options?.throwOnError) throw e;
    return [];
  }
};

function formatBUnitLedgerTime(ts: number): string {
  const d = new Date(ts * 1000);
  const now = Date.now();
  const diff = now - ts * 1000;
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 48 * 60 * 60 * 1000) return tu('yesterday');
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const getCardOwnerByCardAddress = async (cardAddress: string): Promise<searchResult | null> => {
    try {
        const card = new ethers.Contract(cardAddress, cardAbi, baseEndpoint)
        const owner = await card.owner()
		if (owner === ethers.ZeroAddress) {
			return null
		}
		const account = await searchUsername(owner)
		if (account?.results?.[0]) {
			return account.results[0]
		}
		return null
    } catch (error: any) {
        console.log(`❌ getCardOwnerByCardAddress Failed: ${error.message}`);
        return null
    }
}

/** Android POS Check Balance：POST /api/getUIDAssets（uid + 可选 SUN e,c,m） */
export type UidAssetsNfcCardRow = {
	cardAddress: string
	cardName?: string
	points?: string
	cardCurrency?: string
	cardType?: string
}

export type UidAssetsNfcResponse = {
	ok: boolean
	uid?: string
	tagIdHex?: string
	address?: string
	aaAddress?: string
	points?: string
	usdcBalance?: string
	cardCurrency?: string
	cards?: UidAssetsNfcCardRow[]
	error?: string
}

/** POS / PWA：SUN 校验通过后登记 Link 会话（与 android-NDEF postNfcLinkApp 一致） */
export type NfcLinkAppApiResult =
	| {
			ok: true
			nftRedeemcode: string
			tagid: string
			uid: string
			counter: number
			deepLinkUrl: string
			migrateViaContainer?: boolean
			redeemOnChain?: boolean
	  }
	| {
			ok: false
			error: string
			errorCode?: string
			redeemOnChain?: boolean
			httpStatus?: number
	  }

export async function postNfcLinkApp(body: {
	uid: string
	e: string
	c: string
	m: string
	cardAddress?: string
}): Promise<NfcLinkAppApiResult> {
	const uid = body.uid?.trim() ?? ''
	const e = body.e?.trim() ?? ''
	const c = body.c?.trim() ?? ''
	const m = body.m?.trim() ?? ''
	if (!/^[0-9A-Fa-f]{14}$/.test(uid)) {
		return { ok: false, error: 'Invalid uid for NFC link.' }
	}
	if (e.length !== 64 || c.length !== 6 || m.length !== 16) {
		return { ok: false, error: 'SUN params (e, c, m) are invalid or missing.' }
	}
	const payload: Record<string, string> = { uid, e, c, m }
	if (body.cardAddress?.trim()) payload.cardAddress = body.cardAddress.trim()
	try {
		const res = await fetch(`${beamioApi}/api/nfcLinkApp`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify(payload),
		})
		const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
		const success = Boolean(json.success)
		const errStr = json.error != null ? String(json.error) : ''
		const errorCode = json.errorCode != null ? String(json.errorCode) : undefined
		const redeemOnChain = Boolean(json.redeemOnChain)
		if (res.status === 409) {
			return {
				ok: false,
				error: errStr || 'This card is locked by another link session.',
				errorCode,
				redeemOnChain,
				httpStatus: 409,
			}
		}
		if (!res.ok || !success) {
			return {
				ok: false,
				error: errStr || `Request failed (${res.status})`,
				errorCode,
				redeemOnChain,
				httpStatus: res.status,
			}
		}
		const deepLinkUrl = json.deepLinkUrl != null ? String(json.deepLinkUrl) : ''
		const code = json.nftRedeemcode != null ? String(json.nftRedeemcode) : ''
		const tagid = json.tagid != null ? String(json.tagid).replace(/^0x/i, '') : ''
		const uidOut = json.uid != null ? String(json.uid).replace(/^0x/i, '').toLowerCase() : ''
		const counterRaw = json.counter
		const counter =
			typeof counterRaw === 'number' && Number.isFinite(counterRaw)
				? counterRaw
				: parseInt(String(counterRaw ?? ''), 10)
		if (!deepLinkUrl || !code || !tagid || !uidOut || !Number.isFinite(counter)) {
			return { ok: false, error: 'Invalid link response from server.' }
		}
		return {
			ok: true,
			nftRedeemcode: code,
			tagid,
			uid: uidOut,
			counter,
			deepLinkUrl,
			migrateViaContainer: Boolean(json.migrateViaContainer),
			redeemOnChain,
		}
	} catch (e: unknown) {
		return { ok: false, error: e instanceof Error ? e.message : tu('network_error') }
	}
}

/** App 端认领：用当前钱包私钥完成换绑与可选链上迁移（HTTPS；勿记录私钥） */
export type NfcLinkAppClaimApiResult =
	| { ok: true; address?: string; redeemTxHash?: string | null; migrationEoaSweepTxHashes?: string[] }
	| { ok: false; error: string }

export async function postNfcLinkAppClaimWithKey(body: {
	nftRedeemcode: string
	tagid: string
	uid: string
	counter: number
	/** 0x + 64 hex，与 MemberCard.normalizeNfcLinkClaimPrivateKey 一致 */
	privateKey: string
}): Promise<NfcLinkAppClaimApiResult> {
	const pk = body.privateKey.trim()
	const pkHex = pk.startsWith('0x') ? pk : `0x${pk}`
	if (!/^0x[0-9a-fA-F]{64}$/.test(pkHex)) {
		return { ok: false, error: 'Invalid private key format.' }
	}
	try {
		const res = await fetch(`${beamioApi}/api/nfcLinkAppClaimWithKey`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({
				nftRedeemcode: body.nftRedeemcode.trim(),
				tagid: body.tagid.replace(/^0x/i, ''),
				uid: body.uid.replace(/^0x/i, ''),
				counter: body.counter,
				privateKey: pkHex,
			}),
		})
		const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
		const success = Boolean(json.success)
		if (!res.ok || !success) {
			return {
				ok: false,
				error: json.error != null ? String(json.error) : `Request failed (${res.status})`,
			}
		}
		return {
			ok: true,
			address: json.address != null ? String(json.address) : undefined,
			redeemTxHash: json.redeemTxHash != null ? String(json.redeemTxHash) : null,
			migrationEoaSweepTxHashes: Array.isArray(json.migrationEoaSweepTxHashes)
				? json.migrationEoaSweepTxHashes.map((h) => String(h))
				: undefined,
		}
	} catch (e: unknown) {
		return { ok: false, error: e instanceof Error ? e.message : tu('network_error') }
	}
}

/** 与 x402sdk db.buildNfcCardLinkStateSignMessage 一致（键排序 JSON，供 /api/nfcCardLinkState） */
const NFC_CARD_LINK_STATE_SCOPE = 'beamio:NfcCardLinkState:v1'

function buildNfcCardLinkStateSignMessage(
	action: 'active' | 'deactive' | 'remove',
	tagId16: string,
	issuedAtSec: number
): string {
	const tag = String(tagId16 || '')
		.trim()
		.replace(/^0x/i, '')
		.toUpperCase()
	if (!/^[0-9A-F]{16}$/.test(tag)) {
		throw new Error('tagId must be 16 hex characters')
	}
	if (!Number.isFinite(issuedAtSec) || issuedAtSec <= 0) {
		throw new Error('issuedAt must be a positive Unix timestamp in seconds')
	}
	if (action !== 'active' && action !== 'deactive' && action !== 'remove') {
		throw new Error('action must be active, deactive, or remove')
	}
	const o = {
		action,
		issuedAt: Math.floor(issuedAtSec),
		scope: NFC_CARD_LINK_STATE_SCOPE,
		tagId: tag,
	}
	return JSON.stringify(o, Object.keys(o).sort())
}

export type LinkedNfcCardApiRow = {
	uid: string
	tagId: string
	linkState: 'active' | 'deactive'
}

export type ListLinkedNfcCardsResult =
	| {
			ok: true
			ownerEoa: string
			inputWasSmartAccount: boolean
			count: number
			cards: LinkedNfcCardApiRow[]
	  }
	| { ok: false; error: string }

/** POST /api/listLinkedNfcCards — wallet 可为 AA 或 EOA */
export async function postListLinkedNfcCards(walletRaw: string): Promise<ListLinkedNfcCardsResult> {
	const w = String(walletRaw || '').trim()
	if (!w) return { ok: false, error: 'Missing wallet' }
	let addr: string
	try {
		addr = ethers.getAddress(w)
	} catch {
		return { ok: false, error: 'Invalid wallet address' }
	}
	try {
		const res = await fetch(`${beamioApi}/api/listLinkedNfcCards`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ wallet: addr }),
		})
		const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
		if (!res.ok || json.ok !== true) {
			return {
				ok: false,
				error: json.error != null ? String(json.error) : `Request failed (${res.status})`,
			}
		}
		const cardsRaw = json.cards
		const cards: LinkedNfcCardApiRow[] = []
		if (Array.isArray(cardsRaw)) {
			for (const row of cardsRaw) {
				const r = row as Record<string, unknown>
				const uid = String(r.uid ?? '')
					.replace(/^0x/i, '')
					.toLowerCase()
				const tagId = String(r.tagId ?? r.tagid ?? '')
					.replace(/^0x/i, '')
					.toUpperCase()
				const ls = String(r.linkState ?? r.nfc_link_state ?? 'active').toLowerCase()
				const linkState: 'active' | 'deactive' = ls === 'deactive' ? 'deactive' : 'active'
				if (uid && tagId.length === 16 && /^[0-9A-F]+$/.test(tagId)) {
					cards.push({ uid, tagId, linkState })
				}
			}
		}
		return {
			ok: true,
			ownerEoa: json.ownerEoa != null ? String(json.ownerEoa) : '',
			inputWasSmartAccount: Boolean(json.inputWasSmartAccount),
			count: typeof json.count === 'number' ? json.count : cards.length,
			cards,
		}
	} catch (e: unknown) {
		return { ok: false, error: e instanceof Error ? e.message : tu('network_error') }
	}
}

export async function postNfcCardLinkStateSigned(params: {
	/** Raw hex or 0x+64，与 Link Claim 所用用户钱包一致 */
	privateKeyArmorOrHex: string
	action: 'active' | 'deactive' | 'remove'
	tagId16: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
	const raw = params.privateKeyArmorOrHex.trim()
	const pkHex = raw.startsWith('0x') ? raw : `0x${raw}`
	if (!/^0x[0-9a-fA-F]{64}$/.test(pkHex)) {
		return { ok: false, error: 'Invalid private key format.' }
	}
	let message: string
	try {
		message = buildNfcCardLinkStateSignMessage(params.action, params.tagId16, Math.floor(Date.now() / 1000))
	} catch (e: unknown) {
		return { ok: false, error: e instanceof Error ? e.message : 'Invalid request' }
	}
	try {
		const wallet = new ethers.Wallet(pkHex)
		const signature = await wallet.signMessage(message)
		const res = await fetch(`${beamioApi}/api/nfcCardLinkState`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ message, signature }),
		})
		const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
		if (!res.ok || json.ok !== true) {
			return {
				ok: false,
				error: json.error != null ? String(json.error) : `Request failed (${res.status})`,
			}
		}
		return { ok: true }
	} catch (e: unknown) {
		return { ok: false, error: e instanceof Error ? e.message : tu('network_error') }
	}
}

export async function postGetUidAssetsForNfcScan(body: {
	uid: string
	e?: string
	c?: string
	m?: string
}): Promise<UidAssetsNfcResponse> {
	const uid = body.uid?.trim() ?? ''
	if (!uid) return { ok: false, error: 'Missing uid' }
	const payload: Record<string, string> = { uid }
	if (body.e?.trim()) payload.e = body.e.trim()
	if (body.c?.trim()) payload.c = body.c.trim()
	if (body.m?.trim()) payload.m = body.m.trim()
	try {
		const res = await fetch(`${beamioApi}/api/getUIDAssets`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify(payload),
		})
		const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
		const ok = Boolean(json.ok)
		const errStr = json.error != null ? String(json.error) : ''
		if (!res.ok && !ok) {
			return { ok: false, error: errStr || `Request failed (${res.status})` }
		}
		if (!ok) {
			return { ok: false, error: errStr || 'Card query failed' }
		}
		const cardsRaw = json.cards
		let cards: UidAssetsNfcCardRow[] | undefined
		if (Array.isArray(cardsRaw)) {
			cards = cardsRaw.map((c: Record<string, unknown>) => ({
				cardAddress: String(c.cardAddress ?? ''),
				cardName: c.cardName != null ? String(c.cardName) : undefined,
				points: c.points != null ? String(c.points) : undefined,
				cardCurrency: c.cardCurrency != null ? String(c.cardCurrency) : undefined,
				cardType: c.cardType != null ? String(c.cardType) : undefined,
			}))
		}
		return {
			ok: true,
			uid: json.uid != null ? String(json.uid) : undefined,
			tagIdHex: json.tagIdHex != null ? String(json.tagIdHex) : undefined,
			address: json.address != null ? String(json.address) : undefined,
			aaAddress: json.aaAddress != null ? String(json.aaAddress) : undefined,
			points: json.points != null ? String(json.points) : undefined,
			usdcBalance: json.usdcBalance != null ? String(json.usdcBalance) : undefined,
			cardCurrency: json.cardCurrency != null ? String(json.cardCurrency) : undefined,
			cards,
			error: errStr || undefined,
		}
	} catch (e: unknown) {
		return { ok: false, error: e instanceof Error ? e.message : tu('network_error') }
	}
}