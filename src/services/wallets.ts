import { ethers, formatEther, formatUnits, parseEther } from "ethers";
import { generateKey } from "openpgp";
import {
  customJsonStringify,
  initProfileTokens,
  isValidSolanaBase58PrivateKey,
  postToEndpoint,

} from "../utils/utils";
import {allNodes} from './mining'
import {
  apiv4_endpoint,
  conetDepinProvider,
  conetProvider,
  localDatabaseName,
  rewardWalletAddress,
  payment_endpoint,
  paypal_endpoint,
  changeRPC,
  ethProvider
} from "../utils/constants";

import contracts from "../utils/contracts";
import { CoNET_Data, setCoNET_Data } from "../utils/globals";
import * as Bip39 from "bip39";
import { Connection, PublicKey } from "@solana/web3.js";
import { Keypair } from "@solana/web3.js";
import Bs58 from "bs58";
import { scanSolanaSol, scanSolanaSp } from "./listeners";
import axios from 'axios';
import { blast_CNTPAbi } from "./../utils/abis";

const SPOracleSmartContract = new ethers.Contract(contracts.SpOracle.address, contracts.SpOracle.abi, conetDepinProvider)
const PouchDB = require("pouchdb").default;
const initSolana = async (mnemonic: string): Promise<any> => {
	if (!Bip39.validateMnemonic(mnemonic)) return false;

	const seed = (await Bip39.mnemonicToSeed(mnemonic)).slice(0, 32);
	const keypair = Keypair.fromSeed(new Uint8Array(seed));

	return {
	  publicKey: keypair.publicKey.toBase58(),
	  privateKey: Bs58.encode(keypair.secretKey),
	};
  }

const isValidSolanaPublicKey = (publicKey: string) => {
	try{
		const walletPubKey = new PublicKey(publicKey);
	} catch(ex) {
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
	  (tmpData?.profiles.length < 2 ||
		tmpData?.profiles[1]?.type !== "solana" ||!isValidSolanaPublicKey(tmpData?.profiles[1]?.keyID) ||
		!isValidSolanaBase58PrivateKey(tmpData?.profiles[1]?.privateKeyArmor))
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

	const profiles = CoNET_Data.profiles;

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

const checkLocalStorageNodes = async () => {
	const database = PouchDB(localDatabaseName, { auto_compaction: true });

	try {
	  const doc = await database.get("nodes", { latest: true });
	  const data = JSON.parse(Buffer.from(doc.title, "base64").toString())
	  return data
	} catch (ex) {
	  return null
	}
}

const storageAllNodes = async (allNodes: any[]) => {
	await storageHashData('nodes', Buffer.from(JSON.stringify(allNodes)).toString('base64'))
}

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

const getCurrentPassportInfoInChain = async (
  walletAddress: string
) => {
  if (!CoNET_Data) {
    return;
  }
  let provider;
  let contractAddress;
  let contractAbi;


    provider = conetDepinProvider;
    contractAddress = contracts.distributor.address;
    contractAbi = contracts.distributor.abi;


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
    const result = await passportContract.getCurrentPassport(walletAddress);
    return result;
  } catch (ex) {
    console.log(ex);
  }
};

const activeNFTUrl = `${payment_endpoint}activeNFT`

const changeActiveNFT = async (nftId: string) => {
  if (!CoNET_Data?.profiles) {
    return
  }
  const profile = CoNET_Data.profiles[0]
  const solanaWallet = CoNET_Data.profiles[1].keyID
  try {
    const message = JSON.stringify({ walletAddress: profile.keyID, solanaWallet, data: nftId})
	const wallet = new ethers.Wallet(profile.privateKeyArmor)
	const signMessage = await wallet.signMessage(message)
	const sendData = {
      message, signMessage
    }

	const result = await postToEndpoint(activeNFTUrl, true, sendData)
	
	await getPassportsInfoForProfile(CoNET_Data.profiles[0])
    return true
  } catch (ex) {
    console.log(ex);
    return false
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
    if (!passportContract.changeActiveNFT) {
      throw new Error("Function changeActiveNFT not found in contract ABI.");
    }

    const gasLimit = await passportContract.changeActiveNFT.estimateGas(nftId);

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.ZeroAddress;

    const gasFee = Number(gasLimit) * Number(gasPrice);

    return {
      gasLimit: gasLimit.toString(),
      gasPrice: formatUnits(gasPrice, "gwei"),
      gasFee: formatEther(gasFee.toString()),
    };
  } catch (ex) {
    console.error("Gas estimation failed:", ex);
  }
};


const tryToRequireFreePassport = async () => {
  if (!CoNET_Data) {
    return;
  }

    await requireFreePassport();

};

const calculateTransferNftGas = async (toAddr: string, nftId: string) => {
  if (!CoNET_Data) {
    return;
  }

  let provider;
  let contractAddress;
  let contractAbi;

  provider = conetDepinProvider;
  contractAddress = contracts.PassportMainnet.address;
  contractAbi = contracts.PassportMainnet.abi;

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
    if (!passportContract.safeTransferFrom) {
      throw new Error("Function safeTransferFrom not found in contract ABI.");
    }

    const gasLimit = await passportContract.safeTransferFrom.estimateGas(
      wallet.address,
      toAddr,
      nftId,
      1,
      "0x"
    );

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.ZeroAddress;

    const gasFee = Number(gasLimit) * Number(gasPrice);

    return {
      gasLimit: gasLimit.toString(),
      gasPrice: formatUnits(gasPrice, "gwei"),
      gasFee: formatEther(gasFee.toString()),
    };
  } catch (ex) {
    console.error("Gas estimation failed:", ex);
  }
};

