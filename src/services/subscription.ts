import {getCONET_api_health} from './wallets'
import {
	aesGcmDecrypt,
	customJsonStringify,
	initProfileTokens,
	isValidSolanaBase58PrivateKey,
	postToEndpoint,
  } from "../utils/utils";

import {
	payment_endpoint,
  } from "../utils/constants";
const getCryptoPayUrl = `${payment_endpoint}cryptoPay`
const waitingPayUrl = `${payment_endpoint}cryptoPayment_waiting`
export const getCryptoPay = async (agentWallet: string, cryptoName: string) => {

	

	try {
		const result = await postToEndpoint(getCryptoPayUrl, true, { agentWallet, cryptoName})
		return result
	} catch(ex) {
		console.log("EX: ", ex)
		return null
	}
}


const _waitingPay = async (uuid: string) => {
	try {
		const result = await postToEndpoint(waitingPayUrl, true, { uuid })
		return result
	} catch(ex) {
		console.log("EX: ", ex)
		return false
	}
}

export const waitingPay = (uuid: string): Promise<any> => new Promise(async resolve => {
	const status = await _waitingPay(uuid)
	if (!status) {
		return resolve(false)
	}
	if (status.status ===1) {
		return setTimeout(async () => {
			return resolve(await waitingPay (uuid))
		}, 15 * 1000)
	}
	resolve(status)
})