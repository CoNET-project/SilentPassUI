import { ethers } from "ethers";
import { generateKey } from "openpgp";
import {
  customJsonStringify,
  initProfileTokens,
  postToEndpoint,
  aesGcmEncrypt,
  aesGcmDecrypt
} from "../utils/utils";
import {
  apiv4_endpoint,
  conetProvider,
  localDatabaseName,
} from "../utils/constants";
import contracts from "../utils/contracts";
import { CoNET_Data, setCoNET_Data } from "../utils/globals";
import { Keypair } from "@solana/web3.js";
import { mnemonicToSeedSync } from "bip39";
import { sha512 } from "@noble/hashes/sha512";
import {mapLimit} from 'async'
const uuid62 = require('uuid62')

const PouchDB = require("pouchdb").default;

let isGetFaucetProcess = false;

let getFaucetRoop = 0;

// Function to derive the keypair from mnemonic
async function getSolanaKeypairFromMnemonic(mnemonic: string) {
  // Convert mnemonic to seed
  const seed = mnemonicToSeedSync(mnemonic);

  // Derive the seed for the first account using Solana's HD wallet path
  const derivedSeed = await deriveSolanaSeed(seed);

  // Generate a Keypair from the derived seed
  return Keypair.fromSeed(derivedSeed);
}

// Function to derive the seed for the given derivation path
async function deriveSolanaSeed(seed: any) {
  // Derive a 32-byte key from the seed using SHA512 (Solana's derivation process)
  const hash = sha512(seed);
  return hash.slice(0, 32); // Take the first 32 bytes as the private key
}

const convertSecretKeyToPrivateKey = (secretKey: any) => {
  // Extract the first 32 bytes (private key)
  const privateKey = secretKey.slice(0, 32);

  // Convert to a 64-character hex string (Ethereum format)
  const privateKeyHex = Buffer.from(privateKey).toString("hex");

  return privateKeyHex;
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
      const secondaryWallet: Keypair = await getSolanaKeypairFromMnemonic(
        acc?.mnemonic?.phrase
      );

      const privateKeyHex = convertSecretKeyToPrivateKey(
        secondaryWallet.secretKey
      );

      const profile2: profile = {
        tokens: initProfileTokens(),
        publicKeyArmor: secondaryWallet.publicKey.toString(),
        keyID: secondaryWallet.publicKey.toBase58(),
        isPrimary: true,
        referrer: null,
        isNode: false,
        pgpKey: {
          privateKeyArmor: key.privateKey,
          publicKeyArmor: key.publicKey,
        },
        privateKeyArmor: privateKeyHex,
        hdPath: null,
        index: 0,
        type: "solana",
      };

      data.profiles.push(profile2);
    }

    setCoNET_Data(data);
  }

  const tmpData = CoNET_Data;
  if (tmpData) tmpData.profiles.length = 2;

  if (
    tmpData &&
    (tmpData?.profiles.length < 2 || tmpData?.profiles[1]?.type !== "solana")
  ) {
    const secondaryWallet = await getSolanaKeypairFromMnemonic(
      tmpData.mnemonicPhrase
    );

    const privateKeyHex = convertSecretKeyToPrivateKey(
      secondaryWallet.secretKey
    );

    const key = await createGPGKey("", "", "");

    const profile2: profile = {
      tokens: initProfileTokens(),
      publicKeyArmor: secondaryWallet.publicKey.toString(),
      keyID: secondaryWallet.publicKey.toBase58(),
      isPrimary: true,
      referrer: null,
      isNode: false,
      pgpKey: {
        privateKeyArmor: key.privateKey,
        publicKeyArmor: key.publicKey,
      },
      privateKeyArmor: privateKeyHex,
      hdPath: null,
      index: 0,
      type: "solana",
    };

    tmpData.profiles[1] = profile2;
  }

  tmpData?.profiles.forEach(async (n: profile) => {
    n.keyID = n.keyID.toLocaleLowerCase();
    n.tokens.cCNTP.unlocked = false;
  });

  setCoNET_Data(tmpData);

  if (!CoNET_Data) return;

  await getFaucet(CoNET_Data.profiles[0]);

  await storeSystemData();

  const profile = CoNET_Data.profiles[0];

  return profile;
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

const requireFreePassport = async () => {
  if (!CoNET_Data) {
    return;
  }

  const wallet = new ethers.Wallet(
    CoNET_Data.profiles[0].privateKeyArmor,
    conetProvider
  );

  const freePassportContract = new ethers.Contract(
    contracts.FreePassport.address,
    contracts.FreePassport.abi,
    wallet
  );

  try {
    const tx = await freePassportContract.getFreePassport();
    console.log(`success hash = ${tx.hash}`);
  } catch (ex) {
    console.log(ex);
  }
};

