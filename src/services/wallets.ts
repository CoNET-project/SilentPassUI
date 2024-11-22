import { ethers } from "ethers";
import { generateKey } from "openpgp";
import { customJsonStringify } from "../utils/utils";

const databaseName = "conet";
const XMLHttpRequestTimeout = 30 * 1000;
const apiv3_endpoint = `https://apiv3.conet.network/api/`;
const apiv4_endpoint = `https://apiv4.conet.network/api/`;
let getFaucetRoop = 0;
const conetRpc = "https://rpc.conet.network";

export const createOrGetWallet = async () => {
  if (!CoNET_Data?.profiles) {
    const acc = createKeyHDWallets();

    const key = await createGPGKey("", "", "");

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
      tickets: { balance: "0" },
    };

    CoNET_Data = {
      mnemonicPhrase: acc.mnemonic.phrase,
      profiles: [profile],
      isReady: true,
      ver: 0,
      nonce: 0,
    };
  }

  CoNET_Data.profiles.forEach(async (n) => {
    n.keyID = n.keyID.toLocaleLowerCase();
    await initV2(n);
    n.tokens.cCNTP.unlocked = false;
  });

  await getFaucet(
    CoNET_Data.profiles[0].keyID,
    CoNET_Data.profiles[0].privateKeyArmor
  );

  await storeSystemData();

  const profile = CoNET_Data.profiles[0];

  const cmd: channelWroker = {
    cmd: "profileVer",
    data: [profile],
  };

  sendState("toFrontEnd", cmd);
};

const createKeyHDWallets = () => {
  try {
    const root = ethers.Wallet.createRandom();
    return root;
  } catch (ex) {
    return null;
  }
};

const initProfileTokens = () => {
  const ret: conet_tokens = {
    CGPNs: {
      balance: "0",
      history: [],
      network: "CONET Guardian Nodes (CGPNs)",
      decimal: 1,
      contract: CONET_Guardian_NodesV3,
      name: "CGPNs",
    },
    CGPN2s: {
      balance: "0",
      history: [],
      network: "CONET Guardian Nodes (CGPN2s)",
      decimal: 1,
      contract: CONET_Guardian_NodesV3,
      name: "CGPN2s",
    },
    cCNTP: {
      balance: "0",
      history: [],
      network: "CONET Holesky",
      decimal: 18,
      contract: cCNTP_new_Addr,
      name: "cCNTP",
    },
    cBNBUSDT: {
      balance: "0",
      history: [],
      network: "CONET Holesky",
      decimal: 18,
      contract: Claimable_BNBUSDTv3,
      name: "cBNBUSDT",
    },
    cUSDB: {
      balance: "0",
      history: [],
      network: "CONET Holesky",
      decimal: 18,
      contract: Claimable_BlastUSDBv3,
      name: "cUSDB",
    },
    cUSDT: {
      balance: "0",
      history: [],
      network: "CONET Holesky",
      decimal: 18,
      contract: Claimable_ETHUSDTv3,
      name: "cUSDT",
    },
    conet: {
      balance: "0",
      history: [],
      network: "CONET Holesky",
      decimal: 18,
      contract: "",
      name: "conet",
    },
  };
  return ret;
};

const createGPGKey = async (passwd: string, name: string, email: string) => {
  const userId = {
    name: name,
    email: email,
  };
  const option = {
    type: "ecc",
    passphrase: passwd,
    userIDs: [userId],
    curve: "curve25519",
    format: "armored",
  };

  return await generateKey(option);
};

const getFaucet = async (keyId, privateKey: string) => {
  if (CoNET_Data?.profiles[0].tokens.conet.balance === "0") {
    if (++getFaucetRoop > 6) {
      getFaucetRoop = 0;
      logger(`getFaucet Roop > 6 STOP process!`);
      return null;
    }
    const url = `${apiv4_endpoint}conet-faucet`;
    let result;
    try {
      result = await postToEndpoint(url, true, { walletAddr: keyId });
    } catch (ex) {
      logger(`getFaucet postToEndpoint [${url}] error! `, ex);
      return null;
    }
    getFaucetRoop = 0;

    if (result) {
      return true;
    }

    return null;
  } else {
    const provide = new ethers.JsonRpcProvider(conetRpc);
    const wallet = new ethers.Wallet(privateKey, provide);
    const faucetSmartContract = new ethers.Contract(
      faucet_addr,
      faucetAbi,
      wallet
    );

    try {
      const tx = await faucetSmartContract.getFaucet();
      console.log(`success hash = ${tx.hash}`);
      return true;
    } catch (ex) {
      console.log(ex);
      return null;
    }
  }
};

