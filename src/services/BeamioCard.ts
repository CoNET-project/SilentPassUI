import { ethers } from "ethers";
import contracts from "../utils/contracts";
import { baseEndpoint, baseRpcProviderDirect, USDCContract_BASE, beamioApi, BeamioCardFactorySC, conetDepinProvider, CCSA_Card_Address, BEAMIO_USER_CARD_ASSET_ADDRESS } from "../utils/constants";
import { withBaseRpc } from "../utils/baseRpc";
import {
	BASE_MAINNET_FACTORIES,
	BASE_TREASURY,
	CONET_BUINT_REDEEM_AIRDROP,
	CONET_BUSINESS_START_KET,
	CONET_BUSINESS_START_KET_REDEEM,
	CONET_CARD_FACTORY,
} from "@/config/chainAddresses";
import { resolveBeamioAaOnConet } from "@/utils/resolveBeamioAaFromCardFactory";
import { isRpcDegraded, reportRpcFailure, isRpcQuotaOrNetworkError } from "@/utils/rpcStatus";
import { CoNET_Data, setCoNET_Data } from "@/utils/globals";
import { storeSystemData } from "./beamio";
import { BeamioAAAcountFactoryAbi, cardAbi } from "../utils/abis";
import { searchUsername} from "./beamio"
import usdc_abi from './ABI/usdc_abi.json'
import { Theater } from "lucide-react";
import {
	normalizeCardPreviewLogoDisplayTier,
	type CardPreviewLogoDisplayTier,
} from "@/utils/cardPreviewLogoDisplayTier";
import {
	CONET_MAINNET_CHAIN_ID,
	DEFAULT_MERCHANT_CARD_FACTORY,
	eip712ChainIdForBeamioUserCard,
	providerForBeamioUserCard,
} from "@/utils/beamioUserCardChain";
//		UID 044073D2151990

/** 购卡请求体：仅允许 string/number，禁止 BigInt，以便 JSON 序列化发给后端 */
export type Icard = { cardAddress: string, userSignature: string, nonce: string, usdcAmount: string, from: string, validAfter: number, validBefore: number }



/**
 * 
 * 	const now = BigInt(Math.floor(Date.now() / 1000))
	const validAfter = now - BigInt(60)
	const validBefore = now + BigInt(60)   
 */
/** 用户拥有的卡片列表中不显示的卡地址（基础设施/系统卡） */
const USER_CARD_DISPLAY_EXCLUDED = new Set([
	'0x02bae511632354584b198951b42ec73bacbc4e98',
	'0xa86a8406b06bd6c332b4b380a0eaced822218eff',
	'0xc0f1c74fb95100a97b532be53b266a54f41db615',
	'0xecc5bdff6716847e45363befd3506b1d539c02d5',
	'0x90ae2212ee70aca8671ab7f5238c828d13c6dea7',
	'0x4879171d6c4693eaedcd8f448a785a31b2146e64',
	'0x66be7ec7111145becdfc2b5aa63143d6be1e3dd4',
	'0x97a1453254a7d0b4bfa5f9b402047ce49deed9c9',
	'0x1829fa7dfe1a4afbea40978eb57dbb7d6237381d',
	'0x9cda8477c9f03b8759ac64e21941e578908fd750',
	CCSA_Card_Address,
	BEAMIO_USER_CARD_ASSET_ADDRESS,
])

const filterExcludedUserCards = (cards: UserCardInfo[]): UserCardInfo[] =>
	cards.filter((c) => !USER_CARD_DISPLAY_EXCLUDED.has(c.cardAddress.toLowerCase()))

/** User Card Factory = card.factoryGateway()；OpenTransfer 验签须与 redeemOpenTransfer 同源 */
const BeamioUserCardGatewayAddress = ethers.getAddress(DEFAULT_MERCHANT_CARD_FACTORY)
const chainId8453 = BigInt(CONET_MAINNET_CHAIN_ID)
export const signOfflineTransferERC3009 = async (
	userPrivateKey: string,
	pointsHuman: string,
	cardAddress: string
  ) => {
	const signer = new ethers.Wallet(userPrivateKey)
  
	const now = Math.floor(Date.now() / 1000)
	const validAfter = BigInt(now - 60)          // 给 30s 容错
	const validBefore = BigInt(now + 360)        // 3 分钟
  
	const nonce = ethers.hexlify(ethers.randomBytes(32)) as `0x${string}`
  
	const tokenID = 0n // 这里必须等于合约的 POINTS_ID（你现在用 0，确认一下确实是 0）
	const maxAmount = ethers.parseUnits(pointsHuman, 6)
  
	// 1) 对齐 Solidity: keccak256(abi.encode(...))
	const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
	  ["string","address","address","uint256","address","uint256","uint256","uint256","uint256","bytes32"],
	  [
		"OpenTransfer",
		BeamioUserCardGatewayAddress,
		cardAddress,
		chainId8453,
		signer.address,
		tokenID,
		maxAmount,
		validAfter,
		validBefore,
		nonce,
	  ]
	)
  
	const hash = ethers.keccak256(encoded)
  
	// 2) 对齐 Solidity: toEthSignedMessageHash(hash) + recover
	const signature = await signer.signMessage(ethers.getBytes(hash))
  
	return {
	  fromEOA: signer.address,
	  id: tokenID.toString(),
	  maxAmount: maxAmount.toString(),
	  validAfter: validAfter.toString(),
	  validBefore: validBefore.toString(),
	  nonce,
	  signature,
	  digest: hash,
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
const createCardEndpoint = `${beamioApi}/api/createCard`
const updateCardShareMetadataEndpoint = `${beamioApi}/api/updateCardShareMetadata`
const updateCardMerchantImageEndpoint = `${beamioApi}/api/updateCardMerchantImage`
const updateCardProgramImageEndpoint = `${beamioApi}/api/updateCardProgramImage`
const updateIssuedCouponMetadataEndpoint = `${beamioApi}/api/updateIssuedCouponMetadata`
const requestExplorerNftMetadataRefreshEndpoint = `${beamioApi}/api/requestExplorerNftMetadataRefresh`
const cardUpdateTiersEndpoint = `${beamioApi}/api/cardUpdateTiers`
const cardsByCategoryEndpoint = `${beamioApi}/api/cardsByCategory`

/** 与 x402sdk getLatestCards / cardsByCategory 返回的单卡结构一致（Cluster JSON） */
export type BeamioLatestCardApiItem = {
	cardAddress: string
	cardOwner: string
	currency: string
	priceInCurrencyE6: string
	uri: string | null
	metadata: Record<string, unknown> | null
	txHash: string | null
	totalPointsMinted6: string
	holderCount: number
	createdAt: string
}

export type CardsByCategoryGroup = {
	categoryId: string
	items: BeamioLatestCardApiItem[]
}

/** GET /api/cardsByCategory — 按 shareTokenMetadata.categories 聚合已登记发卡 */
export const fetchCardsByCategory = async (opts?: {
	scanLimit?: number
	limitPerCategory?: number
}): Promise<CardsByCategoryGroup[]> => {
	const params = new URLSearchParams()
	if (opts?.scanLimit != null) params.set('scanLimit', String(opts.scanLimit))
	if (opts?.limitPerCategory != null) params.set('limitPerCategory', String(opts.limitPerCategory))
	const q = params.toString()
	const url = q ? `${cardsByCategoryEndpoint}?${q}` : cardsByCategoryEndpoint
	const response = await fetch(url)
	const data = (await response.json()) as { groups?: CardsByCategoryGroup[]; error?: string }
	if (!response.ok) {
		throw new Error(data?.error ?? `cardsByCategory HTTP ${response.status}`)
	}
	return Array.isArray(data.groups) ? data.groups : []
}

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
const cardRedeemPreCheckEndpoint = `${beamioApi}/api/cardRedeemPreCheck`
const cardCouponOpenClaimEndpoint = `${beamioApi}/api/cardCouponOpenClaim`
const cardRedeemAdminEndpoint = `${beamioApi}/api/cardRedeemAdmin`
const cardAddAdminEndpoint = `${beamioApi}/api/cardAddAdmin`
const cardAddAdminByAdminEndpoint = `${beamioApi}/api/cardAddAdminByAdmin`
const cardClearAdminMintCounterEndpoint = `${beamioApi}/api/cardClearAdminMintCounter`
const cardTerminalSettlementClearEndpoint = `${beamioApi}/api/cardTerminalSettlementClear`
const longDhangMigrationConfigEndpoint = `${beamioApi}/api/longDhangMigrationConfig`
const longDhangMigrationPreviewEndpoint = `${beamioApi}/api/longDhangMigrationPreview`
const longDhangMigrationCreateCardEndpoint = `${beamioApi}/api/longDhangMigrationCreateCard`
const longDhangMigrationRunEndpoint = `${beamioApi}/api/longDhangMigrationRun`
const longDhangMigrationVerifyEndpoint = `${beamioApi}/api/longDhangMigrationVerify`

export const LONGDHANG_OLD_BASE_CARD = '0x30d80cD71Fd1FFD346737b387dA11C7412363EFF'
export const LONGDHANG_OLD_CARD_OWNER = '0xA2d21FBd33F7D754D8d7A53fe2B4e5C39A008a1F'
export const LONGDHANG_MIGRATION_VERSION = 'longdhang-conet-migration-v1'

export type LongDhangMigrationSnapshotHolder = {
	eoa: string
	oldBaseAA: string
	balanceE6: string
	sourceHolder?: string
}

export type LongDhangMigrationSnapshot = {
	version: string
	oldBaseCard: string
	oldBaseCardOwner: string
	baseChainId: number
	conetChainId: number
	baseRpcUrl: string
	baseFromBlock: number
	baseToBlock: number
	oldBaseAaFactory: string
	holderCount: number
	totalBalanceE6: string
	excludedCount: number
	holders: LongDhangMigrationSnapshotHolder[]
	excluded: Array<{ holder: string; balanceE6: string; reason: string }>
	anomalies: Array<{ holder: string; balanceE6: string; reason: string }>
	snapshotHash: string
	migrationAdmin: string
	generatedAt: string
}

export type LongDhangMigrationRunResult = {
	success: boolean
	newCardAddress: string
	snapshotHash: string
	totalSnapshotRows: number
	processed: number
	minted: number
	skipped: number
	failed: number
	rows: Array<LongDhangMigrationSnapshotHolder & {
		conetAA?: string
		status: 'minted' | 'skipped' | 'failed'
		reason?: string
		mintTx?: string
		indexerTx?: string
		txId?: string
	}>
	terminals?: {
		total: number
		registered: number
		skipped: number
		failed: number
		rows: Array<{
			posEoa: string
			metadata: string
			mintLimitE6: string
			status: 'registered' | 'skipped' | 'failed'
			txHash?: string
			reason?: string
		}>
	}
	error?: string
}

export function buildLongDhangMigrationAuthMessage(args: {
	action: 'create-card' | 'run-migration'
	ownerEoa: string
	snapshotHash: string
	newCardAddress?: string
}): string {
	const owner = ethers.getAddress(args.ownerEoa)
	const snap = args.snapshotHash && ethers.isHexString(args.snapshotHash, 32) ? args.snapshotHash.toLowerCase() : ''
	const newCard = args.newCardAddress && ethers.isAddress(args.newCardAddress)
		? ethers.getAddress(args.newCardAddress)
		: ethers.ZeroAddress
	return [
		'LongDhang CoNET Migration',
		`version:${LONGDHANG_MIGRATION_VERSION}`,
		`action:${args.action}`,
		`owner:${owner}`,
		`oldBaseCard:${ethers.getAddress(LONGDHANG_OLD_BASE_CARD)}`,
		`newConetCard:${newCard}`,
		`snapshotHash:${snap}`,
		`conetChainId:${CONET_MAINNET_CHAIN_ID}`,
	].join('\n')
}

export async function signLongDhangMigrationAuthorization(args: {
	privateKeyArmor: string
	action: 'create-card' | 'run-migration'
	ownerEoa: string
	snapshotHash: string
	newCardAddress?: string
}): Promise<string> {
	const pk = args.privateKeyArmor.startsWith('0x') ? args.privateKeyArmor : `0x${args.privateKeyArmor}`
	const wallet = new ethers.Wallet(pk)
	const msg = buildLongDhangMigrationAuthMessage(args)
	return wallet.signMessage(msg)
}

export async function fetchLongDhangMigrationConfig(): Promise<{
	success: boolean
	oldBaseCard?: string
	oldBaseCardOwner?: string
	migrationAdmin?: string
	error?: string
}> {
	try {
		const res = await fetch(longDhangMigrationConfigEndpoint)
		const data = await res.json()
		if (!res.ok || data?.success === false) return { success: false, error: data?.error ?? 'Migration config unavailable.' }
		return {
			success: true,
			oldBaseCard: data.oldBaseCard,
			oldBaseCardOwner: data.oldBaseCardOwner,
			migrationAdmin: data.migrationAdmin,
		}
	} catch (e: any) {
		return { success: false, error: e?.message ?? String(e) }
	}
}

export async function previewLongDhangMigration(force = false): Promise<{
	success: boolean
	snapshot?: LongDhangMigrationSnapshot
	error?: string
}> {
	try {
		const signal = createFetchTimeoutSignal(240_000)
		const res = await fetch(longDhangMigrationPreviewEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ force }),
			...(signal ? { signal } : {}),
		})
		const data = await res.json()
		if (!res.ok || !data?.success) return { success: false, error: data?.error ?? 'Snapshot preview failed.' }
		return { success: true, snapshot: data.snapshot as LongDhangMigrationSnapshot }
	} catch (e: any) {
		return { success: false, error: e?.message ?? String(e) }
	}
}

export async function createLongDhangMigrationCard(payload: {
	ownerEoa: string
	snapshotHash: string
	ownerSignature: string
}): Promise<{ success: boolean; cardAddress?: string; txHash?: string; migrationAdmin?: string; error?: string }> {
	try {
		const signal = createFetchTimeoutSignal(240_000)
		const res = await fetch(longDhangMigrationCreateCardEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
			...(signal ? { signal } : {}),
		})
		const data = await res.json()
		if (!res.ok || !data?.success) return { success: false, error: data?.error ?? 'Create CoNET card failed.' }
		return {
			success: true,
			cardAddress: data.cardAddress,
			txHash: data.txHash,
			migrationAdmin: data.migrationAdmin,
		}
	} catch (e: any) {
		return { success: false, error: e?.message ?? String(e) }
	}
}

export async function runLongDhangMigration(payload: {
	newCardAddress: string
	ownerEoa: string
	snapshotHash: string
	ownerSignature: string
	limit?: number
}): Promise<LongDhangMigrationRunResult> {
	try {
		const signal = createFetchTimeoutSignal(360_000)
		const res = await fetch(longDhangMigrationRunEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
			...(signal ? { signal } : {}),
		})
		const data = await res.json()
		if (!res.ok || !data?.success) {
			if (data && Array.isArray(data.rows)) return data as LongDhangMigrationRunResult
			return {
				success: false,
				newCardAddress: payload.newCardAddress,
				snapshotHash: payload.snapshotHash,
				totalSnapshotRows: 0,
				processed: 0,
				minted: 0,
				skipped: 0,
				failed: 0,
				rows: [],
				error: data?.error ?? 'Run migration failed.',
			}
		}
		return data as LongDhangMigrationRunResult
	} catch (e: any) {
		return {
			success: false,
			newCardAddress: payload.newCardAddress,
			snapshotHash: payload.snapshotHash,
			totalSnapshotRows: 0,
			processed: 0,
			minted: 0,
			skipped: 0,
			failed: 0,
			rows: [],
			error: e?.message ?? String(e),
		}
	}
}