const getFreePassportInfo = async () => {
  if (!CoNET_Data) {
    return;
  }

  const wallet = new ethers.Wallet(
    CoNET_Data.profiles[0].privateKeyArmor,
    conetProvider
  );

  const freePassportContract = new ethers.Contract(
    contracts.FreePassport.address,
    contracts.FreePassport.abi,
    wallet
  );

  try {
    const tx = await freePassportContract.getUserInfo(wallet.address);
    return tx;
  } catch (ex) {
    console.log(ex);
  }
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
    contracts.FreePassport.address,
    contracts.FreePassport.abi,
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

const NFTsProcess = async () => {
	if (!CoNET_Data?.profiles[0]) {
		return;
	}
	const profile = CoNET_Data.profiles[0];
	const message = JSON.stringify({ walletAddress: profile.keyID })
	const wallet = new ethers.Wallet(profile.privateKeyArmor)
	const signMessage = await wallet.signMessage(message)
	const sendData = {
        message, signMessage
    }
	const url = `${apiv4_endpoint}getTestNFTsNew`;
	try {
		const result: any = await postToEndpoint(url, true, sendData);
		return true
	} catch(ex) {
		return false
	}
}

const getNFTs = async () => {
	if (!CoNET_Data?.profiles[0]) {
		return null;
	}
	const profile = CoNET_Data.profiles[0]
	const contract_distributor = new ethers.Contract(contracts.distributor.address, contracts.distributor.abi, conetProvider)
	let _monthly: _distributorNFTs
	let _yearly: _distributorNFTs
	try {
		[_monthly, _yearly] = await 
		Promise.all([
			contract_distributor.getListOfMonthly(profile.keyID, 0, 100),
			contract_distributor.getListOfAnnual(profile.keyID, 0, 100)
		])

		
	} catch(ex) {
		return null
	}

	const monthly: distributorNFTs = {
		nfts: [],
		current: parseInt(_monthly.current.toString()),
		total: parseInt(_monthly.total.toString())
	}
	const yearly: distributorNFTs = {
		nfts: [],
		current: parseInt(_yearly.current.toString()),
		total: parseInt(_yearly.total.toString())
	}
	if (_monthly) {
		let index = 0
		await mapLimit(_monthly.nfts, 1, async (n, next) => {
			const item: distributorNFTItem = {
				id: parseInt(n.toString()),
				used: _monthly.used[index],
				code: _monthly.code[index] ? await aesGcmDecrypt(_monthly.code[index], profile.privateKeyArmor): '',
				showRedeemProcess: false
			}
			monthly.nfts.push(item)
			index ++
		})
	}
	if (_yearly) {
		let index = 0
		await mapLimit(_yearly.nfts, 1, async (n, next) => {
			const item: distributorNFTItem = {
				id: parseInt(n.toString()),
				used: _yearly.used[index],
				code: _yearly.code[index] ? await aesGcmDecrypt(_yearly.code[index], profile.privateKeyArmor): '',
				showRedeemProcess: false
			}
			yearly.nfts.push(item)
			index ++
		})

	}

	const ret: distributorNFTObj = {monthly, yearly}
	return ret
}

const checkApprovedForAll = async (wallet: ethers.Wallet) => {
	const passport_contract = new ethers.Contract(contracts.testPassport.address, contracts.testPassport.abi, wallet)
	try {
		const approved = await passport_contract.isApprovedForAll(wallet.address, contracts.distributor.address)
		if (!approved) {
			const tx = await passport_contract.setApprovalForAll(contracts.distributor.address, true)
			await tx.wait()
		}
	} catch (ex) {
		return false
	}
	return true
}

const redeemProcess = async(id: number, monthly: boolean) => {
	if (!CoNET_Data?.profiles[0]) {
		return null;
	}
	const profile = CoNET_Data.profiles[0]
	const wallet = new ethers.Wallet(profile.privateKeyArmor, conetProvider)
	if (!await checkApprovedForAll(wallet)) {
		return null
	}
	const contract_distributor = new ethers.Contract(contracts.distributor.address, contracts.distributor.abi, wallet)
	const RedeemCode = uuid62.v4()
	const encrypto = await aesGcmEncrypt(RedeemCode, profile.privateKeyArmor)
	const hash = ethers.id(encrypto)
	try {
		const tx = await contract_distributor._generatorCode(monthly, hash, encrypto)
		await tx.wait()
	} catch (ex) {
		return null
	}
	return RedeemCode
}


interface _distributorNFTs {
	nfts: BigInt[]
	used: boolean[]
	code: string[]
	current: BigInt
	total: BigInt
}

export interface distributorNFTItem {
	id: number
	used: boolean
	code: string
	showRedeemProcess: boolean
}

export interface distributorNFTs {
	nfts: distributorNFTItem[]
	current: number
	total: number
}

export interface distributorNFTObj {
	monthly: distributorNFTs
	yearly: distributorNFTs
}


export {
  createOrGetWallet,
  createGPGKey,
  requireFreePassport,
  tryToRequireFreePassport,
  getFreePassportInfo,
  getFaucet,
  getVpnTimeUsed,
  NFTsProcess,
  getNFTs,
  redeemProcess
};
