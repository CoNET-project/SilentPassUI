import {
  conetDepinProvider,
} from "../utils/constants"
import {
  CoNET_Data,
  currentPageInvitees,
  globalAllNodes,
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
import { PublicKey, Connection } from "@solana/web3.js";

let epoch = 0;
let blockProcess = 0
const LAMPORTS_PER_SOL = 9
const listenProfileVer = async (
  _setProfiles: (profiles: profile[]) => void,
  _setActivePassport: (profiles: freePassport) => void,
  setMiningData: (response: nodeResponse) => void
) => {
  const profiles = CoNET_Data?.profiles;
  const now = new Date().getTime()
  if (!profiles||now - blockProcess < 1000 * 10) {
    return;
  }
  blockProcess = now
  
  await conetDepinProvider.getBlockNumber();
  checkCurrentRate(setMiningData);
  await getProfileAssets(profiles[0], profiles[1]);
  // await getVpnTimeUsed();
  await getSpClubInfo(profiles[0], currentPageInvitees);
  await getPassportsInfoForProfile(profiles[0])
  // await getReceivedAmounts(
  //  profiles[1].keyID,
  //  globalAllNodes
  // );
  
  _setProfiles(profiles);

  if (profiles[0].activePassport) {
    _setActivePassport(profiles[0].activePassport);
  }

  await storeSystemData();
  await setProcessingBlock(false);
  blockProcess = now
  let _process = false
  conetDepinProvider.on("block", async (block) => {
    if (block === epoch + 1) {

      epoch++;
      
      const profiles = CoNET_Data?.profiles;
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
      
        if (CoNET_Data?.profiles && CoNET_Data?.profiles.length > 0) {
          await _setProfiles(CoNET_Data?.profiles);
          if (CoNET_Data.profiles[0].activePassport)
          await _setActivePassport(CoNET_Data.profiles[0].activePassport);
        }

        await storeSystemData();
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
  const sol = lamports / LAMPORTS_PER_SOL
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


const getSolanaTokenBalance = async (tokenAddress: string) => {
  if (!CoNET_Data?.profiles) {
    return null
  }
  const profile = CoNET_Data.profiles[1]
  const url = `http://${getRandomNode()}/solana-rpc`
  const connection = new Connection(url, 'confirmed')
  const ownerPubkey = new PublicKey(profile.keyID)
  const mintPubkey  = new PublicKey(tokenAddress)
  const resp = await connection.getTokenAccountsByOwner(ownerPubkey, { mint: mintPubkey })
  if (resp.value.length === 0) {
    console.log('getSolanaTokenBalance Error: No token account found for this mint.');
    return null
  }
  const tokenAccountPubkey = resp.value[0].pubkey
  const { value } = await connection.getTokenAccountBalance(tokenAccountPubkey)
  return value
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

export { listenProfileVer, scanSolanaSol, scanSolanaSp, scanSolanaUsdt };


//    