export async function verifyLongDhangMigration(newCardAddress: string): Promise<{
	success: boolean
	newCardAddress?: string
	snapshotHash?: string
	totalRows?: number
	matches?: number
	mismatches?: Array<LongDhangMigrationSnapshotHolder & { conetAA?: string; conetBalanceE6?: string; reason?: string }>
	terminals?: {
		total: number
		matches: number
		mismatches: Array<{ posEoa: string; reason: string; dbCardAddress?: string | null }>
	}
	error?: string
}> {
	try {
		const signal = createFetchTimeoutSignal(240_000)
		const res = await fetch(longDhangMigrationVerifyEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ newCardAddress }),
			...(signal ? { signal } : {}),
		})
		const data = await res.json()
		if (!res.ok || !data?.success) return { success: false, error: data?.error ?? 'Migration verification failed.' }
		return data
	} catch (e: any) {
		return { success: false, error: e?.message ?? String(e) }
	}
}

/** 通过 Factory 预测 EOA 的 AA 地址（index=0，CoNET CREATE2）。用于离线签字前构建 adminManager(predictedAA,...)。 */
export const getPredictedAAAddress = async (eoa: string): Promise<string> => {
	if (!eoa?.trim() || !ethers.isAddress(eoa)) throw new Error('Invalid EOA')
	const accountFactory = new ethers.Contract(
		contracts.BeamioAAAcountFactory.address,
		BeamioAAAcountFactoryAbi,
		conetDepinProvider
	)
	const predicted = await accountFactory.getFunction('getAddress(address,uint256)')(ethers.getAddress(eoa.trim()), 0n)
	if (!predicted || predicted === ethers.ZeroAddress) throw new Error('Factory returned invalid predicted AA address')
	return ethers.getAddress(predicted)
}

/** 为 EOA 确保存在 AA（无则创建），返回 AA 地址。登记 admin 前 UI 必须传 EOA 调用此接口获取 AA，再构建 adminManager(AA,...) 并签字。 */
export const ensureAAForEOA = async (eoa: string): Promise<string> => {
	if (!eoa?.trim() || !ethers.isAddress(eoa)) throw new Error('Invalid EOA')
	const addr = ethers.getAddress(eoa.trim())
	const res = await fetch(`${beamioApi}/api/ensureAAForEOA?eoa=${encodeURIComponent(addr)}`)
	const data = await res.json()
	if (!res.ok) throw new Error(data?.error ?? 'Failed to ensure AA for EOA')
	if (!data?.aa || !ethers.isAddress(data.aa)) throw new Error('Invalid AA response')
	return ethers.getAddress(data.aa)
}

/**
 * Cluster DB：`beamio_pos_terminal_admin_card`（与 `assertPosEoaAvailableForCardBinding` / GET `/api/myPosAddress` 一致）。
 * 用于终端登记前预检：若已绑定其它 program 卡则与后端拒绝文案对齐。
 */
export const fetchPosTerminalDbBinding = async (
	posEoa: string
): Promise<{ boundCard: string } | { notFound: true } | { error: string }> => {
	const trimmed = posEoa?.trim()
	if (!trimmed || !ethers.isAddress(trimmed)) return { error: 'Invalid address' }
	const addr = ethers.getAddress(trimmed)
	try {
		const res = await fetch(`${beamioApi}/api/myPosAddress?wallet=${encodeURIComponent(addr)}`)
		const j = (await res.json().catch(() => ({}))) as {
			ok?: boolean
			cardAddress?: string
			myPosAddress?: string
			error?: string
		}
		if (res.status === 404) return { notFound: true }
		if (j?.ok === false) return { notFound: true }
		if (!res.ok) return { error: j?.error ?? 'Could not verify terminal registration status. Try again.' }
		const raw = j.cardAddress ?? j.myPosAddress
		if (!raw || !ethers.isAddress(raw)) return { notFound: true }
		return { boundCard: ethers.getAddress(raw) }
	} catch {
		return { error: 'Could not verify terminal registration status. Try again.' }
	}
}

/** Cluster `GET /api/myPosAddress`：读取 DB 中保存的 `terminalMetadata`（Link / Edit terminal 上链 metadata同步）。 */
export const fetchPosTerminalMetadataFromApi = async (
	posEoa: string,
): Promise<
	{ ok: true; terminalMetadata: unknown | null; cardAddress?: string } | { ok: false; error: string }
> => {
	const trimmed = posEoa?.trim()
	if (!trimmed || !ethers.isAddress(trimmed)) return { ok: false, error: 'Invalid address' }
	const addr = ethers.getAddress(trimmed)
	try {
		const res = await fetch(`${beamioApi}/api/myPosAddress?wallet=${encodeURIComponent(addr)}`)
		const j = (await res.json().catch(() => ({}))) as {
			ok?: boolean
			terminalMetadata?: unknown
			cardAddress?: string
			error?: string
		}
		if (res.status === 404 || j?.ok === false) return { ok: true, terminalMetadata: null }
		if (!res.ok) return { ok: false, error: j?.error ?? 'Could not load terminal metadata.' }
		return {
			ok: true,
			terminalMetadata: j.terminalMetadata ?? null,
			cardAddress: typeof j.cardAddress === 'string' ? j.cardAddress : undefined,
		}
	} catch {
		return { ok: false, error: 'Could not load terminal metadata.' }
	}
}

/** SilentPassUI / beamio.app deep link for BeamioUserCard redeem codes. */
export const buildBeamioUserCardRedeemShareUrl = (cardAddress: string, redeemCode: string): string => {
	if (!cardAddress || !redeemCode?.trim() || !ethers.isAddress(cardAddress)) return ''
	const card = ethers.getAddress(cardAddress)
	return `https://beamio.app/app/?beamiocard=${encodeURIComponent(card)}&redeemcode=${encodeURIComponent(redeemCode.trim())}`
}

/** 客户端兑换前预检：链上 redeem 是否仍可用（Cluster 直读，不消耗码）。 */
export const postCardRedeemPreCheck = async (
	cardAddress: string,
	redeemCode: string,
	toUserEOA: string
): Promise<{
	success: boolean
	redeemable?: boolean
	shareUrl?: string
	hash?: string
	error?: string
	status?: number
}> => {
	if (!cardAddress || !redeemCode?.trim() || !toUserEOA || !ethers.isAddress(toUserEOA) || !ethers.isAddress(cardAddress)) {
		return { success: false, redeemable: false, error: 'Invalid cardAddress, redeemCode, or toUserEOA' }
	}
	const trimmedCode = redeemCode.trim()
	try {
		const res = await fetch(cardRedeemPreCheckEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ cardAddress, redeemCode: trimmedCode, toUserEOA }),
		})
		let data: {
			success?: boolean
			redeemable?: boolean
			shareUrl?: string
			hash?: string
			error?: string
		} = {}
		try {
			const text = await res.text()
			if (text) data = JSON.parse(text) as typeof data
		} catch {
			// response might be HTML
		}
		if (!res.ok) {
			return {
				success: false,
				redeemable: false,
				error: data.error ?? `HTTP ${res.status}`,
				status: res.status,
			}
		}
		if (data.success && data.redeemable) {
			return {
				success: true,
				redeemable: true,
				shareUrl: data.shareUrl ?? buildBeamioUserCardRedeemShareUrl(cardAddress, trimmedCode),
				hash: data.hash,
			}
		}
		return {
			success: false,
			redeemable: false,
			error: data.error ?? 'Redeem pre-check failed',
			status: res.status,
		}
	} catch (e) {
		const msg = (e as Error)?.message ?? 'Redeem pre-check request failed'
		return { success: false, redeemable: false, error: msg }
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

export type CardActiveIssuedCouponSeriesItem = {
	cardAddress: string
	tokenId: string
	metadata?: Record<string, unknown> | null
	issuedNftMaxSupply?: string
	issuedNftMintedCount?: string
	issuedNftRemainingSupply?: string
}

function readCouponIdFromMetadata(meta: Record<string, unknown> | null | undefined): string {
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

export async function fetchCardActiveIssuedCouponSeries(
	cardAddress: string,
	limit = 50
): Promise<CardActiveIssuedCouponSeriesItem[]> {
	if (!cardAddress || !ethers.isAddress(cardAddress)) return []
	const lim = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 50) : 50
	try {
		const res = await fetch(
			`${beamioApi}/api/cardActiveIssuedCouponSeries?card=${encodeURIComponent(ethers.getAddress(cardAddress))}&limit=${lim}`
		)
		if (!res.ok) return []
		const json = (await res.json().catch(() => ({}))) as { items?: CardActiveIssuedCouponSeriesItem[] }
		return Array.isArray(json.items) ? json.items : []
	} catch {
		return []
	}
}

export type CardActiveIssuedProductionSeriesItem = CardActiveIssuedCouponSeriesItem

export async function fetchCardActiveIssuedProductionSeries(
	cardAddress: string,
	limit = 50
): Promise<CardActiveIssuedProductionSeriesItem[]> {
	if (!cardAddress || !ethers.isAddress(cardAddress)) return []
	const lim = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 50) : 50
	try {
		const res = await fetch(
			`${beamioApi}/api/cardActiveIssuedProductionSeries?card=${encodeURIComponent(ethers.getAddress(cardAddress))}&limit=${lim}`
		)
		if (!res.ok) return []
		const json = (await res.json().catch(() => ({}))) as { items?: CardActiveIssuedProductionSeriesItem[] }
		return Array.isArray(json.items) ? json.items : []
	} catch {
		return []
	}
}

export type IssuedNftClaimWalletApiRow = {
	wallet: string
	holder: string
	claimedAt: string
	/** Latest on-chain burn (redeem/consume) timestamp; empty if not burned. */
	burnedAt?: string
	txHash: string
	blockNumber?: number
}

export type FetchIssuedNftClaimWalletsResult = {
	ok: boolean
	cardAddress?: string
	tokenId?: string
	page?: number
	pageSize?: number
	total?: number
	items?: IssuedNftClaimWalletApiRow[]
	error?: string
}

/** Wallets that completed mint/claim for an issued coupon or catalog NFT (chain IssuedNftMinted). */
export async function fetchIssuedNftClaimWallets(
	cardAddress: string,
	tokenId: string,
	page = 1,
	pageSize = 10
): Promise<FetchIssuedNftClaimWalletsResult | null> {
	if (!cardAddress || !ethers.isAddress(cardAddress) || !tokenId?.trim()) return null
	const pageN = Math.max(1, Math.floor(Number(page) || 1))
	const pageSizeN = Math.min(50, Math.max(1, Math.floor(Number(pageSize) || 10)))
	try {
		const qs = new URLSearchParams({
			card: ethers.getAddress(cardAddress),
			tokenId: tokenId.trim(),
			page: String(pageN),
			pageSize: String(pageSizeN),
		})
		const res = await fetch(`${beamioApi}/api/issuedNftClaimWallets?${qs.toString()}`)
		const json = (await res.json().catch(() => ({}))) as FetchIssuedNftClaimWalletsResult
		if (!res.ok || json.ok !== true) {
			return {
				ok: false,
				error: typeof json.error === 'string' ? json.error : `HTTP ${res.status}`,
			}
		}
		return {
			ok: true,
			cardAddress: json.cardAddress,
			tokenId: json.tokenId,
			page: json.page ?? pageN,
			pageSize: json.pageSize ?? pageSizeN,
			total: typeof json.total === 'number' ? json.total : 0,
			items: Array.isArray(json.items) ? json.items : [],
		}
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Network error'
		return { ok: false, error: message }
	}
}

async function resolveOpenClaimTokenIdByCouponId(cardAddress: string, couponId: string): Promise<string | null> {
	const wanted = couponId.trim()
	if (!wanted) return null
	const rows = await fetchCardActiveIssuedCouponSeries(cardAddress)
	for (const row of rows) {
		const id = readCouponIdFromMetadata(row.metadata ?? null)
		if (id && id === wanted) return String(row.tokenId)
	}
	const productionRows = await fetchCardActiveIssuedProductionSeries(cardAddress)
	for (const row of productionRows) {
		const id = readProductionIdFromMetadata(row.metadata ?? null)
		if (id && id === wanted) return String(row.tokenId)
	}
	return null
}

/** 用户离线签字 + 直连 API：无 redeemcode 的 coupon open-claim。 */
export const postCardCouponOpenClaimWithCurrentWallet = async (params: {
	cardAddress: string
	couponId: string
	privateKeyArmor: string
}): Promise<{ success: boolean; tx?: string; tokenId?: string; error?: string; status?: number }> => {
	const cardAddress = params.cardAddress?.trim() ?? ''
	const couponId = params.couponId?.trim() ?? ''
	const privateKeyArmor = params.privateKeyArmor?.trim() ?? ''
	if (!cardAddress || !couponId || !privateKeyArmor || !ethers.isAddress(cardAddress)) {
		return { success: false, error: 'Invalid cardAddress, couponId, or privateKey' }
	}
	try {
		const signer = new ethers.Wallet(privateKeyArmor)
		const userEOA = ethers.getAddress(signer.address)
		const cardNorm = ethers.getAddress(cardAddress)

		const tokenId = await resolveOpenClaimTokenIdByCouponId(cardNorm, couponId)
		if (!tokenId) {
			return { success: false, error: 'Coupon not found or inactive on this card.' }
		}

		const { provider } = await providerForBeamioUserCard(cardNorm)
		const cardRead = new ethers.Contract(cardNorm, ['function factoryGateway() view returns (address)'], provider)
		const verifyingContract = ethers.getAddress(await cardRead.factoryGateway())
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
			}
		)

		const res = await fetch(cardCouponOpenClaimEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				cardAddress: cardNorm,
				couponId,
				userEOA,
				tokenId,
				deadline,
				nonce,
				userSignature,
			}),
		})
		const data = (await res.json().catch(() => ({}))) as { success?: boolean; tx?: string; error?: string; tokenId?: string }
		if (!res.ok || data.success === false) {
			return { success: false, error: data.error ?? `HTTP ${res.status}`, status: res.status }
		}
		return { success: true, tx: data.tx, tokenId: data.tokenId ?? tokenId }
	} catch (e: any) {
		return { success: false, error: e?.shortMessage ?? e?.message ?? String(e) }
	}
}

/** 链上校验 redeem-admin 码是否有效（未过期、未使用）：hash = keccak256(toUtf8Bytes(redeemCode)) */
export const checkRedeemAdminCodeValid = async (
	cardAddress: string,
	redeemCode: string
): Promise<boolean> => {
	if (!cardAddress || !redeemCode?.trim() || !ethers.isAddress(cardAddress)) return false
	try {
		const hash = ethers.keccak256(ethers.toUtf8Bytes(redeemCode.trim()))
		const cardAbi = ['function getRedeemAdminStatus(bytes32 hash) view returns (bool active)']
		const card = new ethers.Contract(cardAddress, cardAbi, baseEndpoint)
		const active = await card.getRedeemAdminStatus(hash)
		return !!active
	} catch {
		return false
	}
}

/** 链上校验 EOA 是否为指定卡的 admin（避免重复兑换浪费 redeem code）。RPC 失败时抛出，不得将失败当作「非 admin」的信任信息。
 * 使用主合约原生 isAdmin，避免依赖 getAdminListWithMetadata 的 fallback/module 路由。 */
