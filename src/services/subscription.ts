import {
	postToEndpoint,
} from "../utils/utils";

import {
	payment_endpoint,
	apiv4_endpoint,
	
} from "../utils/constants"
import { refreshSolanaBalances, storeSystemData } from './wallets'
import contracts from "../utils/contracts";
import anchor_linear_vesting_del from '../utils/anchor_linear_vesting.json'
import {AnchorLinearVesting} from '../utils/anchor_linear_vesting'
import {ethers} from 'ethers'
import { CoNET_Data, setCoNET_Data } from "../utils/globals"
import { PublicKey, Transaction, VersionedTransaction} from '@solana/web3.js'
import Bs58 from 'bs58'

import {
  AnchorProvider,
  Program,
  BN,
  web3,
  Wallet
} from "@coral-xyz/anchor"

import {allNodes} from './mining'

const uuid62 = require('uuid62')

interface CompatibleWallet {
	publicKey: PublicKey;
	signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
	signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
}

const getCryptoPayUrl = `${payment_endpoint}cryptoPay`

const TOKEN_MINT = new web3.PublicKey(contracts.SPToken.address)


export const getCryptoPay = async (cryptoName: string, plan: string): Promise<null|{transferNumber: string, wallet: string}> => {
	
	const profiles = CoNET_Data?.profiles
	if (!profiles) {
		return null
	}

	const message = JSON.stringify({ walletAddress:  profiles[0].keyID.toLowerCase(), solanaWallet: profiles[1].keyID, data: {cryptoName, plan}})
	const wallet = new ethers.Wallet(profiles[0].privateKeyArmor)
	const signMessage = await wallet.signMessage(message)
	const sendData = {
      message, signMessage
    }
	try {
		const result = await postToEndpoint(getCryptoPayUrl, true, sendData)
		return result
	} catch(ex) {
		console.log("EX: ", ex)
		return null
	}
}

export const initDuplicate = async () => {
	if (!CoNET_Data) {
		return
	}
	
	const pass = CoNET_Data.duplicateCode = CoNET_Data?.duplicateCode || uuid62.v4()
	CoNET_Data.duplicateCodeHash = ethers.solidityPackedKeccak256(['string'], [CoNET_Data.duplicateCode])
	
	CoNET_Data.encryptedString = await aesGcmEncrypt(CoNET_Data.mnemonicPhrase, pass)
	if (!CoNET_Data?.duplicateAccount) {
		ethers.ZeroAddress
	}
	setCoNET_Data(CoNET_Data)
	storeSystemData()
}

export const checkWallet = (wallet: string) => {
	return ethers.isAddress(wallet)
}



const airDropForSPUrl = `${apiv4_endpoint}airDropForSP`
const SP_tokenDecimals = 6
let airDropForSPProcess = false
const PROGRAM_ID = new web3.PublicKey(anchor_linear_vesting_del.address)


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
			
			CoNET_Data.profiles[0].referrer = referrer
			setCoNET_Data(CoNET_Data)
			
			return result.amount
		}

		
		return false
	  } catch (ex) {
		getirDropForSPReffProcess = false
		console.log(ex)
		return false
	  }
}

interface CompatibleWallet {
  publicKey: PublicKey
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>
  payer: web3.Keypair
}

