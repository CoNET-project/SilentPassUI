import { ethers } from "ethers";
import contracts from "../utils/contracts";
import { baseEndpoint, USDCContract_BASE, beamioApi, BeamioCardFactorySC,conetDepinProvider, CCSA_Card_Address } from "../utils/constants";
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



/**
 * 
 * 	const now = BigInt(Math.floor(Date.now() / 1000))
	const validAfter = now - BigInt(60)
	const validBefore = now + BigInt(60)   
 */
/** AA Factory 作为 UserCard gateway（与 config/base-addresses AA_FACTORY 一致） */
const BeamioUserCardGatewayAddress = '0xD86403DD1755F7add19540489Ea10cdE876Cc1CE'.toLowerCase()
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

/** 当前使用的 Card Factory 地址（须与 contracts.BeamioCardFactory 一致，为新部署 0x7Ec82...） */
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
const executeForOwnerEndpoint = `${beamioApi}/api/executeForOwner`
const cardCreateRedeemEndpoint = `${beamioApi}/api/cardCreateRedeem`
const cardRedeemEndpoint = `${beamioApi}/api/cardRedeem`
const cardAddAdminEndpoint = `${beamioApi}/api/cardAddAdmin`

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
 * - trusted=false：RPC 与 API 均失败，返回 profile.issuedCards 作为缓存，UI 不可信空 []。 */
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
	if (owners.length === 0) return { cards: [], trusted: false }

	const cached = profile?.issuedCards ?? []
	const seen = new Set<string>()
	const merged: UserCardInfo[] = []

	// 0. RPC 熔断期：仅使用 CoNET 节点，不向 API 请求
	// （withBaseRpc 内部会走 CoNET-only）

	// 1. 尝试 RPC（正常时 CoNET 优先 + 公共 RPC，限流时仅 CoNET）
	try {
		for (const owner of owners) {
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
		return { cards: merged, trusted: true }
	} catch (e) {
		if (isRpcQuotaOrNetworkError(e)) reportRpcFailure()
		// 2. RPC 失败，尝试 API
		try {
			const apiItems = await fetchMyCardsFromApi(owners)
			return { cards: apiItems, trusted: true }
		} catch {
			// 3. RPC 与 API 均失败，返回 profile 缓存的卡，不信任空 []
			return { cards: cached, trusted: false }
		}
	}
}

/** ERC-1155 shareTokenMetadata，写入 0x{owner}.json */
export type ShareTokenMetadata = {
	name: string
	description?: string
	image?: string
}

/** Tier 类型 metadata，存于 0x{owner}.json，回送 {NFT}.json 时包含 */
export type TierMetadata = {
	index: number
	minUsdc6: string
	attr: number
	name?: string
	description?: string
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
			...(params.shareTokenMetadata && { shareTokenMetadata: params.shareTokenMetadata }),
			...(params.tiers && params.tiers.length > 0 && { tiers: params.tiers }),
		})
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

/** EIP-712 签名：Owner 授权 executeForOwner(cardAddr, data, deadline, nonce)。通用接口，支持 createRedeem、cancelRedeem 等。 */
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

const addAdminInterface = new ethers.Interface([
    'function addAdmin(address newAdmin, uint256 newThreshold)',
])

/** 构建 addAdmin 的 calldata（供 executeForOwner 使用）。newAdmin 必须为 EOA，newThreshold 为所需签名数（通常 1） */
export const encodeAddAdmin = (newAdmin: string, newThreshold: number | bigint): string =>
    addAdminInterface.encodeFunctionData('addAdmin', [newAdmin, BigInt(newThreshold)])

/** 提交 addAdmin 到 API cardAddAdmin。Cluster 预检 newAdmin 为 EOA 后转发 Master executeForOwner 排队，返回 tx hash */
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
            'function owner() view returns (address)',
            'function currency() view returns (uint8)',
            'function pointsUnitPriceInCurrencyE6() view returns (uint256)',
        ]

		const rpcEndpoint = baseEndpoint
        const card = new ethers.Contract(cardAddress, cardAbiExtended, rpcEndpoint)
        const hashBytes32 = hash.length === 66 && hash.startsWith('0x') ? hash as `0x${string}` : hash as `0x${string}`

        const [[active, totalPoints6], owner, currencyNum, priceE6Raw] = await Promise.all([
            card.getRedeemStatus(hashBytes32),
            card.owner(),
            card.currency(),
            card.pointsUnitPriceInCurrencyE6(),
        ])

        // 合约仅存储 active，无法区分 redeemed/cancelled；API 有缓存且同样依赖合约。
        // 以链上 active 为唯一可信来源，避免 API 缓存导致“已取消仍显示 Valid”的不一致。
        const status = _decodeRedeemStatus(active)

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
	try {
		const accountFactory = new ethers.Contract(
			contracts.BeamioAAAcountFactory.address,
			BeamioAAAcountFactoryAbi,
			baseEndpoint
		)
		const account = await accountFactory.primaryAccountOf(eoa)
		if (account === ethers.ZeroAddress) return null
		const code = await baseEndpoint.getCode(account)
		if (code === '0x') return null
		try {
			const aa = new ethers.Contract(account, ['function factory() view returns (address)'], baseEndpoint)
			await aa.factory()
		} catch (e: any) {
			throw new Error(`getAAAccount: factory() not available: ${e?.shortMessage ?? e?.message}`)
		}
		return account
	} catch (error: any) {
		console.warn(`[getAAAccount] RPC failed: ${error.message}, fallback to API`)
		return fetchAAAccountFromApi(eoa)
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