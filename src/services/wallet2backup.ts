import { CoNET_Data, setCoNET_Data } from "../utils/globals";
import {createKeyHDWallets} from './wallets'
import {
  customJsonStringify,
  initProfileTokens,
  isValidSolanaBase58PrivateKey,
  postToEndpoint,

} from "../utils/utils";
import Bs58 from "bs58";
import { Keypair } from "@solana/web3.js"

export const createOrGetWallet = async (secretPhrase: string, solanaPrivatekey: string) => {

	setCoNET_Data(null)
	
	const acc = createKeyHDWallets(secretPhrase)
	if (!acc) {
		return
	}



	const profile: profile = {
		tokens: initProfileTokens(),
		publicKeyArmor: acc.publicKey,
		keyID: acc.address,
		isPrimary: true,
		referrer: null,
		isNode: false,
		privateKeyArmor: acc.signingKey.privateKey,
		hdPath: acc.path,
		index: acc.index,
		type: "ethereum",
		webFilter: true
	}

	const data: any = {
		mnemonicPhrase: acc?.mnemonic?.phrase,
		profiles: [profile],
		isReady: true,
		ver: 0,
		nonce: 0,
	}

	let solanaKey
	try{
		
		const decoded = Bs58.decode(solanaPrivatekey)
		if (decoded.length !== 64) {
			return
		}

		solanaKey = Keypair.fromSecretKey(decoded);
	}catch(error){
		return
	}
	if (!solanaKey) {
		return 
	}
	const profile2: profile = {
		tokens: initProfileTokens(),
		publicKeyArmor: "",
		keyID: solanaKey.publicKey.toBase58(),
		isPrimary: true,
		referrer: null,
		isNode: false,
		privateKeyArmor: solanaPrivatekey,
		hdPath: null,
		index: 0,
		type: "solana"
	}

	data.profiles.push(profile2)

	setCoNET_Data(data)
	if (!CoNET_Data) return

	const profiles = CoNET_Data.profiles

	return profiles
};