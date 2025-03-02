import { blast_CNTPAbi } from "./../utils/abis";
import { ethers } from "ethers";
import {
  conetDepinProvider,
  conetProvider,
  ethProvider,
  XMLHttpRequestTimeout,
  solanaRPC,
} from "../utils/constants";
import {
  CoNET_Data,
  processingBlock,
  setCoNET_Data,
  setProcessingBlock,
  lastProceeeTime,
  setLastProceeeTime
} from "../utils/globals";
import contracts from "../utils/contracts";
import { initProfileTokens } from "../utils/utils";
import { getVpnTimeUsed } from "./wallets"; 
import { Connection, PublicKey, Keypair } from "@solana/web3.js"
import Bs58 from "bs58"

let epoch = 0;
const SOLANA_CONNECTION = new Connection(solanaRPC)

const listenProfileVer = async (callback: (profiles: profile[]) => void) => {
  epoch = await conetProvider.getBlockNumber();

  conetProvider.on("block", async (block) => {
    if (block === epoch + 1) {
      epoch++;

      if (processingBlock === true) return;
	  
	  const currentTime = new Date().getTime()
	  //	over 30 seconds!
      if (currentTime > lastProceeeTime + XMLHttpRequestTimeout ) {
        setProcessingBlock(true);

        const profiles = CoNET_Data?.profiles;
        if (!profiles) {
          return;
        }
        const runningList: any[] = [];

        runningList.push(getProfileAssets(profiles[0]));
		runningList.push(getSolanaAssets(profiles[1]))
        await Promise.all(runningList);

        await getVpnTimeUsed();

        if (CoNET_Data?.profiles[0]) callback(CoNET_Data?.profiles);
		setProcessingBlock(false)
        setLastProceeeTime(new Date().getTime())
      }
    }
  });

  epoch = await conetProvider.getBlockNumber();
};
const scan_spl_balance = async (walletAddr: string, tokenAddress: string) => {
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
  
	  const response = await fetch(solanaRPC, {
		method: "POST",
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
  
	  return 0; // No balance found
	} catch (error) {
	  console.error("Error fetching SPL balance:", error);
	  return false;
	}
};
const getSolanaAssets = async (profile: profile) => {
	
	const publciKey = new PublicKey(profile.keyID)
	const [balanceSo, balanceSP] = await Promise.all([
		SOLANA_CONNECTION.getBalance(publciKey),
		scan_spl_balance(profile.keyID, contracts.SP.address)
	])
	
	if (profile.tokens?.solana) {
		const solanaObj = profile.tokens.solana
		profile.tokens.solana.balance =
		  parseFloat(
			ethers.formatUnits(balanceSo.toString(), solanaObj.decimal).toString()
		).toFixed(6)
	} else {
		profile.tokens.solana = {
		  balance:
		  parseFloat(
			ethers.formatUnits(balanceSo.toString(), 9).toString()
		  ).toFixed(6),
		  network: "Solana",
		  decimal: 9,
		  contract: "",
		  name: "Solana",
		}
	}

		if (profile.tokens?.SP) {
			const spOBJ = profile.tokens.SP
			profile.tokens.SP.balance = balanceSP ? balanceSP.toFixed(4): "0"
		} else {
			profile.tokens.SP = {
			  balance: balanceSP ? balanceSP.toFixed(4): "0",
			  network: "Solana",
			  decimal: contracts.SP.decimal,
			  contract: contracts.SP.address,
			  name: "Solana",
			}
		}
	

}


const getProfileAssets = async (profile: profile) => {
  const key = profile.keyID;

  if (key) {
    if (!profile.tokens) {
      profile.tokens = initProfileTokens();
    }

    const [conetDepin, conet_eth, eth] = await Promise.all([
    //   scanCCNTP(key),
    //   scanCONETHolesky(key),
      scanCONETDepin(key),
      scanConetETH(key),
      scanETH(key),
    ]);

    // if (profile.tokens?.cCNTP) {
    //   profile.tokens.cCNTP.balance =
    //     cCNTP === false ? "" : parseFloat(ethers.formatEther(cCNTP)).toFixed(6);
    // } else {
    //   profile.tokens.cCNTP = {
    //     balance:
    //       cCNTP === false
    //         ? ""
    //         : parseFloat(ethers.formatEther(cCNTP)).toFixed(6),
    //     network: "CONET Holesky",
    //     decimal: 18,
    //     contract: contracts.ClaimableConetPoint.address,
    //     name: "cCNTP",
    //   };
    // }

    // if (profile.tokens?.conet) {
    //   profile.tokens.conet.balance =
    //     conet === false ? "" : parseFloat(ethers.formatEther(conet)).toFixed(6);
    // } else {
    //   profile.tokens.conet = {
    //     balance:
    //       conet === false
    //         ? ""
    //         : parseFloat(ethers.formatEther(conet)).toFixed(6),
    //     network: "CONET Holesky",
    //     decimal: 18,
    //     contract: "",
    //     name: "conet",
    //   };
    // }

    if (profile.tokens?.conetDepin) {
      profile.tokens.conetDepin.balance =
        conetDepin === false
          ? ""
          : parseFloat(ethers.formatEther(conetDepin)).toFixed(6);
    } else {
      profile.tokens.conetDepin = {
        balance:
          conetDepin === false
            ? ""
            : parseFloat(ethers.formatEther(conetDepin)).toFixed(6),
        network: "CONET DePIN",
        decimal: 18,
        contract: "",
        name: "conetDepin",
      };
    }

    if (profile.tokens?.eth) {
      profile.tokens.eth.balance =
        eth === false ? "" : parseFloat(ethers.formatEther(eth)).toFixed(6);
    } else {
      profile.tokens.eth = {
        balance:
          eth === false ? "" : parseFloat(ethers.formatEther(eth)).toFixed(6),
        network: "ETH",
        decimal: 18,
        contract: "",
        name: "eth",
      };
    }

    if (profile.tokens?.conet_eth) {
      profile.tokens.conet_eth.balance =
        conet_eth === false
          ? ""
          : parseFloat(ethers.formatEther(conet_eth)).toFixed(6);
    } else {
      profile.tokens.conet_eth = {
        balance:
          conet_eth === false
            ? ""
            : parseFloat(ethers.formatEther(conet_eth)).toFixed(6),
        network: "CONET DePIN",
        decimal: 18,
        contract: "",
        name: "conet_eth",
      };
    }

    const temp = CoNET_Data;

    if (!temp) {
      return false;
    }

    temp.profiles[0] = profile;

    setCoNET_Data(temp);
  }

  return true;
};

const scanCCNTP = async (walletAddr: string) => {
  return await scan_erc20_balance(
    walletAddr,
    contracts.ClaimableConetPoint.address,
    contracts.ClaimableConetPoint.abi,
    conetProvider
  );
};

const scanCONETDepin = async (walletAddr: string) => {
  return await scan_erc20_balance(
    walletAddr,
    contracts.ConetDepin.address,
    contracts.ClaimableConetPoint.abi,
    conetDepinProvider
  );
};

const scanConetETH = async (walletAddr: string) => {
  return await scan_natural_balance(walletAddr, conetDepinProvider);
};

const scanCONETHolesky = async (walletAddr: string) => {
  return await scan_natural_balance(walletAddr, conetProvider);
};

const scanETH = async (walletAddr: string) => {
  return await scan_natural_balance(walletAddr, ethProvider);
};

const scan_erc20_balance: (
  walletAddr: string,
  address: string,
  abi: any,
  provider: any
) => Promise<false | any> = (walletAddr, contractAddress, abi, provider) =>
  new Promise(async (resolve) => {
    const contract = new ethers.Contract(
      contractAddress,
      blast_CNTPAbi,
      provider
    );

    try {
      const result = await contract.balanceOf(walletAddr);
      return resolve(result);
    } catch (ex) {
      console.log(`scan_erc20_balance Error!`);
      return resolve(false);
    }
  });

const scan_natural_balance = async (walletAddr: string, provider: any) => {
  try {
    const result = await provider.getBalance(walletAddr);
    return result;
  } catch (ex) {
    console.log(`scan_natureBalance Error!`);
    return false;
  }
};

export { listenProfileVer };
