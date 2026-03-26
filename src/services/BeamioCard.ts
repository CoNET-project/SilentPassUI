import { ethers } from "ethers";
import contracts from "../utils/contracts";
import { baseEndpoint, USDCContract_BASE, beamioApi, BeamioCardFactorySC, conetDepinProvider, CCSA_Card_Address, BEAMIO_USER_CARD_ASSET_ADDRESS, ASSET_CARD_ADDRESSES } from "../utils/constants";
import { BASE_MAINNET_FACTORIES, BASE_TREASURY } from "@/config/chainAddresses";
import { isRpcDegraded, reportRpcFailure, isRpcQuotaOrNetworkError } from "@/utils/rpcStatus";
import { CoNET_Data, setCoNET_Data } from "@/utils/globals";
import { storeSystemData } from "./beamio";
import { BeamioAAAcountFactoryAbi, cardAbi } from "../utils/abis";
import { searchUsername} from "./beamio"
import usdc_abi from './ABI/usdc_abi.json'
import { Theater } from "lucide-react";
//		UID 044073D2151990

/** 购卡请求体：仅允许 string/number，禁止 BigInt，以便 JSON 序列化发给后端 */
export type Icard = { cardAddress: string, userSignature: string, nonce: string, usdcAmount: string, from: string, validAfter: number, validBefore: number }

/** B-Unit Refuel EIP-3009 payload for purchaseBUnitFromBase API */
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
	'0xf99018dffdb0c5657c93ca14db2900cebe1168a7',
	'0x82b333da5c723da6e98fefecd96cb1ca304c6125',
	'0x9d098fa94d559b8cb223b9760e8bac3d07617c78',
	'0x926deadb97d8badd1221060840b5a1cf46711a86',
	'0x709dae38d65a87289597ee79cb0d5d251a282e59',
	'0x536cab27c6488202fd86bae0581f143c725f5b4d',
	'0xb87058b44c881020fd529e7e34a158f05bc4c28a',
	'0x82cee96db45933fe4b71d36fa8904508f929027c',
	'0xf0ce0ae91f74f67893e00307cabea8c058939f03',
	'0xb7644ddb12656f4854dc746464af47d33c206f0e',
	'0x0fb5032915c5473b6ef40d878c3c701641f90ec8',
	'0x407e9974a927af2860780645997778be7b0e8e23',
	'0xea7b248cfcd457c4884371c55ae5afb0f428c483',
	'0xe1666f0309529df18e7986064a337c981baea178',
	'0x4cc2e5a596791cb71e34d7b3177e60f6ab3f73ed',
	'0xcdab59228695bbf2137d56382395f854267194e1',
	'0x3957724e39e3db4f9f5fb263dd18e73fe8a67581',
	'0x4cb611a14b1441d36183f125503f2c72af5b8fc8',
	'0x5af645042411bd68ec80c8b2c781d422343e95c9',
	'0xda36bd32418cac424dbffd07617094d1884e629c',
	'0x63a6251a51939f6c47ba0ceff5984e5c9f031605',
	'0x48952f9ea1231b59e5c5fa1a99bc657b122cfdfd',
	'0xb8a42181adc9bb81b6ccc1f2198be95105cfd969',
	'0x70399f0854f32553d7fe14a43fd6ab925d39c0b4',
	'0xfb4d0546b90a8f353f7c479392a1ba40a1185b9d',
	'0x4c66b36ba059b2f05ef3d5f383c67533f19c6219',
	'0x74f35741ad8bc75d873a8d7d140ae5ffb529ac0f',
	'0x9cda8477c9f03b8759ac64e21941e578908fd750', // BEAMIO_USER_CARD_ASSET_ADDRESS (infra)
])

const filterExcludedUserCards = (cards: UserCardInfo[]): UserCardInfo[] =>
	cards.filter((c) => !USER_CARD_DISPLAY_EXCLUDED.has(c.cardAddress.toLowerCase()))

/** AA Factory 作为 UserCard gateway（与 config/chainAddresses BASE_AA_FACTORY 一致） */
const BeamioUserCardGatewayAddress = BASE_MAINNET_FACTORIES.AA_FACTORY.toLowerCase()
const chainId8453 = 8453n
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

