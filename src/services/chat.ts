import {
	pgpCoNET
} from '@/utils/constants'
import {generateKey, readKey, } from 'openpgp'
import { CoNET_Data, setCoNET_Data } from "@/utils/globals"

type GenerateKeyArg = Parameters<typeof generateKey>[0]


const generatePgpKey = async (walletAddr: string, passwd: string ) => {
	const userIDs = [{ name: walletAddr }] // ✅ 单独声明，mutable

	const option = {
		type: 'ecc',
		passphrase: passwd,
		userIDs,
		curve: 'curve25519',
		format: 'armored'
	} as const

	// ✅ 这里 option.userIDs 仍会变 readonly（因为 as const 会冻结引用类型）
	// 所以需要在调用点转回 generateKey 的参数类型：
	const { privateKey, publicKey } = await generateKey(option as unknown as GenerateKeyArg)
	const publicKeyArmored = publicKey as unknown as string
	
	const keyObj = await readKey ({armoredKey: publicKeyArmored})
	const keyID = keyObj.getKeyIDs()[1].toHex().toUpperCase()
	return { privateKey, publicKey, keyID }
}

type searchKeyPGP = {
	userPgpKeyID: string
	userPublicKeyArmored: string
	routePublicKeyArmoreds: string[]
	routeOnlineStates: boolean[]
}

const getKeysFromCoNETPGPSC = async (keyID: string) => {

	try {
		const [info, privateKey] : [searchKeyPGP, string] = await Promise.all([
			pgpCoNET.searchKey(keyID),
			pgpCoNET.getEncryptedPrivateKey()
		])
		
		return {privateArmored: privateKey, publicArmored: info.userPublicKeyArmored, routersArmoreds: info.routePublicKeyArmoreds}
	} catch (ex) {
		return null
	}
}


export const initBeamioPGPKeys = async (profile: profile): Promise<initBeamioPGPKeysRet|null> => {
	
	const keyInfo = await getKeysFromCoNETPGPSC(profile.keyID)
	if (keyInfo?.privateArmored) {
		return {
			privateKey: keyInfo.privateArmored,
			publicKey: keyInfo.publicArmored,
			keyID: ''
		}
	}

	const keys = await generatePgpKey(profile.keyID,'')
	const ret: initBeamioPGPKeysRet = {
		privateKey: keys.privateKey as unknown as string,
		publicKey: keys.publicKey as unknown as string,
		keyID: keys.keyID

	}
	return ret
}