const transferNft = async (toAddr: string, nftId: string) => {
  if (!CoNET_Data) {
    return;
  }
  let provider;
  let contractAddress;
  let contractAbi;

  provider = conetDepinProvider;
  contractAddress = contracts.PassportMainnet.address;
  contractAbi = contracts.PassportMainnet.abi;

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
    const tx = await passportContract.safeTransferFrom(
      wallet.address,
      toAddr,
      nftId,
      1,
      "0x"
    );
    return tx;
  } catch (ex) {
    console.log(ex);
    throw ex;
  }
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
//   const tmpCancunPassports = await getPassportsInfo(profile, "cancun");
  const tmpMainnetPassports = await getPassportsInfo(profile, "mainnet");

  const _currentPassport = await getCurrentPassportInfoInChain(profile.keyID);

  profile = {
    ...profile,
    activePassport: {
      nftID: _currentPassport[0].toString(),
      expires: _currentPassport[1].toString(),
      expiresDays: _currentPassport[2].toString(),
      premium: _currentPassport[3].toString(),
    },
  };

  const cancunPassports: passportInfo[] = [];
  const mainnetPassports: passportInfo[] = [];

//   for (let i = 0; i < tmpCancunPassports?.nftIDs?.length; i++) {
//     cancunPassports.push({
//       walletAddress: profile.keyID,
//       nftID: parseInt(tmpCancunPassports.nftIDs[i].toString()),
//       expires: parseInt(tmpCancunPassports.expires[i].toString()),
//       expiresDays: parseInt(tmpCancunPassports.expiresDays[i].toString()),
//       premium: tmpCancunPassports.premium[i],
//       network: "Conet Holesky",
//     });
//   }
   const nowTime = new Date().getTime()
  for (let i = 0; i < tmpMainnetPassports?.nftIDs?.length; i++) {
    const expires = new Date (parseInt(tmpMainnetPassports.expires[i].toString()+'000')).getTime()
	if (expires > 0 && expires <= nowTime) {
		continue
	}

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

  allPassports = allPassports.filter((passport) => passport.nftID !== 0);

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
    contractAddress = contracts.distributor.address;
    contractAbi = contracts.distributor.abi;
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

let reflaseSolanaBalancesProcess = false
const refreshSolanaBalances = async (
) => {
	const solanaProfile = CoNET_Data?.profiles[1];

	if (!solanaProfile||reflaseSolanaBalancesProcess||!allNodes) {
	  return false
	}
	const _node1 = allNodes[Math.floor(Math.random() * (allNodes.length - 1))];
	reflaseSolanaBalancesProcess = true
		
		const solanaRPC_url = `https://${_node1.domain}/solana-rpc`;
		try {
			const [sol, sp, oracle] = await Promise.all([
			scanSolanaSol(solanaProfile.keyID, solanaRPC_url),
			scanSolanaSp(solanaProfile.keyID, solanaRPC_url),
			getSPOracle(),
			]);
			const solPrice = parseFloat(formatEther(oracle[4]).toString())
			const spPrice = parseFloat(formatEther(oracle[0]).toString())/2.49
			if (sol !== false) {
				const _sol = parseFloat(sol.toString())

				const sol1 = (_sol >= 1_000_000) ? (_sol/1_000_000).toFixed(3) + 'M' : _sol.toFixed(5)
				if (solanaProfile.tokens?.sol) {
					solanaProfile.tokens.sol.balance = sol1
					solanaProfile.tokens.sol.balance1 = _sol
				} else {
					solanaProfile.tokens.sol = {
					balance:sol1,
					balance1: _sol,
					network: "Solana Mainnet",
					decimal: 18,
					contract: "",
					name: "sol",
					usd: ''
					};
				}
			}
			if ( typeof solanaProfile.tokens.sol?.balance1 === 'number') {
				const sol_usd = solanaProfile.tokens.sol.balance1 * solPrice
				solanaProfile.tokens.sol.usd = sol_usd >= 1_000_000 ? (sol_usd/1_000_000).toFixed(2) + 'M' : sol_usd.toFixed(2)
			}
			

			if (sp !== false) {
				const _sp = parseFloat(sp.toString())
				const sp1 = (_sp >= 1_000_000) ? (_sp/1_000_000).toFixed(2) + 'M' : _sp.toFixed(2)
				if (solanaProfile.tokens?.sp) {
					solanaProfile.tokens.sp.balance = sp1
					solanaProfile.tokens.sp.balance1 = _sp
				} else {
					solanaProfile.tokens.sp = {
					balance: sp1,
					network: "Solana Mainnet",
					decimal: 18,
					contract: "",
					name: "sp",
					balance1: _sp,
					usd:''
					};
				}
			}
			if ( typeof solanaProfile.tokens.sp?.balance1 === 'number') {
				const sp_usd = solanaProfile.tokens.sp.balance1 / spPrice
				solanaProfile.tokens.sp.usd = sp_usd  >= 1_000_000 ? (sp_usd/1_000_000).toFixed(2) + 'M' : sp_usd.toFixed(2)
			}
			


			const temp = CoNET_Data;

			if (temp) {
				temp.profiles[1] = {
					...temp.profiles[1],
					tokens: {
					...temp.profiles[1].tokens,
					sp: solanaProfile.tokens.sp,
					sol: solanaProfile.tokens.sol,
					},
				};
				
				setCoNET_Data(temp);
			}

	reflaseSolanaBalancesProcess = false

	return true;
  } catch (ex) {
	reflaseSolanaBalancesProcess = false
    return false;
  }
};

const getSpClubInfo = async (profile: profile, currentPageInvitees: number) => {
  const temp = CoNET_Data;

  if (!temp) {
    return false;
  }

  const wallet = new ethers.Wallet(profile.privateKeyArmor, conetDepinProvider);
  const contract = new ethers.Contract(
    contracts.SpClub.address,
    contracts.SpClub.abi,
    wallet
  );

  if (!profile.spClub) {
    profile.spClub = {
      memberId: "0",
      referrer: "",
      referees: [],
      totalReferees: 0,
    };
  }

  try {
    const result = await contract.membership(profile.keyID);
    profile.spClub.memberId = result;
  } catch (error) {
    console.log(error);
  }

  if (profile.spClub.memberId) {
    try {
      const referrerResult = await contract.getReferrer(profile.keyID);

      if (
        referrerResult.referrer !== "0x0000000000000000000000000000000000000000"
      )
        profile.spClub.referrer = referrerResult.referrer;
      else profile.spClub.referrer = "";
    } catch (error) {
      console.log(error);
    }

    try {
      const refereesResult = await contract.getReferees(
        profile.keyID,
        currentPageInvitees
      );
      profile.spClub.totalReferees = Number(refereesResult._total_length);
      profile.spClub.referees = [];

      if (
        refereesResult?.referees?.length > 0 &&
        refereesResult?.referees?.[0] ===
          "0x0000000000000000000000000000000000000000"
      )
        profile.spClub.totalReferees = 0;

      const validReferees = refereesResult.referees.filter(
        (referee: string) =>
          referee !== "0x0000000000000000000000000000000000000000"
      );

      // Use map to handle async operations
      const refereePromises = validReferees.map(async (referee: string) => {
        const _activePassport = await getCurrentPassportInfoInChain(referee);

        const activePassport = {
          nftID: _activePassport?.nftIDs?.toString(),
          expires: _activePassport?.expires?.toString(),
          expiresDays: _activePassport?.expiresDays?.toString(),
          premium: _activePassport?.premium,
        };

        return {
          walletAddress: referee,
          activePassport: activePassport,
        };
      });

      // Wait for all promises to resolve
      profile.spClub.referees = await Promise.all(refereePromises);
    } catch (error) {
      console.log(error);
    }
  }

  temp.profiles[0] = profile;
  setCoNET_Data(temp);
};

const getRefereesPage = async (
  profile: profile,
  currentPageInvitees: number
) => {
  const temp = CoNET_Data;

  if (!temp) {
    return false;
  }

  const wallet = new ethers.Wallet(profile.privateKeyArmor, conetDepinProvider);
  const contract = new ethers.Contract(
    contracts.SpClub.address,
    contracts.SpClub.abi,
    wallet
  );

  if (!profile.spClub) {
    profile.spClub = {
      memberId: "0",
      referrer: "",
      referees: [],
      totalReferees: 0,
    };
  }

  try {
    const refereesResult = await contract.getReferees(
      profile.keyID,
      currentPageInvitees
    );
    profile.spClub.totalReferees = Number(refereesResult._total_length);
    profile.spClub.referees = [];

    if (
      refereesResult?.referees?.length > 0 &&
      refereesResult?.referees?.[0] ===
        "0x0000000000000000000000000000000000000000"
    )
      profile.spClub.totalReferees = 0;

    const validReferees = refereesResult.referees.filter(
      (referee: string) =>
        referee !== "0x0000000000000000000000000000000000000000"
    );

    // Use map to handle async operations
    const refereePromises = validReferees.map(async (referee: string) => {
      const _activePassport = await getCurrentPassportInfoInChain(referee);

      const activePassport = {
        nftID: _activePassport?.nftIDs?.toString(),
        expires: _activePassport?.expires?.toString(),
        expiresDays: _activePassport?.expiresDays?.toString(),
        premium: _activePassport?.premium,
      };

      return {
        walletAddress: referee,
        activePassport: activePassport,
      };
    });

    // Wait for all promises to resolve
    profile.spClub.referees = await Promise.all(refereePromises);
  } catch (error) {
    console.log(error);
  }

  temp.profiles[0] = profile;
  setCoNET_Data(temp);
};

const getSpClubMemberId = async (profile: profile) => {
  const wallet = new ethers.Wallet(profile.privateKeyArmor, conetDepinProvider);
  const contract = new ethers.Contract(
    contracts.SpClub.address,
    contracts.SpClub.abi,
    wallet
  );

  if (!profile.spClub) {
    profile.spClub = {
      memberId: "0",
      referrer: "",
      referees: [],
      totalReferees: 0,
    };
  }

  try {
    const result = await contract.membership(profile.keyID);
    profile.spClub.memberId = result;
  } catch (error) {
    console.log(error);
  }

  const temp = CoNET_Data;

  if (!temp) {
    return "0";
  }

  temp.profiles[0] = profile;
  setCoNET_Data(temp);

  return profile.spClub.memberId;
};

async function getReceivedAmounts (
  walletAddress: string,
  allNodes: nodes_info[]
) {
  try {
    const walletPubKey = new PublicKey(walletAddress);
    const senderPubKey = new PublicKey(rewardWalletAddress);
	const _node1 = allNodes[Math.floor(Math.random() * (allNodes.length - 1))];
    const _connection1 = new Connection(
      `https://${_node1.domain}/solana-rpc`,
      "confirmed"
    );

    // Step 1: Get transaction signatures
    const signatures = await _connection1.getSignaturesForAddress(walletPubKey, {
      limit: 20,
    });

    if (signatures.length === 0) {
      console.log("No transactions found.");
      return [];
    }

    // For only one transaction it works. Here's an example.
    // For multiple transactions it fails because the server doesn't support it.
    
    const transaction = await _connection1.getTransaction(
      signatures[0].signature,
      {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0, // Ensures we handle versioned transactions
      }
    );
    console.log(transaction);

    // Step 2: Fetch transactions with a delay to avoid rate limits
    // const transactions = [];
    // for (const sig of signatures) {
    //   const _node = allNodes[Math.floor(Math.random() * (allNodes.length - 1))];

    //   const _connection = new Connection(
    //     `https://${_node.domain}/solana-rpc`,
    //     "confirmed"
    //   );

    //   const tx = await _connection.getTransaction(sig.signature, {
    //     commitment: "confirmed",
    //     maxSupportedTransactionVersion: 0,
    //   });
    //   if (tx) transactions.push(tx);
    // }

    // Step 3: Filter transactions where sender matches
    // const receivedTransactions = transactions
    //   .filter((tx: any) => tx && tx.meta)
    //   .map((tx) => {
    //     if (!tx || !tx.meta) return null;

    //     // Get account balances before and after the transaction
    //     const preBalances = tx.meta.preBalances;
    //     const postBalances = tx.meta.postBalances;

    //     // Get account keys (supports both legacy & versioned transactions)
    //     const accountKeys =
    //       tx.transaction.message.getAccountKeys().staticAccountKeys;

    //     // Find the index of the recipient (walletAddress) in the account keys
    //     const recipientIndex = accountKeys.findIndex(
    //       (key: any) => key.toBase58() === walletPubKey.toBase58()
    //     );

    //     if (recipientIndex === -1) return null; // Wallet not found in the transaction

    //     // Calculate SOL received (in lamports, convert to SOL)
    //     const solReceived =
    //       (postBalances[recipientIndex] - preBalances[recipientIndex]) / 1e9;

    //     // Extract token transfers (SPL tokens)
    //     const tokenTransfers = tx.meta.postTokenBalances?.map(
    //       (tokenBalance: any) => {
    //         const preToken = tx?.meta?.preTokenBalances?.find(
    //           (pre) =>
    //             pre.mint === tokenBalance.mint && pre.owner === walletAddress
    //         );

    //         const receivedAmount =
    //           (tokenBalance.uiTokenAmount.uiAmount || 0) -
    //           (preToken?.uiTokenAmount.uiAmount || 0);

    //         return {
    //           mint: tokenBalance.mint,
    //           receivedAmount,
    //         };
    //       }
    //     );

    //     return {
    //       signature: tx.transaction.signatures[0],
    //       solReceived,
    //       tokenTransfers,
    //     };
    //   });

    // console.log(receivedTransactions.filter((tx: any) => tx !== null));

    // return receivedTransactions.filter((tx: any) => tx !== null);
  } catch (error) {
    console.error("Error fetching transaction history:", error);
    return [];
  }
};

const getSPOracle = async () => {
	try {
		const quote = await SPOracleSmartContract.getQuote()
		return quote
	} catch (ex) {
		return null
	}
}

const getRewordStaus = async(): Promise<boolean> => {
	const contract_SpReward = new ethers.Contract(contracts.SpReword.address, contracts.SpReword.abi, conetDepinProvider)

	

	const profiles = CoNET_Data?.profiles
	if (!profiles || profiles.length < 2 ) {
		return false
	}
	try {
		const [ quote, status ] = await Promise.all ([
			getSPOracle(),
			contract_SpReward.isReadyReword(profiles[0].keyID, profiles[1].keyID),
			refreshSolanaBalances()
			
		])

		const price = formatEther(quote[2].toString())
		const initBalance = parseInt(status[1].toString())/10 ** 6
		const spReworkBalance = parseInt(price.toString())
		const SPBalance = profiles[1].tokens?.sp?.balance1
		//		balance < price && (initBalance === 0 || initBalance > 0 && initBalance > balance)
		if (SPBalance === undefined ||  SPBalance < spReworkBalance && (initBalance === 0 || initBalance > 0 && initBalance > SPBalance)) {
			return false
		}
		return status[0]
	} catch (ex) {
		return false
	}
	
}

const spRewardRequest = async (): Promise<number> => {
	if (!CoNET_Data) {
		return 0
	}
	let ret = 0
	const profile = CoNET_Data?.profiles[0]
	const solanaWallet = CoNET_Data?.profiles[1].keyID
	if (!solanaWallet||!profile) {
		return 0
	}
	
	const url = `${payment_endpoint}spReward`
	const message = JSON.stringify({ walletAddress: profile.keyID, solanaWallet})
	const wallet = new ethers.Wallet(profile.privateKeyArmor)
	const signMessage = await wallet.signMessage(message)
	const sendData = {
      message, signMessage
    }

	const result = await postToEndpoint(url, true, sendData)
	if (result === false) {
		return -1
	}
	await getPassportsInfoForProfile(CoNET_Data.profiles[0])

	return ret

}
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




const scanCONETDepin = async (walletAddr: string) => {
	return await scan_erc20_balance(
	  walletAddr,
	  contracts.ConetDepin.address,
	  contracts.ClaimableConetPoint.abi,
	  conetDepinProvider
	);
  };

  const scan_natural_balance = async (walletAddr: string, provider: any) => {
	try {
	  const result = await provider.getBalance(walletAddr);
	  return result;
	} catch (ex) {
	  changeRPC()
	  console.log(`scan_natureBalance Error!`);
	  return false;
	}
  };
const scanConetETH = async (walletAddr: string) => {
  return await scan_natural_balance(walletAddr, conetDepinProvider);
};
const scanETH = async (walletAddr: string) => {
	return await scan_natural_balance(walletAddr, ethProvider);
};
const ReferralsContract = new ethers.Contract(contracts.Referrals.address, contracts.Referrals.abi, conetDepinProvider)
const getReferrals = async (key: string) => {
	try {
		const ret = await ReferralsContract._referees(key)
		if (ret === ethers.ZeroAddress) {
			return null
		}
		return ret
	} catch (ex) {
		return null
	}
}
const SPClubPointContract = new ethers.Contract(contracts.SPClubPoint.address, contracts.SPClubPoint.abi, conetDepinProvider)
const getSPClubPoint = async (key: string) => {
	try {
		const points = await SPClubPointContract.getAllPoints(key)
		return points
	} catch (ex) {
		return null
	}
}
const getProfileAssets = async (profile: profile, solanaProfile: profile) => {
  const key = profile.keyID;

  if (key) {
	if (!profile.tokens) {
	  profile.tokens = initProfileTokens();
	}

	const [conetDepin, conet_eth, referrals, points] = await Promise.all([
	  scanCONETDepin(key),
	  scanConetETH(key),
	  getReferrals(key),
	  getSPClubPoint(key)
	]);

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

	// if (profile.tokens?.eth) {
	//   profile.tokens.eth.balance =
	// 	eth === false ? "" : parseFloat(ethers.formatEther(eth)).toFixed(6);
	// } else {
	//   profile.tokens.eth = {
	// 	balance:
	// 	  eth === false ? "" : parseFloat(ethers.formatEther(eth)).toFixed(6),
	// 	network: "ETH",
	// 	decimal: 18,
	// 	contract: "",
	// 	name: "eth",
	//   };
	// }

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

	profile.referrer = referrals
	
	profile.SpClubPoints = {
		SPHolderPoint: points ? parseInt(points[0].toString()):0,
		RefferentSPHolderPoint: points ? parseInt(points[1].toString()):0,
		SubscriptionPoint: points ? parseInt(points[2].toString()):0,
		RefferentSubscriptionPoint: points ? parseInt(points[3].toString()):0,
		ClaimableSubscriptionPoint: points ? parseInt(points[4].toString()):0,
		ClaimableRefferentSubscriptionPoint: points ? parseInt(points[5].toString()):0
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

/* const checkApprovedForAll = async (wallet: ethers.Wallet) => {
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
} */


const listenersRealizationRedeem = (SC: ethers.Contract, profileKey: string): Promise<number> => new Promise(async resolve => {
	const distributor_addr = contracts.distributor.address.toLowerCase()
	let currentBlock = await conetDepinProvider.getBlockNumber()
	const checkCNTPTransfer = (tR: ethers.TransactionReceipt) => {
		for (let log of tR.logs) {
			const LogDescription = SC.interface.parseLog(log)

			if (LogDescription?.name === 'TransferSingle') {
				const toAddress  = LogDescription.args[1]
				if (toAddress.toLowerCase() == profileKey) {
					const nftID = LogDescription.args[2]
					conetDepinProvider.removeListener('block', listenBlock)
					clearTimeout(_time)
					return resolve (parseInt(nftID.toString()))
				}
			}
		}
	}

	const listenBlock = async (block: number) => {
		if (block > currentBlock) {
			currentBlock = block
			const blockTs = await conetDepinProvider.getBlock(block)
			if (!blockTs?.transactions) {
				return
			}
			console.log(`listenersRealizationRedeem ${block} has process now!`)
			for (let tx of blockTs.transactions) {
				const event = await conetDepinProvider.getTransactionReceipt(tx)

				if ( event?.to?.toLowerCase() === distributor_addr) {
					checkCNTPTransfer(event)
				}
			}
		}
	}

	conetDepinProvider.on('block', listenBlock)

	const _time = setTimeout(() => {
		//		TimeOUT
		// conetDepinProvider.removeListener('block', listenBlock)
		// resolve (null)
	}, 1000 * 180)
})

const RealizationRedeem_withSmartContract = async (profile: profile, solana: string, code: string): Promise<null|number> => {
	const wallet = new ethers.Wallet(profile.privateKeyArmor, conetDepinProvider)
	const contract_distributor = new ethers.Contract(contracts.distributor.address, contracts.distributor.abi, wallet)
	try {
		const tx = await contract_distributor.codeToClient(code, solana)
		const nftID = await listenersRealizationRedeem(contract_distributor, profile.keyID.toLowerCase())
		return nftID
	} catch (ex) {
    	console.log("EX: ", ex);
		return null
	}

}

const RealizationRedeem = async (code: string): Promise<null|number> => {
	if (!CoNET_Data?.profiles?.length) {
		return null;
	}
	const profile = CoNET_Data?.profiles[0]
	const solana = CoNET_Data?.profiles[1]
	const solanaWallet = solana.keyID
	if (!solanaWallet||!profile) {
		return null;
	}
	// const ethBalance = parseFloat(profile.tokens.conet_eth.balance)
	// if (ethBalance > 0.000001) {
	// 	return await RealizationRedeem_withSmartContract(profile, solanaWallet, code)
	// }

	const url = `${apiv4_endpoint}codeToClient`
	const message = JSON.stringify({ walletAddress: profile.keyID, solanaWallet, uuid: code })
	const wallet = new ethers.Wallet(profile.privateKeyArmor)
	const signMessage = await wallet.signMessage(message)
	const sendData = {
      message, signMessage
    }
	try {
		const result = await postToEndpoint(url, true, sendData)
		if (typeof result === 'boolean'|| result === ''|| result?.error ) {
			return null
		}
		return result.status
	} catch(ex) {
    	console.log("EX: ", ex);
		return null
	}
}

const waitingNFT = (wallet: ethers.Wallet) => new Promise(async resolve => {
	const passportNFT = new ethers.Contract(contracts.PassportMainnet.address, contracts.PassportMainnet.abi, wallet)
	const distributor_addr = contracts.distributor.address.toLowerCase()
	let currentBlock = await conetDepinProvider.getBlockNumber()
	let myWallet = wallet.address.toLowerCase()
	const checkCNTPTransfer = (tR: ethers.TransactionReceipt) => {
		for (let log of tR.logs) {
			const LogDescription = passportNFT.interface.parseLog(log)

			if (LogDescription?.name === 'TransferSingle') {
				const toAddress  = LogDescription.args[2]
				if (toAddress.toLowerCase() == myWallet) {
					const nftID = LogDescription.args[3]
					conetDepinProvider.removeListener('block', listenning)
					clearTimeout(_time)
					checkFreePassportProcess = 40

					return resolve (parseInt(nftID.toString()))
				}
			}
		}
	}

	const listenning = async (block: number) => {
		checkFreePassportProcess = 30
		if (block > currentBlock) {
			currentBlock = block
			const blockTs = await conetDepinProvider.getBlock(block)
			if (!blockTs?.transactions) {
				return
			}
			console.log(`listenersRealizationRedeem ${block} has process now!`)
			for (let tx of blockTs.transactions) {
				const event = await conetDepinProvider.getTransactionReceipt(tx)

				if ( event?.to?.toLowerCase() === distributor_addr) {
					checkCNTPTransfer(event)
				}
			}
		}
	}

	conetDepinProvider.on('block', listenning)
	const _time = setTimeout(() => {
		//		TimeOUT
		resolve (null)
		conetDepinProvider.removeListener('block', listenning)
		checkFreePassportProcess = 0
	}, 1000 * 60)
})


const getFreeNFT = async (wallet: ethers.Wallet) => {
	if (!await getCONET_api_health()) {
		checkFreePassportProcess = 0
		return null
	}
	checkFreePassportProcess = 20

	const url = `${apiv4_endpoint}freePassport`
	const message = JSON.stringify({ walletAddress: wallet.address})
	const signMessage = await wallet.signMessage(message)
	const sendData = {
		message, signMessage
	}
	try {
		const result: any = await postToEndpoint(url, true, sendData);
		return await waitingNFT (wallet)

	} catch(ex) {
		console.log("EX: ", ex);
		checkFreePassportProcess = 0
		return null
	}
}

let checkFreePassportProcess = 0
const checkFreePassport = async () => {
	if (!CoNET_Data?.profiles?.length) {
		checkFreePassportProcess = -1
		return null;
	}
	if (checkFreePassportProcess > 0) {
		return
	}
	checkFreePassportProcess = 10
	const profile = CoNET_Data?.profiles[0]

	const wallet = new ethers.Wallet(profile.privateKeyArmor, conetDepinProvider)
	const contract_distributor = new ethers.Contract(contracts.distributor.address, contracts.distributor.abi, wallet)
	let canGetFreeNFT: boolean
	let currentNFT
	try {
		[canGetFreeNFT, currentNFT] = await
		Promise.all ([
			contract_distributor._freeUserOwnerShip(wallet.address),
			contract_distributor.getCurrentPassport(wallet.address)
		])

	} catch (ex) {
		checkFreePassportProcess = 0
		return null
	}

	const nftID = parseInt(currentNFT[0].toString())

	if (!canGetFreeNFT || !nftID ) {
		await getFreeNFT (wallet)
		await getPassportsInfoForProfile(profile)

		checkFreePassportProcess = 50
		return true
	}
	checkFreePassportProcess = 50
	return true
}

const getPaymentUrl = async (price: number) => {
	if (!CoNET_Data?.profiles?.length) {
		return null;
	}
	const profile = CoNET_Data?.profiles[0]
	const solanaWallet = CoNET_Data?.profiles[1].keyID
	if (!solanaWallet||!profile) {
		return null;
	}

	const url = `${payment_endpoint}payment_stripe`
	const message = JSON.stringify({ walletAddress: profile.keyID, solanaWallet, price})
	const wallet = new ethers.Wallet(profile.privateKeyArmor)
	const signMessage = await wallet.signMessage(message)
	const sendData = {
      message, signMessage
    }
	const result = await postToEndpoint(url, true, sendData)
	return result
}


const waitingPaymentStatus = async (): Promise<false|number> => {
	if (!CoNET_Data?.profiles?.length) {
		return false;
	}
	const profile = CoNET_Data?.profiles[0]
	const solanaWallet = CoNET_Data?.profiles[1]
	if (!solanaWallet||!profile) {
		return false;
	}

	const url = `${payment_endpoint}payment_stripe_waiting`
	const message = JSON.stringify({ walletAddress: profile.keyID})
	const wallet = new ethers.Wallet(profile.privateKeyArmor)
	const signMessage = await wallet.signMessage(message)
	const sendData = {
      message, signMessage
    }
	let waitingPaymentStatusLoop = 0
	const waiting = async (): Promise<false|number> => new Promise(async resolve => {
		const result = await postToEndpoint(url, true, sendData)
		
		if (result.status < 100|| result === false) {
			if (waitingPaymentStatusLoop > 50 ) {
				return resolve(false)
			}
			return setTimeout(() => {
				return waiting().then (jj => resolve(jj))
			}, 10 * 1000)
		}
		return resolve(result.status)
	})

	const result = await waiting ()

	return result
}

const getPaypalUrl = async (price: number) => {
	if (!CoNET_Data?.profiles?.length) {
	  return null;
	}
	const profile = CoNET_Data?.profiles[0]
	const solanaWallet = CoNET_Data?.profiles[1].keyID
	if (!solanaWallet||!profile) {
	  return null;
	}
  
	const url = `${paypal_endpoint}app/api/Order/createOrderNftStr?`;
	const message = JSON.stringify({ walletAddress: profile.keyID, solana: solanaWallet, price})
	const wallet = new ethers.Wallet(profile.privateKeyArmor)
	const signMessage = await wallet.signMessage(message)
	const res = await axios.post(url, {message, signMessage})
	return res.data;
}

export {
  createOrGetWallet,
  createGPGKey,
  requireFreePassport,
  tryToRequireFreePassport,
  getCurrentPassportInfoInChain,
  changeActiveNFT,
  estimateChangeNFTGasFee,
  getFaucet,
  calculateTransferNftGas,
  transferNft,
  getVpnTimeUsed,
  getPassportsInfoForProfile,
  refreshSolanaBalances,			//			refreshSolanaBalances
  getSpClubInfo,
  getSpClubMemberId,
  getRefereesPage,
  getReceivedAmounts,
  RealizationRedeem,
  checkFreePassport,
  checkFreePassportProcess,
  getPaymentUrl,
  waitingPaymentStatus,
  getSPOracle,
  getPaypalUrl,
  getRewordStaus,
  spRewardRequest,
  checkLocalStorageNodes,
  storageAllNodes,
  getProfileAssets
};