export const isCardAdmin = async (cardAddress: string, eoa: string): Promise<boolean> => {
	if (!cardAddress || !eoa || !ethers.isAddress(cardAddress) || !ethers.isAddress(eoa)) return false
	const cardAbi = ['function isAdmin(address) view returns (bool)']
	const { provider } = await providerForBeamioUserCard(cardAddress)
	const card = new ethers.Contract(cardAddress, cardAbi, provider)
	return Boolean(await card.isAdmin(ethers.getAddress(eoa)))
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

const FACTORY_CARDS_OF_OWNER_ABI = ['function cardsOfOwner(address owner) view returns (address[])'] as const

/** CoNET-first: new merchant cards deploy on 224422; legacy cards remain on Base. */
const MERCHANT_CARD_FACTORY_QUERIES: Array<{ factory: string; provider: ethers.Provider }> = [
	{ factory: CONET_CARD_FACTORY, provider: conetDepinProvider },
	{ factory: BASE_MAINNET_FACTORIES.CARD_FACTORY, provider: baseEndpoint },
]

async function readUserCardInfoFromChain(addr: string): Promise<UserCardInfo | null> {
	try {
		const { provider } = await providerForBeamioUserCard(addr)
		const card = new ethers.Contract(addr, cardAbiSlice, provider)
		const [currencyNum, priceE6Raw] = await Promise.all([
			card.currency(),
			card.pointsUnitPriceInCurrencyE6(),
		])
		const currency = getICurrency(BigInt(currencyNum))
		const priceE6 = Number(priceE6Raw)
		const ptsPer1Currency = priceE6 > 0 ? 1_000_000 / priceE6 : 0
		return {
			cardAddress: ethers.getAddress(addr),
			name: 'User Card',
			currency,
			priceE6: String(priceE6),
			ptsPer1Currency: String(ptsPer1Currency),
		}
	} catch {
		return null
	}
}

async function fetchCardsForOwner(ownerAddress: string): Promise<UserCardInfo[]> {
	if (!ownerAddress || !ethers.isAddress(ownerAddress)) return []
	const seen = new Set<string>()
	const results: UserCardInfo[] = []
	for (const { factory: factoryAddr, provider } of MERCHANT_CARD_FACTORY_QUERIES) {
		try {
			const factory = new ethers.Contract(factoryAddr, FACTORY_CARDS_OF_OWNER_ABI, provider)
			const cards: string[] = await factory.cardsOfOwner(ownerAddress)
			if (!cards?.length) continue
			for (const addr of cards) {
				const key = ethers.getAddress(addr).toLowerCase()
				if (seen.has(key)) continue
				seen.add(key)
				const info = await readUserCardInfoFromChain(addr)
				if (info) results.push(info)
			}
		} catch {
			/* try other factory */
		}
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
	const items = data?.items ?? []
	return items as UserCardInfo[]
}

export type GetCardsResult = { cards: UserCardInfo[]; trusted: boolean }

/**
 * Factory.cardsOfOwner 只按「创建时的 cardOwner」建索引。卡若以 EOA 为 owner，而 profile 里只有 AA、没有 keyID，
 * 则仅查 AA 会得到 []。对合约地址补充 `owner()`（Beamio AA →控制 EOA）后再查 factory。
 */
async function expandFactoryOwnerCandidatesForCardsOfOwner(addresses: string[]): Promise<string[]> {
	const out = new Set(addresses.map((a) => ethers.getAddress(a)))
	const ownerAbi = ['function owner() view returns (address)'] as const
	for (const addr of addresses) {
		const norm = ethers.getAddress(addr)
		for (const prov of [conetDepinProvider, baseRpcProviderDirect]) {
			try {
				const code = await prov.getCode(norm)
				if (!code || code === '0x' || code.length <= 2) continue
				const acct = new ethers.Contract(norm, ownerAbi, prov)
				const own = await acct.owner()
				if (own && ethers.isAddress(own) && ethers.getAddress(own) !== ethers.ZeroAddress) {
					out.add(ethers.getAddress(own))
				}
				break
			} catch {
				/* try other chain */
			}
		}
	}
	return [...out]
}

/** 同时查询 aaAccount 与 keyID 下的卡（去重合并）。用于 CardManager / Verra Merchant：仅用户发行的 BeamioUserCard（不含 CCSA / 基础设施卡）。
 * 当 keyID 缺失时，会从 privateKeyArmor 推导 EOA 地址作为 fallback。
 * - trusted=true：RPC 或 API 明确成功，可更新 profile.issuedCards。
 * - trusted=false：RPC 与 API 均失败，返回 profile.issuedCards 作为缓存，UI 不可信空 []。
 *
 * 重要：Factory.cardsOfOwner(cardOwner) 按创建时的 cardOwner 索引。CLI 创建时 CARD_OWNER 为 EOA，
 * 则必须用 profile.keyID（或 privateKeyArmor 推导的 EOA）查询；App 创建时 cardOwner 为 aaAccount ?? keyID，
 * 则需同时查询两者。若卡由 CLI 以某 EOA 创建，但 App 登录的是不同钱包，则不会显示。
 * 若 profile 仅有 AA、卡 owner 为 EOA：会通过 AA.owner() 补充 EOA 再查 factory（避免 Dashboard 误判无卡）。 */
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
	if (uniqueOwners.length === 0) {
		if (typeof console !== 'undefined' && console.warn) {
			console.warn('[getCardsOfOwnerWithDetailsForProfile] 无有效 owner（keyID/aaAccount 均空）')
		}
		return { cards: [], trusted: false }
	}

	let ownersForFactory: string[]
	try {
		ownersForFactory = await expandFactoryOwnerCandidatesForCardsOfOwner(uniqueOwners)
	} catch {
		ownersForFactory = uniqueOwners
	}
	if (typeof console !== 'undefined' && console.log) {
		console.log(
			'[getCardsOfOwnerWithDetailsForProfile] 查询 owners:',
			ownersForFactory,
			'(profile:',
			uniqueOwners,
			') | keyID:',
			eoa ?? '(空)',
			'| aaAccount:',
			aa ?? '(空)',
		)
	}

	const cached = profile?.issuedCards ?? []
	const seen = new Set<string>()
	const merged: UserCardInfo[] = []

	// 0. RPC 熔断期：仅使用 CoNET 节点，不向 API 请求
	// （withBaseRpc 内部会走 CoNET-only）

	// 1. 尝试 RPC（正常时 CoNET 优先 + 公共 RPC，限流时仅 CoNET）
	try {
		for (const owner of ownersForFactory) {
			const list = await fetchCardsForOwner(owner)
			for (const c of list) {
				const key = c.cardAddress.toLowerCase()
				if (seen.has(key)) continue
				seen.add(key)
				merged.push(c)
			}
		}
		if (merged.length === 0 && typeof console !== 'undefined' && console.warn) {
			console.warn(
				'[getCardsOfOwnerWithDetailsForProfile] 0 cards for owners:',
				ownersForFactory,
				'(EOA/keyID 须与创建卡时的 cardOwner 一致，或检查 profile 是否仅有 AA 而无 keyID)',
			)
		}
		if (merged.length === 0) {
			try {
				const apiItems = await fetchMyCardsFromApi(ownersForFactory)
				for (const c of apiItems) {
					const key = c.cardAddress.toLowerCase()
					if (seen.has(key)) continue
					seen.add(key)
					merged.push(c)
				}
			} catch (apiErr) {
				if (typeof console !== 'undefined' && console.warn) {
					console.warn(
						'[getCardsOfOwnerWithDetailsForProfile] RPC 空结果后 API 补查失败，保留 RPC trusted-empty。owners:',
						ownersForFactory,
						(apiErr as Error)?.message ?? apiErr,
					)
				}
			}
		}
		return { cards: filterExcludedUserCards(merged), trusted: true }
	} catch (e) {
		if (isRpcQuotaOrNetworkError(e)) reportRpcFailure()
		if (typeof console !== 'undefined' && console.warn) {
			console.warn('[getCardsOfOwnerWithDetailsForProfile] RPC 失败，尝试 API。owners:', ownersForFactory, (e as Error)?.message ?? e)
		}
		// 2. RPC 失败，尝试 API
		try {
			const apiItems = await fetchMyCardsFromApi(ownersForFactory)
			if (apiItems.length === 0 && typeof console !== 'undefined' && console.warn) {
				console.warn('[getCardsOfOwnerWithDetailsForProfile] API 返回 0 张卡。owners:', ownersForFactory)
			}
			return { cards: filterExcludedUserCards(apiItems), trusted: true }
		} catch (apiErr) {
			if (typeof console !== 'undefined' && console.warn) {
				console.warn('[getCardsOfOwnerWithDetailsForProfile] RPC+API 均失败，返回缓存。owners:', ownersForFactory, 'cached:', cached.length, (apiErr as Error)?.message ?? apiErr)
			}
			// 3. RPC 与 API 均失败，返回 profile 缓存的卡，不信任空 []
			return { cards: filterExcludedUserCards(cached), trusted: false }
		}
	}
}

/** ERC-1155 shareTokenMetadata，写入 0x{owner}.json */
export type ShareTokenMetadataBonusRule = {
	paymentAmount?: number
	bonusValue?: number
	/**
	 * When true, bonus scales with actual top-up: `bonusPaid = topupAmount * (bonusValue / paymentAmount)`.
	 * When false/omitted, `bonusPaid` is the fixed `bonusValue` when the rule applies (POS reads from metadata).
	 */
	bonusProportional?: boolean
}

export type ShareTokenMetadataPointSystem = {
	enabled: boolean
	/** E6 ratio: 1_000_000 means 1 reward point per 1 card-currency unit spent. */
	chargeRewardRatioE6?: string
	rewardTokenId?: number
}

export type ShareTokenMetadataCoupon = {
	id?: string
	name?: string
	/** Maximum number of coupons that can be issued for this coupon definition. */
	issueTotal?: number
	/** NFT kind label; coupon definitions use `"Coupon"` to distinguish from other issued series. */
	category?: string
	/**
	 * When true, members must use a redeem code to claim this coupon; when false/omitted, open claim (no secret code).
	 * @since merchant Programs UI — persisted in shareTokenMetadata.coupons[]
	 */
	requiresRedeemCode?: boolean
	/**
	 * Inclusive validity window as local calendar dates (YYYY-MM-DD). Both must be set for clients to enforce.
	 * @since merchant Programs coupon editor
	 */
	validFrom?: string
	validTo?: string
	icon?: string
	backgroundColor?: string
	description?: string
	issued?: boolean
	/** On-chain issued NFT `tokenId` after createIssuedNft (coupon series) */
	issuedTokenId?: string | number
}

export type ShareTokenMetadataServiceCategoryEntry = {
	id: string
	label: string
}

export type ShareTokenMetadataProduction = {
	id?: string
	name?: string
	subtitle?: string
	/** Second-level catalog chip id (legacy `serviceCategory`). */
	itemCategory?: string
	/** @deprecated Read compat only — prefer `itemCategory`. */
	serviceCategory?: string
	singleSessionPrice?: number
	packageDealEnabled?: boolean
	packageSessions?: number
	packageBonusSessions?: number
	packageTotalPrice?: number
	issueTotal?: number
	/** Global catalog category: Product | Service | Menu | ShareLink | SalesManagement. */
	category?: string
	icon?: string
	backgroundColor?: string
	productionImage?: string
	productionImageStartSec?: number
	productionImageMime?: string
	description?: string
	issued?: boolean
	issuedTokenId?: string | number
}

export type ShareTokenMetadata = {
	name: string
	/** Consumer-facing card title in apps (short); optional; falls back to `name` when absent */
	displayName?: string
	description?: string
	image?: string
	/**
	 * Optional wide / hero merchant imagery (IPFS URL), distinct from square `image` logo.
	 * Other clients read from `shareTokenMetadata.merchantImage`.
	 */
	merchantImage?: string
	/** Program category ids (e.g. travel, gaming); optional, for merchant UI / discovery */
	categories?: string[]
	/** Points / fungible display symbol (e.g. "$VERRA"); persisted for merchant Daily Dashboard */
	Symbol?: string
	/** Card-level accent / share artwork background (CSS hex); optional */
	backgroundColor?: string
	/** Whole currency units (same scale as Card Issuance min/max top-up); optional */
	minimumTopup?: number
	/** Whole currency units; optional */
	maximumTopup?: number
	/** Single recharge bonus rule previewed in configurator; optional */
	bonusRule?: ShareTokenMetadataBonusRule
	/** Multiple recharge bonus rules previewed in configurator; optional */
	bonusRules?: ShareTokenMetadataBonusRule[]
	/** Client-facing switch for displaying charge reward points (ERC-1155 token #2). */
	pointSystem?: ShareTokenMetadataPointSystem
	/** Program coupons metadata (icon can be an IPFS URL). */
	coupons?: ShareTokenMetadataCoupon[]
	/** Program service catalog / productions (global category Product | Service | Menu | ShareLink | SalesManagement). */
	productions?: ShareTokenMetadataProduction[]
	/** Item category chip definitions for catalog UI (legacy `serviceCategory`). */
	itemCategory?: ShareTokenMetadataServiceCategoryEntry[]
	/** @deprecated Read compat only — prefer `itemCategory`. */
	serviceCategory?: ShareTokenMetadataServiceCategoryEntry[]
	/** Hero program logo scale on card surfaces (0–3). Optional; clients default to 0. */
	logoDisplayTier?: number
}

/** Tier 类型 metadata，存于 0x{owner}.json，回送 {NFT}.json 时包含；image 为 IPFS URL，backgroundColor 为 CSS 颜色（如 #hex）。升级模式由卡级 upgradeType（链上）决定。 */
export type TierMetadata = {
	index: number
	minUsdc6: string
	attr: number
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

export type UpdateBeamioCardShareMetadataParams = {
	cardAddress: string
	shareTokenMetadata: ShareTokenMetadata
	tiers?: TierMetadata[]
	upgradeType?: 0 | 1 | 2
	transferWhitelistEnabled?: boolean
}

export type UpdateBeamioCardTiersParams = UpdateBeamioCardShareMetadataParams & {
	data: string
	deadline: number
	nonce: string
	ownerSignature: string
}

/**
 * 仅更新已登记卡的 `shareTokenMetadata.merchantImage`（https URL）或空字符串清除；服务端合并 DB 后写 metadata 文件。
 */
export const updateCardMerchantImage = async (params: {
	cardAddress: string
	merchantImage: string
}): Promise<{ success: boolean; cardAddress?: string; error?: string }> => {
	try {
		const body = JSON.stringify({
			cardAddress: params.cardAddress,
			merchantImage: params.merchantImage ?? '',
		})
		const signal = createFetchTimeoutSignal(180_000)
		const response = await fetch(updateCardMerchantImageEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body,
			...(signal ? { signal } : {}),
		})
		const data = await response.json()
		if (response.ok && data.success) {
			invalidateBeamioCardMetadataCache(params.cardAddress)
			return { success: true, cardAddress: data.cardAddress as string | undefined }
		}
		return { success: false, error: data.error ?? 'Update merchant image failed' }
	} catch (e: unknown) {
		if (e instanceof DOMException && e.name === 'AbortError') {
			return { success: false, error: 'Update merchant image timed out. Check your network and try again.' }
		}
		const msg = e instanceof Error ? e.message : String(e)
		return { success: false, error: msg }
	}
}

/**
 * 仅更新已登记卡的 `shareTokenMetadata.image`（https URL）或空字符串清除；服务端合并 DB 后写 metadata 文件。
 */
export const updateCardProgramImage = async (params: {
	cardAddress: string
	image: string
}): Promise<{ success: boolean; cardAddress?: string; error?: string }> => {
	try {
		const body = JSON.stringify({
			cardAddress: params.cardAddress,
			image: params.image ?? '',
		})
		const signal = createFetchTimeoutSignal(180_000)
		const response = await fetch(updateCardProgramImageEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body,
			...(signal ? { signal } : {}),
		})
		const data = await response.json()
		if (response.ok && data.success) {
			invalidateBeamioCardMetadataCache(params.cardAddress)
			return { success: true, cardAddress: data.cardAddress as string | undefined }
		}
		return { success: false, error: data.error ?? 'Update program image failed' }
	} catch (e: unknown) {
		if (e instanceof DOMException && e.name === 'AbortError') {
			return { success: false, error: 'Update program image timed out. Check your network and try again.' }
		}
		const msg = e instanceof Error ? e.message : String(e)
		return { success: false, error: msg }
	}
}

