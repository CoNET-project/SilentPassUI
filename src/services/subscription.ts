import {
	postToEndpoint, initProfileTokens
} from "../utils/utils";
import axios, { AxiosResponse } from "axios"
import {
	payment_endpoint,
	apiv4_endpoint,
	conetDepinProvider
} from "../utils/constants"
import { refreshSolanaBalances, initSolana, storeSystemData, createOrGetWallet } from './wallets'
import contracts from "../utils/contracts";
import anchor_linear_vesting_del from '../utils/anchor_linear_vesting.json'
import {AnchorLinearVesting} from '../utils/anchor_linear_vesting'
import {ethers} from 'ethers'
import { CoNET_Data, setCoNET_Data } from "../utils/globals"
import { PublicKey, Transaction, VersionedTransaction, Keypair, Connection, SendTransactionError} from '@solana/web3.js'
import Bs58 from 'bs58'
import {
  AnchorProvider,
  Program,
  BN,
  web3,
  Wallet
} from "@coral-xyz/anchor"


import {changeStopProcess} from './listeners'

const uuid62 = require('uuid62')
const duplicate = contracts.Duplicate
const duplicate_readOnly = new ethers.Contract(duplicate.address, duplicate.abi, conetDepinProvider)

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

const getEncryptoData = async (restoreCode: string): Promise<string> => {

	try {
		const ret = await duplicate_readOnly.getEncryptoString(restoreCode)
		return ret
	} catch (ex) {
		return ''
	}
}

const restoreAPI = `${apiv4_endpoint}restore`

const tryTest = async (address: string, code: string) => {
	try {
		const [isCode, duplicateAddress] = await Promise.all([
			duplicate_readOnly.isRestore(code),
			duplicate_readOnly.duplicateList(address)
		])
		return ({isCode, duplicateAddress})
	} catch (ex) {
		return null
	}
}
export const restoreAccount = async (passcode: string, password: string, temp: encrypt_keys_object, setProfiles: (profiles: any) => void): Promise<boolean> => {
	if (!temp || !temp?.duplicateAccount||!temp?.profiles) {
		return false
	}

	const profiles = temp.profiles


	const finish = async (duplicateAddress : string, solanaWallet: {publicKey: string, privateKey: string} ) => {
		if (!temp || !temp?.duplicateAccount) {
			return false
		}
		changeStopProcess(true)
		temp.duplicateAccount.keyID = duplicateAddress
		temp.profiles[1].keyID = solanaWallet.publicKey
		temp.profiles[1].privateKeyArmor = solanaWallet.privateKey
		//		reset duplicateCode
		temp.duplicateCode = temp.duplicatePassword = ''
		temp.mnemonicPhrase = temp.duplicateMnemonicPhrase = restoreMnemonicPhrase

		await setCoNET_Data(temp)
		await storeSystemData()
		await setProfiles(temp.profiles)
		setTimeout(() => {
			changeStopProcess(false)
		}, 15000)
	}


	const ret = await tryTest(profiles[0].keyID, passcode)

		//		already backuped
	if (ret && ret.isCode === false ) {
		const duplicateAddress = ret.duplicateAddress.toLowerCase()
		if ( duplicateAddress !== ethers.ZeroAddress && temp.duplicateAccount.keyID.toLowerCase() !== duplicateAddress) {
			if (temp?._duplicateCode) {
				let solanaWallet
				const restoreEncryptoText = await getEncryptoData(temp._duplicateCode)
				if (!restoreEncryptoText) {
					return false
				}
				
				try {
					const restoreMnemonicPhrase = await aesGcmDecrypt(restoreEncryptoText, temp._duplicateCode + temp.duplicatePassword)
					if (!restoreMnemonicPhrase) {
						return false
					}

					solanaWallet = await initSolana(restoreMnemonicPhrase)
					
				} catch (ex) {
					return false
				}
				if (!solanaWallet) {
					return false
				}
				
				await finish(ret.duplicateAddress, solanaWallet)
				return true
			}
		}
		return false
	}

	const restoreEncryptoText = await getEncryptoData(passcode)
	if (!restoreEncryptoText) {
		return false
	}

	let restoreMnemonicPhrase = ''
	try {
		restoreMnemonicPhrase = await aesGcmDecrypt(restoreEncryptoText, passcode + password)
		if (!restoreMnemonicPhrase) {
			return false
		}
		
		
	} catch (ex) {
		return false
	}
	const solanaWallet = await initSolana(restoreMnemonicPhrase)
	if (!solanaWallet || !temp?._duplicateCode) {
		return false
	}

	const pass = temp._duplicateCode
	temp.encryptedString = await aesGcmEncrypt(restoreMnemonicPhrase, pass)

	const message = JSON.stringify({ walletAddress: profiles[0].keyID, uuid: temp.duplicateCodeHash, data: temp.encryptedString, hash: passcode })
	const wallet = new ethers.Wallet(profiles[0].privateKeyArmor)
	const signMessage = await wallet.signMessage(message)
	const sendData = {
		message, signMessage
	}
	
	const result = await postToEndpoint(restoreAPI, true, sendData)
	if (!result|| !result?.status) {
		console.log(`initDuplicate Error!`, result?.error)
		changeStopProcess(false)
		return false
	}

	if (ethers.isAddress(result.status)) {
		await finish (result.status, solanaWallet)
	}
	
	return true

}

