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
  conetDepinProvider,
  conetProvider,
  localDatabaseName,
} from "../utils/constants";
import contracts from "../utils/contracts";
import { CoNET_Data, setCoNET_Data } from "../utils/globals";
import { Keypair, PublicKey } from "@solana/web3.js";
import { sha512 } from "@noble/hashes/sha512";
import {mapLimit} from 'async'
import * as Bip39 from "bip39"
import Bs58 from "bs58"

const uuid62 = require('uuid62')

const PouchDB = require("pouchdb").default;

let isGetFaucetProcess = false;

let getFaucetRoop = 0;

interface SolanaWallet {
	publicKey: string;
	privateKey: string;
  }

const initSolana = async (mnemonic: string): Promise<any> => {
	if (!Bip39.validateMnemonic(mnemonic)) return false;
  
	const seed = (await Bip39.mnemonicToSeed(mnemonic)).slice(0, 32);
	const keypair = Keypair.fromSeed(new Uint8Array(seed));
    const ret: SolanaWallet = {
		publicKey: keypair.publicKey.toBase58(),
	  	privateKey: Bs58.encode(keypair.secretKey),
	}
	return ret
  };

// Function to derive the seed for the given derivation path
async function deriveSolanaSeed(seed: any) {
  // Derive a 32-byte key from the seed using SHA512 (Solana's derivation process)
  const hash = sha512(seed);
  return hash.slice(0, 32); // Take the first 32 bytes as the private key
}



const testSolana = (solanaPublicKey: string) => {
	try {
		const key = new PublicKey(solanaPublicKey)
	} catch (ex) {
		return false
	}
	return true
}

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
      const secondaryWallet = await initSolana(
        acc?.mnemonic?.phrase
      );


      const profile2: profile = {
        tokens: initProfileTokens(),
        publicKeyArmor: secondaryWallet.publicKey.toString(),
        keyID: secondaryWallet.publicKey,
        isPrimary: true,
        referrer: null,
        isNode: false,
        pgpKey: {
          privateKeyArmor: key.privateKey,
          publicKeyArmor: key.publicKey,
        },
        privateKeyArmor: secondaryWallet.secretKey,
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
    tmpData && ( tmpData?.profiles.length < 2 ||
     tmpData?.profiles[1]?.type !== "solana" || !testSolana(tmpData?.profiles[1]?.keyID))
  ) {
    const secondaryWallet = await initSolana(
      tmpData.mnemonicPhrase
    );

    const key = await createGPGKey("", "", "");

    const profile2: profile = {
      tokens: initProfileTokens(),
      publicKeyArmor: secondaryWallet.publicKey.toString(),
      keyID: secondaryWallet.publicKey,
      isPrimary: true,
      referrer: null,
      isNode: false,
      pgpKey: {
        privateKeyArmor: key.privateKey,
        publicKeyArmor: key.publicKey,
      },
      privateKeyArmor: secondaryWallet.privateKey,
      hdPath: null,
      index: 0,
      type: "solana",
    };

    tmpData.profiles[1] = profile2;
  }

