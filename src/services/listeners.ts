import { ethers } from "ethers";
import { conetProvider } from "../utils/constants";
import { CoNET_Data, setCoNET_Data } from "../utils/globals";
import { contracts } from "../utils/contracts";
import { initProfileTokens } from "../utils/utils";

let epoch = 0;

const listenProfileVer = async (callback: (profile: profile) => void) => {
  epoch = await conetProvider.getBlockNumber();

  conetProvider.on("block", async (block) => {
    if (block === epoch + 1) {
      epoch++;

      const profiles = CoNET_Data?.profiles;
      if (!profiles) {
        return;
      }
      const runningList: any[] = [];

      runningList.push(getProfileAssets(profiles[0]));

      await Promise.all(runningList);

      if (CoNET_Data?.profiles[0]) callback(CoNET_Data?.profiles[0]);
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

    const [cCNTP, conet] = await Promise.all([
      scanCCNTP(key),
      scanCONETHolesky(key),
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

    const temp = CoNET_Data;

    if (!temp) {
      return false;
    }

    temp.profiles[0] = profile;

    console.log("ccntp balance", profile.tokens.cCNTP.balance);

    setCoNET_Data(temp);
  }

  return true;
};

const scanCCNTP = async (walletAddr: string) => {
  const erc20 = new ethers.Contract(
    contracts.ClaimableConetPoint.address,
    contracts.ClaimableConetPoint.abi,
    conetProvider
  );
  try {
    const result = await erc20.balanceOf(walletAddr);
    return result;
  } catch (ex) {
    console.log(`scan_erc20_balance Error!`);
    return false;
  }
};

const scanCONETHolesky = async (walletAddr: string) => {
  try {
    const result = await conetProvider.getBalance(walletAddr);
    return result;
  } catch (ex) {
    console.log(`scan_natureBalance Error!`, ex);
    return false;
  }
};

export { listenProfileVer };
