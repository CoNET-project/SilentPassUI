import { ethers } from "ethers";
import { blast_CNTPAbi } from "./../utils/abis";
import {
  conetDepinProvider,
  conetProvider,
  ethProvider,
  solanaRpc,
} from "../utils/constants";
import {
  CoNET_Data,
  processingBlock,
  setCoNET_Data,
  setProcessingBlock,
} from "../utils/globals";
import contracts from "../utils/contracts";
import { initProfileTokens } from "../utils/utils";
import {
  getPassportsInfoForProfile,
  getVpnTimeUsed,
  storeSystemData,
} from "./wallets";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

let epoch = 0;

const listenProfileVer = async (callback: (profiles: profile[]) => void) => {
  epoch = await conetProvider.getBlockNumber();

  conetProvider.on("block", async (block) => {
    if (block === epoch + 1) {
      epoch++;

      if (processingBlock === true) return;

      if (block % 15 === 0) {
        setProcessingBlock(true);

        const profiles = CoNET_Data?.profiles;
        if (!profiles) {
          return;
        }
        const runningList: any[] = [];

        runningList.push(getProfileAssets(profiles[0], profiles[1]));

        await Promise.all(runningList);

        await getVpnTimeUsed();

        await getPassportsInfoForProfile(profiles[0]);

        if (CoNET_Data?.profiles && CoNET_Data?.profiles.length > 0)
          callback(CoNET_Data?.profiles);

        storeSystemData();

        setProcessingBlock(false);
      }
    }
  });

  epoch = await conetProvider.getBlockNumber();
};

const getProfileAssets = async (profile: profile, solanaProfile: profile) => {
  const key = profile.keyID;
  const solanaKey = solanaProfile.keyID;

  if (key) {
    if (!profile.tokens) {
      profile.tokens = initProfileTokens();
    }

    const [cCNTP, conet, conetDepin, conet_eth, eth, sol, sp] =
      await Promise.all([
        scanCCNTP(key),
        scanCONETHolesky(key),
        scanCONETDepin(key),
        scanConetETH(key),
        scanETH(key),
        scanSolanaSol(solanaKey),
        scanSolanaSp(solanaKey),
      ]);

    if (profile.tokens?.cCNTP) {
      profile.tokens.cCNTP.balance =
        cCNTP === false ? "" : parseFloat(ethers.formatEther(cCNTP)).toFixed(6);
    } else {
      profile.tokens.cCNTP = {
        balance:
          cCNTP === false
            ? ""
            : parseFloat(ethers.formatEther(cCNTP)).toFixed(6),
        network: "CONET Holesky",
        decimal: 18,
        contract: contracts.ClaimableConetPoint.address,
        name: "cCNTP",
      };
    }

    if (profile.tokens?.conet) {
      profile.tokens.conet.balance =
        conet === false ? "" : parseFloat(ethers.formatEther(conet)).toFixed(6);
    } else {
      profile.tokens.conet = {
        balance:
          conet === false
            ? ""
            : parseFloat(ethers.formatEther(conet)).toFixed(6),
        network: "CONET Holesky",
        decimal: 18,
        contract: "",
        name: "conet",
      };
    }

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

    if (solanaProfile.tokens?.sol) {
      solanaProfile.tokens.sol.balance = sol === false ? "" : sol?.toFixed(6);
    } else {
      solanaProfile.tokens.sol = {
        balance: sol === false ? "" : sol?.toFixed(6),
        network: "Solana Mainnet",
        decimal: 18,
        contract: "",
        name: "sol",
      };
    }

    if (solanaProfile.tokens?.sp) {
      solanaProfile.tokens.sp.balance =
        sp === false ? "" : parseFloat(sp).toFixed(6);
    } else {
      solanaProfile.tokens.sp = {
        balance: sp === false ? "" : parseFloat(sp).toFixed(6),
        network: "Solana Mainnet",
        decimal: 18,
        contract: "",
        name: "sp",
      };
    }

    const temp = CoNET_Data;

    if (!temp) {
      return false;
    }

    temp.profiles[0] = profile;
    temp.profiles[1] = solanaProfile;

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

const scanSolanaSol = async (walletAddr: string) => {
  try {
    // Validate wallet address format
    if (!PublicKey.isOnCurve(walletAddr)) {
      throw new Error("Invalid wallet address format");
    }

    // Connect to Solana Mainnet (or use 'devnet' for testing)
    const connection = new Connection(solanaRpc, "singleGossip");

    // Convert the wallet address to a PublicKey
    const publicKey = new PublicKey(walletAddr);

    // Get balance (returned in lamports, 1 SOL = 1,000,000,000 lamports)
    const balance = await connection.getBalance(publicKey);

    // Convert to SOL
    return balance / 1_000_000_000;
  } catch (error) {
    console.error("Error fetching balance $SOL:", error);
    return false;
  }
};

const scanSolanaSp = async (walletAddr: string) => {
  return await scan_spl_balance(walletAddr, contracts.PassportSolana.address);
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

const scan_spl_balance = async (walletAddr: string, tokenAddress: string) => {
  try {
    // Connect to Solana Mainnet (or use 'devnet' for testing)
    const connection = new Connection(solanaRpc, "singleGossip");

    const publicKey = new PublicKey(walletAddr);
    const mintPublicKey = new PublicKey(tokenAddress);

    // Get token accounts of the wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      {
        programId: TOKEN_PROGRAM_ID,
      }
    );

    // Find the correct token account
    for (let account of tokenAccounts.value) {
      const info = account.account.data.parsed.info;
      if (info.mint === mintPublicKey.toBase58()) {
        return info.tokenAmount.uiAmount; // Return balance in tokens
      }
    }

    return 0; // If the user has no balance for the token
  } catch (error) {
    console.error("Error fetching $SP balance:", error);
    return false;
  }
};

export { listenProfileVer };
