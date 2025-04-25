import { ethers, formatUnits, parseUnits } from "ethers"
import { createJupiterApiClient, QuoteGetRequest } from '@jup-ag/api'
import { Connection, PublicKey, Keypair, VersionedTransaction } from "@solana/web3.js"
import bs58 from "bs58"
import {
	globalAllNodes
  } from "../utils/globals"
import {
  SilentPassOfficial
} from "../utils/constants";

export const solanaAddr = "So11111111111111111111111111111111111111112"
export const spAddr = "Bzr4aEQEXrk7k8mbZffrQ9VzX6V3PAH4LvWKXkKppump"
const usdcAddr = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const usdtAddr = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
const solanaDecimalPlaces = 9
const usdtDecimalPlaces = 6
const usdcDecimalPlaces = 6
const spDecimalPlaces = 6
const jupiterQuoteApi = createJupiterApiClient()

const tokenDecimal = (tokenAddr: string) => {
	switch(tokenAddr) {
		case usdtAddr: {
			return usdtDecimalPlaces
		}
		case solanaAddr: {
			return solanaDecimalPlaces
		}
		case spAddr: {
			return spDecimalPlaces
		}
		case usdcAddr: {
			return usdcDecimalPlaces
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



export const swapTokens = async (from: string, to: string, privateKey: string, fromEthAmount: string): Promise<string> => new Promise(async resolve => {
	const wallet = Keypair.fromSecretKey(bs58.decode(privateKey))
	const amount = ethers.parseUnits(fromEthAmount, tokenDecimal(from))
	const _node1 = globalAllNodes[Math.floor(Math.random() * (globalAllNodes.length - 1))]
	const SOLANA_CONNECTION = new Connection(`https://${_node1.domain}/solana-rpc`, "confirmed")
	const quoteResponse = await (await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${from}&outputMint=${to}&amount=${amount}&slippageBps=250`)).json()
	const { swapTransaction } = await (
		await fetch('https://quote-api.jup.ag/v6/swap', {
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({
				// quoteResponse from /quote api
				quoteResponse,
				// user public key to be used for the swap
				userPublicKey: wallet.publicKey.toString(),
				// auto wrap and unwrap SOL. default is true
				wrapAndUnwrapSol: true
				// Optional, use if you want to charge a fee.  feeBps must have been passed in /quote API.
				// feeAccount: "fee_account_public_key"
			})
		})).json()

	const swapTransactionBuf = Buffer.from(swapTransaction, 'base64')
	const transaction = VersionedTransaction.deserialize(swapTransactionBuf)
	// get the latest block hash
	const latestBlockHash = await SOLANA_CONNECTION.getLatestBlockhash()
	transaction.sign([wallet])
	// Execute the transaction
	const rawTransaction = transaction.serialize()
	const txid = await SOLANA_CONNECTION.sendRawTransaction(rawTransaction, {
		skipPreflight: true,
		maxRetries: 2
	})
	resolve (txid)
	try {
		await SOLANA_CONNECTION.confirmTransaction({
			blockhash: latestBlockHash.blockhash,
			lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
			signature: txid
		})
	} catch (ex) {

	}
	

})

export const Sp2SolQuote = async (amount: string) => {
	return await getTokenQuote(spAddr, solanaAddr, amount)
}

export const Sol2SpQuote = async (amount: string) => {
	return await getTokenQuote(solanaAddr, spAddr, amount)
	// const tx = await swapTokens(solanaAddr, spAddr, privateKey, amount, solanaRPC)
}