/** Logs the exact JSON body sent to POST /api/createCard when: Vite dev, NODE_ENV=development, localStorage BEAMIO_DEBUG_CREATE_CARD=1, or URL ?debugCreateCard=1 */
function shouldLogCreateCardRequestBody(): boolean {
	if (typeof window !== 'undefined') {
		try {
			if (window.localStorage?.getItem('BEAMIO_DEBUG_CREATE_CARD') === '1') return true
			if (/(?:^|[?&])debugCreateCard=1(?:&|$)/.test(window.location.search || '')) return true
		} catch {
			/* storage blocked */
		}
	}
	try {
		const im = import.meta as ImportMeta & { env?: { DEV?: boolean; MODE?: string } }
		if (im.env?.DEV === true || im.env?.MODE === 'development') return true
	} catch {
		/* no import.meta */
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
const cardAddAdminEndpoint = `${beamioApi}/api/cardAddAdmin`
const cardCreateRedeemAdminEndpoint = `${beamioApi}/api/cardCreateRedeemAdmin`
const cardRedeemAdminEndpoint = `${beamioApi}/api/cardRedeemAdmin`
const cardClearAdminMintCounterEndpoint = `${beamioApi}/api/cardClearAdminMintCounter`

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
	const items = data?.items ?? []
	return items as UserCardInfo[]
}

export type GetCardsResult = { cards: UserCardInfo[]; trusted: boolean }

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
		return { cards: [], trusted: false }
	}

	const cached = profile?.issuedCards ?? []
	const seen = new Set<string>()
	const merged: UserCardInfo[] = []

	// 0. RPC 熔断期：仅使用 CoNET 节点，不向 API 请求
	// （withBaseRpc 内部会走 CoNET-only）

	// 1. 尝试 RPC（正常时 CoNET 优先 + 公共 RPC，限流时仅 CoNET）
	try {
		for (const owner of uniqueOwners) {
			const list = await fetchCardsForOwner(owner)
			for (const c of list) {
				const key = c.cardAddress.toLowerCase()
				if (seen.has(key)) continue
				seen.add(key)
				merged.push(c)
			}
		}
		// Fallback: 若用户 EOA 为 CCSA owner，但 cardsOfOwner 未返回 CCSA，则显式加入
		if (CCSA_Card_Address && eoa && ethers.isAddress(eoa)) {
			try {
				const ccsaLower = CCSA_Card_Address.toLowerCase()
				if (!seen.has(ccsaLower)) {
					const owner = await BeamioCardFactorySC.beamioUserCardOwner(CCSA_Card_Address)
					if (owner && ethers.getAddress(owner).toLowerCase() === ethers.getAddress(eoa).toLowerCase()) {
						const card = new ethers.Contract(CCSA_Card_Address, cardAbiSlice, baseEndpoint)
						const [currencyNum, priceE6Raw] = await Promise.all([
							card.currency(),
							card.pointsUnitPriceInCurrencyE6(),
						])
						const currency = getICurrency(BigInt(currencyNum))
						const priceE6 = Number(priceE6Raw)
						const ptsPer1Currency = priceE6 > 0 ? (1_000_000 / priceE6) : 0
						merged.unshift({
							cardAddress: CCSA_Card_Address,
							name: 'CCSA',
							currency,
							priceE6: String(priceE6),
							ptsPer1Currency: String(ptsPer1Currency),
						})
						seen.add(ccsaLower)
					}
				}
			} catch (_) {}
		}
		// Fallback: 若用户 EOA 为基础设施卡 owner，但 cardsOfOwner 未返回该卡，则显式加入（便于 owner 创建 redeem）
		if (BEAMIO_USER_CARD_ASSET_ADDRESS && eoa && ethers.isAddress(eoa)) {
			try {
				const infraLower = BEAMIO_USER_CARD_ASSET_ADDRESS.toLowerCase()
				if (!seen.has(infraLower)) {
					const owner = await BeamioCardFactorySC.beamioUserCardOwner(BEAMIO_USER_CARD_ASSET_ADDRESS)
					if (owner && ethers.getAddress(owner).toLowerCase() === ethers.getAddress(eoa).toLowerCase()) {
						const card = new ethers.Contract(BEAMIO_USER_CARD_ASSET_ADDRESS, cardAbiSlice, baseEndpoint)
						const [currencyNum, priceE6Raw] = await Promise.all([
							card.currency(),
							card.pointsUnitPriceInCurrencyE6(),
						])
						const currency = getICurrency(BigInt(currencyNum))
						const priceE6 = Number(priceE6Raw)
						const ptsPer1Currency = priceE6 > 0 ? (1_000_000 / priceE6) : 0
						merged.push({
							cardAddress: BEAMIO_USER_CARD_ASSET_ADDRESS,
							name: 'CashTrees Card',
							currency,
							priceE6: String(priceE6),
							ptsPer1Currency: String(ptsPer1Currency),
						})
						seen.add(infraLower)
					}
				}
			} catch (_) {}
		}
		if (merged.length === 0 && typeof console !== 'undefined' && console.warn) {
			console.warn('[getCardsOfOwnerWithDetailsForProfile] 0 cards for owners:', uniqueOwners, '(EOA/keyID 须与创建卡时的 cardOwner 一致)')
		}
		return { cards: filterExcludedUserCards(merged), trusted: true }
	} catch (e) {
		if (isRpcQuotaOrNetworkError(e)) reportRpcFailure()
		if (typeof console !== 'undefined' && console.warn) {
			console.warn('[getCardsOfOwnerWithDetailsForProfile] RPC 失败，尝试 API。owners:', uniqueOwners, (e as Error)?.message ?? e)
		}
		// 2. RPC 失败，尝试 API
		try {
			const apiItems = await fetchMyCardsFromApi(uniqueOwners)
			if (apiItems.length === 0 && typeof console !== 'undefined' && console.warn) {
				console.warn('[getCardsOfOwnerWithDetailsForProfile] API 返回 0 张卡。owners:', uniqueOwners)
			}
			return { cards: filterExcludedUserCards(apiItems), trusted: true }
		} catch (apiErr) {
			if (typeof console !== 'undefined' && console.warn) {
				console.warn('[getCardsOfOwnerWithDetailsForProfile] RPC+API 均失败，返回缓存。owners:', uniqueOwners, 'cached:', cached.length, (apiErr as Error)?.message ?? apiErr)
			}
			// 3. RPC 与 API 均失败，返回 profile 缓存的卡，不信任空 []
			return { cards: filterExcludedUserCards(cached), trusted: false }
		}
	}
}

