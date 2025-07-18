import {
	Connection,
	PublicKey,
	Keypair,
	Transaction,
	sendAndConfirmTransaction,
	ComputeBudgetProgram
  } from "@solana/web3.js"
import {
	postToEndpoint,
} from "../utils/utils"
import {
	payment_endpoint,
	apiv4_endpoint
} from "../utils/constants"
import {waitingPaymentStatus} from './wallets'
  import { ethers } from "ethers"
  import Bs58 from "bs58";
  import contracts from "../utils/contracts";
  import { conetDepinProvider, conetProvider } from "../utils/constants";
  import { CoNET_Data } from "../utils/globals";
  import {epoch_info_ABI} from "../utils/abis"
  import nacl from 'tweetnacl'
  import {allNodes} from './mining'

  import { createTransferInstruction,getOrCreateAssociatedTokenAccount, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token"

  interface OracleData {
	timeStamp: number;
	data: spOracle | null;
  }
  
  let oracleData: OracleData = {
	timeStamp: 0,
	data: null,
  };
  
  const returnPool: {
	from: string;
	amount: string;
  }[] = [];
const sp_team = "2UbwygKpWguH6miUbDro8SNYKdA66qXGdqqvD6diuw3q"
  const spDecimalPlaces = 6;
  	export const getOracle = async () => {
		const timeStamp = new Date().getTime();
  
		if (oracleData && timeStamp - oracleData.timeStamp > 1000 * 60) {
	  		const SP_Oracle_SC_reaonly = new ethers.Contract(
				contracts.SpOracle.address,
				contracts.SpOracle.abi,
				conetDepinProvider
	  		);
  
	  		try {
				const [_sp249, _sp999, _sp2499, _sp9999, _so] = await SP_Oracle_SC_reaonly.getQuote();
				const sp249 = ethers.formatEther(_sp249).split('.')[0]
				const sp999 = ethers.formatEther(_sp999).split('.')[0];
				const sp2499 = ethers.formatEther(_sp2499).split('.')[0];
				const sp9999 = ethers.formatEther(_sp9999).split('.')[0];
				const so = ethers.formatEther(_so);
  
				oracleData = {
		  			timeStamp,
		  			data: {
						sp249,
						sp999,
						sp2499,
						sp9999,
						so,
		  			},
				};
  
				return oracleData;
	  		} catch (ex: any) {
				console.log(`getOracle Error ${ex.message}`);
	  		}
		}
  
		return oracleData;
  	};
  
  const checkPrice = async (_amount: string) => {
	await getOracle();
  
	const amount = parseFloat(_amount);
	if (oracleData.data == null) {
	  return console.log(`checkPrice oracleData?.data is NULL Error!`);
	}
	const sp249 = parseFloat(oracleData.data.sp249);
	const sp999 = parseFloat(oracleData.data.sp999);
	const sp2499 = parseFloat(oracleData.data.sp2499);
	const sp9999 = parseFloat(oracleData.data.sp9999);
	if (Math.abs(amount - sp249) < sp249 * 0.1) {
	  return "sp249";
	}
	if (Math.abs(amount - sp999) < sp999 * 0.1) {
	  return "sp999";
	}
	if (Math.abs(amount - sp2499) < sp2499 * 0.1) {
	  return "sp999";
	}
	if (Math.abs(amount - sp9999) < sp9999 * 0.1) {
	  return "sp999";
	}
  
	return "";
  };
  const epoch_mining_info_cancun_addr = '0xbC713Fef0c7Bb178151cE45eFF1FD17d020a9ecD'.toLocaleLowerCase()
  const epoch_mining_infoSC = new ethers.Contract(epoch_mining_info_cancun_addr, epoch_info_ABI, conetDepinProvider)

export const checkCurrentRate = async (setMiningData: (response: nodeResponse) => void) => {
	let _epoch: BigInt
	let _totalMiners: BigInt
	let _minerRate: ethers.BigNumberish
	let _totalUsrs: BigInt

	try {
		[_epoch, _totalMiners, _minerRate, _totalUsrs] = await epoch_mining_infoSC.currentInfo()
	} catch (ex: any) {
		return console.log(`checkCurrentRate Error! ${ex.message}`)
	}

	if (parseInt(_epoch.toString()) > 0) {
		const online = _totalMiners.toString()
		const rate = ethers.formatEther(_minerRate)
		const totalUsers = _totalUsrs.toString()
		const epoch = parseInt(_epoch.toString())
		const currentRate: nodeResponse = {
			online, rate, totalUsers, epoch
		}
		return setMiningData(currentRate)
	}
	return null
	
}

  const update_purchase_cancun = async (signature: string) => {
	if (!CoNET_Data?.profiles[0]?.privateKeyArmor) {
		return
	}
	const wallet = new ethers.Wallet(
		CoNET_Data?.profiles[0]?.privateKeyArmor,
		conetProvider
	  );
  
	  const purchasePassportContract = new ethers.Contract(
		contracts.PurchasePassport.address,
		contracts.PurchasePassport.abi,
		wallet
	  );
	const purchaseTx = await purchasePassportContract.purchase(signature);
	const completedTx = await purchaseTx.wait();
	await waitingStatusChange(purchasePassportContract, wallet.address)
	return completedTx;
  }
  
// const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
// 	microLamports: 9000
// })
// const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
// 	units: 200000
// })


export const transferSolanaSP = async(toPublicKeyString: string, _amount: number): Promise<{err?: string, success?: string}> => {
	if (!CoNET_Data?.profiles) {
		return {err: 'not ready'}
	}
	const amount = ethers.parseUnits(_amount.toFixed(6), spDecimalPlaces)
	const profile = CoNET_Data.profiles[1]
	const privateKey = profile.privateKeyArmor
	const privatekey_array = Bs58.decode(privateKey)
	const solana_account_keypair = Keypair.fromSecretKey(
		privatekey_array
	)
	const _node1 = allNodes[Math.floor(Math.random() * (allNodes.length - 1))];
	const solanaConnection = new Connection(
		`https://${_node1.domain}/solana-rpc`,
		"confirmed"
	)
	const SP_Address = new PublicKey(contracts.SPToken.address)
	const to_address = new PublicKey(toPublicKeyString)
	const sourceAccount = await getOrCreateAssociatedTokenAccount(
		solanaConnection, 
		solana_account_keypair,
		SP_Address,
		solana_account_keypair.publicKey
	)

	const recipientTokenAddress = await getAssociatedTokenAddress(
		SP_Address,
		to_address
	)

	const transaction = new Transaction()

	const accountInfo = await solanaConnection.getAccountInfo(recipientTokenAddress)
	if (!accountInfo) {
		transaction.add(
			createAssociatedTokenAccountInstruction(
				solana_account_keypair.publicKey,         // payer
				recipientTokenAddress,    					// ATA address
				to_address,          						// wallet owner
				SP_Address                      			// token mint
			)
		)
	}

	// 构建交易
	transaction.add(
		createTransferInstruction(
			sourceAccount.address,
			recipientTokenAddress,
			solana_account_keypair.publicKey,
			amount
		)
	)
	let signature
	try {
		
		const latestBlockHash = await solanaConnection.getLatestBlockhash('confirmed')
		transaction.recentBlockhash = latestBlockHash.blockhash
		// 发送并确认交易
		signature = await solanaConnection.sendTransaction(transaction, [solana_account_keypair])
		await new Promise(executor => setTimeout(() => executor(true), 5000))
		return {success: signature}
	} catch (ex: any) {
		await setTimeout(() => new Promise(executor => executor(true)), 5000)
		if (signature) {
			const info = await solanaConnection.getSignatureStatus(signature)
			if (info) {
				return {success: signature}
			}
		}
		return {err: ex.message}
	}
}

let purchasePassportProcess = false
export const purchasePassport = async (_amount: string): Promise<number> => {
	if (purchasePassportProcess) {
		return 0
	}
	purchasePassportProcess = true
	const result = await transferSolanaSP(sp_team, parseFloat(_amount))

	if (result.err||!result.success) {
		purchasePassportProcess = false
		return 0
	}
	const post = await postPurchasePassport(result.success)
	purchasePassportProcess = false
	if (!post) {

		return 0
	}
	
	return post
}
  
  
  const waitingStatusChange = (_contract: ethers.Contract, profileKeyID: string) => new Promise (async (resolve, reject) => {
	  let currentBlock = await conetProvider.getBlockNumber()
	  const contractAddr = (await _contract.getAddress()).toLocaleLowerCase()
	  const listenAddress = profileKeyID.toLocaleLowerCase()
	  const checkCNTPTransfer = (tR: ethers.TransactionReceipt) => {
		  for (let log of tR.logs) {
			  const LogDescription = _contract.interface.parseLog(log)
			  if (LogDescription?.args?.length) {
				  const toAddress = LogDescription.args[0]
				  if (toAddress.toLocaleLowerCase() === listenAddress) {
					  if (LogDescription?.name === 'purchaseSuccess') {
						  return resolve (true)
					  }
					  reject('reject')
				  }
			  }
			  
		  }
		  resolve('')
	  }
	  const getBlock = async (block: number) => {
  
		  const blockTs = await conetProvider.getBlock(block)
		  if (!blockTs?.transactions) {
			  return
		  }
		  
		  for (let tx of blockTs.transactions) {
			  const event = await conetProvider.getTransactionReceipt(tx)
			  if ( event?.to?.toLowerCase() === contractAddr) {
				  await checkCNTPTransfer(event)
			  }
			  
		  }
	  }
	  
	  conetProvider.on('block', async block => {
		  if (block > currentBlock) {
			  currentBlock = block
			  getBlock (block)
		  }
	  })
  })

  const purchasePassportBySP = `${payment_endpoint}purchasePassportBySP`


  export const postPurchasePassport = async (hash: string): Promise<number|false> => {

	  if (!CoNET_Data?.profiles) {
		return false
	  }
  
	  const profile = CoNET_Data.profiles[0]
	  const solanaWallet = CoNET_Data.profiles[1].keyID
	  const encodedMessage = new TextEncoder().encode(profile.keyID.toLowerCase())
	  const privateKey = CoNET_Data.profiles[1]?.privateKeyArmor
	  const solana_account_privatekey_array = Bs58.decode(privateKey)
	  const solana_account_keypair = Keypair.fromSecretKey(
		 solana_account_privatekey_array
	  )

	  const _data = nacl.sign.detached(encodedMessage, solana_account_keypair.secretKey)
	  const data = Bs58.encode(_data)
	  try {
		const message = JSON.stringify({ walletAddress: profile.keyID, solanaWallet, hash, data })
		const wallet = new ethers.Wallet(profile.privateKeyArmor)
		const signMessage = await wallet.signMessage(message)
		const sendData = {
		  message, signMessage
		}
	
		const result = await postToEndpoint(purchasePassportBySP, true, sendData)
		const status = result?.status
		if (status) {
			
			const waiting = await waitingPaymentStatus()
			if (waiting) {
				return waiting
			}
			
		}
		
		return false
	  } catch (ex) {
		console.log(ex)
		return false
	  }
  }
  
//   const checkts = async (solanaTx: string) => {
// 	//		from: J3qsMcDnE1fSmWLd1WssMBE5wX77kyLpyUxckf73w9Cs
// 	//		to: 2UbwygKpWguH6miUbDro8SNYKdA66qXGdqqvD6diuw3q
  
// 	const solanaConnection = new Connection(solanaRpc);
  
// 	const tx = await solanaConnection.getTransaction(solanaTx, {
// 	  maxSupportedTransactionVersion: 0,
// 	});
// 	const meta = tx?.meta;
// 	if (meta) {
// 	  const postTokenBalances = meta.postTokenBalances;
// 	  const preTokenBalances = meta.preTokenBalances;
// 	  if (preTokenBalances?.length == 2 && postTokenBalances?.length == 2) {
// 		const from = postTokenBalances[0].owner;
// 		if (
// 		  from &&
// 		  preTokenBalances[0].mint === contracts.PassportSolana.address &&
// 		  preTokenBalances[1].owner === sp_team
// 		) {
// 		  const _transferAmount =
// 			parseFloat(postTokenBalances[1].uiTokenAmount.amount) -
// 			parseFloat(preTokenBalances[1].uiTokenAmount.amount);
// 		  const amount = ethers.formatUnits(
// 			_transferAmount.toFixed(0),
// 			spDecimalPlaces
// 		  );
// 		  console.log(`transferAmount = ${amount}`);
// 		  const check = await checkPrice(amount);
  
// 		  if (!check) {
// 			returnPool.push({
// 			  from,
// 			  amount,
// 			});
// 			// returnSP();
// 			return console.log(`check = false back! ${amount}`);
// 		  }
// 		}
// 	  }
// 	}
//   };
  