/**
 * Persist program square icon (`shareTokenMetadata.image`).
 * Tries `/api/updateCardProgramImage` first; falls back to full share metadata patch on older API builds.
 */
export const persistCardProgramIconImage = async (params: {
	cardAddress: string
	image: string
}): Promise<{ success: boolean; cardAddress?: string; error?: string }> => {
	const primary = await updateCardProgramImage(params)
	if (primary.success) return primary

	try {
		const res = await fetch(
			`${beamioApi}/api/cardMetadata?cardAddress=${encodeURIComponent(params.cardAddress)}`
		)
		if (!res.ok) return primary
		const data = (await res.json()) as { metadata?: Record<string, unknown> | null }
		const metaJson = data?.metadata
		if (!metaJson || typeof metaJson !== 'object') return primary
		const existingShare =
			metaJson.shareTokenMetadata != null &&
			typeof metaJson.shareTokenMetadata === 'object' &&
			!Array.isArray(metaJson.shareTokenMetadata)
				? { ...(metaJson.shareTokenMetadata as Record<string, unknown>) }
				: {}
		const share = { ...existingShare }
		const imageTrim = (params.image ?? '').trim()
		if (imageTrim) share.image = imageTrim
		else delete share.image
		const upgradeTypeRaw = Number(metaJson.upgradeType)
		const upgradeType =
			upgradeTypeRaw === 0 || upgradeTypeRaw === 1 || upgradeTypeRaw === 2
				? (upgradeTypeRaw as 0 | 1 | 2)
				: undefined
		const fallback = await updateBeamioCardShareMetadata({
			cardAddress: params.cardAddress,
			shareTokenMetadata: share as ShareTokenMetadata,
			...(Array.isArray(metaJson.tiers) && metaJson.tiers.length > 0 && {
				tiers: metaJson.tiers as UpdateBeamioCardShareMetadataParams['tiers'],
			}),
			...(upgradeType !== undefined && { upgradeType }),
			...(typeof metaJson.transferWhitelistEnabled === 'boolean' && {
				transferWhitelistEnabled: metaJson.transferWhitelistEnabled,
			}),
		})
		if (fallback.success) return fallback
		return {
			success: false,
			error: fallback.error ?? primary.error ?? 'Update program image failed',
		}
	} catch {
		return primary
	}
}

/**
 * 已发卡仅更新链下 metadata（`/api/updateCardShareMetadata`）：写入 0x{card}0.json 并同步 beamio_cards.metadata_json。
 * Recharge bonus 的增删改需在商户端确认后点此接口（或等价 Publish），POS/应用从 metadata 读取规则。
 */
export const updateBeamioCardShareMetadata = async (
	params: UpdateBeamioCardShareMetadataParams
): Promise<{ success: boolean; cardAddress?: string; error?: string }> => {
	try {
		const body = JSON.stringify({
			cardAddress: params.cardAddress,
			shareTokenMetadata: params.shareTokenMetadata,
			...(params.tiers && params.tiers.length > 0 && { tiers: params.tiers }),
			...(params.upgradeType === 0 || params.upgradeType === 1 || params.upgradeType === 2
				? { upgradeType: params.upgradeType }
				: {}),
			...(typeof params.transferWhitelistEnabled === 'boolean' && {
				transferWhitelistEnabled: params.transferWhitelistEnabled,
			}),
		})
		const signal = createFetchTimeoutSignal(180_000)
		const response = await fetch(updateCardShareMetadataEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body,
			...(signal ? { signal } : {}),
		})
		const data = await response.json()
		if (response.ok && data.success) {
			invalidateBeamioCardMetadataCache(params.cardAddress)
			return { success: true, cardAddress: data.cardAddress as string | undefined }
		}
		return { success: false, error: data.error ?? 'Update metadata failed' }
	} catch (e: unknown) {
		if (e instanceof DOMException && e.name === 'AbortError') {
			return { success: false, error: 'Update metadata timed out. Check your network and try again.' }
		}
		const msg = e instanceof Error ? e.message : String(e)
		return { success: false, error: msg }
	}
}

/** Warm Coupon Preview OG + optional OpenSea refresh so BaseScan picks up new `image` after biz edits. */
export const postRequestExplorerNftMetadataRefresh = async (params: {
	cardAddress: string
	tokenId: string
}): Promise<{ success: boolean; channels?: string[]; errors?: string[]; error?: string }> => {
	try {
		const res = await fetch(requestExplorerNftMetadataRefreshEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				cardAddress: ethers.getAddress(params.cardAddress),
				tokenId: String(params.tokenId).trim(),
			}),
		})
		const data = (await res.json().catch(() => ({}))) as {
			success?: boolean
			channels?: string[]
			errors?: string[]
			error?: string
		}
		if (!res.ok) {
			return { success: false, error: data.error ?? `requestExplorerNftMetadataRefresh HTTP ${res.status}` }
		}
		return {
			success: data.success === true,
			channels: data.channels,
			errors: data.errors,
		}
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e)
		return { success: false, error: msg }
	}
}

export const updateIssuedCouponMetadata = async (params: {
	cardAddress: string
	couponId: string
	issuedTokenId: string
	icon: string
	backgroundColor: string
	description: string
	/** Wide coupon hero background (https); empty string clears. */
	couponImage?: string
}): Promise<{ success: boolean; cardAddress?: string; error?: string }> => {
	try {
		const body = JSON.stringify({
			cardAddress: params.cardAddress,
			couponId: params.couponId,
			issuedTokenId: params.issuedTokenId,
			icon: params.icon,
			backgroundColor: params.backgroundColor,
			description: params.description,
			couponImage: params.couponImage ?? '',
		})
		const signal = createFetchTimeoutSignal(180_000)
		const response = await fetch(updateIssuedCouponMetadataEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body,
			...(signal ? { signal } : {}),
		})
		const data = await response.json()
		if (response.ok && data.success) {
			return { success: true, cardAddress: data.cardAddress as string | undefined }
		}
		return { success: false, error: data.error ?? 'Update issued coupon metadata failed' }
	} catch (e: unknown) {
		if (e instanceof DOMException && e.name === 'AbortError') {
			return { success: false, error: 'Update issued coupon metadata timed out. Check your network and try again.' }
		}
		const msg = e instanceof Error ? e.message : String(e)
		return { success: false, error: msg }
	}
}

/**
 * 已发卡更新 tiers：链上执行 `BeamioUserCard.setTiers(...)`，确认后同步 ERC-1155 card metadata / DB。
 */
export const updateBeamioCardTiers = async (
	params: UpdateBeamioCardTiersParams
): Promise<{ success: boolean; cardAddress?: string; hash?: string; error?: string }> => {
	try {
		const signal = createFetchTimeoutSignal(180_000)
		const response = await fetch(cardUpdateTiersEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				cardAddress: params.cardAddress,
				data: params.data,
				deadline: params.deadline,
				nonce: params.nonce,
				ownerSignature: params.ownerSignature,
				shareTokenMetadata: params.shareTokenMetadata,
				...(params.tiers && params.tiers.length > 0 && { tiers: params.tiers }),
				...(params.upgradeType === 0 || params.upgradeType === 1 || params.upgradeType === 2
					? { upgradeType: params.upgradeType }
					: {}),
				...(typeof params.transferWhitelistEnabled === 'boolean' && {
					transferWhitelistEnabled: params.transferWhitelistEnabled,
				}),
			}),
			...(signal ? { signal } : {}),
		})
		const data = await response.json()
		if (response.ok && data.success) {
			const addr = (data.cardAddress as string | undefined) ?? ethers.getAddress(params.cardAddress)
			return {
				success: true,
				cardAddress: addr,
				hash: (data.hash as string | undefined) ?? (typeof (data as { tx?: string }).tx === 'string' ? (data as { tx: string }).tx : undefined),
			}
		}
		return { success: false, error: data.error ?? 'Update tiers failed' }
	} catch (e: unknown) {
		if (e instanceof DOMException && e.name === 'AbortError') {
			return { success: false, error: 'Update tiers timed out. Check your network and try again.' }
		}
		const msg = e instanceof Error ? e.message : String(e)
		return { success: false, error: msg }
	}
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

/** BeamioUserCard 记录在链上的 `factoryGateway()`，EIP-712 `verifyingContract` 须与其一致。 */
export const getCardFactoryGatewayForEip712 = async (cardAddress: string): Promise<string> => {
	const { provider } = await providerForBeamioUserCard(cardAddress)
	const c = new ethers.Contract(ethers.getAddress(cardAddress), ['function factoryGateway() view returns (address)'], provider)
	return ethers.getAddress(await c.factoryGateway())
}

/** 获取卡的 owner 地址。executeForOwner 要求签名者必须等于 card.owner()，AA 为 owner 时需用 EOA 签会失败。 */
export const getCardOwner = async (cardAddress: string): Promise<string> => {
	const { provider } = await providerForBeamioUserCard(cardAddress)
	const card = new ethers.Contract(cardAddress, ['function owner() view returns (address)'], provider)
	return ethers.getAddress(await card.owner())
}

/** EIP-712 签名：Admin 授权 executeForAdmin(cardAddr, data, deadline, nonce)。用于 cardAddAdminByAdmin 等。
 * 签名者必须为 card admin。与 MemberCard verifyExecuteForAdminSignerIsAdmin 的 domain/types 一致。 */
export const signExecuteForAdmin = async (
	adminPrivateKey: string,
	cardAddress: string,
	data: string,
	deadline: number,
	nonce: string,
	verifyingContract?: string,
): Promise<string> => {
	const { provider } = await providerForBeamioUserCard(cardAddress)
	const wallet = new ethers.Wallet(adminPrivateKey, provider)
	const factoryAddress = verifyingContract
		? ethers.getAddress(verifyingContract)
		: await withPromiseTimeout(getCardFactoryGatewayForEip712(cardAddress), 25_000, 'factoryGateway()')
	const chainId = await eip712ChainIdForBeamioUserCard(cardAddress)
	const domain = {
		name: 'BeamioUserCardFactory',
		version: '1',
		chainId,
		verifyingContract: factoryAddress,
	}
	const types = {
		ExecuteForAdmin: [
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

/** EIP-712：上层 admin 清零下层 admin 的 mint 计数（与 MemberCard cardClearAdminMintCounterPreCheck / Factory 一致）。 */
export const signClearAdminMintCounter = async (
	adminPrivateKey: string,
	cardAddress: string,
	subordinate: string,
	deadline: number,
	nonceHex: string
): Promise<string> => {
	const { provider } = await providerForBeamioUserCard(cardAddress)
	const wallet = new ethers.Wallet(adminPrivateKey, provider)
	const factoryAddress = await getCardFactoryGatewayForEip712(cardAddress)
	const chainId = await eip712ChainIdForBeamioUserCard(cardAddress)
	const domain = {
		name: 'BeamioUserCardFactory',
		version: '1',
		chainId,
		verifyingContract: factoryAddress,
	}
	const types = {
		ClearAdminMintCounter: [
			{ name: 'cardAddress', type: 'address' },
			{ name: 'subordinate', type: 'address' },
			{ name: 'deadline', type: 'uint256' },
			{ name: 'nonce', type: 'bytes32' },
		],
	}
	const n =
		nonceHex.length === 66 && nonceHex.startsWith('0x')
			? (nonceHex as `0x${string}`)
			: (ethers.keccak256(ethers.toUtf8Bytes(nonceHex)) as `0x${string}`)
	const value = {
		cardAddress: ethers.getAddress(cardAddress),
		subordinate: ethers.getAddress(subordinate),
		deadline,
		nonce: n,
	}
	return wallet.signTypedData(domain, types, value)
}

/** EIP-712：Terminal Settlement clear — 仅在 indexer 记 `TX_Terminal_RESET`（与 ClearAdminMintCounter 类型不同）。 */
export const signTerminalSettlementClear = async (
	adminPrivateKey: string,
	cardAddress: string,
	subordinate: string,
	deadline: number,
	nonceHex: string
): Promise<string> => {
	const { provider } = await providerForBeamioUserCard(cardAddress)
	const wallet = new ethers.Wallet(adminPrivateKey, provider)
	const factoryAddress = await getCardFactoryGatewayForEip712(cardAddress)
	const chainId = await eip712ChainIdForBeamioUserCard(cardAddress)
	const domain = {
		name: 'BeamioUserCardFactory',
		version: '1',
		chainId,
		verifyingContract: factoryAddress,
	}
	const types = {
		TerminalSettlementClear: [
			{ name: 'cardAddress', type: 'address' },
			{ name: 'subordinate', type: 'address' },
			{ name: 'deadline', type: 'uint256' },
			{ name: 'nonce', type: 'bytes32' },
		],
	}
	const n =
		nonceHex.length === 66 && nonceHex.startsWith('0x')
			? (nonceHex as `0x${string}`)
			: (ethers.keccak256(ethers.toUtf8Bytes(nonceHex)) as `0x${string}`)
	const value = {
		cardAddress: ethers.getAddress(cardAddress),
		subordinate: ethers.getAddress(subordinate),
		deadline,
		nonce: n,
	}
	return wallet.signTypedData(domain, types, value)
}

/** Parent admin 签 ClearAdminMintCounter 后提交 Cluster → Master（Base Factory + CoNET Indexer）。 */
export const postCardClearAdminMintCounter = async (payload: {
	cardAddress: string
	subordinate: string
	deadline: number
	nonce: string
	adminSignature: string
}): Promise<{ success: boolean; tx?: string; error?: string }> => {
	try {
		const res = await fetch(cardClearAdminMintCounterEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				cardAddress: ethers.getAddress(payload.cardAddress),
				subordinate: ethers.getAddress(payload.subordinate),
				deadline: payload.deadline,
				nonce: payload.nonce,
				adminSignature: payload.adminSignature,
			}),
		})
		const data = await res.json()
		if (!res.ok) return { success: false, error: data.error ?? 'cardClearAdminMintCounter failed' }
		return { success: true, tx: data.tx }
	} catch (e: any) {
		return { success: false, error: e?.message ?? String(e) }
	}
}

/** Terminal settlement clear：仅 indexer TX_Terminal_RESET；Cluster/Master `/api/cardTerminalSettlementClear`。 */
export const postCardTerminalSettlementClear = async (payload: {
	cardAddress: string
	subordinate: string
	deadline: number
	nonce: string
	adminSignature: string
}): Promise<{ success: boolean; syncTx?: string; error?: string }> => {
	try {
		const res = await fetch(cardTerminalSettlementClearEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				cardAddress: ethers.getAddress(payload.cardAddress),
				subordinate: ethers.getAddress(payload.subordinate),
				deadline: payload.deadline,
				nonce: payload.nonce,
				adminSignature: payload.adminSignature,
			}),
		})
		const data = await res.json()
		if (!res.ok) return { success: false, error: data.error ?? 'cardTerminalSettlementClear failed' }
		return { success: true, syncTx: typeof data.syncTx === 'string' ? data.syncTx : undefined }
	} catch (e: any) {
		return { success: false, error: e?.message ?? String(e) }
	}
}

/** EIP-712 签名：Owner 授权 executeForOwner(cardAddr, data, deadline, nonce)。通用接口，支持 createRedeem、cancelRedeem 等。
 * 省略 `verifyingContract` 时使用卡 `factoryGateway()`（勿写死全局 CARD_FACTORY）。
 * 注意：签名者必须等于 card.owner()；AA 为 owner 时用 EOA 签会失败。 */
