
import {
	postToEndpoint,
  } from "../utils/utils";

import {
	payment_endpoint,
  } from "../utils/constants";

import {ethers} from 'ethers'
const getCryptoPayUrl = `${payment_endpoint}cryptoPay`
const waitingPayUrl = `${payment_endpoint}cryptoPayment_waiting`
let listening: NodeJS.Timeout|null = null
export const getCryptoPay = async (agentWallet: string, cryptoName: string, plan: string) => {
	if (listening) {
		clearTimeout(listening)
	}
	
	try {
		const result = await postToEndpoint(getCryptoPayUrl, true, { agentWallet, cryptoName, plan})
		return result
	} catch(ex) {
		console.log("EX: ", ex)
		return null
	}
}


const _waitingPay = async (wallet: string) => {

	try {
		const result = await postToEndpoint(waitingPayUrl, true, { wallet })
		return result
	} catch(ex) {
		console.log("EX: ", ex)
		return false
	}
}

export const waitingPaymentReady = (wallet: string): Promise<any> => new Promise(async resolve => {
	if (listening) {
		clearTimeout(listening)
	}
	const status = await _waitingPay(wallet)
	if (!status) {
		return resolve(false)
	}
	if (status.status ===1) {
		return listening = setTimeout(async () => {
			return resolve(await waitingPaymentReady (wallet))
		}, 15 * 1000)
	}
	resolve(status)
})

export const checkWallet = (wallet: string) => {
	return ethers.isAddress(wallet)
}

export const clearWaiting = () => {
	if (listening) {
		clearTimeout(listening)
	}
}