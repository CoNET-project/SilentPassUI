import { ethers, formatEther, formatUnits } from "ethers";
import { generateKey } from "openpgp";
import {
  customJsonStringify,
  initProfileTokens,
  postToEndpoint,
} from "../utils/utils";
import {
  apiv4_endpoint,
  conetDepinProvider,
  conetProvider,
  localDatabaseName,
} from "../utils/constants";
import contracts from "../utils/contracts";
import { CoNET_Data, setCoNET_Data } from "../utils/globals";
import * as Bip39 from "bip39";

import { Keypair } from "@solana/web3.js";
import Bs58 from "bs58";

const PouchDB = require("pouchdb").default;

interface SolanaWallet {
  publicKey: string;
  privateKey: string;
}

const initSolana = async (mnemonic: string): Promise<any> => {
  if (!Bip39.validateMnemonic(mnemonic)) return false;

  const seed = (await Bip39.mnemonicToSeed(mnemonic)).slice(0, 32);
  const keypair = Keypair.fromSeed(new Uint8Array(seed));

  return {
    publicKey: keypair.publicKey.toBase58(),
    privateKey: Bs58.encode(keypair.secretKey),
  };
};

const createOrGetWallet = async (secretPhrase: string | null) => {
  await checkStorage();

  if (secretPhrase) setCoNET_Data(null);

  if (!CoNET_Data || !CoNET_Data?.profiles) {
    const acc = createKeyHDWallets(secretPhrase);

    const key = await createGPGKey("", "", "");

    if (!acc) return;

    const profile: profile = {
      tokens: initProfileTokens(),
      publicKeyArmor: acc.publicKey,
      keyID: acc.address,
      isPrimary: true,
      referrer: null,
      isNode: false,
      pgpKey: {
        privateKeyArmor: key.privateKey,
        publicKeyArmor: key.publicKey,
      },
      privateKeyArmor: acc.signingKey.privateKey,
      hdPath: acc.path,
      index: acc.index,
      type: "ethereum",
    };

    const data: any = {
      mnemonicPhrase: acc?.mnemonic?.phrase,
      profiles: [profile],
      isReady: true,
      ver: 0,
      nonce: 0,
    };

    if (acc?.mnemonic?.phrase) {
      const result = await initSolana(acc?.mnemonic?.phrase);

      const profile2: profile = {
        tokens: initProfileTokens(),
        publicKeyArmor: "",
        keyID: result?.publicKey || "",
        isPrimary: true,
        referrer: null,
        isNode: false,
        pgpKey: {
          privateKeyArmor: key.privateKey,
          publicKeyArmor: key.publicKey,
        },
        privateKeyArmor: result?.privateKey || "",
        hdPath: null,
        index: 0,
        type: "solana",
      };

      data.profiles.push(profile2);
    }

    setCoNET_Data(data);
  }

  const tmpData = CoNET_Data;

  if (
    tmpData &&
    (tmpData?.profiles.length < 2 || tmpData?.profiles[1]?.type !== "solana")
  ) {
    const result = await initSolana(tmpData?.mnemonicPhrase);

    const key = await createGPGKey("", "", "");

    const profile2: profile = {
      tokens: initProfileTokens(),
      publicKeyArmor: "",
      keyID: result?.publicKey || "",
      isPrimary: true,
      referrer: null,
      isNode: false,
      pgpKey: {
        privateKeyArmor: key.privateKey,
        publicKeyArmor: key.publicKey,
      },
      privateKeyArmor: result?.privateKey || "",
      hdPath: null,
      index: 0,
      type: "solana",
    };

    tmpData.profiles[1] = profile2;
  }

  tmpData?.profiles.forEach(async (n: profile) => {
    n.tokens.cCNTP.unlocked = false;
  });

  setCoNET_Data(tmpData);

  if (!CoNET_Data) return;

  getFaucet(CoNET_Data.profiles[0]);

  storeSystemData();

  const profiles = CoNET_Data.profiles[0];

  return profiles;
};

