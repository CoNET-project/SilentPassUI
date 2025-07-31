import {
  conetDepinProvider,
} from "../utils/constants"
import {
  CoNET_Data,
  currentPageInvitees,
  globalAllNodes,
  setCoNET_Data,
  setProcessingBlock,
} from "../utils/globals";
import contracts from "../utils/contracts"
import {getRandomNode} from './mining'
import { checkCurrentRate } from "../services/passportPurchase";
import {
  getPassportsInfoForProfile,
  getReceivedAmounts,
  getSpClubInfo,
  getVpnTimeUsed,
  storeSystemData,
  getProfileAssets,
} from "./wallets";
import { PublicKey, Connection } from "@solana/web3.js"
import {initDuplicate} from './subscription'
import axios, { AxiosResponse } from "axios"

let epoch = 0;
let blockProcess = 0
let _process = false
let _stopProcess = false

const changeStopProcess = (status: boolean) => {
	_process = status
}
const LAMPORTS_PER_SOL = 9
const listenProfileVer = async (
  _setProfiles: (profiles: profile[]) => void,
  _setActivePassport: (profiles: freePassport) => void,
  setMiningData: (response: nodeResponse) => void
) => {
  const temp = CoNET_Data
  const profiles = temp?.profiles
  if (!CoNET_Data || !profiles) {
  return
  }
  const now = new Date().getTime()
  if (now - blockProcess < 1000 * 10) {
    return;
  }


  blockProcess = now
  

  await conetDepinProvider.getBlockNumber();
  checkCurrentRate(setMiningData);
  await getProfileAssets(profiles[0], profiles[1]);
  // await getVpnTimeUsed();
  await getSpClubInfo(profiles[0], currentPageInvitees);
  await getPassportsInfoForProfile(profiles[0])

  _setProfiles(profiles);

  if (profiles[0].activePassport) {
    _setActivePassport(profiles[0].activePassport);
  }
  
  setCoNET_Data(temp)
  if (!_stopProcess) {
	 await storeSystemData();
  }
 
  await setProcessingBlock(false);
  blockProcess = now




  conetDepinProvider.on("block", async (block) => {

    if (block === epoch + 1) {

      epoch++;

      if (_stopProcess) {
		return
	  }

      const profiles = CoNET_Data?.profiles
      const now = new Date().getTime()
	  
      if (!profiles||now - blockProcess < 1000 * 10||_process) {
        return;
      }
      _process = true
	  
        await checkCurrentRate(setMiningData);
        await getProfileAssets(profiles[0], profiles[1]);
        // await getVpnTimeUsed();
        await getSpClubInfo(profiles[0], currentPageInvitees);
        
        // const receivedTransactions = await getReceivedAmounts(
        //  profiles[1].keyID,
        //  globalAllNodes
        // );
        // console.log(receivedTransactions);
      
        await getPassportsInfoForProfile(profiles[0]);
      
        if (CoNET_Data && CoNET_Data?.profiles && CoNET_Data?.profiles.length > 0) {
          await _setProfiles(CoNET_Data?.profiles);
          if (CoNET_Data.profiles[0].activePassport)
          await _setActivePassport(CoNET_Data.profiles[0].activePassport);
			const temp = await initDuplicate(CoNET_Data)
			if (!temp) {
				await new Promise(n => setTimeout(() => n(true),10000))
			}
        }
		if (!_stopProcess) {
			await storeSystemData();
		}
        
        await setProcessingBlock(false);
      _process = false
      blockProcess = now
    }
  });

  epoch = await conetDepinProvider.getBlockNumber();
}


const getSOL_Balance = async () => {
  if (!CoNET_Data?.profiles) {
    return null
  }
  const profile = CoNET_Data.profiles[1]
  const url = `http://${getRandomNode()}/solana-rpc`
  const ownerPubkey = new PublicKey(profile.keyID)
  const connection = new Connection(url, 'confirmed')
  const lamports = await connection.getBalance(ownerPubkey)
  const sol = lamports / 10 ** LAMPORTS_PER_SOL
  return sol
}


const scanSolanaSol = () => {
  return getSOL_Balance()
}


const scanSolanaSp = () => {
  return getSolanaTokenBalance(contracts.SPToken.address)
}

const scanSolanaUsdt = () => {
  return getSolanaTokenBalance('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB')
}


const getSolanaTokenBalance = async (programId: string): Promise<number> => {
  if (!CoNET_Data?.profiles) {
    return 0
  }
  const profile = CoNET_Data.profiles[1]
  const solanaWallet = new PublicKey(profile.keyID)
  const url = `http://${getRandomNode()}/solana-rpc`
  const connection = new Connection(url, "confirmed")
  const mintPubkey = new PublicKey(programId)
  // 4. 获取这个 mint 下，属于 ownerPubkey 的所有 token 账户
  const resp = await connection.getTokenAccountsByOwner(
    solanaWallet,
    { mint: mintPubkey }
  )
  if (resp.value.length === 0) {
    return 0
  }
   const tokenAccountPubkey = resp.value[0].pubkey
   const balanceInfo = await connection.getTokenAccountBalance(tokenAccountPubkey)
   const amount = balanceInfo.value.uiAmount
   if (!amount) {
  return 0
   }
   return amount
}


const scan_spl_balance = async (
  walletAddr: string,
  tokenAddress: string,
  solanaRPC_url: string
) => {
  try {
    const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"; // Solana SPL Token Program ID

    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [
        walletAddr,
        { programId: TOKEN_PROGRAM_ID },
        { encoding: "jsonParsed" },
      ],
    };

    const response = await fetch(solanaRPC_url, {
      method: "POST",
    credentials: 'omit',
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    const tokenAccounts = data.result?.value ?? [];

    for (let account of tokenAccounts) {
      const info = account.account.data.parsed.info;
      if (info.mint === tokenAddress) {
        return info.tokenAmount.uiAmount; // Return balance in tokens
      }
    }
  let ret = 0
    return ret; // No balance found
  } catch (error) {
    console.error("Error fetching SPL balance:", error);
    return false;
  }
};

export { listenProfileVer, scanSolanaSol, scanSolanaSp, scanSolanaUsdt, changeStopProcess };


//    