export const signExecuteForOwner = async (
	ownerPrivateKey: string,
	cardAddress: string,
	data: string,
	deadline: number,
	nonce: string,
	verifyingContract?: string,
): Promise<string> => {
	const { provider } = await providerForBeamioUserCard(cardAddress)
	const wallet = new ethers.Wallet(ownerPrivateKey, provider)
	const vc = verifyingContract?.trim()
		? ethers.getAddress(verifyingContract.trim())
		: await withPromiseTimeout(getCardFactoryGatewayForEip712(cardAddress), 25_000, 'factoryGateway()')
	const chainId = await eip712ChainIdForBeamioUserCard(cardAddress)
	const domain = {
		name: 'BeamioUserCardFactory',
		version: '1',
		chainId,
		verifyingContract: vc,
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

/** 构建 createRedeemBatch calldata；支持任意 tokenIds/amounts（如 issued NFT #）。codes 链上登记为 keccak256(utf8(code))，与 consumeRedeem 一致。 */
export const encodeCreateRedeemBatchBundle = (
	codes: string[],
	points6Top: bigint,
	attr: number,
	validAfter: number,
	validBefore: number,
	tokenIds: (string | number | bigint)[],
	amounts: (string | number | bigint)[],
): string => {
	const hashes = codes.map((c) => ethers.keccak256(ethers.toUtf8Bytes(c)))
	const tids = tokenIds.map((t) => BigInt(t))
	const amts = amounts.map((a) => BigInt(a))
	const pts6ForRedeem = tids.some((t) => t === 0n) ? 0n : BigInt(points6Top)
	return createRedeemBatchInterface.encodeFunctionData('createRedeemBatch', [
		hashes,
		pts6ForRedeem,
		BigInt(attr),
		validAfter,
		validBefore,
		tids,
		amts,
	])
}

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
	/** 缺省 [0] + [points6]；issued NFT 场景传实际 tokenId 与 amount */
	tokenIds?: string[]
	amounts?: string[]
	attr?: number
}): Promise<{ success: boolean; error?: string; codes?: string[] }> => {
	try {
		const tids = payload.tokenIds?.length ? payload.tokenIds.map(String) : ['0']
		const amts =
			payload.amounts?.length === tids.length
				? payload.amounts.map(String)
				: [String(payload.points6)]
		const body = {
			cardAddress: payload.cardAddress,
			codes: payload.codes,
			points6: String(payload.points6),
			attr: payload.attr ?? 0,
			validAfter: payload.validAfter,
			validBefore: payload.validBefore,
			tokenIds: tids,
			amounts: amts,
			deadline: payload.deadline,
			nonce: payload.nonce,
			ownerSignature: payload.ownerSignature,
		}
		const signal = createFetchTimeoutSignal(180_000)
        const res = await fetch(cardCreateRedeemEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
			...(signal ? { signal } : {}),
        })
        const data = await res.json()
        if (!res.ok) return { success: false, error: data.error ?? 'cardCreateRedeem failed' }
        return { success: true, codes: payload.codes }
    } catch (e: any) {
		if (e?.name === 'AbortError') {
			return { success: false, error: 'Request timed out. Check your network and try again.' }
		}
        return { success: false, error: e?.message ?? String(e) }
    }
}

const cancelRedeemInterface = new ethers.Interface([
    'function cancelRedeem(string code)',
])

/** 构建 cancelRedeem 的 calldata（供 executeForOwner 使用） */
export const encodeCancelRedeem = (code: string): string =>
    cancelRedeemInterface.encodeFunctionData('cancelRedeem', [code])

const setTiersInterface = new ethers.Interface([
	'function setTiers(tuple(uint256 minUsdc6,uint256 attr,uint256 tierExpirySeconds)[] newTiers)',
])

/** 构建 setTiers 的 calldata（供 executeForOwner 使用），会整体替换 BeamioUserCard 链上 tiers。 */
export const encodeSetTiers = (
	tiers: Array<{ minUsdc6: string | bigint; attr: number | bigint; tierExpirySeconds?: number | bigint }>
): string =>
	setTiersInterface.encodeFunctionData('setTiers', [
		tiers.map((t) => ({
			minUsdc6: BigInt(t.minUsdc6),
			attr: BigInt(t.attr),
			tierExpirySeconds: BigInt(t.tierExpirySeconds ?? 0),
		})),
	])

const setChargeRewardRatioInterface = new ethers.Interface([
	'function setChargeRewardRatio(uint256 ratioE6)',
])

/** Build calldata for owner-gateway updates to token #2 charge reward ratio. */
export const encodeSetChargeRewardRatio = (ratioE6: string | number | bigint): string =>
	setChargeRewardRatioInterface.encodeFunctionData('setChargeRewardRatio', [BigInt(ratioE6)])

const addAdminInterface = new ethers.Interface([
    'function addAdmin(address newAdmin, uint256 newThreshold)',
])

const adminManagerInterface = new ethers.Interface([
    'function adminManager(address to, bool admin, uint256 newThreshold, string metadata)',
    'function adminManager(address to, bool admin, uint256 newThreshold, string metadata, uint256 mintLimit)',
])

/** 构建 addAdmin 的 calldata（供 executeForOwner 使用）。newAdmin 必须为 EOA，newThreshold 为所需签名数（通常 1） */
export const encodeAddAdmin = (newAdmin: string, newThreshold: number | bigint): string =>
    addAdminInterface.encodeFunctionData('addAdmin', [newAdmin, BigInt(newThreshold)])

/** 构建 adminManager 添加 admin（带 metadata 和 topup limit）。mintLimitPoints6 为 points6 精度（如 1000 CAD = 1000e6） */
export const encodeAddAdminWithMintLimit = (
    newAdmin: string,
    newThreshold: number | bigint,
    metadata: string,
    mintLimitPoints6: bigint
): string =>
    adminManagerInterface.encodeFunctionData('adminManager(address,bool,uint256,string,uint256)', [newAdmin, true, BigInt(newThreshold), metadata, mintLimitPoints6])

/**
 * `adminManager(to, true, threshold, metadata)` — 4 参 calldata。
 * - `POST /api/cardAddAdmin`（executeForOwner）：原样执行 adminManager。
 * - `POST /api/cardAddAdminByAdmin`（executeForAdmin）：工厂合约把其重写为 `adminManagerByAdmin(..., signer)`。
 */
export const encodeAdminManagerAdd = (toEoa: string, newThreshold: number | bigint, metadata: string): string =>
	adminManagerInterface.encodeFunctionData('adminManager(address,bool,uint256,string)', [
		ethers.getAddress(toEoa),
		true,
		BigInt(newThreshold),
		metadata,
	])

/** adminManager(to, false, newThreshold, metadata) — 移除 admin；newThreshold 须 ≤ 移除后 adminList.length 且 ≥1（常见为 1）。 */
export const encodeRemoveAdmin = (
	adminToRemove: string,
	newThreshold: number | bigint,
	metadata: string = '{}',
): string =>
	adminManagerInterface.encodeFunctionData('adminManager(address,bool,uint256,string)', [
		ethers.getAddress(adminToRemove),
		false,
		BigInt(newThreshold),
		metadata,
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

/**
 * Abort after `ms` for fetch bodies. Prefer `AbortSignal.timeout` when present; otherwise
 * `AbortController` so Safari / older Chromium still get an upper bound (no infinite “Saving…”).
 */
function createFetchTimeoutSignal(ms: number): AbortSignal | undefined {
	try {
		if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
			return AbortSignal.timeout(ms)
		}
		if (typeof AbortController !== 'undefined') {
			const ctl = new AbortController()
			setTimeout(() => {
				try {
					ctl.abort()
				} catch {
					/* noop */
				}
			}, ms)
			return ctl.signal
		}
	} catch {
		/* noop */
	}
	return undefined
}

/**
 * Race against wall-clock timeout so a never-settling RPC cannot block the caller indefinitely.
 * (e.g. waitForNewIssuedNftTokenId loop otherwise never advances if issuedNftIndex() hangs)
 */
export async function withPromiseTimeout<T>(p: Promise<T>, ms: number, label = 'request'): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined
	try {
		return await Promise.race([
			p,
			new Promise<T>((_, reject) => {
				timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
			}),
		])
	} finally {
		if (timer !== undefined) clearTimeout(timer)
	}
}

/** 提交 createIssuedNft 到 API cardCreateIssuedNft。成功后响应体含 Master 从 Base receipt 解析的 `issuedNftTokenId`（客户端勿再轮询 issuedNftIndex）。 */
export const postCardCreateIssuedNft = async (payload: {
	cardAddress: string
	data: string
	deadline: number
	nonce: string
	ownerSignature: string
	description?: string
	image?: string
	background_color?: string
	metadata_extra_properties?: string | Record<string, unknown>
}): Promise<{ success: boolean; hash?: string; issuedNftTokenId?: string; error?: string }> => {
	try {
		const body: Record<string, unknown> = {
			cardAddress: payload.cardAddress,
			data: payload.data,
			deadline: payload.deadline,
			nonce: payload.nonce,
			ownerSignature: payload.ownerSignature,
		}
		if (payload.description != null && String(payload.description).trim()) body.description = String(payload.description).trim()
		if (payload.image != null && String(payload.image).trim()) body.image = String(payload.image).trim()
		if (payload.background_color != null && String(payload.background_color).trim()) {
			body.background_color = String(payload.background_color).trim()
		}
		if (payload.metadata_extra_properties != null) {
			body.metadata_extra_properties =
				typeof payload.metadata_extra_properties === 'string'
					? payload.metadata_extra_properties
					: JSON.stringify(payload.metadata_extra_properties)
		}
		const signal = createFetchTimeoutSignal(180_000)
		const res = await fetch(cardCreateIssuedNftEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			...(signal ? { signal } : {}),
		})
        const data = await res.json()
        if (!res.ok) return { success: false, error: data.error ?? 'cardCreateIssuedNft failed' }
		const tid =
			data?.issuedNftTokenId != null && String(data.issuedNftTokenId).trim() !== ''
				? String(data.issuedNftTokenId).trim()
				: undefined
		return {
			success: true,
			hash: data.hash,
			...(tid != null && tid !== '' ? { issuedNftTokenId: tid } : {}),
		}
    } catch (e: any) {
		if (e?.name === 'AbortError') {
			return { success: false, error: 'Request timed out. Check your network and try again.' }
		}
        return { success: false, error: e?.message ?? String(e) }
    }
}

const registerSeriesEndpoint = `${beamioApi}/api/registerSeries`

/** 单次读 `issuedNftIndex()` 的 UI 超时（Create Coupon / 确认新系列）。慢 RPC 下过短会误判失败。 */
export const ISSUED_NFT_INDEX_RPC_TIMEOUT_MS = 45_000

/** 链上 `issuedNftIndex()` — 下一次将分配的 tokenId 等于返回值（赋值后递增）。
 * 经 `withBaseRpc`：配额/网关类错误会自动换节点再试（比单一 baseEndpoint Proxy 静默挂死更可控）。 */
export const readIssuedNftIndexCounter = async (cardAddress: string): Promise<bigint> => {
	const addr = ethers.getAddress(cardAddress)
	return withBaseRpc(async (provider) => {
		const c = new ethers.Contract(addr, ['function issuedNftIndex() view returns (uint256)'], provider)
		return BigInt(await c.issuedNftIndex())
	})
}

/** createIssuedNft API 成功后轮询直到计数递增；返回新系列的 tokenId（= 新 index - 1）。 */
export const waitForNewIssuedNftTokenId = async (cardAddress: string, indexBefore: bigint): Promise<bigint | null> => {
	const addr = ethers.getAddress(cardAddress)
	const maxWaitMs = 120_000
	const perReadMs = 35_000
	const started = Date.now()
	while (Date.now() - started < maxWaitMs) {
		try {
			const idx = await withPromiseTimeout(readIssuedNftIndexCounter(addr), perReadMs, 'issuedNftIndex')
			if (idx > indexBefore) return idx - 1n
		} catch {
			/* RPC timeout or transient error — keep polling until maxWaitMs */
		}
		await new Promise((r) => setTimeout(r, 2000))
	}
	return null
}

/** 登记 issued NFT 系列到 DB（与链上 `issuedNftSharedMetadataHash` 常为 0 对齐） */
export const postRegisterIssuedNftSeries = async (params: {
	cardAddress: string
	tokenId: string | number | bigint
	metadata?: Record<string, unknown>
}): Promise<{ success: boolean; error?: string }> => {
	try {
		const res = await fetch(registerSeriesEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				cardAddress: ethers.getAddress(params.cardAddress),
				tokenId: String(params.tokenId),
				sharedMetadataHash: ethers.ZeroHash,
				metadata: params.metadata ?? { kind: 'issued_nft_series' },
			}),
		})
		const data = (await res.json().catch(() => ({}))) as { error?: string }
		if (!res.ok) return { success: false, error: data.error ?? `registerSeries HTTP ${res.status}` }
		return { success: true }
	} catch (e: any) {
		return { success: false, error: e?.message ?? String(e) }
	}
}

