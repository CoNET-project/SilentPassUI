import { ethers } from "ethers";
import contracts from "../utils/contracts";
import { baseEndpoint, USDCContract_BASE, beamioApi, BeamioCardFactorySC,conetDepinProvider } from "../utils/constants";
import { BeamioAAAcountFactoryAbi, cardAbi } from "../utils/abis";
import { searchUsername} from "./beamio"

type Icard = { cardAddress: string, userSignature: string, nonce: string, usdcAmount: string, from: string, validAfter: number, validBefore: number }


export const signOfflineTransferERC3009 = async (
    userPrivateKey: string,
    pointsHuman: string,
    cardAddress: string,
) => {
	const BeamioUserCardGatewayAddress = '0x5b24729E66f13BaB19F763f7aE7A35C881D3d858'
	const signer = new ethers.Wallet(userPrivateKey)
     // 用本机时间生成窗口（注意：链上用 block.timestamp 校验；建议留点容错）
	const now = Math.floor(Date.now() / 1000);
	const validAfter = BigInt(now);                 // 立即生效
	const validBefore = BigInt(now + 3600);   // 3分钟后过期

	// bytes32 nonce：强烈建议每次唯一
	const nonce = ethers.hexlify(ethers.randomBytes(32));
	const tokenID = 0
	const maxAmount = ethers.parseUnits(pointsHuman, 6); // => 1000000n

	// 关键：要和 Solidity abi.encode(...) 一致（这里用 solidityPackedKeccak256）
	// 对应 abi.encode("OpenTransfer", gateway, card, fromEOA, id, maxAmount, validAfter, validBefore, nonce)
	// 注意 string "OpenTransfer" 在 packed 里用 "string"
	const digest = ethers.solidityPackedKeccak256(
		["string", "address", "address", "address", "uint256", "uint256", "uint256", "uint256", "bytes32"],
		["OpenTransfer", BeamioUserCardGatewayAddress, cardAddress, signer.address, tokenID, 1, validAfter, validBefore, nonce]
	);

	// 合约端用了 toEthSignedMessageHash，所以这里用 signMessage(bytes)（EIP-191）
	const signature = await signer.signMessage(ethers.getBytes(digest));

	return {
		fromEOA: signer.address,
		id: tokenID.toString(),
		maxAmount: maxAmount.toString(),
		validAfter: validAfter.toString(),
		validBefore: validBefore.toString(),
		nonce,
		signature,
		digest,
	};
}

export const USDC2Token = async (
    userPrivateKey: string,
    amount: number,
    cardAddress: string
) => {

	const _quoteUsdcAmount = await quoteUSDCForPoints(cardAddress, amount.toString())
    try {


        const userWallet = new ethers.Wallet(userPrivateKey, baseEndpoint);
        const usdcAmount6 = _quoteUsdcAmount.usdc6
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
			validBefore: validBefore
		}

        return ret;

    } catch (error: any) {
        console.log(`❌ Direct Purchase Failed: ${error.message}`);
        throw error;
    }
}

export const quoteUSDCForPoints = async (
	cardAddress: string,
	pointsHuman: string   // ✅ 人类可读，例如 "10" / "1.5"
  ) => {
	const factory = BeamioCardFactorySC
  
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
  
	// 2️⃣ quote 总价（USDC 6 decimals）
	const usdc6: bigint = await factory.quotePointsInUSDC6(cardAddress, points6);
	if (usdc6 === 0n) {
	  throw new Error("quote=0 (oracle not configured or card invalid)");
	}
  
	// 3️⃣ 单价（1 token = 1e6 points）
	const unitPriceUSDC6: bigint =
	  await factory.quoteUnitPointInUSDC6(cardAddress);
  
	const ret = {
	  // 原始输入
	  points: pointsHuman,
  
	  // 链上单位
	  points6,                     // bigint (1e6)
  
	  // 总价
	  usdc6,                       // bigint (1e6)
	  usdc: ethers.formatUnits(usdc6, 6),
  
	  // 单价
	  unitPriceUSDC6,              // bigint
	  unitPriceUSDC: ethers.formatUnits(unitPriceUSDC6, 6),
	};
  
	
	return ret;
  }

const purchasingCardEndpoint = `${beamioApi}/api/purchasingCard`

/** 互斥锁：同一时间只允许一个 postBuyCardPoints 执行 */
let postBuyCardPointsLock = false

export const postBuyCardPoints = async (
    amount: number,
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
            const request = await USDC2Token(profile.privateKeyArmor, amount, cardAddress)
            const response = await fetch(purchasingCardEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(request)
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

export const getMyAssets = async (profile: profile, cardAddress: string): Promise<MyCardAssets | null> => {
    try {
		if (!profile.aaAccount) {
			const aa = await getAAAccount(profile)
			if (!aa) {
				return null
			}
			profile.aaAccount = aa
		}
        // 1. 实例化合约（只需要 getOwnership 函数的定义）
        const cardContract = new ethers.Contract(
            cardAddress,
            cardAbi,
            baseEndpoint // 使用你之前的 provider
        );

        

        // 2. 调用合约方法
        const [pointsBalance, nfts] = await cardContract.getOwnership(profile.aaAccount);
		const currency =  getICurrency(await cardContract.currency())

        // 3. 格式化数据并返回
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
			cardCurrency: currency
        }

        // 打印结果
        console.table(result.nfts)
        
        return result;

    } catch (error: any) {
    
        throw error;
    }
}

const getICurrency = (currency: BigInt): ICurrency => {
	switch (currency) {
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



export const getAAAccount = async (profile: profile): Promise<string | null> => {
    try {
        const accountFactory = new ethers.Contract(
            contracts.BeamioAAAcountFactory.address,
            BeamioAAAcountFactoryAbi,
            baseEndpoint
        )
        const account = await accountFactory.primaryAccountOf(profile.keyID)
		if (account === ethers.ZeroAddress) {
			return null
		}
		const code = await baseEndpoint.getCode(account);
        if (code === "0x") {
            return null
        }

        return account
    } catch (error: any) {
        console.log(`❌ getAAAccount Failed: ${error.message}`);
		return null
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
	cardAddress: string
) => {
	const facet = new ethers.Contract(contracts.BeamioDiamond.address, contracts.BeamioDiamond.abi.ActionFacet, conetDepinProvider);
  
	const total: bigint = await facet.getUserActionsCount(profile.keyID);
	if (total === 0n) return [];

	const limit = 20n;
	const offset = total > limit ? total - limit : 0n;

	const idsRaw = await facet.getUserActionIdsPaged(profile.keyID, offset, limit);
	// ethers 返回的 Result 为只读，需复制为可变数组再 reverse
	const ids: bigint[] = [...idsRaw].reverse(); // 最新在前

	const rows: BeamioActionResponse[] = await Promise.all(
		ids.map(async (id) => {
			const [action, meta] = await facet.getActionWithMeta(id);
			return mapActionToBeamioResponse({ action, meta });
		})
	);

	const cardLower = cardAddress.toLowerCase();
	return rows.filter((r) => (r.cardAddress || "").toLowerCase() === cardLower);
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