const createKeyHDWallets = (secretPhrase: string | null) => {
  try {
    if (!secretPhrase) return ethers.Wallet.createRandom();

    return ethers.Wallet.fromPhrase(secretPhrase);
  } catch (ex) {
    return null;
  }
};

const createGPGKey = async (passwd: string, name: string, email: string) => {
  const userId = {
    name: name,
    email: email,
  };
  const option: any = {
    type: "ecc",
    passphrase: passwd,
    userIDs: [userId],
    curve: "curve25519",
    format: "armored",
  };

  return await generateKey(option);
};

const getCONET_api_health = async () => {
  const url = `${apiv4_endpoint}health`;
  const result: any = await postToEndpoint(url, false, null);
  if (result === true || result?.health === true) {
    return true;
  }
  return false;
};

const getFaucet: (profile: profile) => Promise<boolean | any> = async (
  profile
) =>
  new Promise(async (resolve) => {
    const conet = profile?.tokens?.conet;

    const health = await getCONET_api_health();
    if (!health) {
      return resolve(false);
    }

    const url = `${apiv4_endpoint}conet-faucet`;
    let result;
    try {
      result = await postToEndpoint(url, true, { walletAddr: profile.keyID });
    } catch (ex) {
      console.log(`getFaucet postToEndpoint [${url}] error! `, ex);
      return resolve(false);
    }
    setTimeout(() => {
      return resolve(true);
    }, 1000);
  });

export const storeSystemData = async () => {
  if (!CoNET_Data) {
    return;
  }

  try {
    await storageHashData(
      "init",
      Buffer.from(customJsonStringify(CoNET_Data)).toString("base64")
    );
  } catch (ex) {
    console.log(`storeSystemData storageHashData Error!`, ex);
  }
};

const storageHashData = async (docId: string, data: string) => {
  const database = PouchDB(localDatabaseName, { auto_compaction: true });

  let doc: any;
  try {
    doc = await database.get(docId, { latest: true });

    try {
      await database.put({ _id: docId, title: data, _rev: doc._rev });
    } catch (ex) {
      console.log(`put doc storageHashData Error!`, ex);
    }
  } catch (ex: any) {
    if (/^not_found/.test(ex.name)) {
      try {
        await database.post({ _id: docId, title: data });
      } catch (ex) {
        console.log(`create new doc storageHashData Error!`, ex);
      }
    } else {
      console.log(`get doc storageHashData Error!`, ex);
    }
  }
};

const checkStorage = async () => {
  const database = PouchDB(localDatabaseName, { auto_compaction: true });

  try {
    const doc = await database.get("init", { latest: true });
    const data = JSON.parse(Buffer.from(doc.title, "base64").toString());
    setCoNET_Data(data);
  } catch (ex) {
    return console.log(
      `checkStorage have no CoNET data in IndexDB, INIT CoNET data`
    );
  }
};

const requireFreePassport = async () => {
  if (!CoNET_Data) {
    return;
  }

  const wallet = new ethers.Wallet(
    CoNET_Data.profiles[0].privateKeyArmor,
    conetProvider
  );

  const freePassportContract = new ethers.Contract(
    contracts.PassportCancun.address,
    contracts.PassportCancun.abi,
    wallet
  );

  try {
    const tx = await freePassportContract.getFreePassport();
    console.log(`success hash = ${tx.hash}`);
  } catch (ex) {
    console.log(ex);
  }
};

const getCurrentPassportInfoInChain = async (chain: string) => {
  if (!CoNET_Data) {
    return;
  }
  let provider;
  let contractAddress;
  let contractAbi;

  if (chain === "mainnet") {
    provider = conetDepinProvider;
    contractAddress = contracts.PassportMainnet.address;
    contractAbi = contracts.PassportMainnet.abi;
  } else {
    provider = conetProvider;
    contractAddress = contracts.PassportCancun.address;
    contractAbi = contracts.PassportCancun.abi;
  }

  const wallet = new ethers.Wallet(
    CoNET_Data.profiles[0].privateKeyArmor,
    provider
  );

  const passportContract = new ethers.Contract(
    contractAddress,
    contractAbi,
    wallet
  );

  try {
    const result = await passportContract.getCurrentPassport(wallet.address);
    return result;
  } catch (ex) {
    console.log(ex);
  }
};