/** 提交 addAdmin 到 API cardAddAdmin。若传 adminEOA，Cluster 会先 ensureAAForEOA 再执行。 */
export const postCardAddAdmin = async (payload: {
    cardAddress: string
    data: string
    deadline: number
    nonce: string
    ownerSignature: string
    adminEOA?: string
}): Promise<{ success: boolean; hash?: string; error?: string }> => {
    try {
        const body: Record<string, unknown> = {
            cardAddress: payload.cardAddress,
            data: payload.data,
            deadline: payload.deadline,
            nonce: payload.nonce,
            ownerSignature: payload.ownerSignature,
        }
        if (payload.adminEOA && ethers.isAddress(payload.adminEOA)) {
            body.adminEOA = ethers.getAddress(payload.adminEOA)
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

/** 提交 addAdmin 到 API cardAddAdminByAdmin。若传 adminEOA，Cluster 会先 ensureAAForEOA 再执行。 */
export const postCardAddAdminByAdmin = async (payload: {
	cardAddress: string
	data: string
	deadline: number
	nonce: string
	adminSignature: string
	adminEOA?: string
}): Promise<{ success: boolean; hash?: string; error?: string }> => {
	try {
		const body: Record<string, unknown> = {
			cardAddress: payload.cardAddress,
			data: payload.data,
			deadline: payload.deadline,
			nonce: payload.nonce,
			adminSignature: payload.adminSignature,
		}
		if (payload.adminEOA && ethers.isAddress(payload.adminEOA)) {
			body.adminEOA = ethers.getAddress(payload.adminEOA)
		}
		const res = await fetch(cardAddAdminByAdminEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		})
		const data = await res.json()
		if (!res.ok) return { success: false, error: data.error ?? 'cardAddAdminByAdmin failed' }
		return { success: true, hash: data.txHash ?? data.hash }
	} catch (e: any) {
		return { success: false, error: e?.message ?? String(e) }
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
	/** When set, batch mints issued NFT via redeem bundle (not plain points) */
	kind?: 'points' | 'issued_nft_coupon' | 'issued_nft_production'
	issuedNftTokenId?: string
	couponId?: string
	productionId?: string
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

/** 单次查询：通过 getRedeemStatus(bytes32) 从合约直接读取，不做区块/事件扫描；限流时仅用 CoNET */
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

        // 1) redeem 状态：优先 getRedeemStatusEx（不遍历 bundle）；失败再回退 getRedeemStatus / Batch / API
        let active: boolean
        let totalPoints6: bigint
        let statusFromApi: RedeemStatusChain | null = null
        try {
            const [aEx, ptsEx, isPool] = await card.getRedeemStatusEx(hashBytes32, ethers.ZeroAddress)
            active = aEx
            if (isPool) {
                totalPoints6 = 0n
            } else if (aEx && ptsEx === 0n) {
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
                        const apiStatuses = await getRedeemStatusBatchFromApi([{ cardAddress, hash, code }])
                        const apiStatus = apiStatuses?.[hash]
                        if (apiStatus) {
                            active = apiStatus === 'pending'
                            totalPoints6 = 0n
                            statusFromApi = apiStatus as RedeemStatusChain
                            console.warn('[getRedeemDetailsForDisplay] 合约 revert，使用 API 状态:', cardAddress, apiStatus)
                        } else {
                            console.warn('[getRedeemDetailsForDisplay] getRedeemStatusEx/Status/Batch 均 revert:', cardAddress, (exErr as Error)?.message)
                            return null
                        }
                    }
                }
            } else throw exErr
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

/** Multicall3 地址（Base 等链通用） */
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11'

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
        const iface = new ethers.Interface(getRedeemStatusAbi)
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
let getMyAssetsMutex = Promise.resolve<void>(undefined)

const getMyAssetsCacheKey = (profile: profile, cardAddress: string) =>
	`${profile.keyID ?? ''}-${cardAddress}`

async function withGetMyAssetsMutex<T>(fn: () => Promise<T>): Promise<T> {
	const prev = getMyAssetsMutex
	let resolveMutex: () => void
	getMyAssetsMutex = new Promise<void>((r) => { resolveMutex = r })
	await prev
	try {
		return await fn()
	} finally {
		resolveMutex!()
	}
}

export const getMyAssets = async (profile: profile, cardAddress: string): Promise<MyCardAssets | null> => {
	const key = getMyAssetsCacheKey(profile, cardAddress)
	const cached = getMyAssetsCache.get(key)
	if (cached && Date.now() - cached.timestamp < GET_MY_ASSETS_CACHE_TTL_MS) {
		return cached.result
	}
	// 限流时仅使用 CoNET 节点（withBaseRpc 内部会走 CoNET-only），不再跳过 RPC

	return withGetMyAssetsMutex(async () => {
		const cachedAgain = getMyAssetsCache.get(key)
		if (cachedAgain && Date.now() - cachedAgain.timestamp < GET_MY_ASSETS_CACHE_TTL_MS) {
			return cachedAgain.result
		}

		try {
			if (!profile.aaAccount) {
				const aa = await getAAAccount(profile)
				if (!aa) {
					return null
				}
				profile.aaAccount = aa
			}
			// 1. 实例化卡合约（用 getOwnershipByEOA 由卡按自身 gateway 的 AA Factory 解析 EOA→AA，与购卡时一致）
			const cardContract = new ethers.Contract(
            cardAddress,
            [
                'function getOwnershipByEOA(address userEOA) view returns (uint256 pt, (uint256 tokenId, uint256 attribute, uint256 tierIndexOrMax, uint256 expiry, bool isExpired)[] nfts)',
                'function currency() view returns (uint8)',
            ],
            baseEndpoint
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
        const usdcBalanceRaw = await usdcContract.balanceOf(balanceAddress);
        const usdcBalance = ethers.formatUnits(usdcBalanceRaw, 6);

        // 4. 格式化数据并返回
        const result = {
            address: profile.aaAccount,
            cardAddress: cardAddress,
			cardOwner: await getCardOwnerByCardAddress(cardAddress),
            // 积分余额（从 1e6 格式化回人类可读数值）
            points: ethers.formatUnits(pointsBalance, 6),

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

			// 打印结果
			console.table(result.nfts)

			getMyAssetsCache.set(key, { result, timestamp: Date.now() })
			return result
		} catch (error: unknown) {
			if (isRpcQuotaOrNetworkError(error)) reportRpcFailure()
			throw error
		}
	})
}

/** 聚合用户发行的多张 BeamioUserCard 资产（不含 CCSA / 基础设施卡）。
 * 注意：不使用 withGetMyAssetsMutex，因 getMyAssets 内部已用 mutex；若此处再用会死锁。 */
export const getMyAssetsAggregated = async (profile: profile): Promise<MyCardAssets | null> => {
	const key = `aggregated-issued-${profile.keyID ?? ''}`
	const cached = getMyAssetsCache.get(key)
	if (cached && Date.now() - cached.timestamp < GET_MY_ASSETS_CACHE_TTL_MS) {
		return cached.result
	}
	const { cards, trusted } = await getCardsOfOwnerWithDetailsForProfile(profile)
	if (!trusted || cards.length === 0) return null
	const results = await Promise.all(cards.map((c) => getMyAssets(profile, c.cardAddress)))
	const valid = results.filter((r): r is MyCardAssets => r != null)
	if (valid.length === 0) return null
	const first = valid[0]
	const totalPoints = valid.reduce((sum, r) => sum + Number(r.points || 0), 0)
	const mergedNfts = valid.flatMap((r) => r.nfts)
	const primaryAddr = cards[0]?.cardAddress ?? first.cardAddress
	const result: MyCardAssets = {
		...first,
		cardAddress: primaryAddr,
		points: String(totalPoints),
		nfts: mergedNfts,
	}
	getMyAssetsCache.set(key, { result, timestamp: Date.now() })
	return result
}

/** 卡 metadata 中的 tier 项（创建卡时由 cardManager 提交，存于 0x{owner}.json） */
export type CardTierMetadata = { index: number; minUsdc6?: string; attr?: number; name?: string; description?: string; image?: string; backgroundColor?: string }

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
	/** From shareTokenMetadata.displayName — shown on consumer card when set */
	displayName?: string
	image?: string
	/** From shareTokenMetadata.merchantImage — optional banner / hero image URL */
	merchantImage?: string
	tiers?: CardTierMetadata[]
	cardOwner?: string
	categories?: string[]
	bonusRule?: ShareTokenMetadataBonusRule
	bonusRules?: ShareTokenMetadataBonusRule[]
	pointSystem?: ShareTokenMetadataPointSystem
	coupons?: ShareTokenMetadataCoupon[]
	productions?: ShareTokenMetadataProduction[]
	itemCategory?: ShareTokenMetadataServiceCategoryEntry[]
	/** @deprecated Read compat only — prefer `itemCategory`. */
	serviceCategory?: ShareTokenMetadataServiceCategoryEntry[]
	/** Parsed from shareTokenMetadata.minimumTopup (whole currency units) */
	minimumTopupCad?: number
	/** Parsed from shareTokenMetadata.maximumTopup (whole currency units) */
	maximumTopupCad?: number
	/** 0–3 from shareTokenMetadata.logoDisplayTier — hero logo size on card previews */
	logoDisplayTier?: CardPreviewLogoDisplayTier
}

/** 单张成员 NFT 的 tier metadata（GET /metadata/0x{owner}{NFT#}.json） */
export type NftTierMetadata = { name?: string; description?: string; image?: string; tierIndex?: number; minUsdc6?: string; backgroundColor?: string }

/** ERC1155 metadata 缓存：cardAddress -> { name?, image?, tiers?, cardOwner?, categories?, timestamp }，TTL 5 分钟 */
const cardMetadataCache = new Map<
	string,
	{
		name?: string
		displayName?: string
		image?: string
		merchantImage?: string
		tiers?: CardTierMetadata[]
		cardOwner?: string
		categories?: string[]
		bonusRule?: ShareTokenMetadataBonusRule
		bonusRules?: ShareTokenMetadataBonusRule[]
		pointSystem?: ShareTokenMetadataPointSystem
		coupons?: ShareTokenMetadataCoupon[]
		productions?: ShareTokenMetadataProduction[]
		itemCategory?: ShareTokenMetadataServiceCategoryEntry[]
		serviceCategory?: ShareTokenMetadataServiceCategoryEntry[]
		minimumTopupCad?: number
		maximumTopupCad?: number
		logoDisplayTier?: CardPreviewLogoDisplayTier
		timestamp: number
	}
>()
const CARD_METADATA_CACHE_TTL_MS = 5 * 60 * 1000

/** Bust client cache after server-side metadata updates (e.g. merchantImage). */
export function invalidateBeamioCardMetadataCache(cardAddress: string): void {
	const key = cardAddress.trim().toLowerCase()
	if (key) cardMetadataCache.delete(key)
}

/** Positive whole-number top-up limit from metadata shareTokenMetadata (CAD / card currency units). */
export function parseShareTokenMetadataTopupLimit(raw: unknown): number | undefined {
	if (raw == null) return undefined
	if (typeof raw === 'number' && Number.isFinite(raw)) {
		const n = Math.trunc(raw)
		if (n > 0 && n === raw) return n
	}
	if (typeof raw === 'string') {
		const t = raw.replace(/,/g, '').trim()
		if (!t) return undefined
		const n = Number.parseInt(t, 10)
		const f = parseFloat(t)
		if (Number.isFinite(n) && Number.isFinite(f) && f === n && n > 0) return n
	}
	return undefined
}

function topupLimitsFromShareTokenMetadata(
	share: Record<string, unknown> | undefined | null
): { minimumTopupCad?: number; maximumTopupCad?: number } {
	if (!share || typeof share !== 'object') return {}
	const minRaw = share.minimumTopup ?? share.minimumTopUp ?? share.minTopup
	const maxRaw = share.maximumTopup ?? share.maximumTopUp ?? share.maxTopup
	const minimumTopupCad = parseShareTokenMetadataTopupLimit(minRaw)
	const maximumTopupCad = parseShareTokenMetadataTopupLimit(maxRaw)
	return {
		...(minimumTopupCad != null ? { minimumTopupCad } : {}),
		...(maximumTopupCad != null ? { maximumTopupCad } : {}),
	}
}

function shareTokenCategoriesFromUnknown(share: Record<string, unknown> | undefined | null): string[] | undefined {
	if (!share || typeof share !== 'object') return undefined
	const raw = share.categories
	if (!Array.isArray(raw)) return undefined
	const out = raw
		.filter((c): c is string => typeof c === 'string' && c.trim() !== '')
		.map((c) => c.trim().toLowerCase())
	return out.length > 0 ? Array.from(new Set(out)) : undefined
}

function shareTokenDisplayNameFromUnknown(share: Record<string, unknown> | undefined | null): string | undefined {
	if (!share || typeof share !== 'object') return undefined
	const raw = share.displayName ?? share.storeDisplayName
	if (typeof raw !== 'string') return undefined
	const t = raw.trim()
	return t || undefined
}

function shareTokenMerchantImageFromUnknown(share: Record<string, unknown> | undefined | null): string | undefined {
	if (!share || typeof share !== 'object') return undefined
	const raw = share.merchantImage ?? share.merchant_image
	if (typeof raw !== 'string') return undefined
	const t = raw.trim()
	return t || undefined
}

function shareTokenLogoDisplayTierFromUnknown(
	share: Record<string, unknown> | undefined | null
): CardPreviewLogoDisplayTier | undefined {
	if (!share || typeof share !== 'object') return undefined
	const raw = share.logoDisplayTier ?? share.logoSizeTier
	return normalizeCardPreviewLogoDisplayTier(raw)
}

function shareTokenBooleanFromUnknown(raw: unknown): boolean | undefined {
	if (typeof raw === 'boolean') return raw
	if (typeof raw === 'number' && Number.isFinite(raw)) return raw !== 0
	if (typeof raw === 'string') {
		const t = raw.trim().toLowerCase()
		if (['true', '1', 'yes', 'on', 'enabled'].includes(t)) return true
		if (['false', '0', 'no', 'off', 'disabled'].includes(t)) return false
	}
	return undefined
}

function shareTokenRatioE6FromUnknown(raw: unknown): string | undefined {
	if (typeof raw === 'bigint') return raw >= 0n ? raw.toString() : undefined
	if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
		return String(Math.trunc(raw))
	}
	if (typeof raw === 'string') {
		const t = raw.replace(/,/g, '').trim()
		if (/^\d+$/.test(t)) return t
	}
	return undefined
}

function shareTokenPointSystemFromUnknown(
	share: Record<string, unknown> | undefined | null
): ShareTokenMetadataPointSystem | undefined {
	if (!share || typeof share !== 'object') return undefined
	const raw =
		share.pointSystem && typeof share.pointSystem === 'object' && !Array.isArray(share.pointSystem)
			? (share.pointSystem as Record<string, unknown>)
			: undefined
	const enabledRaw =
		raw?.enabled ??
		raw?.pointSystemEnabled ??
		raw?.pointsEnabled ??
		share.pointSystemEnabled ??
		share.pointsEnabled
	const ratioRaw =
		raw?.chargeRewardRatioE6 ??
		raw?.pointRewardRatioE6 ??
		raw?.consumptionRewardRatioE6 ??
		share.chargeRewardRatioE6 ??
		share.pointRewardRatioE6 ??
		share.consumptionRewardRatioE6
	const enabled = shareTokenBooleanFromUnknown(enabledRaw)
	const chargeRewardRatioE6 = shareTokenRatioE6FromUnknown(ratioRaw)
	let rewardTokenId: number | undefined
	const tokenRaw = raw?.rewardTokenId ?? share.pointRewardTokenId
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

function shareTokenBonusRuleNumber(raw: unknown): number | undefined {
	if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
		return Math.round(raw * 100) / 100
	}
	if (typeof raw === 'string') {
		const t = raw.replace(/,/g, '').trim()
		if (!t) return undefined
		const n = Number.parseFloat(t)
		if (Number.isFinite(n) && n > 0) return Math.round(n * 100) / 100
	}
	return undefined
}

function shareTokenBonusProportionalFromUnknown(obj: Record<string, unknown>): boolean {
	const v =
		obj.bonusProportional ?? obj.bonusIsProportional ?? obj.percentBased ?? obj.proportionalBonus
	if (v === true || v === 'true' || v === 1 || v === '1') return true
	return false
}

function shareTokenBonusRuleFromUnknown(
	share: Record<string, unknown> | undefined | null
): ShareTokenMetadataBonusRule | undefined {
	if (!share || typeof share !== 'object') return undefined
	const raw = share.bonusRule
	if (!raw || typeof raw !== 'object') return undefined
	const obj = raw as Record<string, unknown>
	const paymentAmount = shareTokenBonusRuleNumber(
		obj.paymentAmount ?? obj.payment ?? obj.thresholdAmount
	)
	const bonusValue = shareTokenBonusRuleNumber(
		obj.bonusValue ?? obj.bonus ?? obj.bonusAmount
	)
	if (paymentAmount == null || bonusValue == null) return undefined
	const bonusProportional = shareTokenBonusProportionalFromUnknown(obj)
	return { paymentAmount, bonusValue, ...(bonusProportional ? { bonusProportional: true } : {}) }
}

function shareTokenBonusRulesFromUnknown(
	share: Record<string, unknown> | undefined | null
): ShareTokenMetadataBonusRule[] | undefined {
	if (!share || typeof share !== 'object') return undefined
	const raw = share.bonusRules
	if (Array.isArray(raw)) {
		const out = raw
			.map((entry) => {
				if (!entry || typeof entry !== 'object') return undefined
				const obj = entry as Record<string, unknown>
				const paymentAmount = shareTokenBonusRuleNumber(
					obj.paymentAmount ?? obj.payment ?? obj.thresholdAmount
				)
				const bonusValue = shareTokenBonusRuleNumber(
					obj.bonusValue ?? obj.bonus ?? obj.bonusAmount
				)
				if (paymentAmount == null || bonusValue == null) return undefined
				const bonusProportional = shareTokenBonusProportionalFromUnknown(obj)
				return { paymentAmount, bonusValue, ...(bonusProportional ? { bonusProportional: true } : {}) }
			})
			.filter((entry): entry is NonNullable<typeof entry> => entry != null) as ShareTokenMetadataBonusRule[]
		if (out.length > 0) return out
	}
	const single = shareTokenBonusRuleFromUnknown(share)
	return single ? [single] : undefined
}

function shareTokenCouponsFromUnknown(
	share: Record<string, unknown> | undefined | null
): ShareTokenMetadataCoupon[] | undefined {
	if (!share || typeof share !== 'object') return undefined
	const raw = share.coupons
	if (!Array.isArray(raw) || raw.length === 0) return undefined
	const out: ShareTokenMetadataCoupon[] = []
	for (const entry of raw) {
		if (!entry || typeof entry !== 'object') continue
		const obj = entry as Record<string, unknown>
		const id = typeof obj.id === 'string' ? obj.id.trim() : ''
		const name = typeof obj.name === 'string' ? obj.name.trim() : ''
		if (!name) continue
		let issueTotal: number | undefined
		const itRaw =
			obj.issueTotal ?? obj.totalIssuance ?? obj.issueTotalCap ?? obj.maxIssueCount ?? obj.mintLimit
		if (typeof itRaw === 'number' && Number.isFinite(itRaw)) {
			const n = Math.trunc(itRaw)
			if (n >= 1) issueTotal = n
		} else if (typeof itRaw === 'string') {
			const n = Number.parseInt(itRaw.replace(/,/g, '').trim(), 10)
			if (Number.isFinite(n) && n >= 1) issueTotal = n
		}
		const icon = typeof obj.icon === 'string' ? obj.icon.trim() : ''
		const backgroundColor = typeof obj.backgroundColor === 'string' ? obj.backgroundColor.trim() : ''
		const description = typeof obj.description === 'string' ? obj.description.trim() : ''
		const validFromRaw = obj.validFrom ?? obj.startDate
		const validToRaw = obj.validTo ?? obj.endDate
		const validFrom = typeof validFromRaw === 'string' ? validFromRaw.trim() : ''
		const validTo = typeof validToRaw === 'string' ? validToRaw.trim() : ''
		const issued =
			obj.issued === true || obj.issued === 1 || obj.issued === '1' || obj.issued === 'true'
		const requiresRedeemCode =
			obj.requiresRedeemCode === true ||
			obj.requiresRedeemCode === 1 ||
			obj.requiresRedeemCode === '1' ||
			obj.requiresRedeemCode === 'true' ||
			obj.redeemCodeRequired === true ||
			obj.redeemCodeRequired === 1 ||
			obj.redeemCodeRequired === '1' ||
			obj.redeemCodeRequired === 'true'
		out.push({
			...(id ? { id } : {}),
			name,
			...(issueTotal != null ? { issueTotal } : {}),
			...(requiresRedeemCode ? { requiresRedeemCode: true } : {}),
			...(validFrom && validTo ? { validFrom, validTo } : {}),
			...(icon ? { icon } : {}),
			...(backgroundColor ? { backgroundColor } : {}),
			...(description ? { description } : {}),
			...(issued ? { issued: true } : {}),
		})
	}
	return out.length > 0 ? out : undefined
}

function shareTokenItemCategoryFromUnknown(
	share: Record<string, unknown> | undefined | null
): ShareTokenMetadataServiceCategoryEntry[] | undefined {
	if (!share || typeof share !== 'object') return undefined
	const raw = share.itemCategory ?? share.serviceCategory
	if (!Array.isArray(raw) || raw.length === 0) return undefined
	const out: ShareTokenMetadataServiceCategoryEntry[] = []
	const seen = new Set<string>()
	for (const entry of raw) {
		if (!entry || typeof entry !== 'object') continue
		const obj = entry as Record<string, unknown>
		const id = typeof obj.id === 'string' ? obj.id.trim() : ''
		const label = typeof obj.label === 'string' ? obj.label.trim() : ''
		if (!id || !label || seen.has(id)) continue
		seen.add(id)
		out.push({ id, label })
	}
	return out.length > 0 ? out : undefined
}

/** @deprecated Use `shareTokenItemCategoryFromUnknown`. */
function shareTokenServiceCategoryFromUnknown(
	share: Record<string, unknown> | undefined | null
): ShareTokenMetadataServiceCategoryEntry[] | undefined {
	return shareTokenItemCategoryFromUnknown(share)
}

function shareTokenProductionsFromUnknown(
	share: Record<string, unknown> | undefined | null
): ShareTokenMetadataProduction[] | undefined {
	if (!share || typeof share !== 'object') return undefined
	const raw = share.productions
	if (!Array.isArray(raw) || raw.length === 0) return undefined
	const out: ShareTokenMetadataProduction[] = []
	for (const entry of raw) {
		if (!entry || typeof entry !== 'object') continue
		const obj = entry as Record<string, unknown>
		const id = typeof obj.id === 'string' ? obj.id.trim() : ''
		const name = typeof obj.name === 'string' ? obj.name.trim() : ''
		if (!name) continue
		const subtitle = typeof obj.subtitle === 'string' ? obj.subtitle.trim() : ''
		const itemCategoryChip =
			typeof obj.itemCategory === 'string'
				? obj.itemCategory.trim()
				: typeof obj.serviceCategory === 'string'
					? obj.serviceCategory.trim()
					: ''
		const singleSessionPrice =
			typeof obj.singleSessionPrice === 'number' && Number.isFinite(obj.singleSessionPrice)
				? obj.singleSessionPrice
				: undefined
		const packageDealEnabled =
			obj.packageDealEnabled === true ||
			obj.packageDealEnabled === 1 ||
			obj.packageDealEnabled === '1' ||
			obj.packageDealEnabled === 'true'
		const packageSessions =
			typeof obj.packageSessions === 'number' && Number.isFinite(obj.packageSessions)
				? Math.trunc(obj.packageSessions)
				: undefined
		const packageBonusSessions =
			typeof obj.packageBonusSessions === 'number' && Number.isFinite(obj.packageBonusSessions)
				? Math.trunc(obj.packageBonusSessions)
				: undefined
		const packageTotalPrice =
			typeof obj.packageTotalPrice === 'number' && Number.isFinite(obj.packageTotalPrice)
				? obj.packageTotalPrice
				: undefined
		let issueTotal: number | undefined
		const itRaw = obj.issueTotal
		if (typeof itRaw === 'number' && Number.isFinite(itRaw)) {
			const n = Math.trunc(itRaw)
			if (n >= 1) issueTotal = n
		} else if (typeof itRaw === 'string') {
			const n = Number.parseInt(itRaw.replace(/,/g, '').trim(), 10)
			if (Number.isFinite(n) && n >= 1) issueTotal = n
		}
		const category = typeof obj.category === 'string' ? obj.category.trim() : ''
		const icon = typeof obj.icon === 'string' ? obj.icon.trim() : ''
		const backgroundColor = typeof obj.backgroundColor === 'string' ? obj.backgroundColor.trim() : ''
		const productionImage = typeof obj.productionImage === 'string' ? obj.productionImage.trim() : ''
		let productionImageStartSec: number | undefined
		const startRaw = obj.productionImageStartSec
		if (typeof startRaw === 'number' && Number.isFinite(startRaw) && startRaw > 0) {
			productionImageStartSec = startRaw
		} else if (typeof startRaw === 'string') {
			const parsed = Number.parseFloat(startRaw.replace(/,/g, '').trim())
			if (Number.isFinite(parsed) && parsed > 0) productionImageStartSec = parsed
		}
		const productionImageMime =
			typeof obj.productionImageMime === 'string' ? obj.productionImageMime.trim() : ''
		const description = typeof obj.description === 'string' ? obj.description.trim() : ''
		const issued =
			obj.issued === true || obj.issued === 1 || obj.issued === '1' || obj.issued === 'true'
		const issuedTokenIdRaw = obj.issuedTokenId
		const issuedTokenId =
			typeof issuedTokenIdRaw === 'string' || typeof issuedTokenIdRaw === 'number'
				? String(issuedTokenIdRaw).trim()
				: ''
		out.push({
			...(id ? { id } : {}),
			name,
			...(subtitle ? { subtitle } : {}),
			...(itemCategoryChip ? { itemCategory: itemCategoryChip } : {}),
			...(singleSessionPrice != null ? { singleSessionPrice } : {}),
			...(packageDealEnabled ? { packageDealEnabled: true } : {}),
			...(packageSessions != null ? { packageSessions } : {}),
			...(packageBonusSessions != null ? { packageBonusSessions } : {}),
			...(packageTotalPrice != null ? { packageTotalPrice } : {}),
			...(issueTotal != null ? { issueTotal } : {}),
			...(category ? { category } : {}),
			...(icon ? { icon } : {}),
			...(backgroundColor ? { backgroundColor } : {}),
			...(productionImage ? { productionImage } : {}),
			...(productionImageStartSec != null ? { productionImageStartSec } : {}),
			...(productionImageMime ? { productionImageMime } : {}),
			...(description ? { description } : {}),
			...(issued ? { issued: true } : {}),
			...(issuedTokenId ? { issuedTokenId } : {}),
		})
	}
	return out.length > 0 ? out : undefined
}

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
			merchantImage?: string
			description?: string
			shareTokenMetadata?: { name?: string; image?: string; description?: string; categories?: unknown; bonusRule?: unknown; coupons?: unknown }
			tiers?: CardTierMetadata[]
			properties?: Record<string, unknown>
		}
		const share = json?.shareTokenMetadata as Record<string, unknown> | undefined
		const categories = shareTokenCategoriesFromUnknown(share)
		const limits = topupLimitsFromShareTokenMetadata(share)
		const displayName = shareTokenDisplayNameFromUnknown(share)
		const bonusRule = shareTokenBonusRuleFromUnknown(share)
		const bonusRules = shareTokenBonusRulesFromUnknown(share)
		const pointSystem = shareTokenPointSystemFromUnknown(share)
		const coupons = shareTokenCouponsFromUnknown(share)
		const productions = shareTokenProductionsFromUnknown(share)
		const itemCategory = shareTokenItemCategoryFromUnknown(share)
		const logoDisplayTier = shareTokenLogoDisplayTierFromUnknown(share)
		const merchantImage =
			shareTokenMerchantImageFromUnknown(share) ??
			(typeof json.merchantImage === 'string' && json.merchantImage.trim() ? json.merchantImage.trim() : undefined)
		const meta: CardMetadataFromUri = {
			name: (share?.name ?? json?.name) as string | undefined,
			image: (share?.image ?? json?.image) as string | undefined,
			...(displayName && { displayName }),
			...(merchantImage && { merchantImage }),
			...(bonusRule && { bonusRule }),
			...(bonusRules && { bonusRules }),
			...(pointSystem && { pointSystem }),
			...(coupons && { coupons }),
			...(productions && { productions }),
			...(itemCategory && { itemCategory }),
			...(Array.isArray(json?.tiers) && json.tiers.length > 0 && { tiers: json.tiers }),
			...(categories && { categories }),
			...limits,
			...(logoDisplayTier !== undefined && { logoDisplayTier }),
		}
		cardMetadataCache.set(cacheKey, { ...meta, timestamp: Date.now() })
		return meta
	} catch {
		return null
	}
}