export const getBalanceFromPDA = async (solanaRPC_url: string, spToken: CryptoAsset, VESTING_ID = 0) => {
    if (!CoNET_Data?.profiles||!allNodes) {
		return
	}
	
	const BENEFICIARY_privatekey =  CoNET_Data.profiles[1].privateKeyArmor
	const BENEFICIARY_bs58 = Bs58.decode(BENEFICIARY_privatekey)
	const BENEFICIARY =  web3.Keypair.fromSecretKey(BENEFICIARY_bs58)
       // STEP 1: Derive PDA

    const [vestingPda] = await PublicKey.findProgramAddressSync([
		Buffer.from("vesting"), 
		BENEFICIARY.publicKey.toBuffer(), 
		TOKEN_MINT.toBuffer(), 
		Uint8Array.of(VESTING_ID)],
        PROGRAM_ID
    )

    const anchorConnection = new web3.Connection(solanaRPC_url)

	const anchorWallet: CompatibleWallet = {
		publicKey: BENEFICIARY.publicKey,
		payer: BENEFICIARY,
		signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
			return tx
		},
		signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
			// Sign logic (again, for mock you can return txs unchanged)
			return txs;
		}
	}

    const anchorProvider = new AnchorProvider(anchorConnection, anchorWallet, {
        preflightCommitment: 'confirmed'
    })


    const program = new Program(anchor_linear_vesting_del as AnchorLinearVesting, anchorProvider)
    
    // 3. Fetch balance
    try {
		//@ts-ignore
        const vestingAccount =  await program.account.vestingAccount.fetch(vestingPda)
		

        // ───────────── Get “now” timestamp ─────────────
        const latestSlot = await anchorProvider.connection.getSlot()
        const nowTs = await anchorProvider.connection.getBlockTime(latestSlot)
        if (nowTs === null) {
            throw new Error("Failed to fetch block time")
        }

        // ───────────── Convert BN → BigInt/number ─────────────
        const _startTime = vestingAccount.startTime.toNumber() // UNIX seconds
        const releaseDuration = vestingAccount.releaseDuration.toNumber() // seconds

        // BN → BigInt:
        const _totalAmount = BigInt(vestingAccount.totalAmount.toString())
        const _claimedAmount = BigInt(vestingAccount.claimedAmount.toString())

        // ───────────── Compute “claimable” ─────────────
        const elapsed = nowTs - _startTime


        let vested: bigint;
        if (elapsed < 0 || elapsed >= releaseDuration ) {
            vested = _totalAmount
        } else {
            vested = (_totalAmount * BigInt(elapsed)) / BigInt(releaseDuration)
        }

        const _claimableAmount = vested > _claimedAmount ? vested - _claimedAmount : BigInt(0)
		const claimableAmount = parseFloat(ethers.formatUnits(_claimableAmount, SP_tokenDecimals))
		const totalAmount = parseFloat(ethers.formatUnits(_totalAmount, SP_tokenDecimals))
		const claimedAmount = parseFloat(ethers.formatUnits(_claimedAmount, SP_tokenDecimals))
		const startTime = new Date(_startTime * 1000)
		const lockedAmount = totalAmount-claimedAmount
        console.log("─ VestingAccount data ─────────────────")
        console.log("startTime (unix):", startTime)
        console.log("releaseDuration:", releaseDuration, "sec")
        console.log("totalAmount (raw):", totalAmount)
        console.log("claimedAmount (raw):", claimedAmount)
        console.log("Now (unix):", new Date(nowTs*1000))
        console.log("Elapsed (sec):", elapsed)
        console.log("Vested so far (raw):", ethers.formatUnits(vested, SP_tokenDecimals))

		if (!VESTING_ID || !spToken.staking) {
			spToken.staking = []
		}
		if (VESTING_ID === 16) {
			console.log('17')
		}
		if (lockedAmount) {
			spToken.staking.push({
				totalAmount,
				startTime,
				claimedAmount,
				releaseDuration,
				claimableAmount,
				lockedAmount 
			})

			spToken.balance1 = spToken.balance1 || 0
			spToken.balance1 +=  lockedAmount
			spToken.balance = (spToken.balance1 >= 1_000_000) ? (spToken.balance1/1_000_000).toFixed(2) + 'M' : spToken.balance1.toFixed(2)
		}

		await getBalanceFromPDA(solanaRPC_url, spToken, ++VESTING_ID )

    } catch (ex) {
		if (!VESTING_ID) {
			spToken.staking = []
		}
        console.log(`getBalanceFromPDA Error!`)
    }

}

export const aesGcmEncrypt = async (plaintext: string, password: string) => {
	const pwUtf8 = new TextEncoder().encode(password)                                 // encode password as UTF-8
	const pwHash = await crypto.subtle.digest('SHA-256', pwUtf8)                      // hash the password

	const iv = crypto.getRandomValues(new Uint8Array(12))                             // get 96-bit random iv
	const ivStr = Array.from(iv).map(b => String.fromCharCode(b)).join('')            // iv as utf-8 string

	const alg = { name: 'AES-GCM', iv: iv }                                           // specify algorithm to use

	const key = await crypto.subtle.importKey('raw', pwHash, alg, false, ['encrypt']) // generate key from pw

	const ptUint8 = new TextEncoder().encode(plaintext)                               // encode plaintext as UTF-8
	const ctBuffer = await crypto.subtle.encrypt(alg, key, ptUint8)                   // encrypt plaintext using key

	const ctArray = Array.from(new Uint8Array(ctBuffer))                              // ciphertext as byte array
	const ctStr = ctArray.map(byte => String.fromCharCode(byte)).join('')             // ciphertext as string

	return btoa(ivStr+ctStr)   
}

export const aesGcmDecrypt= async (ciphertext: string, password: string) => {
	const pwUtf8 = new TextEncoder().encode(password)                                 // encode password as UTF-8
	const pwHash = await crypto.subtle.digest('SHA-256', pwUtf8)                      // hash the password

	const ivStr = atob(ciphertext).slice(0,12)                                        // decode base64 iv
	const iv = new Uint8Array(Array.from(ivStr).map(ch => ch.charCodeAt(0)))          // iv as Uint8Array

	const alg = { name: 'AES-GCM', iv: iv }                                           // specify algorithm to use

	const key = await crypto.subtle.importKey('raw', pwHash, alg, false, ['decrypt']) // generate key from pw

	const ctStr = atob(ciphertext).slice(12)                                          // decode base64 ciphertext
	const ctUint8 = new Uint8Array(Array.from(ctStr).map(ch => ch.charCodeAt(0)))     // ciphertext as Uint8Array
	// note: why doesn't ctUint8 = new TextEncoder().encode(ctStr) work?

	try {
		const plainBuffer = await crypto.subtle.decrypt(alg, key, ctUint8)            // decrypt ciphertext using key
		const plaintext = new TextDecoder().decode(plainBuffer)                       // plaintext from ArrayBuffer
		return plaintext                                                              // return the plaintext
	} catch (e) {
		throw new Error('Decrypt failed')
	}
}