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

export const getCryptoPay = async (agentWallet: string, cryptoName: string) => {

	const url = `${payment_endpoint}cryptoPay`

	try {
		const result = await postToEndpoint(url, true, { agentWallet, cryptoName})
		return result
	} catch(ex) {
		console.log("EX: ", ex)
		return null
	}
}