/** 从 beamioApi 拉取 card_owner + metadata_json，转为 CardMetadataFromUri。优先用此接口，不依赖链上 uri 与 RPC。 */
export const getCardMetadataFromApi = async (cardAddress: string): Promise<CardMetadataFromUri | null> => {
	const key = cardAddress.toLowerCase()
	const cached = cardMetadataCache.get(key)
	if (cached && Date.now() - cached.timestamp < CARD_METADATA_CACHE_TTL_MS) {
		const { timestamp, ...meta } = cached
		return meta
	}
	try {
		const res = await fetch(`${beamioApi}/api/cardMetadata?cardAddress=${encodeURIComponent(cardAddress)}`)
		if (!res.ok) return null
		const data = (await res.json()) as { cardOwner?: string; metadata?: Record<string, unknown> | null }
		const metaJson = data?.metadata
		if (!metaJson || typeof metaJson !== 'object') return null
		const share = metaJson.shareTokenMetadata as Record<string, unknown> | undefined
		const categories = shareTokenCategoriesFromUnknown(share)
		const limits = topupLimitsFromShareTokenMetadata(share)
		const displayName = shareTokenDisplayNameFromUnknown(share)
		const bonusRule = shareTokenBonusRuleFromUnknown(share)
		const bonusRules = shareTokenBonusRulesFromUnknown(share)
		const pointSystem = shareTokenPointSystemFromUnknown(share)
		const coupons = shareTokenCouponsFromUnknown(share)
		const productions = shareTokenProductionsFromUnknown(share)
		const itemCategory = shareTokenItemCategoryFromUnknown(share)
		const logoDisplayTier = shareTokenLogoDisplayTierFromUnknown(share)
		const cardOwner = data?.cardOwner && typeof data.cardOwner === 'string' ? data.cardOwner : undefined
		const merchantImage =
			shareTokenMerchantImageFromUnknown(share) ??
			(typeof metaJson.merchantImage === 'string' && metaJson.merchantImage.trim()
				? metaJson.merchantImage.trim()
				: undefined)
		const meta: CardMetadataFromUri = {
			name: (share?.name ?? metaJson.name) as string | undefined,
			image: (share?.image ?? metaJson.image) as string | undefined,
			...(displayName && { displayName }),
			...(merchantImage && { merchantImage }),
			...(bonusRule && { bonusRule }),
			...(bonusRules && { bonusRules }),
			...(pointSystem && { pointSystem }),
			...(coupons && { coupons }),
			...(productions && { productions }),
			...(itemCategory && { itemCategory }),
			...(Array.isArray(metaJson.tiers) && metaJson.tiers.length > 0 && { tiers: metaJson.tiers as CardTierMetadata[] }),
			...(cardOwner && { cardOwner }),
			...(categories && { categories }),
			...limits,
			...(logoDisplayTier !== undefined && { logoDisplayTier }),
		}
		cardMetadataCache.set(key, { ...meta, timestamp: Date.now() })
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

/** EIP-1155 `uri()` 模板 `{id}` → 64 位小写 hex（与 beamio.app `/api/metadata/` 路由一致）。 */
function erc1155MetadataIdHex(tokenId: bigint | number | string = 0): string {
	return BigInt(tokenId).toString(16).padStart(64, '0').toLowerCase()
}

function resolveBeamioErc1155MetadataUrl(baseUri: string, tokenId: bigint | number = 0): string {
	if (!baseUri.includes('{id}')) return baseUri
	return baseUri.replace(/{id}/gi, erc1155MetadataIdHex(tokenId))
}

function beamioApiErc1155MetadataUrl(cardAddress: string, tokenId: bigint | number = 0): string {
	const hex40 = ethers.getAddress(cardAddress).slice(2).toLowerCase()
	return `${beamioApi}/api/metadata/0x${hex40}${erc1155MetadataIdHex(tokenId)}.json`
}

/** 从 BeamioUserCard 的 uri 获取 metadata（name、image、tiers）。base 为 `https://beamio.app/api/metadata/0x` + 卡地址 + `{id}.json`。 */
export const getCardMetadataFromUri = async (cardAddress: string): Promise<CardMetadataFromUri | null> => {
	const key = cardAddress.toLowerCase()
	const cached = cardMetadataCache.get(key)
	if (cached && Date.now() - cached.timestamp < CARD_METADATA_CACHE_TTL_MS) {
		const { timestamp, ...meta } = cached
		return meta
	}
	try {
		const card = new ethers.Contract(
			cardAddress,
			['function uri(uint256) view returns (string)'],
			baseEndpoint
		)
		const baseUri = await card.uri(0)
		if (!baseUri || typeof baseUri !== 'string') return null
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
		const json = (await res.json()) as {
			name?: string
			image?: string
			merchantImage?: string
			description?: string
			shareTokenMetadata?: { name?: string; image?: string; description?: string; categories?: unknown; bonusRule?: unknown; coupons?: unknown }
			tiers?: CardTierMetadata[]
		}
		// 兼容顶层 ERC1155 与服务器写入的 shareTokenMetadata 嵌套结构；API 返回 shared 时带 tiers
		const shareObj = json?.shareTokenMetadata as Record<string, unknown> | undefined
		const categories = shareTokenCategoriesFromUnknown(shareObj)
		const limits = topupLimitsFromShareTokenMetadata(shareObj)
		const displayName = shareTokenDisplayNameFromUnknown(shareObj)
		const bonusRule = shareTokenBonusRuleFromUnknown(shareObj)
		const bonusRules = shareTokenBonusRulesFromUnknown(shareObj)
		const pointSystem = shareTokenPointSystemFromUnknown(shareObj)
		const coupons = shareTokenCouponsFromUnknown(shareObj)
		const productions = shareTokenProductionsFromUnknown(shareObj)
		const itemCategory = shareTokenItemCategoryFromUnknown(shareObj)
		const logoDisplayTier = shareTokenLogoDisplayTierFromUnknown(shareObj)
		const merchantImage =
			shareTokenMerchantImageFromUnknown(shareObj) ??
			(typeof json.merchantImage === 'string' && json.merchantImage.trim() ? json.merchantImage.trim() : undefined)
		const meta: CardMetadataFromUri = {
			name: json?.name ?? json?.shareTokenMetadata?.name,
			image: json?.image ?? json?.shareTokenMetadata?.image,
			...(displayName && { displayName }),
			...(merchantImage && { merchantImage }),
			...(bonusRule && { bonusRule }),
			...(bonusRules && { bonusRules }),
			...(pointSystem && { pointSystem }),
			...(coupons && { coupons }),
			...(productions && { productions }),
			...(itemCategory && { itemCategory }),
			...(Array.isArray(json?.tiers) && json.tiers.length > 0 && { tiers: json.tiers }),
			...(categories && { categories }),
			...limits,
			...(logoDisplayTier !== undefined && { logoDisplayTier }),
		}
		cardMetadataCache.set(key, { ...meta, timestamp: Date.now() })
		return meta
	} catch {
		return null
	}
}

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



const _isDev = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'

/** RPC 失败或 primaryAccountOf 为空时从 API 获取 AA 地址 */
async function fetchAAAccountFromApi(eoa: string): Promise<string | null> {
	try {
		const res = await fetch(`${beamioApi}/api/getAAAccount?eoa=${encodeURIComponent(eoa)}`)
		if (!res.ok) {
			if (_isDev) console.warn('[getAAAccount] API returned', res.status, res.statusText)
			return null
		}
		const data = await res.json().catch(() => ({}))
		const account = data?.account ?? null
		if (!account && _isDev) console.warn('[getAAAccount] API response missing account field:', data)
		return account
	} catch (e) {
		if (_isDev) console.warn('[getAAAccount] API fetch failed:', e)
		return null
	}
}

/** 使用 AA Factory 预测 index=0 的 AA 地址，并在 CoNET 链上验证是否已部署。 */
async function tryPredictedAAFromFactory(eoa: string): Promise<string | null> {
	try {
		const accountFactory = new ethers.Contract(
			contracts.BeamioAAAcountFactory.address,
			BeamioAAAcountFactoryAbi,
			conetDepinProvider
		)
		const getAddressFn = accountFactory.getFunction('getAddress(address,uint256)')
		const predicted = await getAddressFn(ethers.getAddress(eoa.trim()), 0n)
		if (!predicted || predicted === ethers.ZeroAddress) return null
		const addr = ethers.getAddress(predicted)
		const code = await conetDepinProvider.getCode(addr)
		if (!code || code === '0x') return null
		try {
			const aa = new ethers.Contract(addr, ['function factory() view returns (address)'], conetDepinProvider)
			await aa.factory()
		} catch {
			return null
		}
		if (_isDev) console.warn('[getAAAccount] fallback: predicted AA verified on CoNET for', eoa)
		return addr
	} catch {
		return null
	}
}

/**
 * 仅 RPC：CoNET BEAMIO_AA_FACTORY beamioAccountOf（须有合约 code）。
 * 用于 Merchant OS：仅在 `trusted === true` 时用结果比对并覆盖本地缓存的 `aaAccount`。
 */
export async function fetchTrustedCanonicalAaFromRpc(
	eoa: string
): Promise<{ trusted: true; aa: string | null } | { trusted: false }> {
	try {
		const addr = ethers.getAddress(eoa.trim())
		const aa = await resolveBeamioAaOnConet(conetDepinProvider, addr)
		return { trusted: true, aa }
	} catch {
		return { trusted: false }
	}
}

export type BuintRedeemAirdropPreCheckApiResponse = {
	valid?: boolean
	codeHash?: string
	amount?: string
	validAfter?: number
	validBefore?: number
	active?: boolean
	consumed?: boolean
	timeOk?: boolean
	redeemable?: boolean
	error?: string
}

const BUINT_REDEEM_AIRDROP_GET_ABI = [
	'function getRedeem(bytes32 codeHash) view returns (uint256 amount, uint64 validAfter, uint64 validBefore, bool active, bool consumed)',
] as const

const MAX_BUINT_REDEEM_CODE_BYTES = 512

function buintRedeemAirdropTimeOkClient(validAfter: bigint, validBefore: bigint, nowSec: number): boolean {
	if (validAfter !== 0n && BigInt(nowSec) < validAfter) return false
	if (validBefore !== 0n && BigInt(nowSec) > validBefore) return false
	return true
}

/** 浏览器直连 CoNET RPC：与合约 `keccak256(bytes(code))` + `getRedeem` 一致，不经过 API */
export async function queryBuintRedeemAirdropOnChain(code: string): Promise<BuintRedeemAirdropPreCheckApiResponse> {
	const b = ethers.toUtf8Bytes(code)
	const now = Math.floor(Date.now() / 1000)
	if (b.length === 0 || b.length > MAX_BUINT_REDEEM_CODE_BYTES) {
		return {
			valid: false,
			codeHash: ethers.keccak256(b),
			amount: '0',
			validAfter: 0,
			validBefore: 0,
			active: false,
			consumed: false,
			timeOk: false,
			redeemable: false,
			error: 'Invalid redeem code length',
		}
	}
	const codeHash = ethers.keccak256(b)
	const c = new ethers.Contract(CONET_BUINT_REDEEM_AIRDROP, BUINT_REDEEM_AIRDROP_GET_ABI, conetDepinProvider)
	let amount = 0n
	let validAfter = 0n
	let validBefore = 0n
	let active = false
	let consumed = false
	try {
		const r = await c.getRedeem!(codeHash)
		const tup = r as unknown as [bigint, bigint, bigint, boolean, boolean]
		amount = tup[0] ?? 0n
		validAfter = tup[1] ?? 0n
		validBefore = tup[2] ?? 0n
		active = Boolean(tup[3])
		consumed = Boolean(tup[4])
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return {
			valid: false,
			codeHash,
			amount: '0',
			validAfter: 0,
			validBefore: 0,
			active: false,
			consumed: false,
			timeOk: false,
			redeemable: false,
			error: err?.shortMessage ?? err?.message ?? 'getRedeem failed',
		}
	}
	const timeOk = buintRedeemAirdropTimeOkClient(validAfter, validBefore, now)
	let error: string | undefined
	if (!active) error = 'Redeem is not active'
	else if (consumed) error = 'Redeem already consumed'
	else if (!timeOk) error = 'Outside valid time window'
	else if (amount <= 0n) error = 'Zero amount'
	const redeemable = active && !consumed && timeOk && amount > 0n
	return {
		valid: true,
		codeHash,
		amount: amount.toString(),
		validAfter: Number(validAfter),
		validBefore: Number(validBefore),
		active,
		consumed,
		timeOk,
		redeemable,
		error,
	}
}

/** Cluster → Master：admin 代付 redeem；Master 先确保 Base AA 存在，再划入 CoNET 上该 AA 地址的 B-Unit 余额 */
export async function postBuintRedeemAirdropRedeem(
	eoa: string,
	code: string
): Promise<{ success: boolean; txHash?: string; recipient?: string; error?: string }> {
	const res = await fetch(`${beamioApi}/api/buintRedeemAirdropRedeem`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ eoa: ethers.getAddress(eoa.trim()), code }),
	})
	const data = (await res.json().catch(() => ({}))) as {
		success?: boolean
		txHash?: string
		recipient?: string
		aa?: string
		error?: string
	}
	if (!res.ok) {
		return { success: false, error: data?.error ?? res.statusText }
	}
	const recipient = data.recipient ?? data.aa
	return { success: Boolean(data.success), txHash: data.txHash, recipient, error: data.error }
}