const storeSystemData = async () => {
  if (!CoNET_Data) {
    return;
  }

  const password = "conet123";

  const data = {
    mnemonicPhrase: CoNET_Data.mnemonicPhrase,
    fx168Order: CoNET_Data.fx168Order || [],
    dammy: buffer.Buffer.allocUnsafeSlow(1024 * (20 + Math.random() * 20)),
    ver: CoNET_Data.ver || 1,
    upgradev2: CoNET_Data.upgradev2,
  };

  const waitEntryptData = buffer.Buffer.from(JSON.stringify(data));

  const filenameIterate1 = ethers.id(password);
  const filenameIterate2 = ethers.id(filenameIterate1);
  const filenameIterate3 = ethers.id(ethers.id(ethers.id(filenameIterate2)));

  const encryptIterate1 = await CoNETModule.aesGcmEncrypt(
    waitEntryptData,
    password
  );
  const encryptIterate2 = await CoNETModule.aesGcmEncrypt(
    encryptIterate1,
    filenameIterate1
  );
  const encryptIterate3 = await CoNETModule.aesGcmEncrypt(
    encryptIterate2,
    filenameIterate2
  );

  CoNET_Data.encryptedString = encryptIterate3;

  if (!CoNET_Data.encryptedString) {
    return logger(`encryptStoreData aesGcmEncrypt Error!`);
  }

  try {
    await storageHashData(
      "init",
      buffer.Buffer.from(customJsonStringify(CoNET_Data)).toString("base64")
    );
  } catch (ex) {
    logger(`storeSystemData storageHashData Error!`, ex);
  }
};

const storageHashData = async (docId: string, data: string) => {
  const database = new PouchDB(databaseName, { auto_compaction: true });

  let doc: any;
  try {
    doc = await database.get(docId, { latest: true });

    try {
      await database.put({ _id: docId, title: data, _rev: doc._rev });
    } catch (ex) {
      logger(`put doc storageHashData Error!`, ex);
    }
  } catch (ex: any) {
    if (/^not_found/.test(ex.name)) {
      try {
        await database.post({ _id: docId, title: data });
      } catch (ex) {
        logger(`create new doc storageHashData Error!`, ex);
      }
    } else {
      logger(`get doc storageHashData Error!`, ex);
    }
  }
};

const checkStorage = async () => {
  const database = new PouchDB(databaseName, { auto_compaction: true });

  try {
    const doc = await database.get("init", { latest: true });
    CoNET_Data = JSON.parse(buffer.Buffer.from(doc.title, "base64").toString());
  } catch (ex) {
    return logger(
      `checkStorage have no CoNET data in IndexDB, INIT CoNET data`
    );
  }
};

const initV2 = async (profile) => {
  const url = `${apiv3_endpoint}initV3`;
  const result = await postToEndpoint(url, true, {
    walletAddress: profile.keyID,
  });
  logger(result);
};

const postToEndpoint = (url: string, post: boolean, jsonData: any) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      clearTimeout(timeCount);

      if (xhr.status === 200) {
        if (!xhr.responseText.length) {
          return resolve("");
        }

        let ret;

        try {
          ret = JSON.parse(xhr.responseText);
        } catch (ex) {
          if (post) {
            return resolve("");
          }

          return resolve(xhr.responseText);
        }

        return resolve(ret);
      }

      logger(
        `postToEndpoint [${url}] xhr.status [${
          xhr.status === 200
        }] !== 200 Error`
      );

      return resolve(false);
    };

    xhr.onerror = (err) => {
      logger(`xhr.onerror`, err);
      clearTimeout(timeCount);
      return reject(err);
    };

    xhr.open(post ? "POST" : "GET", url, true);

    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");

    xhr.send(jsonData ? JSON.stringify(jsonData) : "");

    const timeCount = setTimeout(() => {
      const Err = `Timeout!`;
      logger(`postToEndpoint ${url} Timeout Error`, Err);
      reject(new Error(Err));
    }, XMLHttpRequestTimeout);
  });
};