const gettNumeric = (token: string) => {
	switch (token) {
		default: {
			return 6
		}
		case 'So11111111111111111111111111111111111111112': {
			return 9
		}
		
	}
}


export const getPriceFromUp2Down = async (upMint: string, downputMint: string, _amount: number, node: nodes_info): Promise<string> => {
	const amount = ethers.parseUnits(_amount.toString(), gettNumeric(upMint))
	const slippageBps = 250 // 0.5% slippage
	const quoteUrl = `http://${node.ip_addr}/jup_ag/swap/v1/quote?inputMint=${upMint}&outputMint=${downputMint}&amount=${amount}&slippageBps=${slippageBps}`
	try {
        const quoteResponse = await axios.get(quoteUrl)
        const quote = quoteResponse.data
        const price = ethers.formatUnits(quote.outAmount, gettNumeric(downputMint))
        return price
    } catch (ex) {
    	
    }
    return ''
}


export const getPriceFromDown2Up = async (upMint: string, downputMint: string, _amount: number, node: nodes_info): Promise<string> => {
	const amount = parseInt(ethers.parseUnits(_amount.toString(), gettNumeric(upMint)).toString())
	const slippageBps = 250 
	const quoteUrl = `http://${node.ip_addr}/jup_ag/swap/v1/quote?inputMint=${downputMint}&outputMint=${upMint}&amount=${amount}&slippageBps=${slippageBps}&swapMode=ExactOut`
	try {
        const quoteResponse = await axios.get(quoteUrl)
        const quote = quoteResponse.data
        const price = ethers.formatUnits(quote.otherAmountThreshold, gettNumeric(downputMint))
        return price
    } catch (ex) {
    	
    }
    return ''
	
}

const getDuplicateOwnership = async(duplicateAccount: string, keyID: string): Promise<boolean|null> => {
	try {
		const owner = await duplicate_readOnly.duplicateList(keyID)
		if (owner === ethers.ZeroAddress || duplicateAccount.toLowerCase() !== owner.toLowerCase()) {
			return false
		}
		return true
	} catch (ex) {
		return null
	}

}

const duplicateAPI = `${apiv4_endpoint}duplicate`
export const initDuplicate = async (temp: encrypt_keys_object): Promise<encrypt_keys_object|null> => {
	
	temp._duplicateCode = temp?._duplicateCode || uuid62.v4()
	temp.duplicateCodeHash = ethers.solidityPackedKeccak256(['string'], [temp._duplicateCode])
	temp.duplicateMnemonicPhrase = temp.mnemonicPhrase


	if (!temp?.duplicateAccount) {
		const profiles = temp.profiles
		const message = JSON.stringify({ walletAddress: profiles[0].keyID, hash: temp.duplicateCodeHash, data: '', channelPartners: temp.ChannelPartners})
		const wallet = new ethers.Wallet(profiles[0].privateKeyArmor)
		const signMessage = await wallet.signMessage(message)
		const sendData = {
		  	message, signMessage
		}
	
		const result = await postToEndpoint(duplicateAPI, true, sendData)
		if (!result|| !result?.status) {
			console.log(`initDuplicate Error!`, result?.error)
			return temp
		}
		console.log(`initDuplicate success!`, result?.status)

		temp.duplicateAccount = {
			privateKeyArmor: profiles[0].privateKeyArmor,
			tokens: initProfileTokens(),
			publicKeyArmor: '',
			referrer: '',
			keyID: result.status,
			isNode: false,
			index: 0,
			hdPath: null
		}
		
	} else {
		const keyID = temp.profiles[0].keyID
		const duplicateStatus = await getDuplicateOwnership(temp.duplicateAccount.keyID, keyID)
		if (duplicateStatus === false) {
			await createOrGetWallet(null, true)
			
			return null
		}
	}

	if (!temp?.duplicatePassword) {
		temp.duplicateCode = ''
	}

	return temp

}
const duplicatePasscodeAPI = `${apiv4_endpoint}duplicatePasscode`