const changeActiveNFT = async (chain: string, nftId: string) => {
  if (!CoNET_Data) {
    return;
  }
  let provider;
  let contractAddress;
  let contractAbi;

  if (chain === "mainnet") {
    provider = conetDepinProvider;
    contractAddress = contracts.PassportMainnet.address;
    contractAbi = contracts.PassportMainnet.abi;
  } else {
    provider = conetProvider;
    contractAddress = contracts.PassportCancun.address;
    contractAbi = contracts.PassportCancun.abi;
  }

  const wallet = new ethers.Wallet(
    CoNET_Data.profiles[0].privateKeyArmor,
    provider
  );

  const passportContract = new ethers.Contract(
    contractAddress,
    contractAbi,
    wallet
  );

  try {
    const tx = await passportContract.changeActiveNFT(nftId);
    return tx;
  } catch (ex) {
    console.log(ex);
    throw ex;
  }
};

const estimateChangeNFTGasFee = async (chain: string, nftId: string) => {
  if (!CoNET_Data) {
    return;
  }

  let provider;
  let contractAddress;
  let contractAbi;

  if (chain === "mainnet") {
    provider = conetDepinProvider;
    contractAddress = contracts.PassportMainnet.address;
    contractAbi = contracts.PassportMainnet.abi;
  } else {
    provider = conetProvider;
    contractAddress = contracts.PassportCancun.address;
    contractAbi = contracts.PassportCancun.abi;
  }

  const wallet = new ethers.Wallet(
    CoNET_Data.profiles[0].privateKeyArmor,
    provider
  );

  const passportContract = new ethers.Contract(
    contractAddress,
    contractAbi,
    wallet
  );

  try {
    // Verify if the function exists
    if (!passportContract.changeActiveNFT) {
      throw new Error("Function changeActiveNFT not found in contract ABI.");
    }

    // Estimate gas usage
    const gasLimit = await passportContract.changeActiveNFT.estimateGas(nftId);

    // Get the gas price
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.ZeroAddress; // Ensure a fallback value

    // Calculate gas fee
    const gasFee = Number(gasLimit) * Number(gasPrice); // BigInt operation

    return {
      gasLimit: gasLimit.toString(),
      gasPrice: formatUnits(gasPrice, "gwei"),
      gasFee: formatEther(gasFee.toString()), // Convert to ETH
    };
  } catch (ex) {
    console.error("Gas estimation failed:", ex);
  }
};

const getCurrentPassportInfo = async () => {
  if (!CoNET_Data) {
    return;
  }

  const resultMainnet = await getCurrentPassportInfoInChain("mainnet");

  if (resultMainnet?.nftIDs?.toString() !== "0") {
    return resultMainnet;
  }

  const resultCancun = await getCurrentPassportInfoInChain("cancun");

  return resultCancun;
};

const tryToRequireFreePassport = async () => {
  if (!CoNET_Data) {
    return;
  }

  do {
    await getFaucet(CoNET_Data.profiles[0]);

    await new Promise((resolve) => setTimeout(resolve, 3000));
    await requireFreePassport();
    await new Promise((resolve) => setTimeout(resolve, 12000));
  } while (CoNET_Data.profiles[0].tokens.conet.balance < "0.0001");
};

