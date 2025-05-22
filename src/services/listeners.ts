import { ethers } from "ethers";
import { blast_CNTPAbi } from "./../utils/abis";
import {
  conetDepinProvider,
} from "../utils/constants";
import {
  CoNET_Data,
  currentPageInvitees,
  globalAllNodes,
  setProcessingBlock,
} from "../utils/globals";
import contracts from "../utils/contracts";
import { initProfileTokens } from "../utils/utils";
import { checkCurrentRate } from "../services/passportPurchase";
import {
  getPassportsInfoForProfile,
  getReceivedAmounts,
  getSpClubInfo,
  getVpnTimeUsed,
  storeSystemData,
  getProfileAssets
} from "./wallets";
import { PublicKey } from "@solana/web3.js";

let epoch = 0;
let blockProcess = 0
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
	await getReceivedAmounts(
		profiles[1].keyID,
		globalAllNodes
	);
	
	_setProfiles(profiles);

	if (profiles[0].activePassport) {
		_setActivePassport(profiles[0].activePassport);
	}

	await storeSystemData();
	await setProcessingBlock(false);
	blockProcess = now
	conetDepinProvider.on("block", async (block) => {
		if (block === epoch + 1) {

			epoch++;
			
			const profiles = CoNET_Data?.profiles;
			const now = new Date().getTime()
			if (!profiles||now - blockProcess < 1000 * 10) {
				return;
			}

			blockProcess = now
				await checkCurrentRate(setMiningData);
				await getProfileAssets(profiles[0], profiles[1]);
				// await getVpnTimeUsed();
				await getSpClubInfo(profiles[0], currentPageInvitees);
				
				const receivedTransactions = await getReceivedAmounts(
					profiles[1].keyID,
					globalAllNodes
				);
				console.log(receivedTransactions);
			
				await getPassportsInfoForProfile(profiles[0]);
			
				if (CoNET_Data?.profiles && CoNET_Data?.profiles.length > 0) {
					_setProfiles(CoNET_Data?.profiles);
					if (CoNET_Data.profiles[0].activePassport)
					_setActivePassport(CoNET_Data.profiles[0].activePassport);
				}

				await storeSystemData();
				await setProcessingBlock(false);
			blockProcess = now
		}
	});

  epoch = await conetDepinProvider.getBlockNumber();
};


const scanSolanaSol = async (walletAddr: string, randomSolanaRPC: string) => {
  try {
    // Validate wallet address format
    if (!PublicKey.isOnCurve(walletAddr)) {
      throw new Error("Invalid wallet address format");
    }

    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [walletAddr],
    };

    const response = await fetch(randomSolanaRPC, {
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
    if (data.result) {
      return data.result.value / 1_000_000_000; // Convert lamports to SOL
    } else {
      throw new Error("No balance found");
    }
  } catch (error) {
    console.error("Error fetching balance $SOL:", error);
    return false;
  }
};

const scanSolanaSp = async (walletAddr: string, solanaRPC_url: string) => {
  return await scan_spl_balance(
    walletAddr,
    contracts.PassportSolana.address,
    solanaRPC_url
  );
};


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

export { listenProfileVer, scanSolanaSol, scanSolanaSp };


//		