export const initializeDuplicateCode = async (passcode: string): Promise<boolean> => {
	if (!CoNET_Data) {
		return false
	}
	const temp = CoNET_Data
	const passCode = temp._duplicateCode
	const profiles = temp.profiles
	
	const wallet = new ethers.Wallet(profiles[0].privateKeyArmor)
	
	const mnemonicPhrase = temp.duplicateMnemonicPhrase = temp.mnemonicPhrase
	const pass = passCode + passcode
	const encryptoText = temp.encryptedString = await aesGcmEncrypt(mnemonicPhrase, pass)
	const keyword = await aesGcmDecrypt(encryptoText, pass)
	const message = JSON.stringify({ walletAddress: profiles[0].keyID, hash: temp.duplicateCodeHash, data: encryptoText})
	const signMessage = await wallet.signMessage(message)
	const sendData = {
		message, signMessage
	}
	try {
		const result = await postToEndpoint(duplicatePasscodeAPI, true, sendData)
		if (!result|| !result?.status) {
			console.log(`initDuplicate Error!`, result?.error)
			return false
		}
	} catch (ex) {
		return false
	}

	temp.duplicateCode = temp._duplicateCode
	temp.duplicatePassword = passcode
	await setCoNET_Data(temp)
  	await storeSystemData()
	return true
}

export const checkWallet = (wallet: string) => {
	return ethers.isAddress(wallet)
}

const airDropForSPUrl = `${apiv4_endpoint}airDropForSP`
const SP_tokenDecimals = 6
let airDropForSPProcess = false
const PROGRAM_ID = new web3.PublicKey(anchor_linear_vesting_del.address)


let airDropStatus: null | airDropStatus = null


const getAirDropForSPUrl = `${payment_endpoint}getAirDropForSP`

let getAirDropForSPProcess = false


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
	  const mainWallet = profile.keyID.toLowerCase()
	  const referrerLow = referrer.toLowerCase()
	  if (mainWallet === referrerLow || referrerLow === CoNET_Data.duplicateAccount?.keyID.toLocaleUpperCase() ) {
			return false
	  }
	  try {
		const message = JSON.stringify({ walletAddress: profile.keyID, solanaWallet, referrer})
		const wallet = new ethers.Wallet(profile.privateKeyArmor)
		const signMessage = await wallet.signMessage(message)
		const sendData = {
		  message, signMessage
		}
	
		const result = await postToEndpoint(getAirDropForSPReffUrl, true, sendData)
		
		getirDropForSPReffProcess = false
		if (result?.status) {
			
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

export const getBalanceFromPDA = async (solanaRPC_url: string, spToken: CryptoAsset, VESTING_ID = 0, node: nodes_info) => {
    if (!CoNET_Data?.profiles) {
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

		await getBalanceFromPDA(solanaRPC_url, spToken, ++VESTING_ID, node)

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
  amountRaw: string,
  showFail: (err:any)=> void,
  node: nodes_info
): Promise<false | string> => {
  // 用你的 HTTP RPC 节点
  const rpcUrl = `http://${node.ip_addr}/solana-rpc`
  // **显式禁用** WebSocket
  const connection = new Connection(rpcUrl, {
    commitment: "confirmed",
    wsEndpoint: ""
  });

  const amount = ethers.parseUnits(amountRaw, gettNumeric(fromMint))

  try {
    // 1. 构造 Jupiter 的 quote & swapPayload
    const wallet = Keypair.fromSecretKey(Bs58.decode(privateKey));
	const url = `http://${node.ip_addr}/jup_ag/swap/v1/quote?` +
        `inputMint=${fromMint}` +
        `&outputMint=${toMint}` +
        `&amount=${amount}` +
        `&restrictIntermediateTokens=true`
    const quoteRes = await fetch(url)
    const quoteResponse = await quoteRes.json();

    const swapRes = await fetch(
      `http://${node.ip_addr}/jup_ag/swap/v1/swap`,
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

    // 2. 反序列化
	const tx = VersionedTransaction.deserialize(
	Buffer.from(swapTransaction, "base64")
	);

	// 3. 拿最新 blockhash + lastValidBlockHeight
	const latest = await connection.getLatestBlockhash("confirmed");
	tx.message.recentBlockhash      = latest.blockhash;
	// @ts-ignore
	tx.message.lastValidBlockHeight = latest.lastValidBlockHeight;

	// 4. 签名 —— 必须在设置 blockhash/height 后做
	tx.sign([wallet]);

	// 5. 模拟一下，排查逻辑错误
	const sim = await connection.simulateTransaction(tx);
	if (sim.value.err) {
	console.error("⚠️ simulateTransaction failed:", sim.value.err);
	console.error("logs:", sim.value.logs);
	return false;
	}

	// 6. 真正发送
	const rawTx = tx.serialize();
	let txid: string;

    // 5. 真正发
    txid = await connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      preflightCommitment: "confirmed"
    })

	  console.log("🔍 已发送 txid =", txid)

	// 6. 轮询确认
	const ok = await pollSignature(connection, txid)
	return ok ? txid : false

  } catch (err: any) {
    // 捕获 SendTransactionError
    if (err instanceof SendTransactionError) {
      // 调用 getLogs() 拿到完整的仿真日志
      const logs = await err.getLogs(connection)
      console.error("❌ SendTransactionError 仿真日志:\n", logs.join("\n"));
    } else {
      console.error("❌ sendRawTransaction 其他错误:", err);
    }
    showFail(err.message);
    return false
  }

}