import { blast_CNTPAbi } from "./../utils/abis";
import { ethers } from "ethers";
import {
  conetDepinProvider,
  conetProvider,
  ethProvider,
} from "../utils/constants";
import {
  CoNET_Data,
  processingBlock,
  setCoNET_Data,
  setProcessingBlock,
} from "../utils/globals";
import contracts from "../utils/contracts";
import { initProfileTokens } from "../utils/utils";
import { getPassportsInfoForProfile, getVpnTimeUsed } from "./wallets";

let epoch = 0;

const listenProfileVer = async (callback: (profiles: profile[]) => void) => {
  epoch = await conetProvider.getBlockNumber();

  conetProvider.on("block", async (block) => {
    if (block === epoch + 1) {
      epoch++;

      if (processingBlock === true) return;

      if (block % 10 === 0) {
        setProcessingBlock(true);

        const profiles = CoNET_Data?.profiles;
        if (!profiles) {
          return;
        }
        const runningList: any[] = [];

        runningList.push(getProfileAssets(profiles[0]));

        await Promise.all(runningList);

        await getVpnTimeUsed();

        await getPassportsInfoForProfile(profiles[0]);

        if (CoNET_Data?.profiles[0]) callback(CoNET_Data?.profiles);

        setProcessingBlock(false);
      }
    }
  });

  epoch = await conetProvider.getBlockNumber();
};

const getProfileAssets = async (profile: profile) => {
  const key = profile.keyID;

  if (key) {
    if (!profile.tokens) {
      profile.tokens = initProfileTokens();
    }

    const [cCNTP, conet, conetDepin, conet_eth, eth] = await Promise.all([
      scanCCNTP(key),
      scanCONETHolesky(key),
      scanCONETDepin(key),
      scanConetETH(key),
      scanETH(key),
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
