import { ethers } from "ethers";
import { generateKey } from "openpgp";
import {
  customJsonStringify,
  initProfileTokens,
  postToEndpoint,
} from "../utils/utils";
import {
  apiv3_endpoint,
  apiv4_endpoint,
  conetRpc,
  localDatabaseName,
} from "../utils/constants";
import { contracts } from "../utils/contracts";
import { CoNET_Data, setCoNET_Data } from "../utils/globals";
const PouchDB = require("pouchdb").default;

let getFaucetRoop = 0;

const createOrGetWallet = async () => {
  await checkStorage();

  if (!CoNET_Data || !CoNET_Data?.profiles) {
    const acc = createKeyHDWallets();

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
    };

    const data: any = {
      mnemonicPhrase: acc?.mnemonic?.phrase,
      profiles: [profile],
      isReady: true,
      ver: 0,
      nonce: 0,
    };

    setCoNET_Data(data);
  }

  const tmpData = CoNET_Data;

  tmpData?.profiles.forEach(async (n: profile) => {
    n.keyID = n.keyID.toLocaleLowerCase();
    n.tokens.cCNTP.unlocked = false;
  });

  setCoNET_Data(tmpData);

  if (!CoNET_Data) return;

  await getFaucet(
    CoNET_Data.profiles[0].keyID,
    CoNET_Data.profiles[0].privateKeyArmor
  );

  await storeSystemData();

  const profile = CoNET_Data.profiles[0];

  return profile;
};

const createKeyHDWallets = () => {
  try {
    const root = ethers.Wallet.createRandom();
    return root;
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

const getFaucet = async (keyId: string, privateKey: string) => {
  if (CoNET_Data?.profiles[0].tokens.conet.balance === "0") {
    if (++getFaucetRoop > 6) {
      getFaucetRoop = 0;
      console.log(`getFaucet Roop > 6 STOP process!`);
      return null;
    }
    const url = `${apiv4_endpoint}conet-faucet`;
    let result;
    try {
      result = await postToEndpoint(url, true, { walletAddr: keyId });
    } catch (ex) {
      console.log(`getFaucet postToEndpoint [${url}] error! `, ex);
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
      contracts.FaucetV3.address,
      contracts.FaucetV3.abi,
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

export { createOrGetWallet, createGPGKey };