const getVpnTimeUsed = async () => {
  if (!CoNET_Data?.profiles[0]) return;

  const profile = CoNET_Data.profiles[0];

  const wallet = new ethers.Wallet(
    CoNET_Data.profiles[0].privateKeyArmor,
    conetProvider
  );

  const freePassportContract = new ethers.Contract(
    contracts.PassportCancun.address,
    contracts.PassportCancun.abi,
    wallet
  );

  let vpnTimeUsedInMin = 0;

  try {
    vpnTimeUsedInMin = await freePassportContract.balanceOf(wallet.address, 3);
  } catch (ex) {
    console.log(`getVpnTimeUsed error!`, ex);
  }

  if (vpnTimeUsedInMin) {
    profile.vpnTimeUsedInMin = vpnTimeUsedInMin;
  }

  const temp = CoNET_Data;
  temp.profiles[0] = profile;
  setCoNET_Data(temp);
};

const getPassportsInfoForProfile = async (profile: profile): Promise<void> => {
  const tmpCancunPassports = await getPassportsInfo(profile, "cancun");
  const tmpMainnetPassports = await getPassportsInfo(profile, "mainnet");

  const _currentPassport = await getCurrentPassportInfo();

  profile = {
    ...profile,
    activePassport: {
      nftID: _currentPassport?.nftIDs?.toString(),
      expires: _currentPassport?.expires?.toString(),
      expiresDays: _currentPassport?.expiresDays?.toString(),
      premium: _currentPassport?.premium?.toString(),
    },
  };

  const cancunPassports: passportInfo[] = [];
  const mainnetPassports: passportInfo[] = [];

  for (let i = 0; i < tmpCancunPassports?.nftIDs?.length; i++) {
    cancunPassports.push({
      walletAddress: profile.keyID,
      nftID: parseInt(tmpCancunPassports.nftIDs[i].toString()),
      expires: parseInt(tmpCancunPassports.expires[i].toString()),
      expiresDays: parseInt(tmpCancunPassports.expiresDays[i].toString()),
      premium: tmpCancunPassports.premium[i],
      network: "Conet Holesky",
    });
  }

  for (let i = 0; i < tmpMainnetPassports?.nftIDs?.length; i++) {
    mainnetPassports.push({
      walletAddress: profile.keyID,
      nftID: parseInt(tmpMainnetPassports.nftIDs[i].toString()),
      expires: parseInt(tmpMainnetPassports.expires[i].toString()),
      expiresDays: parseInt(tmpMainnetPassports.expiresDays[i].toString()),
      premium: tmpMainnetPassports.premium[i],
      network: "CONET DePIN",
    });
  }

  let allPassports = cancunPassports.concat(mainnetPassports);

  if (profile.activePassport?.expiresDays !== "7")
    allPassports = allPassports?.filter(
      (passport) => passport.expiresDays !== 7
    );

  allPassports?.sort((a, b) => {
    return a.nftID - b.nftID;
  });

  profile.silentPassPassports = allPassports;

  const temp = CoNET_Data;

  if (!temp) {
    return;
  }

  temp.profiles[0] = profile;

  setCoNET_Data(temp);
};

const getPassportsInfo = async (
  profile: profile,
  chain: string
): Promise<passportInfoFromChain> => {
  let provider;
  let contractAddress;
  let contractAbi;

  if (chain === "mainnet") {
    provider = conetDepinProvider;
    contractAddress = contracts.PassportMainnet.address;
    contractAbi = contracts.PassportMainnet.abi;
  } else {
    provider = conetProvider;
    contractAddress = contracts.PassportCancun.address;
    contractAbi = contracts.PassportCancun.abi;
  }

  const wallet = new ethers.Wallet(profile.privateKeyArmor, provider);
  const passportContract = new ethers.Contract(
    contractAddress,
    contractAbi,
    wallet
  );

  try {
    const tx = await passportContract.getUserInfo(wallet.address);
    return tx;
  } catch (ex) {
    console.log(ex);
    return {
      nftIDs: [],
      expires: [],
      expiresDays: [],
      premium: [],
    };
  }
};

export {
  createOrGetWallet,
  createGPGKey,
  requireFreePassport,
  tryToRequireFreePassport,
  getCurrentPassportInfo,
  changeActiveNFT,
  estimateChangeNFTGasFee,
  getFaucet,
  getVpnTimeUsed,
  getPassportsInfoForProfile,
};
