import { ethers, formatUnits, parseUnits } from "ethers"
import { createJupiterApiClient, QuoteGetRequest } from '@jup-ag/api'
import { Connection, PublicKey, Keypair, VersionedTransaction, } from "@solana/web3.js"
import bs58 from "bs58"
import {
	globalAllNodes
	
  } from "../utils/globals"
import { CoNET_Data, setCoNET_Data } from "../utils/globals";
import {
	apiv4_endpoint,
	conetDepinProvider,
	conetProvider,
	localDatabaseName,
	rewardWalletAddress,
	payment_endpoint
  } from "../utils/constants";
import {
	customJsonStringify,
	initProfileTokens,
	isValidSolanaBase58PrivateKey,
	postToEndpoint,
  
} from "../utils/utils"
import {allNodes, getRandomNode} from './mining'
import {
  SilentPassOfficial, Solana_SOL, Solana_SP, Solana_USDT
} from "../utils/constants";

const solanaDecimalPlaces = 9
const usdtDecimalPlaces = 6
const usdcDecimalPlaces = 6
const spDecimalPlaces = 6
const jupiterQuoteApi = createJupiterApiClient()

const tokenDecimal = (tokenAddr: string) => {
	switch(tokenAddr) {
		case Solana_USDT: {
			return usdtDecimalPlaces
		}
		case Solana_SOL: {
			return solanaDecimalPlaces
		}
		case Solana_SP: {
			return spDecimalPlaces
		}
		default: {
			return 18
		}
	}
}

const getTokenQuote = async (from: string, to: string, fromEthAmount: string) => {
	
	const amount = parseUnits(fromEthAmount, tokenDecimal(from))
	const params: QuoteGetRequest = {
		inputMint: from,
		outputMint: to,
		amount: parseFloat(amount.toString()),
		slippageBps: 100
	}
	const quote = await jupiterQuoteApi.quoteGet(params)
	const price_sp = ethers.formatUnits(quote.outAmount, tokenDecimal(to))
	return price_sp
}

type RpcResult<T> = { jsonrpc: string; result: T; id: number; error?: never };
type RpcError = { jsonrpc: string; error: { code: number; message: string }; id: number; result?: never };
function isRpcError<T>(data: RpcResult<T> | RpcError): data is RpcError {
  return "error" in data && data.error !== undefined;
}

// 轮询签名状态
async function pollSignature(
  connection: Connection,
  signature: string,
  interval = 2000,
  timeout = 30_000
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const resp = await connection.getSignatureStatuses([signature]);
	console.log(` pollSignature resp`,resp.value[0])
    const status = resp.value[0]?.confirmationStatus;
    if (status === "confirmed" || status === "finalized") {
      console.log("✅ 交易已确认", signature, status);
      return true;
    }

    await new Promise((r) => setTimeout(r, interval));
  }
  console.warn("⚠️ 签名确认超时", signature);
  return false;
}

export const swapTokens = async (
  fromMint: string,
  toMint: string,
  privateKey: string,
  amountRaw: string
): Promise<false | string> => {
  // 用你的 HTTP RPC 节点
  const rpcUrl = `http://${getRandomNode()}/solana-rpc`;
  // **显式禁用** WebSocket
  const connection = new Connection(rpcUrl, {
    commitment: "confirmed",
    wsEndpoint: ""
  });

  try {
    // 1. 构造 Jupiter 的 quote & swapPayload
    const wallet = Keypair.fromSecretKey(bs58.decode(privateKey));

    const quoteRes = await fetch(
      `http://${getRandomNode()}/jup_ag/v6/quote?` +
        `inputMint=${fromMint}` +
        `&outputMint=${toMint}` +
        `&amount=${amountRaw}` +
        `&restrictIntermediateTokens=true`
    );
    const quoteResponse = await quoteRes.json();

    const swapRes = await fetch(
      `http://${getRandomNode()}/jup_ag/v6/swap`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dynamicComputeUnitLimit: true,
          dynamicSlippage: true,
          prioritizationFeeLamports: {
            priorityLevelWithMaxLamports: {
              maxLamports: 1_000_000,
              priorityLevel: "veryHigh"
            }
          },
          quoteResponse,
          userPublicKey: wallet.publicKey.toString()
        })
      }
    );
    const { swapTransaction } = await swapRes.json();

    // 2. 反序列化并签名
    const tx = VersionedTransaction.deserialize(
      Buffer.from(swapTransaction, "base64")
    );
    tx.sign([wallet]);

    // 3. 拉最新 blockhash + lastValidBlockHeight
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");

    // @ts-ignore
    tx.message.recentBlockhash = blockhash;
    // @ts-ignore
    tx.message.lastValidBlockHeight = lastValidBlockHeight;

    // 4. sendRawTransaction
    const rawTx = tx.serialize();
    const txid = await connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      preflightCommitment: "confirmed"
    });
    console.log("🔍 已发送 txid =", txid);

    // 5. 轮询确认
    const ok = await pollSignature(connection, txid);
    return ok ? txid : false;
  } catch (err) {
    console.error("swapTokens error:", err);
    return false;
  }
}

const getTransaction = (tx: string, SOLANA_CONNECTION: Connection, count = 0): Promise<false|string> => new Promise( async resolve => {
    count ++
    const thash = await SOLANA_CONNECTION.getTransaction(tx,{ maxSupportedTransactionVersion: 0 })
    if (!thash) {
        if (count < 6) {
            return setTimeout(async () => {
                return resolve(await getTransaction(tx, SOLANA_CONNECTION, count))
            }, 1000 * 10 )
        }
        return resolve(false)
    }
    if (!thash.meta?.err) {
        return resolve (tx)
    }
    return resolve (false)
})

export const Sp2SolQuote = async (amount: string) => {
	return await getTokenQuote(Solana_SP, Solana_SOL, amount)
}

export const Sol2SpQuote = async (amount: string) => {
	return await getTokenQuote(Solana_SOL, Solana_SP, amount)
	// const tx = await swapTokens(solanaAddr, spAddr, privateKey, amount, solanaRPC)
}

export const addReferrals = async (referrer: string) => {
	const checkAddr = ethers.isAddress(referrer)
	if (!checkAddr) {
		return false
	}
	if (!CoNET_Data) {
		return false
	}

	const profile = CoNET_Data?.profiles[0]
	if (!profile) {
		return false
	}
	const wallet = new ethers.Wallet(profile.privateKeyArmor)
	const message = JSON.stringify({ walletAddress: profile.keyID, referrer})
	const signMessage = await wallet.signMessage(message)
	const sendData = {
      message, signMessage
    }
	const url = `${payment_endpoint}addReferral`
	const result = await postToEndpoint(url, true, sendData)
	if (!result) {
		return false
	}
	CoNET_Data.profiles[0].referrer = referrer
	setCoNET_Data(CoNET_Data)
	return true
}

