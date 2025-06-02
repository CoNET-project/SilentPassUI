import {
	postToEndpoint,
} from "../utils/utils";

import {
	payment_endpoint,
	apiv4_endpoint
} from "../utils/constants";

import {ethers} from 'ethers'
import { CoNET_Data } from "../utils/globals";
const getCryptoPayUrl = `${payment_endpoint}cryptoPay`
const waitingPayUrl = `${payment_endpoint}cryptoPayment_waiting`
let listening: NodeJS.Timeout|null = null

export const getCryptoPay = async (cryptoName: string, plan: string): Promise<null|{transferNumber: string, wallet: string}> => {
	if (listening) {
		clearTimeout(listening)
	}
	const profiles = CoNET_Data?.profiles
	if (!profiles) {
		return null
	}
	
	try {
		const result = await postToEndpoint(getCryptoPayUrl, true, { agentWallet: profiles[0].referrer, cryptoName, plan, solana: profiles[1].keyID, walletAddress: profiles[0].keyID.toLowerCase()})
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

const airDropForSPUrl = `${apiv4_endpoint}airDropForSP`

let airDropForSPProcess = false



let airDropStatus: null | airDropStatus = null
export const airDropForSP = async (): Promise<airDropStatus|false> => {
	if (airDropStatus !== null) {
		return airDropStatus
	}
	  if (!CoNET_Data?.profiles || airDropForSPProcess) {

		return false
	  }


	  airDropForSPProcess = true
	  const profile = CoNET_Data.profiles[0]
	  const solanaWallet = CoNET_Data.profiles[1].keyID
	  try {
		const message = JSON.stringify({ walletAddress: profile.keyID, solanaWallet})
		const wallet = new ethers.Wallet(profile.privateKeyArmor)
		const signMessage = await wallet.signMessage(message)
		const sendData = {
		  message, signMessage
		}
	
		const result = await postToEndpoint(airDropForSPUrl, true, sendData)
		const status = result?.status
		if (status) {
			airDropStatus = status
			return status
		}
		
		return false
	  } catch (ex) {
		console.log(ex)
		return false
	  }
}

const getAirDropForSPUrl = `${payment_endpoint}getAirDropForSP`

let getAirDropForSPProcess = false


export const getirDropForSP = async (): Promise<boolean|number> => {
	  if (!CoNET_Data?.profiles || getAirDropForSPProcess || airDropForSPProcess === false) {
		return false
	  }

	  const profile = CoNET_Data.profiles[0]
	  const solanaWallet = CoNET_Data.profiles[1].keyID
	  try {
		const message = JSON.stringify({ walletAddress: profile.keyID, solanaWallet})
		const wallet = new ethers.Wallet(profile.privateKeyArmor)
		const signMessage = await wallet.signMessage(message)
		const sendData = {
		  message, signMessage
		}
	
		const result = await postToEndpoint(getAirDropForSPUrl, true, sendData)
		if (airDropStatus) {
			airDropStatus.isReadyForSP = false
		}

		if (result?.amount) {
			return result.amount
		}
		
		return false
	  } catch (ex) {
		console.log(ex)
		return false
	  }
}

let getirDropForSPReffProcess = false
const getAirDropForSPReffUrl = `${payment_endpoint}getAirDropForSPReff`

export const getirDropForSPReff = async (referrer: string): Promise<boolean|number> => {
	  if (!CoNET_Data?.profiles || getirDropForSPReffProcess) {
		return false
	  }

	  getirDropForSPReffProcess = true

	  const isAddr = ethers.isAddress(referrer)
	  if (!isAddr) {
		getirDropForSPReffProcess = false
		return false
	  }

	  const profile = CoNET_Data.profiles[0]
	  const solanaWallet = CoNET_Data.profiles[1].keyID

	  try {
		const message = JSON.stringify({ walletAddress: profile.keyID, solanaWallet, referrer })
		const wallet = new ethers.Wallet(profile.privateKeyArmor)
		const signMessage = await wallet.signMessage(message)
		const sendData = {
		  message, signMessage
		}
	
		const result = await postToEndpoint(getAirDropForSPReffUrl, true, sendData)
		
		getirDropForSPReffProcess = false
		if (result?.status) {

			if (airDropStatus) {
				airDropStatus.isReadyForReferees = false
			}

			return result.amount
		}

		
		return false
	  } catch (ex) {
		getirDropForSPReffProcess = false
		console.log(ex)
		return false
	  }
}