export type BusinessStartKetRedeemPreCheckApiResponse = {
	valid?: boolean
	codeHash?: string
	tokenId?: string
	ketAmount?: string
	buintAmount?: string
	validAfter?: number
	validBefore?: number
	active?: boolean
	consumed?: boolean
	timeOk?: boolean
	redeemable?: boolean
	error?: string
}

const BUSINESS_START_KET_REDEEM_GET_ABI = [
	'function getRedeem(bytes32 codeHash) view returns (uint256 tokenId, uint256 ketAmount, uint256 buintAmount, uint64 validAfter, uint64 validBefore, bool active, bool consumed)',
] as const

const BUSINESS_START_KET_ERC1155_BALANCE_ABI = ['function balanceOf(address account, uint256 id) view returns (uint256)'] as const

/** CoNET：`BusinessStartKet` ERC1155 上用户 Ket 余额（如 id=0）；勿用 Redeem 合约地址（无 balanceOf） */
export async function queryBusinessStartKetBalanceOfOnChain(
	account: string,
	tokenId: bigint = 0n
): Promise<{ ok: true; balance: bigint } | { ok: false; balance: bigint; error: string }> {
	if (!account || !ethers.isAddress(account)) {
		return { ok: false, balance: 0n, error: 'Invalid account' }
	}
	const c = new ethers.Contract(CONET_BUSINESS_START_KET, BUSINESS_START_KET_ERC1155_BALANCE_ABI, conetDepinProvider)
	try {
		const b = await c.balanceOf!(ethers.getAddress(account), tokenId)
		return { ok: true, balance: BigInt(b.toString()) }
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return { ok: false, balance: 0n, error: err?.shortMessage ?? err?.message ?? 'balanceOf failed' }
	}
}

/** 浏览器直连 CoNET RPC：BusinessStartKetRedeem.getRedeem，与链上 redeem 一致 */
export async function queryBusinessStartKetRedeemOnChain(code: string): Promise<BusinessStartKetRedeemPreCheckApiResponse> {
	const b = ethers.toUtf8Bytes(code)
	const now = Math.floor(Date.now() / 1000)
	if (b.length === 0 || b.length > MAX_BUINT_REDEEM_CODE_BYTES) {
		return {
			valid: false,
			codeHash: ethers.keccak256(b),
			tokenId: '0',
			ketAmount: '0',
			buintAmount: '0',
			validAfter: 0,
			validBefore: 0,
			active: false,
			consumed: false,
			timeOk: false,
			redeemable: false,
			error: 'Invalid redeem code length',
		}
	}
	const codeHash = ethers.keccak256(b)
	const c = new ethers.Contract(CONET_BUSINESS_START_KET_REDEEM, BUSINESS_START_KET_REDEEM_GET_ABI, conetDepinProvider)
	let tokenId = 0n
	let ketAmount = 0n
	let buintAmount = 0n
	let validAfter = 0n
	let validBefore = 0n
	let active = false
	let consumed = false
	try {
		const r = await c.getRedeem!(codeHash)
		const tup = r as unknown as [bigint, bigint, bigint, bigint, bigint, boolean, boolean]
		tokenId = tup[0] ?? 0n
		ketAmount = tup[1] ?? 0n
		buintAmount = tup[2] ?? 0n
		validAfter = tup[3] ?? 0n
		validBefore = tup[4] ?? 0n
		active = Boolean(tup[5])
		consumed = Boolean(tup[6])
	} catch (e: unknown) {
		const err = e as { shortMessage?: string; message?: string }
		return {
			valid: false,
			codeHash,
			tokenId: '0',
			ketAmount: '0',
			buintAmount: '0',
			validAfter: 0,
			validBefore: 0,
			active: false,
			consumed: false,
			timeOk: false,
			redeemable: false,
			error: err?.shortMessage ?? err?.message ?? 'getRedeem failed',
		}
	}
	const timeOk = buintRedeemAirdropTimeOkClient(validAfter, validBefore, now)
	let error: string | undefined
	if (!active) error = 'Redeem is not active'
	else if (consumed) error = 'Redeem already consumed'
	else if (!timeOk) error = 'Outside valid time window'
	else if (ketAmount <= 0n && buintAmount <= 0n) error = 'Nothing to redeem'
	const redeemable = active && !consumed && timeOk && (ketAmount > 0n || buintAmount > 0n)
	return {
		valid: true,
		codeHash,
		tokenId: tokenId.toString(),
		ketAmount: ketAmount.toString(),
		buintAmount: buintAmount.toString(),
		validAfter: Number(validAfter),
		validBefore: Number(validBefore),
		active,
		consumed,
		timeOk,
		redeemable,
		error,
	}
}

/** Cluster → Master：admin 代付 BusinessStartKetRedeem.redeemWithCodeAsAdmin（Ket + B-Unit → 用户 Base AA） */
export async function postBusinessStartKetRedeemRedeem(
	eoa: string,
	code: string
): Promise<{ success: boolean; txHash?: string; recipient?: string; error?: string }> {
	const res = await fetch(`${beamioApi}/api/businessStartKetRedeemRedeem`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ eoa: ethers.getAddress(eoa.trim()), code }),
	})
	const data = (await res.json().catch(() => ({}))) as {
		success?: boolean
		txHash?: string
		recipient?: string
		aa?: string
		error?: string
	}
	if (!res.ok) {
		return { success: false, error: data?.error ?? res.statusText }
	}
	const recipient = data.recipient ?? data.aa
	return { success: Boolean(data.success), txHash: data.txHash, recipient, error: data.error }
}

export const getAAAccount = async (profile: profile): Promise<string | null> => {
	const eoa = profile?.keyID?.trim()
	if (!eoa || !ethers.isAddress(eoa)) {
		if (_isDev) console.warn('[getAAAccount] Invalid eoa: missing or invalid keyID')
		return null
	}
	try {
		const account = await resolveBeamioAaOnConet(conetDepinProvider, eoa)
		if (!account) {
			if (_isDev) console.warn('[getAAAccount] no CoNET AA for', eoa)
			const fromApi = await fetchAAAccountFromApi(eoa)
			if (fromApi && ethers.isAddress(fromApi)) {
				const code = await conetDepinProvider.getCode(fromApi).catch(() => '0x')
				if (code && code !== '0x') return fromApi
			}
			return tryPredictedAAFromFactory(eoa)
		}
		try {
			const aa = new ethers.Contract(account, ['function factory() view returns (address)'], conetDepinProvider)
			await aa.factory()
		} catch (e: any) {
			throw new Error(`getAAAccount: factory() not available: ${e?.shortMessage ?? e?.message}`)
		}
		return account
	} catch (error: any) {
		console.warn(`[getAAAccount] CoNET RPC failed: ${error.message}, fallback to API`)
		const fromApi = await fetchAAAccountFromApi(eoa)
		if (fromApi && ethers.isAddress(fromApi)) {
			const code = await conetDepinProvider.getCode(fromApi).catch(() => '0x')
			if (code && code !== '0x') return fromApi
		}
		return tryPredictedAAFromFactory(eoa)
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
        return owner
    } catch (error: any) {
        console.log(`❌ getCardOwnerByCardAddress Failed: ${error.message}`);
        return null
    }
}