//   tmpData?.profiles.forEach(async (n: profile) => {
//     n.keyID = n.keyID.toLocaleLowerCase();
//     n.tokens.cCNTP.unlocked = false;
//   });

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
	const contract_distributor = new ethers.Contract(contracts.distributor.address, contracts.distributor.abi, conetDepinProvider)
	let _monthly: _distributorNFTs|null= null
	let _yearly: _distributorNFTs|null = null
	try {
		_monthly = await contract_distributor.getListOfMonthly(profile.keyID, 0, 100)
	} catch (ex) {

	}
	try {
		_yearly = await contract_distributor.getListOfAnnual(profile.keyID, 0, 100)
	} catch(ex) {
		
	}

	const monthly: distributorNFTs = {
		nfts: [],
		current: _monthly ? parseInt(_monthly.current.toString()): 0,
		total: _monthly ?  parseInt(_monthly.total.toString()): 0
	}
	const yearly: distributorNFTs = {
		nfts: [],
		current: _yearly ? parseInt(_yearly.current.toString()): 0,
		total: _yearly ? parseInt(_yearly.total.toString()): 0
	}
	if (_monthly) {
		let index = 0
		await mapLimit(_monthly.nfts, 1, async (n, next) => {
			if (_monthly) {
				const item: distributorNFTItem = {
					id: parseInt(n.toString()),
					used: _monthly.used[index],
					code: _monthly.code[index] ? await aesGcmDecrypt(_monthly.code[index], profile.privateKeyArmor): '',
					showRedeemProcess: false
				}
				monthly.nfts.push(item)
				index ++
			}
			
		})
	}
	if (_yearly) {
		let index = 0
		await mapLimit(_yearly.nfts, 1, async (n, next) => {
			if (_yearly) {
				const item: distributorNFTItem = {
					id: parseInt(n.toString()),
					used: _yearly.used[index],
					code: _yearly.code[index] ? await aesGcmDecrypt(_yearly.code[index], profile.privateKeyArmor): '',
					showRedeemProcess: false
				}
				yearly.nfts.push(item)
				index ++
			}
			
		})

	}

	const ret: distributorNFTObj = {monthly, yearly}
	return ret
}

const checkApprovedForAll = async (wallet: ethers.Wallet) => {
	const passport_contract = new ethers.Contract(contracts.SPPassport.address, contracts.testPassport.abi, wallet)
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
	const wallet = new ethers.Wallet(profile.privateKeyArmor, conetDepinProvider)
	if (!await checkApprovedForAll(wallet)) {
		return null
	}
	const contract_distributor = new ethers.Contract(contracts.distributor.address, contracts.distributor.abi, wallet)
	const RedeemCode = uuid62.v4()
	const encrypto = await aesGcmEncrypt(RedeemCode, profile.privateKeyArmor)
	const _hash = ethers.solidityPacked(['string'], [RedeemCode])
    const hash = ethers.zeroPadBytes(_hash, 32)
	try {
		const tx = await contract_distributor._generatorCode(monthly, hash, encrypto)
		await tx.wait()
	} catch (ex) {
		return null
	}
	return RedeemCode
}

const RealizationRedeem_withSmartContract = async (profile: profile, solana: string, code: string) => {
	const wallet = new ethers.Wallet(profile.privateKeyArmor, conetProvider)
	const contract_distributor = new ethers.Contract(contracts.distributor.address, contracts.distributor.abi, wallet)
	try {
		const tx = await contract_distributor.codeToClient(code, solana)
		await tx.wait()
	} catch (ex) {
		return null
	}
	return true
}

const RealizationRedeem = async (code: string) => {
	if (!CoNET_Data?.profiles?.length) {
		return null;
	}
	const profile = CoNET_Data?.profiles[0]
	const solanaWallet = CoNET_Data?.profiles[1].keyID
	if (!solanaWallet||!profile) {
		return null;
	}
	const ethBalance = parseInt(profile.tokens.conet_eth.balance)
	if (ethBalance > 0.000001) {
		return await RealizationRedeem_withSmartContract(profile, solanaWallet, code)
	}
	const url = `${apiv4_endpoint}codeToClient`
	const message = JSON.stringify({ walletAddress: profile.keyID, solanaWallet })
	const wallet = new ethers.Wallet(profile.privateKeyArmor)
	const signMessage = await wallet.signMessage(message)
	const sendData = {
        message, signMessage
    }
	try {
		const result: any = await postToEndpoint(url, true, sendData);

	} catch(ex) {
		return null
	}
	return true
}

const recoverWallet = async (phrases: string[]) => {
  if (phrases.length !== 12) return;

  const fullPhrases = phrases.join(" ");
  const recoveredAccount = await ethers.Wallet.fromPhrase(fullPhrases);

  return recoveredAccount;
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
  redeemProcess,
  recoverWallet
};
