import {
	Connection,
	PublicKey,
	Keypair,
	Transaction,
	sendAndConfirmTransaction,
  } from "@solana/web3.js";
  import {
	getOrCreateAssociatedTokenAccount,
	createTransferInstruction,
  } from "@solana/spl-token";
  import { ethers } from "ethers";
  import Bs58 from "bs58";
  import contracts from "../utils/contracts";
  import { conetProvider, solanaRpc } from "../utils/constants";
  import { CoNET_Data } from "../utils/globals";
  import {epoch_info_ABI} from "../utils/abis"
  const sp_team = "2UbwygKpWguH6miUbDro8SNYKdA66qXGdqqvD6diuw3q";
  const spDecimalPlaces = 6;
  
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
  
  export const getOracle = async () => {
	const timeStamp = new Date().getTime();
  
	if (oracleData && timeStamp - oracleData.timeStamp > 1000 * 60) {
	  const SP_Oracle_SC_reaonly = new ethers.Contract(
		contracts.SpOracle.address,
		contracts.SpOracle.abi,
		conetProvider
	  );
  
	  try {
		const [_sp249, _sp999, _sp2499, _sp9999, _so] =
		  await SP_Oracle_SC_reaonly.getQuote();
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
  const epoch_mining_info_cancun_addr = '0x31680dc539cb1835d7C1270527bD5D209DfBC547'.toLocaleLowerCase()
  const epoch_mining_infoSC = new ethers.Contract(epoch_mining_info_cancun_addr, epoch_info_ABI, conetProvider)

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
  
  export const purchasePassport = async (amount: string) => {
	if (!CoNET_Data) {
	  return;
	}
    const privateKey = CoNET_Data.profiles[1]?.privateKeyArmor
	try {
	  const solanaConnection = new Connection(solanaRpc);
	  const solana_account_privatekey_array = Bs58.decode(privateKey);
	  const solana_account_keypair = Keypair.fromSecretKey(
		solana_account_privatekey_array
	  );
  
	  let sourceAccount = await getOrCreateAssociatedTokenAccount(
		solanaConnection,
		solana_account_keypair,
		new PublicKey(contracts.PassportSolana.address),
		solana_account_keypair.publicKey
	  );
  
	  let destinationAccount = await getOrCreateAssociatedTokenAccount(
		solanaConnection,
		solana_account_keypair,
		new PublicKey(contracts.PassportSolana.address),
		new PublicKey(sp_team)
	  );
  
	  const transferTx = new Transaction();
  
	  transferTx.add(
		createTransferInstruction(
		  sourceAccount.address,
		  destinationAccount.address,
		  solana_account_keypair.publicKey,
		  ethers.parseUnits(amount, spDecimalPlaces)
		)
	  );
  
	  const latestBlockHash = await solanaConnection.getLatestBlockhash(
		"confirmed"
	  );
  
	  transferTx.recentBlockhash = await latestBlockHash.blockhash;
  
	  const signature = await sendAndConfirmTransaction(
		solanaConnection,
		transferTx,
		[solana_account_keypair]
	  );
  
	  await update_purchase_cancun(signature)
  
	  
	} catch (error: any) {
	  const _tx: string = error.message
	  const tx1 = _tx.split(/Signature /i)
		if (tx1[1]) {
			const tx = tx1[1].split(' ')[0]
			await update_purchase_cancun(tx)
			return tx;
		}

	  throw error;
	}
  };
  
  
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
  
  const checkts = async (solanaTx: string) => {
	//		from: J3qsMcDnE1fSmWLd1WssMBE5wX77kyLpyUxckf73w9Cs
	//		to: 2UbwygKpWguH6miUbDro8SNYKdA66qXGdqqvD6diuw3q
  
	const solanaConnection = new Connection(solanaRpc);
  
	const tx = await solanaConnection.getTransaction(solanaTx, {
	  maxSupportedTransactionVersion: 0,
	});
	const meta = tx?.meta;
	if (meta) {
	  const postTokenBalances = meta.postTokenBalances;
	  const preTokenBalances = meta.preTokenBalances;
	  if (preTokenBalances?.length == 2 && postTokenBalances?.length == 2) {
		const from = postTokenBalances[0].owner;
		if (
		  from &&
		  preTokenBalances[0].mint === contracts.PassportSolana.address &&
		  preTokenBalances[1].owner === sp_team
		) {
		  const _transferAmount =
			parseFloat(postTokenBalances[1].uiTokenAmount.amount) -
			parseFloat(preTokenBalances[1].uiTokenAmount.amount);
		  const amount = ethers.formatUnits(
			_transferAmount.toFixed(0),
			spDecimalPlaces
		  );
		  console.log(`transferAmount = ${amount}`);
		  const check = await checkPrice(amount);
  
		  if (!check) {
			returnPool.push({
			  from,
			  amount,
			});
			// returnSP();
			return console.log(`check = false back! ${amount}`);
		  }
		}
	  }
	}
  };
  