/** ERC-1155 shareTokenMetadata，写入 0x{owner}.json */
export type ShareTokenMetadata = {
	name: string
	description?: string
	image?: string
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

/** 获取卡的 owner 地址。executeForOwner 要求签名者必须等于 card.owner()，AA 为 owner 时需用 EOA 签会失败。 */
export const getCardOwner = async (cardAddress: string): Promise<string> => {
	const card = new ethers.Contract(cardAddress, ['function owner() view returns (address)'], baseEndpoint)
	return ethers.getAddress(await card.owner())
}

/** ISSUED_NFT_START_ID from BeamioERC1155Logic (100_000_000_000) */
export const ISSUED_NFT_START_ID = 100_000_000_000n

/** 从合约读取 issuedNftIndex（下一个将分配的 tokenId） */
export const getIssuedNftIndex = async (cardAddress: string): Promise<bigint> => {
	const card = new ethers.Contract(cardAddress, ['function issuedNftIndex() view returns (uint256)'], baseEndpoint)
	return BigInt(await card.issuedNftIndex())
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
    const wallet = new ethers.Wallet(ownerPrivateKey, baseEndpoint)
    const factoryAddress = contracts.BeamioCardFactory.address
    const domain = {
        name: 'BeamioUserCardFactory',
        version: '1',
        chainId: 8453,
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

/** 构建 createRedeem 的 calldata（供 executeForOwner 使用）。用于兑换 NFT：tokenIds=[ISSUED_NFT_START_ID], amounts=[1] */
export const encodeCreateRedeemForNft = (
    hash: string,
    validAfter: number,
    validBefore: number,
    tokenId: bigint = ISSUED_NFT_START_ID
): string => {
    const tokenIds = [tokenId]
    const amounts = [1n]
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

/** 构建 createRedeemBatch 的 calldata（供 executeForOwner 使用）。与 API buildCardCreateRedeemBatchData 一致。
 * 使用 hashes 而非 codes，秘密 redeem code 不离开客户端。 */
export const encodeCreateRedeemBatchForNft = (
    hashes: string[],
    validAfter: number,
    validBefore: number,
    tokenIds: (string | number | bigint)[],
    amounts: (string | number | bigint)[]
): string => {
    return createRedeemBatchInterface.encodeFunctionData('createRedeemBatch', [
        hashes,
        0n,
        0n,
        validAfter,
        validBefore,
        tokenIds.map((t) => BigInt(t)),
        amounts.map((a) => BigInt(a)),
    ])
}

/** 提交批量创建 redeem 到 API cardCreateRedeem。使用 createRedeemBatch，无需 toUserEOA。
 * 必须传 hashes（不传 codes），秘密 redeem code 不离开客户端、不记录在链上。 */
export const postCardCreateRedeem = async (payload: {
    cardAddress: string
    hashes: string[]
    points6?: string | number
    validAfter: number
    validBefore: number
    deadline: number
    nonce: string
    ownerSignature: string
    tokenIds?: (string | number)[]
    amounts?: (string | number)[]
}): Promise<{ success: boolean; error?: string }> => {
    try {
        const tokenIds = payload.tokenIds ?? ['0']
        const amounts = payload.amounts ?? [String(payload.points6 ?? 0)]
        const body = {
            cardAddress: payload.cardAddress,
            hashes: payload.hashes,
            points6: String(payload.points6 ?? 0),
            attr: 0,
            validAfter: payload.validAfter,
            validBefore: payload.validBefore,
            tokenIds,
            amounts,
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
        return { success: true }
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
    'function adminManager(address to, bool admin, uint256 newThreshold, string metadata, uint256 mintLimit)',
])

/** 构建 adminManager 的 calldata。admin=true 添加并写入 metadata，admin=false 移除（metadata 可传空） */
export const encodeAdminManager = (to: string, admin: boolean, newThreshold: number | bigint, metadata: string = ''): string =>
    adminManagerInterface.encodeFunctionData('adminManager(address,bool,uint256,string)', [to, admin, BigInt(newThreshold), metadata])

/** 便捷：添加 admin（带 metadata） */
export const encodeAddAdmin = (newAdmin: string, newThreshold: number | bigint, metadata: string = ''): string =>
    encodeAdminManager(newAdmin, true, newThreshold, metadata)

/** 便捷：添加 admin（带 metadata 和 topup limit）。mintLimitPoints6 为 points6 精度（如 1000 CAD = 1000e6） */
export const encodeAddAdminWithMintLimit = (
    newAdmin: string,
    newThreshold: number | bigint,
    metadata: string,
    mintLimitPoints6: bigint
): string =>
    adminManagerInterface.encodeFunctionData('adminManager(address,bool,uint256,string,uint256)', [newAdmin, true, BigInt(newThreshold), metadata, mintLimitPoints6])

/** 便捷：移除 admin */
export const encodeRemoveAdmin = (adminToRemove: string, newThreshold: number | bigint): string =>
    encodeAdminManager(adminToRemove, false, newThreshold, '')

const createRedeemAdminInterface = new ethers.Interface([
    'function createRedeemAdmin(bytes32 hash, string metadata, uint64 validAfter, uint64 validBefore)',
    'function createRedeemAdmin(bytes32 hash, string metadata, uint64 validAfter, uint64 validBefore, uint256 mintLimit)',
])

/** 构建 createRedeemAdmin 的 calldata（供 executeForOwner 使用）。hash=keccak256(secretCode)，owner 离线签字后由 API 代付 gas 执行。 */
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

const createIssuedNftInterface = new ethers.Interface([
    'function createIssuedNft(bytes32 title, uint64 validAfter, uint64 validBefore, uint256 maxSupply, uint256 priceInCurrency6, bytes32 sharedMetadataHash)',
])

const mintIssuedNftByGatewayInterface = new ethers.Interface([
    'function mintIssuedNftByGateway(address userEOA, uint256 tokenId, uint256 amount)',
])

/** 构建 mintIssuedNftByGateway 的 calldata（供 executeForOwner 使用）。Owner 离线签字后由 API 代付 gas 执行，将 issued NFT mint 到目标地址 */
export const encodeMintIssuedNftToAddress = (
    targetAddress: string,
    tokenId: bigint = ISSUED_NFT_START_ID,
    amount: bigint = 1n
): string =>
    mintIssuedNftByGatewayInterface.encodeFunctionData('mintIssuedNftByGateway', [
        ethers.getAddress(targetAddress),
        tokenId,
        amount,
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
const cardMintIssuedNftToAddressEndpoint = `${beamioApi}/api/cardMintIssuedNftToAddress`

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

/** 提交 owner 签名的 mintIssuedNftToAddress 到 API cardMintIssuedNftToAddress。Cluster 预检 targetAddress、签名有效后编码并转发 Master executeForOwner */
export const postCardMintIssuedNftToAddress = async (payload: {
	cardAddress: string
	targetAddress: string
	tokenId?: string | number
	amount?: string | number
	deadline: number
	nonce: string
	ownerSignature: string
}): Promise<{ success: boolean; hash?: string; error?: string }> => {
	try {
		const res = await fetch(cardMintIssuedNftToAddressEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})
		const data = await res.json()
		if (!res.ok) return { success: false, error: data.error ?? 'cardMintIssuedNftToAddress failed' }
		return { success: true, hash: data.hash }
	} catch (e: any) {
		return { success: false, error: e?.message ?? String(e) }
	}
}

/** 提交 adminManager 到 API cardAddAdmin。若传 adminEOA，Cluster 会先 ensureAAForEOA 再执行。 */
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

/** EIP-712 签名：Admin 授权 executeForAdmin(cardAddr, data, deadline, nonce)。通用接口，支持 mintPointsByAdmin、burnPointsByAdmin、adminManager 等。
 * 签名者必须为 card.isAdmin(signer)。 */
export const signExecuteForAdmin = async (
    adminPrivateKey: string,
    cardAddress: string,
    data: string,
    deadline: number,
    nonce: string
): Promise<string> => {
    const wallet = new ethers.Wallet(adminPrivateKey, baseEndpoint)
    const domain = { name: 'BeamioUserCardFactory', version: '1', chainId: 8453, verifyingContract: contracts.BeamioCardFactory.address }
    const types = { ExecuteForAdmin: [{ name: 'cardAddress', type: 'address' }, { name: 'dataHash', type: 'bytes32' }, { name: 'deadline', type: 'uint256' }, { name: 'nonce', type: 'bytes32' }] }
    const dataHash = ethers.keccak256(data)
    const value = { cardAddress: ethers.getAddress(cardAddress), dataHash, deadline, nonce: nonce.startsWith('0x') ? nonce : ethers.keccak256(ethers.toUtf8Bytes(nonce)) }
    return wallet.signTypedData(domain, types, value)
}

const burnPointsByAdminInterface = new ethers.Interface(['function burnPointsByAdmin(address target, uint256 amount)'])

/** 构建 burnPointsByAdmin 的 calldata。target 为被 burn 的地址，amount 为 type(uint256).max 表示 burn 全部。 */
export const encodeBurnPointsByAdmin = (target: string, amount: bigint): string =>
    burnPointsByAdminInterface.encodeFunctionData('burnPointsByAdmin', [ethers.getAddress(target), amount])

/** Admin 离线签字授权 burn 某一地址的 token 0。signer 必须为 card admin；target 为被 burn 的地址；amount 为 type(uint256).max 表示 burn 全部。 */
export const signBurnPointsByAdmin = async (
    adminPrivateKey: string,
    cardAddress: string,
    target: string,
    amount: bigint,
    deadline: number,
    nonce: string
): Promise<{ data: string; adminSignature: string }> => {
    const data = encodeBurnPointsByAdmin(target, amount)
    const adminSignature = await signExecuteForAdmin(adminPrivateKey, cardAddress, data, deadline, nonce)
    return { data, adminSignature }
}

/** EIP-712 签名：Parent admin 授权 clearAdminMintCounter(cardAddress, subordinate)。签名者必须为 card.adminParent(subordinate)。 */
export const signClearAdminMintCounter = async (
    parentPrivateKey: string,
    cardAddress: string,
    subordinate: string,
    deadline: number,
    nonce: string
): Promise<string> => {
    const wallet = new ethers.Wallet(parentPrivateKey, baseEndpoint)
    const domain = { name: 'BeamioUserCardFactory', version: '1', chainId: 8453, verifyingContract: contracts.BeamioCardFactory.address }
    const types = { ClearAdminMintCounter: [{ name: 'cardAddress', type: 'address' }, { name: 'subordinate', type: 'address' }, { name: 'deadline', type: 'uint256' }, { name: 'nonce', type: 'bytes32' }] }
    const nonceBytes = nonce.length === 66 && nonce.startsWith('0x') ? (nonce as `0x${string}`) : ethers.keccak256(ethers.toUtf8Bytes(nonce)) as `0x${string}`
    const value = { cardAddress: ethers.getAddress(cardAddress), subordinate: ethers.getAddress(subordinate), deadline, nonce: nonceBytes }
    return wallet.signTypedData(domain, types, value)
}

/** Admin 提交 burn 自己的 token 0。使用 /api/nfcTopup（与 mint 共用 executeForAdmin 队列）。 */
export const postBurnPointsByAdmin = async (payload: {
    cardAddr: string
    data: string
    deadline: number
    nonce: string
    adminSignature: string
}): Promise<{ success: boolean; tx?: string; error?: string }> => {
    try {
        const res = await fetch(`${beamioApi}/api/nfcTopup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) return { success: false, error: data.error ?? 'burnPointsByAdmin failed' }
        return { success: true, tx: data.tx }
    } catch (e: any) {
        return { success: false, error: e?.message ?? String(e) }
    }
}

/** Parent admin 提交清零 subordinate 的 mint 计数。Cluster 预检 signer==adminParent(subordinate)，Master 调用 Indexer。 */
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
            body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) return { success: false, error: data.error ?? 'cardClearAdminMintCounter failed' }
        return { success: true, tx: data.tx }
    } catch (e: any) {
        return { success: false, error: e?.message ?? String(e) }
    }
}

/** 查询 card 的 admin 列表，连同 metadata、parent、mintCounter 一起回送 */
export const getCardAdminsWithMintCounter = async (cardAddress: string): Promise<{
    success: boolean
    admins?: Array<{ address: string; metadata: string; parent: string; mintCounter: string }>
    error?: string
}> => {
    try {
        const res = await fetch(`${beamioApi}/api/cardAdmins?cardAddress=${encodeURIComponent(cardAddress)}`)
        const data = await res.json()
        if (!res.ok) return { success: false, error: data.error ?? 'getCardAdmins failed' }
        return { success: true, admins: data.admins ?? [] }
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

/** 聚合查询 CCSA + beamioUserCard（基础设施卡）的资产，与 CCSA 同等对待。
 * 注意：不使用 withGetMyAssetsMutex，因 getMyAssets 内部已用 mutex；若此处再用会死锁（持有 mutex 时调用 getMyAssets，getMyAssets 等待同一 mutex）。 */
export const getMyAssetsAggregated = async (profile: profile): Promise<MyCardAssets | null> => {
	const key = `aggregated-${profile.keyID ?? ''}`
	const cached = getMyAssetsCache.get(key)
	if (cached && Date.now() - cached.timestamp < GET_MY_ASSETS_CACHE_TTL_MS) {
		return cached.result
	}
	const results = await Promise.all(
		ASSET_CARD_ADDRESSES.map((addr) => getMyAssets(profile, addr))
	)
	const valid = results.filter((r): r is MyCardAssets => r != null)
	if (valid.length === 0) return null
	const first = valid[0]
	const totalPoints = valid.reduce((sum, r) => sum + Number(r.points || 0), 0)
	const mergedNfts = valid.flatMap((r) => r.nfts)
	const result: MyCardAssets = {
		...first,
		cardAddress: CCSA_Card_Address,
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
export type CardMetadataFromUri = { name?: string; image?: string; tiers?: CardTierMetadata[]; cardOwner?: string }

/** 单张成员 NFT 的 tier metadata（GET /metadata/0x{owner}{NFT#}.json） */
export type NftTierMetadata = { name?: string; description?: string; image?: string; tierIndex?: number; minUsdc6?: string; backgroundColor?: string }

/** ERC1155 metadata 缓存：cardAddress -> { name?, image?, tiers?, cardOwner?, timestamp }，TTL 5 分钟 */
const cardMetadataCache = new Map<string, { name?: string; image?: string; tiers?: CardTierMetadata[]; cardOwner?: string; timestamp: number }>()
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
		}
		const share = json?.shareTokenMetadata
		const meta: CardMetadataFromUri = {
			name: (share?.name ?? json?.name) as string | undefined,
			image: (share?.image ?? json?.image) as string | undefined,
			...(Array.isArray(json?.tiers) && json.tiers.length > 0 && { tiers: json.tiers }),
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
		const cardOwner = data?.cardOwner && typeof data.cardOwner === 'string' ? data.cardOwner : undefined
		const meta: CardMetadataFromUri = {
			name: (share?.name ?? metaJson.name) as string | undefined,
			image: (share?.image ?? metaJson.image) as string | undefined,
			...(Array.isArray(metaJson.tiers) && metaJson.tiers.length > 0 && { tiers: metaJson.tiers as CardTierMetadata[] }),
			...(cardOwner && { cardOwner }),
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

/** 从 BeamioUserCard 的 uri 获取 metadata（name、image、tiers）。创建卡时传入的 uri 如 https://api.beamio.io/metadata/{id}.json；tiers 含创建卡时配置的 name/description */
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
		// ERC1155: 将 {id} 替换为 tokenId（0 = POINTS_ID，用于卡级 metadata）
		// 链上可能存完整 URL（如 https://api.beamio.io/metadata/0x{owner}.json），无 {id} 则不再替换
		const url = baseUri.includes('{id}') ? baseUri.replace(/{id}/gi, '0') : baseUri
		const res = await fetch(url)
		if (!res.ok) return null
		const json = (await res.json()) as {
			name?: string
			image?: string
			description?: string
			shareTokenMetadata?: { name?: string; image?: string; description?: string }
			tiers?: CardTierMetadata[]
		}
		// 兼容顶层 ERC1155 与服务器写入的 shareTokenMetadata 嵌套结构；API 返回 shared 时带 tiers
		const meta: CardMetadataFromUri = {
			name: json?.name ?? json?.shareTokenMetadata?.name,
			image: json?.image ?? json?.shareTokenMetadata?.image,
			...(Array.isArray(json?.tiers) && json.tiers.length > 0 && { tiers: json.tiers }),
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

/** Resolve EOA to AA address via AA Factory. Returns null if EOA has no AA account. */
export const getAAAccountByEOA = async (eoa: string): Promise<string | null> => {
	if (!eoa?.trim() || !ethers.isAddress(eoa)) return null
	const addr = eoa.trim()
	try {
		const accountFactory = new ethers.Contract(
			contracts.BeamioAAAcountFactory.address,
			BeamioAAAcountFactoryAbi,
			baseEndpoint
		)
		const account = await accountFactory.primaryAccountOf(addr)
		if (account === ethers.ZeroAddress) return null
		const code = await baseEndpoint.getCode(account)
		if (code === '0x') return null
		try {
			const aa = new ethers.Contract(account, ['function factory() view returns (address)'], baseEndpoint)
			await aa.factory()
		} catch (e: any) {
			throw new Error(`getAAAccountByEOA: factory() not available: ${e?.shortMessage ?? e?.message}`)
		}
		return account
	} catch (error: any) {
		console.warn(`[getAAAccountByEOA] RPC failed: ${(error as Error).message}, fallback to API`)
		return fetchAAAccountFromApi(addr)
	}
}

/** When EOA has no deployed AA, predict the AA address via factory.getAddress(creator, 0). Same logic as endpoint createAccountFor. */
export const getPredictedAAAddressByEOA = async (eoa: string): Promise<string | null> => {
	if (!eoa?.trim() || !ethers.isAddress(eoa)) return null
	const addr = ethers.getAddress(eoa.trim())
	try {
		const accountFactory = new ethers.Contract(
			contracts.BeamioAAAcountFactory.address,
			BeamioAAAcountFactoryAbi,
			baseEndpoint
		)
		const getAddressFn = accountFactory.getFunction('getAddress(address,uint256)')
		const predicted = await getAddressFn(addr, 0n)
		if (!predicted || predicted === ethers.ZeroAddress) return null
		return ethers.getAddress(predicted)
	} catch {
		return null
	}
}

export const getAAAccount = async (profile: profile): Promise<string | null> => {
	const eoa = profile?.keyID?.trim()
	if (!eoa || !ethers.isAddress(eoa)) return null
	return getAAAccountByEOA(eoa)
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