import {generateKey, readKey, createMessage, enums, encrypt} from 'openpgp'
import {
	ensureNativePushBoundForWallet,
	injectNativeChatPgpSecretsFromProfile,
} from '@/utils/cashTreesPushBind'
import { isCashTreesNativeWebView, postNativePgpCiphertext, setNativeVoiceRelayNodes } from '@/utils/cashTreesNativeNfc'
import { CoNET_Data, setCoNET_Data } from "@/utils/globals"

import {GuardianNodesMainnet, conetDepinProvider, beamioApi} from '@/utils/constants'
import contracts from '@/utils/contracts'
import {ethers} from 'ethers'
import {aesGcmEncrypt, aesGcmDecrypt, toBase64, fromBase64, storeSystemData } from '@/services/beamio'
import { publishNativePwaLog } from '@/utils/cashTreesNativePwaLog'
import { sendChatViaNativeDaemon, getWorkerGossipListenParams, getWorkerGossipRouteArmor, isWorkerGossipActive, isWorkerGossipBusy, isNativeChatListenOwner, pauseNativeChatListen, resumeNativeChatListen, retargetWorkerGossipRoute, startWorkerGossipListen, stopWorkerGossip } from '@/services/chatWorkerBridge'
import { isCashTreesAndroidChatModuleAvailable, isCashTreesAndroidChatModuleRunning } from '@/utils/cashTreesAndroidConetChat'
import { wrapArmorToMailboxWork } from '@conet.project/chat-sdk'
import { planOwnChatRoute, readOwnChainState, recheckListenRoute, resolveCurrentMailbox } from '@/services/chatOwnRoutePlan'
import type { OwnPrivateBlob } from '@/services/chatOwnRoutePlan'

function chatBootLog(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
	publishNativePwaLog(level, `[Chat] ${message}`)
}


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

/** 从公钥 Armored 获取 KeyID，与整个 CONET 一致的格式 */
export const getPublicKeyArmoredKeyID = async (publicKeyArmored: string): Promise<string> => {
	const keyObj = await readKey({ armoredKey: publicKeyArmored })
	return keyObj.getKeyIDs()[1].toHex().toUpperCase()
}
/**
 * userPgpKeyID (string) : 

userPublicKeyArmored (string) : 

routePgpKeyID (string) : 

routePublicKeyArmored (string) : 

routeOnline (bool) : 
 */
type searchKeyPGP = {
	userPgpKeyID: string
	userPublicKeyArmored: string
	routePgpKeyID: string
	routePublicKeyArmored: string
	routeOnline: boolean
}

export const getRandomNode = (allNodes: nodeInfo[]): nodeInfo|null => {
	if (!allNodes.length) return null
	const random = Math.floor(Math.random() * allNodes.length)
	const node = allNodes[random]
	return node
}

/** 随机抽取 n 个不重复的 node（用于 sendMessage 双节点并行 post） */
export const getRandomNodes = (allNodes: nodeInfo[], n: number): nodeInfo[] => {
	if (!allNodes.length || n <= 0) return []
	const shuffled = [...allNodes].sort(() => Math.random() - 0.5)
	return shuffled.slice(0, Math.min(n, shuffled.length))
}

/** 检查是否为有效的 ethers 私钥（64 位 hex，可选 0x 前缀） */
const isValidEthersPrivateKey = (pk: unknown): pk is string => {
	if (!pk || typeof pk !== 'string') return false
	const s = String(pk).trim().replace(/^0x/i, '')
	return /^[0-9a-fA-F]{64}$/.test(s)
}

/** 按钱包地址从 AddressPGP 获取 PGP（searchKey 接受 address） */
export const getKeysFromCoNETPGPSCByAddress = async (walletAddress: string) => {
	return getKeysFromCoNETPGPSC(walletAddress)
}

/**
 * Public PGP key and mailbox route of any wallet, from AddressPGP `searchKey`.
 *
 * The contract runner is the provider, not a Wallet, so the eth_call carries no
 * `from`. With a Wallet runner ethers fills `from` with our own address, and the
 * RPC operator could link our wallet and IP to the peer we look up.
 * `searchKey(to)` reads only `to`, so the answer is the same.
 */
export const getKeysFromCoNETPGPSC = async (walletAddress: string) => {
	if (!ethers.isAddress(walletAddress)) {
		console.warn('[getKeysFromCoNETPGPSC] not a wallet address, skipping')
		return null
	}
	const contract = contracts.constPgpManager
	const SC = new ethers.Contract(contract.address, contract.abi, conetDepinProvider)
	try {
		const info: searchKeyPGP = await SC.searchKey(walletAddress)
		let publicArmored = ''
		if (info.userPublicKeyArmored) {
			publicArmored = fromBase64(info.userPublicKeyArmored)
		}
		const routersArmoreds = info.routePublicKeyArmored ? fromBase64(info.routePublicKeyArmored) : ''
		if (!publicArmored && !routersArmoreds) {
			return null
		}

		rememberRecipientRoute(publicArmored, routersArmoreds)
		// Presence is NOT chain routeOnline (SI abandoned setUserOnlineOnMe).
		// UI online comes from mailbox `wallet_online_query` — see refreshChatMailboxPresence.
		return {
			publicArmored,
			routersArmoreds,
			online: false,
			routePgpKeyID: info.routePgpKeyID,
			userPgpKeyID: info.userPgpKeyID,
		}
	} catch (ex) {
		return null
	}
}

/**
 * Our own AddressPGP record plus our PGP private key. Only for loading our own
 * profile; never call it for a peer.
 *
 * The public part comes from `getKeysFromCoNETPGPSC` (no `from`).
 * `getEncryptedPrivateKey()` reads msg.sender, so that one call has to carry our
 * own address. A decrypt failure keeps the public part.
 */
export const getOwnKeysFromCoNETPGPSC = async (privateKeyArmor: string) => {
	if (!isValidEthersPrivateKey(privateKeyArmor)) {
		console.warn('[getOwnKeysFromCoNETPGPSC] invalid privateKeyArmor format, skipping')
		return null
	}
	let Wallet: ethers.Wallet
	try {
		Wallet = new ethers.Wallet(privateKeyArmor, conetDepinProvider)
	} catch (ex: any) {
		console.warn('[getOwnKeysFromCoNETPGPSC] Wallet creation failed:', ex?.message || ex)
		return null
	}
	const keys = await getKeysFromCoNETPGPSC(Wallet.address)
	if (!keys) return null
	let privateArmored = ''
	try {
		const contract = contracts.constPgpManager
		const SC = new ethers.Contract(contract.address, contract.abi, Wallet)
		const encrypted: string = await SC.getEncryptedPrivateKey()
		if (encrypted) {
			try {
				privateArmored = await aesGcmDecrypt(encrypted, privateKeyArmor)
			} catch {
				// Cannot decrypt our own blob — keep the public part.
			}
		}
	} catch {
		// Private fetch failed — keep the public part.
	}
	return { ...keys, privateArmored }
}



/**
 * Last non-empty Guardian list. A chain RPC hiccup (for example while every SI
 * node restarts) used to return [] and stop chat until the app was restarted.
 */
let lastGoodChatNodes: nodeInfo[] = []

/** 获取 CoNET 节点列表（供 sendMessage 等使用），可单独调用无需 initChat */
export const getCoNETNodesForChat = async (): Promise<nodeInfo[]> => {
	const fresh = await loadCoNETNodesFromChain()
	if (fresh.length) {
		lastGoodChatNodes = fresh
		return fresh
	}
	if (lastGoodChatNodes.length) {
		chatBootLog(`CoNET node list read failed; using the last list (${lastGoodChatNodes.length})`, 'warn')
		return lastGoodChatNodes.slice()
	}
	return []
}

const loadCoNETNodesFromChain = async (): Promise<nodeInfo[]> => {
	let timer: ReturnType<typeof setTimeout> | undefined
	try {
		const _nodes = await Promise.race([
			(async () => {
				const [_nodes1, _nodes2] = await Promise.all([
					GuardianNodesMainnet.getAllNodes(0, 400),
					GuardianNodesMainnet.getAllNodes(400, 800),
				])
				return [..._nodes1, ..._nodes2]
			})(),
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new Error('getAllNodes timeout')), 15_000)
			}),
		])
		const Guardian_Nodes: nodeInfo[] = []
		for (let i = 0; i < _nodes.length; i++) {
			const node = _nodes[i]
			const id = parseInt(node[0].toString())
			const pgpString: string = Buffer.from(node[1], 'base64').toString()
			const domain: string = node[2]
			const ipAddr: string = node[3]
			const region: string = node[4]
			Guardian_Nodes.push({
				ip_addr: ipAddr,
				armoredPublicKey: pgpString,
				domain,
				nftNumber: id,
				region,
			})
		}
		return Guardian_Nodes
	} catch {
		return []
	} finally {
		if (timer !== undefined) clearTimeout(timer)
	}
}

const getAllNodes = getCoNETNodesForChat

const isPgpKeyComplete = (pgp: initBeamioPGPKeysRet | undefined): boolean => {
	if (!pgp) return false
	// keyID、privateKey、publicKey 必填；routes 可为空（后续从链上拉取）
	return !!(pgp.keyID?.trim() && pgp.privateKey?.trim() && pgp.publicKey?.trim() && typeof pgp.routes === 'string')
}

/** 互斥：确保同一时刻只有一个 initChat 在执行 */
let initChatInProgress = false

/**
 * initChat that stopped for a network reason (no Guardian nodes, listen did
 * not open) retries by itself: 2/4/8/16/30 s, then every 30 s, until chat is
 * listening. Each retry is a normal initChat (random entry, no wallet sent).
 */
const CHAT_RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 30_000]
let chatRetryTimer: ReturnType<typeof setTimeout> | undefined
let chatRetryAttempt = 0
let chatRetryArgs: Parameters<typeof initChat> | null = null

const clearChatRetry = (resetBackoff: boolean) => {
	if (chatRetryTimer !== undefined) clearTimeout(chatRetryTimer)
	chatRetryTimer = undefined
	if (resetBackoff) chatRetryAttempt = 0
}

const scheduleChatRetry = (reason: string, args: Parameters<typeof initChat>) => {
	chatRetryArgs = args
	if (chatRetryTimer !== undefined) return
	const delay = CHAT_RETRY_DELAYS_MS[Math.min(chatRetryAttempt, CHAT_RETRY_DELAYS_MS.length - 1)]
	chatRetryAttempt += 1
	chatBootLog(`initChat retry #${chatRetryAttempt} in ${delay / 1000}s (${reason})`, 'warn')
	chatRetryTimer = setTimeout(() => {
		chatRetryTimer = undefined
		const retryArgs = chatRetryArgs
		if (!retryArgs) return
		if (currentGossipAbortController && !currentGossipAbortController.signal.aborted) {
			chatRetryAttempt = 0
			return
		}
		if (initChatInProgress) {
			scheduleChatRetry('another start is running', retryArgs)
			return
		}
		const [setProfiles, setAllNodes, setGossip, , newMessage] = retryArgs
		void initChat(setProfiles, setAllNodes, setGossip, false, newMessage)
	}, delay)
}

export const initChat = async (setProfiles: (val: profile[]) => void, setAllNodes: (val: nodeInfo[]) => void, setGossip: (val: boolean) => void, gossip: boolean, newMessage: (val: string) => void) => {
	if (initChatInProgress) {
		chatBootLog('initChat skipped: already in progress', 'info')
		return
	}
	if (gossip) {
		chatBootLog('initChat skipped: gossip already active', 'info')
		return
	}

	initChatInProgress = true
	// A start reads the chain itself: a recheck still waiting is not needed.
	ownRouteRecheckGen += 1
	chatBootLog('initChat starting…')
	try {
		setGossip(true)
		const allNodes = await getAllNodes()
		chatBootLog(`CoNET nodes loaded: ${allNodes?.length ?? 0}`)
		// An init while offline loads no nodes. Keep the last list instead of
		// wiping it: an empty list failed the next dial ("chain mailbox is not
		// in the node list") until a later init reloaded it.
		if (allNodes?.length) setAllNodes(allNodes)
		const temp = CoNET_Data
		if (!temp || !temp?.profiles?.length) {
			chatBootLog('initChat abort: no profiles in CoNET_Data', 'warn')
			setGossip(false)
			return
		}
		const profiles: profile[] =  temp.profiles
		let profile = profiles[0]
		if (!profile) {
			chatBootLog('initChat abort: empty profiles[0]', 'warn')
			setGossip(false)
			return
		}
		if (!profile.privateKeyArmor || !isValidEthersPrivateKey(profile.privateKeyArmor)) {
			chatBootLog('initChat abort: privateKeyArmor invalid or missing', 'warn')
			setGossip(false)
			return
		}
		let chatManager: IChat|undefined = profile?.chatManager
		let routes: string = chatManager?.router||''
		//		本地非初始化 或 pgpKey 不完整则重新生成
		if (!chatManager || !isPgpKeyComplete(chatManager.pgpKey)) {
			const pgpData = await initBeamioPGPKeys(profile)
			if (!pgpData) {
				// Chain key unreadable right now: retry instead of making a new key.
				setGossip(false)
				scheduleChatRetry('own chain key unreadable', [setProfiles, setAllNodes, setGossip, false, newMessage])
				return
			}

			chatManager = {
				pgpKey: pgpData,
				// Keep the chain route just read: it is the current mailbox if a later read fails.
				router: chatManager?.router || pgpData.routes || '',

			}
			profile.chatManager = chatManager
			routes = pgpData.routes || chatManager.router || ''
		}


		// ✅ 如果没有 routes，从链上/SC 找；再不行就随机注册一个
		//	寻找链上信息
		const rr = await getOwnKeysFromCoNETPGPSC(profile.privateKeyArmor)
		routes = rr?.routersArmoreds||''
		// Own mailbox (chatOwnRoutePlan.ts). A failed chain read keeps the current
		// mailbox and never registers. Only a successful read that shows no record,
		// another key or no route registers the local key, on the mailbox the
		// account already has; a random mailbox is only for a new account.
		const localKeyID = await getPublicKeyArmoredKeyID(chatManager.pgpKey.publicKey || '').catch(() => '')
		const ownChain = await readOwnChatChain(rr, profile.privateKeyArmor)
		const currentMailbox = resolveCurrentMailbox(chatManager.router || '', allNodes || [], null)
		const plan = planOwnChatRoute({
			read: ownChain.read,
			localKeyID,
			current: currentMailbox.mailbox,
			currentArmor: currentMailbox.armor,
		})
		chatBootLog(`own mailbox: ${plan.action} (${plan.reason})`, plan.action === 'use-chain' ? 'info' : 'warn')
		const ownRouteRetryArgs: Parameters<typeof initChat> = [setProfiles, setAllNodes, setGossip, false, newMessage]
		// True once a working chain read confirmed the mailbox we are about to listen on.
		let routeConfirmed = false
		const ownWallet = new ethers.Wallet(profile.privateKeyArmor).address
		if (plan.action === 'use-chain') {
			noteOwnMailboxVerified(ownWallet, plan.mailbox.routeKeyID, plan.mailbox.routeArmor)
		} else {
			forgetOwnMailboxVerified(ownWallet)
		}
		if (plan.action === 'use-chain') {
			routes = plan.mailbox.routeArmor
			routeConfirmed = true
		} else if (plan.action === 'keep-current') {
			routes = plan.routeArmor
		} else if (plan.action === 'wait-retry') {
			setGossip(false)
			scheduleChatRetry('own chain record unreadable', ownRouteRetryArgs)
			return
		} else {
			const randomNode = plan.target === 'random' ? getRandomNode(allNodes) : null
			const target = plan.target !== 'random'
				? plan.target
				: randomNode ? { routeKeyID: randomNode.domain, routeArmor: randomNode.armoredPublicKey } : null
			if (target) {
				routes = target.routeArmor
				const registered = await regiestChatRoute(
					profile.privateKeyArmor,
					chatManager.pgpKey.publicKey,
					localKeyID || chatManager.pgpKey.keyID,
					chatManager.pgpKey.privateKey,
					target.routeKeyID,
				)
				if (registered) {
					await new Promise(resolve => setTimeout(resolve, 1500))
					const verified = await getOwnKeysFromCoNETPGPSC(profile.privateKeyArmor)
					const verifiedKeyID = (verified?.userPgpKeyID || '').toUpperCase()
					if (
						verified?.privateArmored?.trim() &&
						localKeyID &&
						verifiedKeyID === localKeyID
					) {
						routes = verified.routersArmoreds || ''
						routeConfirmed = Boolean(routes)
						if (routeConfirmed) noteOwnMailboxVerified(ownWallet, verified.routePgpKeyID || '', routes)
						chatBootLog('PGP chain/local key verified before gossip listen')
					} else {
						chatBootLog(
							'PGP registration could not be verified; gossip listen will use the current key only if the route is valid',
							'error',
						)
					}
				}
				if (!registered && plan.target === 'random') {
					// A new account whose registration failed has no mailbox yet.
					setGossip(false)
					scheduleChatRetry('mailbox registration failed', ownRouteRetryArgs)
					return
				}
			} else {
				setGossip(false)
				scheduleChatRetry('no CoNET nodes for a new mailbox', ownRouteRetryArgs)
				return
			}
		}

		//	链上route信息
		if (routes) {
			chatManager.router = routes
		}



		profile.chatManager = chatManager
		temp.profiles[0] = profile
		setProfiles(profiles)
		setCoNET_Data(temp)
		storeSystemData()

		// Native shell: permanent user PGP (+ mailbox route / entry domains) for
		// killed-app voice_offer_fetch + local decrypt → CallKit @tag + short address.
		// Guardian ip_addr is owned by the shell (getAllNodes). Do not inject it.
		try {
			const entryDomains = (allNodes || [])
				.map((n) => String(n?.domain || '').trim())
				.filter(Boolean)
			injectNativeChatPgpSecretsFromProfile(profile, entryDomains)
			// Voice v3: route keys of all nodes, so the shell can pick its own relays.
			setNativeVoiceRelayNodes(allNodes)
		} catch {
			/* shell may omit bridge on first paint */
		}

		if (!allNodes?.length) {
			chatBootLog('initChat abort: no CoNET gossip nodes', 'warn')
			setGossip(false)
			scheduleChatRetry('no CoNET nodes', [setProfiles, setAllNodes, setGossip, false, newMessage])
			return
		}
	
		chatBootLog(`connectToGossipNode starting (route=${routeIdForLog(chatManager.router, allNodes)} confirmed=${routeConfirmed})`)
		const started = await connectToGossipNode(
			chatManager.router,
			profile.privateKeyArmor,
			allNodes,
			chatManager.pgpKey.privateKey,
			chatManager.pgpKey.publicKey ?? '',
			newMessage,
		)
		if (!started) {
			chatBootLog('initChat: gossip listen did not start — clearing gossip flag for retry', 'warn')
			setGossip(false)
			scheduleChatRetry('listen did not start', [setProfiles, setAllNodes, setGossip, false, newMessage])
		} else {
			clearChatRetry(true)
			if (!routeConfirmed) {
				startOwnRouteRecheck(chatManager.router, profile.privateKeyArmor, localKeyID, allNodes, ownRouteRetryArgs)
			}
		}
	} catch (error) {
		chatBootLog(`initChat error: ${(error as Error)?.message ?? String(error)}`, 'error')
		setGossip(false)
		scheduleChatRetry('error', [setProfiles, setAllNodes, setGossip, false, newMessage])
	} finally {
		initChatInProgress = false
	}
}

export const initBeamioPGPKeys = async (profile: profile): Promise<initBeamioPGPKeysRet|null> => {
	
	const keyInfo = await getOwnKeysFromCoNETPGPSC(profile.privateKeyArmor)
	if (keyInfo?.privateArmored) {
		return {
			privateKey: keyInfo.privateArmored,
			publicKey: keyInfo.publicArmored,
			keyID: profile.keyID || keyInfo.userPgpKeyID || '',
			routes: keyInfo.routersArmoreds
		}
	}

	// No usable chain private key. Make a new key only when the read worked and
	// the chain holds nothing we could ever load (no record, no blob, or a blob
	// our key cannot open). A failed read returns null so initChat retries;
	// a new key here would overwrite the user's key on chain.
	const own = await readOwnChatChain(keyInfo, profile.privateKeyArmor)
	if (own.read.status === 'error' || (own.read.status === 'ok' && own.read.privateBlob === 'error')) {
		chatBootLog(`initBeamioPGPKeys: chain key unreadable (${own.read.status === 'error' ? own.read.reason : 'private blob read failed'}); not making a new key`, 'warn')
		return null
	}
	if (own.read.status === 'ok' && own.privateArmored && own.publicArmored) {
		return {
			privateKey: own.privateArmored,
			publicKey: own.publicArmored,
			keyID: profile.keyID || own.read.userKeyID || '',
			routes: own.read.routeArmor,
		}
	}

	const keys = await generatePgpKey(profile.keyID,'')
	const ret: initBeamioPGPKeysRet = {
		privateKey: keys.privateKey as unknown as string,
		publicKey: keys.publicKey as unknown as string,
		keyID: keys.keyID,
		routes: ''
	}
	return ret
}

/** Our own encrypted PGP private key: loaded, absent on chain, or not openable with our key. Throws on RPC error. */
const probeOwnPrivateBlob = async (privateKeyArmor: string): Promise<{ state: OwnPrivateBlob; armored: string }> => {
	// getEncryptedPrivateKey() reads msg.sender, so this call carries our address.
	const wallet = new ethers.Wallet(privateKeyArmor, conetDepinProvider)
	const contract = contracts.constPgpManager
	const SC = new ethers.Contract(contract.address, contract.abi, wallet)
	const encrypted: string = await SC.getEncryptedPrivateKey()
	if (!encrypted) return { state: 'missing', armored: '' }
	try {
		const armored = await aesGcmDecrypt(encrypted, privateKeyArmor)
		return armored?.trim() ? { state: 'ok', armored } : { state: 'undecryptable', armored: '' }
	} catch {
		return { state: 'undecryptable', armored: '' }
	}
}

/**
 * Our own AddressPGP record, with a failed read told apart from an empty one
 * (chatOwnRoutePlan.ts `readOwnChainState`). `rr` is the getOwnKeysFromCoNETPGPSC
 * result, which is null in both cases; on null the record is read once more
 * with searchKey (no `from`).
 */
const readOwnChatChain = async (
	rr: Awaited<ReturnType<typeof getOwnKeysFromCoNETPGPSC>>,
	privateKeyArmor: string,
) => {
	const own = await readOwnChainState({
		first: rr
			? {
				userKeyID: rr.userPgpKeyID || '',
				routeKeyID: rr.routePgpKeyID || '',
				routeArmor: rr.routersArmoreds || '',
				publicArmored: rr.publicArmored || '',
				privateArmored: rr.privateArmored || '',
			}
			: null,
		searchKey: async () => {
			const address = new ethers.Wallet(privateKeyArmor).address
			const contract = contracts.constPgpManager
			const SC = new ethers.Contract(contract.address, contract.abi, conetDepinProvider)
			const info: searchKeyPGP = await SC.searchKey(address)
			const publicArmored = info?.userPublicKeyArmored ? fromBase64(info.userPublicKeyArmored) : ''
			const routeArmor = info?.routePublicKeyArmored ? fromBase64(info.routePublicKeyArmored) : ''
			if (!publicArmored && !routeArmor) return null
			return { userKeyID: info.userPgpKeyID || '', routeKeyID: info.routePgpKeyID || '', routeArmor, publicArmored }
		},
		probeBlob: () => probeOwnPrivateBlob(privateKeyArmor),
	})
	if (own.read.status === 'error') chatBootLog(`own chain read failed: ${own.read.reason}`, 'warn')
	return own
}

/** Route key ID of a mailbox armor for logs (node domain = route key ID); '?' if not in the list. */
const routeIdForLog = (armor: string, nodes: nodeInfo[]): string =>
	resolveCurrentMailbox(armor || '', nodes || [], null).mailbox?.routeKeyID || (armor ? '?' : 'none')

/**
 * Own mailbox confirmed by a working chain read during this run. Memory only:
 * a restart starts unverified. Written by initChat, the listen recheck and the
 * dial path (alignLiveGossipRouteToChain); the dial path skips waiting for the
 * chain only when this is set.
 */
type VerifiedOwnMailbox = { wallet: string; routeKeyID: string; routeArmor: string; verifiedAt: number }
let verifiedOwnMailbox: VerifiedOwnMailbox | null = null

/** A working chain read named this mailbox for `wallet`. */
export const noteOwnMailboxVerified = (wallet: string, routeKeyID: string, routeArmor: string): void => {
	const armor = (routeArmor || '').replace(/\r/g, '').trim()
	const w = (wallet || '').toLowerCase()
	if (!w || !armor) return
	verifiedOwnMailbox = { wallet: w, routeKeyID: (routeKeyID || '').trim().toUpperCase(), routeArmor: armor, verifiedAt: Date.now() }
}

/** The local mailbox and the chain disagree, or the registration just changed: unverified again. */
export const forgetOwnMailboxVerified = (wallet: string): void => {
	if (verifiedOwnMailbox && verifiedOwnMailbox.wallet === (wallet || '').toLowerCase()) verifiedOwnMailbox = null
}

/** The mailbox verified in this run for `wallet`, or null. */
export const getVerifiedOwnMailbox = (wallet: string): { routeKeyID: string; routeArmor: string; verifiedAt: number } | null => {
	const v = verifiedOwnMailbox
	if (!v || !wallet || v.wallet !== wallet.toLowerCase()) return null
	return { routeKeyID: v.routeKeyID, routeArmor: v.routeArmor, verifiedAt: v.verifiedAt }
}

let ownRouteRecheckGen = 0

/** Wait `ms`, cut short when the network comes back. False once the check is stale or the listen is gone. */
const waitForOwnRouteRecheck = (ms: number, gen: number): Promise<boolean> => new Promise((resolve) => {
	let timer: ReturnType<typeof setTimeout> | undefined
	const done = () => {
		clearTimeout(timer)
		window.removeEventListener('online', done)
		const live = !!currentGossipAbortController && !currentGossipAbortController.signal.aborted
		resolve(gen === ownRouteRecheckGen && live)
	}
	timer = setTimeout(done, ms)
	window.addEventListener('online', done)
})

/**
 * The listen started on a mailbox no working chain read confirmed (the chain
 * read failed, e.g. airplane mode). Keep it, read the chain with backoff, and
 * once a read works and names another mailbox, start chat again so the listen
 * moves to the chain mailbox (2026-11-02 RC3: a stray mailbox outlived the
 * outage and calls to the chain mailbox never arrived).
 */
const startOwnRouteRecheck = (
	listenArmor: string,
	privateKeyArmor: string,
	localKeyID: string,
	nodes: nodeInfo[],
	args: Parameters<typeof initChat>,
) => {
	const gen = ++ownRouteRecheckGen
	const listenId = routeIdForLog(listenArmor, nodes)
	void recheckListenRoute({
		listenArmor: () => getWorkerGossipRouteArmor() || listenArmor,
		read: async () => (await readOwnChatChain(null, privateKeyArmor)).read,
		localKeyID,
		sleep: (ms) => waitForOwnRouteRecheck(ms, gen),
		onRetry: (why, ms) => chatBootLog(`own mailbox recheck: chain read failed (${why}); keeping route=${listenId}; retry in ${ms / 1000}s`, 'warn'),
	}).then(({ result, read }) => {
		if (gen !== ownRouteRecheckGen || result === 'gone') return
		const ownWallet = new ethers.Wallet(privateKeyArmor).address
		if (result === 'match') {
			if (read?.status === 'ok') noteOwnMailboxVerified(ownWallet, read.routeKeyID, read.routeArmor)
			chatBootLog(`own mailbox recheck: route=${listenId} matches chain`)
			return
		}
		forgetOwnMailboxVerified(ownWallet)
		const chainId = read?.status === 'ok' ? (read.routeKeyID || 'none') : 'none'
		chatBootLog(`own mailbox recheck: route=${listenId} chain=${chainId}; reconnecting per the chain record`, 'warn')
		if (gen !== ownRouteRecheckGen || initChatInProgress) return
		clearGossipListenSession('own_route_mismatch')
		const [setProfiles, setAllNodes, setGossip, , newMessage] = args
		setGossip(false)
		void initChat(setProfiles, setAllNodes, setGossip, false, newMessage)
	}).catch((ex) => chatBootLog(`own mailbox recheck error: ${(ex as Error)?.message ?? String(ex)}`, 'warn'))
}

/**
 * Message the wallet signs for `POST /api/regiestChatRoute` (EIP-191).
 * Must match x402sdk `src/chatRouteAuth.ts` `buildRegiestChatRouteMessage`.
 */
const buildRegiestChatRouteMessage = (p: {
	wallet: string
	keyID: string
	publicKeyArmored: string
	encrypKeyArmored: string
	routeKeyID: string
	timestamp: number
	nonce: string
}): string => [
	'Beamio regiestChatRoute',
	`wallet:${p.wallet.toLowerCase()}`,
	`keyID:${p.keyID}`,
	`publicKeyArmoredHash:${ethers.keccak256(ethers.toUtf8Bytes(p.publicKeyArmored))}`,
	`encrypKeyArmoredHash:${ethers.keccak256(ethers.toUtf8Bytes(p.encrypKeyArmored))}`,
	`routeKeyID:${p.routeKeyID}`,
	`timestamp:${p.timestamp}`,
	`nonce:${p.nonce.toLowerCase()}`,
].join('\n')

export const regiestChatRoute = async (privateKey: string, pubArmor: string, keyID: string, priArmor: string, routeKeyID: string) => {
	try {
		// Signed by the wallet itself; the API rejects unsigned or foreign-signed requests.
		const Wallet = new ethers.Wallet(privateKey)
		const fields = {
			wallet: Wallet.address,
			keyID: String(keyID || '').trim(),
			publicKeyArmored: toBase64(pubArmor).trim(),
			encrypKeyArmored: String(await aesGcmEncrypt(priArmor, privateKey)).trim(),
			routeKeyID: String(routeKeyID || '').trim(),
			timestamp: Date.now(),
			nonce: ethers.hexlify(ethers.randomBytes(16)),
		}
		const signature = await Wallet.signMessage(buildRegiestChatRouteMessage(fields))
		const res = await fetch(`${beamioApi}/api/regiestChatRoute`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...fields, signature })
		})
		const json = await res.json()
		if (!res.ok) {
			console.error('[regiestChatRoute]', res.status, json?.error ?? json)
		}
		return !!json?.ok
	} catch (ex: any) {
		console.error('[regiestChatRoute]', ex?.message ?? ex)
		return false
	}
}


interface TimeoutConfig {
  connectTimeout: number        // 连接阶段超时
  idleTimeout: number           // 无数据超时
  readOperationTimeout: number  // 单次 read() 操作超时
  retryDelay: number            // 重连延迟
}

/** SI liveness handshake / listing push expose `epoch` (= CoNET block height). */
function extractGossipListingBlockHeight(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const row = payload as Record<string, unknown>
  const epoch = row.epoch
  if (epoch == null) return null
  if (typeof epoch === 'number' && Number.isFinite(epoch)) return String(Math.trunc(epoch))
  if (typeof epoch === 'string' && epoch.trim()) return epoch.trim()
  return null
}

function logGossipListingBlockHeight(
  kind: 'handshake' | 'listing',
  payload: unknown,
  rootSignal?: AbortSignal,
  nodeHint?: string
) {
  const blockHeight = extractGossipListingBlockHeight(payload)
  if (!blockHeight) return
  const nodePart = nodeHint ? ` node=${nodeHint}` : ''
  const line = `[Gossip] Listing ${kind} blockHeight=${blockHeight}${nodePart} streamActive=${!rootSignal?.aborted}`
  console.log(line)
  publishNativePwaLog('info', line)
}

const GOSSIP_STOP_REASONS = new Set([
  'root_stop',
  'replaced_by_new_connection',
  'component_unmount',
  'relaunching',
  'connect_failed',
  'foreground_resume',
  'background_pause',
])

/** Last SSE byte / handshake time — used to detect frozen iOS WKWebView streams. */
let lastGossipActivityAt = 0

const noteGossipActivity = () => {
	lastGossipActivityAt = Date.now()
}

function resolveGossipAbortReason(err: unknown, controller: AbortController, rootSignal?: AbortSignal): string {
  if (typeof err === 'string' && err) return err
  const signalReason = controller.signal.reason ?? rootSignal?.reason
  if (typeof signalReason === 'string' && signalReason) return signalReason
  if (err && typeof err === 'object' && 'message' in err && typeof (err as Error).message === 'string') {
    return (err as Error).message
  }
  return 'unknown'
}

// NOTE: Superseded by the Beamio Chat SDK Web Worker (see services/chatWorkerBridge).
// The inbound LISTEN loop + all openpgp decryption now run off the main thread, so
// connectToGossipNode no longer calls startGossip. Kept here (self-contained SSE reader,
// no openpgp) only as a reference / fallback; disable unused-var so CI=true builds pass.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function startGossip(
  nodes: nodeInfo[],
  body: string,
  callback?: (err?: string, data?: string) => void,
  rootSignal?: AbortSignal, // <--- 用于外部强行停止整个递归链
  timeoutConfig?: Partial<TimeoutConfig>,
  /** Reconnect attempt for exponential backoff (reset on successful bytes). */
  reconnectAttempt = 0,
) {
  // 【第一道防线】如果总开关已关，直接销毁，不准启动
  if (rootSignal?.aborted) return;
  if (!nodes?.length) return;

  const node = getRandomNode(nodes)!
  const config: TimeoutConfig = {
    connectTimeout: 12_000,
    // Keep longer than SI liveness (~2 epochs) and entry socketForward idle (60s).
    idleTimeout: 90_000,
    readOperationTimeout: 20_000,
    retryDelay: 2_000,
    ...timeoutConfig,
  };

  const url = `https://${node.domain}.conet.network/post`;
  const controller = new AbortController(); 

  // 绑定：如果 rootSignal 触发 abort，我们也 abort 本次 HTTP 请求
  const onRootAbort = () => controller.abort("root_stop");
  rootSignal?.addEventListener("abort", onRootAbort);

  // --- 重连触发器：每次随机换一个 node；退避避免 SI setUserOnlineOnMe flap ---
  let isRelaunching = false;
  const triggerRelaunch = (reason?: string) => {
    // 【第二道防线】再次检查总开关
    if (rootSignal?.aborted) {
        console.log("🛑 [Gossip] Relaunch prevented: Root signal aborted.");
        return;
    }
    if (isRelaunching) return;
    
    isRelaunching = true;
    rootSignal?.removeEventListener("abort", onRootAbort);
    try { controller.abort("relaunching"); } catch {}

    const nextAttempt = reconnectAttempt + 1
    const delay = Math.min(30_000, Math.round(config.retryDelay * Math.pow(1.6, Math.min(nextAttempt, 8))))
    setTimeout(() => {
        // 【第三道防线】在定时器触发时，最后检查一次
        if (rootSignal?.aborted) return;
        console.log(`🔄 [Gossip] Reconnecting... (random entry C) attempt=${nextAttempt} reason=${reason || 'stream_end'} delayMs=${delay}`);
        startGossip(nodes, body, callback, rootSignal, timeoutConfig, nextAttempt);
    }, delay);
  };

  const connectTimer = setTimeout(() => {
    controller.abort("connect_timeout"); 
  }, config.connectTimeout);

  let idleTimer: number | null = null;
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      controller.abort("idle_timeout");
    }, config.idleTimeout);
  };

  (async () => {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    /** Single in-flight read — never call reader.read() again until this settles (flap root cause). */
    let pendingRead: Promise<ReadableStreamReadResult<Uint8Array>> | null = null
    
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          Accept: "text/event-stream",
          Connection: "keep-alive",
        },
        body,
        signal: controller.signal,
        cache: "no-store",
      });

      clearTimeout(connectTimer);
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      markGossipNodeHealthy(node.domain)
      const connectedLine = `[SSE] Connected [${node.ip_addr}]`
      console.log(connectedLine)
      chatBootLog(connectedLine)
      noteGossipActivity()
      // Successful connect resets backoff for subsequent disconnects after a healthy session.
      reconnectAttempt = 0
      reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let first = true;

      resetIdle();

      while (true) {
        if (rootSignal?.aborted) throw "root_stop"; // 主动抛出异常以退出
        if (controller.signal.aborted) throw controller.signal.reason;

        let readResult: ReadableStreamReadResult<Uint8Array>;
        let readTimer: number | undefined;

        try {
            if (!pendingRead) {
              pendingRead = reader.read()
            }
            // Race timeout against the SAME pending read — do not start a second read().
            const timeoutPromise = new Promise<never>((_, reject) => {
                readTimer = window.setTimeout(() => reject(new Error("read_operation_timeout")), config.readOperationTimeout);
            });
            
            readResult = await Promise.race([pendingRead, timeoutPromise]);
            pendingRead = null
            
        } catch (readErr: any) {
            if (readErr.message === "read_operation_timeout") {
                // Silence only: keep pendingRead, do not open a concurrent reader.read().
                if (rootSignal?.aborted) throw "root_stop";
                if (controller.signal.aborted) throw controller.signal.reason;
                console.log(`[SSE] Silence (Keep-Alive)...`);
                continue; 
            }
            pendingRead = null
            throw readErr;
        } finally {
             if (readTimer) clearTimeout(readTimer); // 必须清理 timer
        }

        const { value, done } = readResult;
        if (done) {
          console.log(`[SSE] Server closed stream.`);
          break; // 退出 while，触发 relaunch
        }

        resetIdle();
        reconnectAttempt = 0
        noteGossipActivity()
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // 解析逻辑...
        let idx: number;
        while ((idx = buffer.indexOf("\r\n\r\n")) !== -1 || (idx = buffer.indexOf("\n\n")) !== -1) {
            const isFour = buffer.substring(idx, idx + 4) === "\r\n\r\n";
            const blockEnd = idx;
            const separatorLen = isFour ? 4 : 2;
            const block = buffer.slice(0, blockEnd);
            buffer = buffer.slice(blockEnd + separatorLen);
            const lines = block.split("\n");
            const dataLines = lines.filter(l => l.startsWith("data:")).map(l => l.slice(5).trimStart());
            const payload = (dataLines.length ? dataLines.join("\n") : block).trim();

            if (payload) {
                if (first) {
                    first = false;
                    try {
                      const parsed = JSON.parse(payload)
                      console.log("[SSE] Handshake:", parsed)
                      logGossipListingBlockHeight('handshake', parsed, rootSignal, node.domain)
                    } catch {}
                } else {
                    callback?.("", payload);
                }
            }
        }
      }

      // 循环正常结束（Server Done），触发重连
      triggerRelaunch('server_closed');

    } catch (err: any) {
      clearTimeout(connectTimer);
      if (idleTimer) clearTimeout(idleTimer);

      const msg = resolveGossipAbortReason(err, controller, rootSignal);

      // 1. 如果是手动停止，彻底终结，不调用 triggerRelaunch
      if (GOSSIP_STOP_REASONS.has(msg)) {
          return; 
      }
      // AbortError with stop reason on signal (browser may use generic message)
      if (err?.name === 'AbortError' && rootSignal?.aborted) {
          return
      }

      if (err?.name !== 'AbortError') {
          console.error(`[SSE] Connection Error:`, msg);
          chatBootLog(`SSE error (${node.domain}): ${msg}`, 'warn')
          callback?.(msg);
      }
      if (msg === 'connect_timeout' || msg === 'idle_timeout' || msg === 'Failed to fetch') {
        markGossipNodeBad(node.domain)
      }
      
      triggerRelaunch(msg);

    } finally {
      rootSignal?.removeEventListener("abort", onRootAbort);
      if (reader) { try { await reader.cancel(); reader.releaseLock(); } catch {} }
    }
  })();
}

// ============================================
// 使用示例
// ============================================

/*
// 默认配置（通用环境）
startGossip(nodeInfo, body, callback)

// 弱网环境（3G/卫星）
startGossip(nodeInfo, body, callback, {
  connectTimeout: 10_000,
  idleTimeout: 60_000,
  readOperationTimeout: 15_000,
  retryDelay: 3_000,
})

// 强网环境（有线网络）
startGossip(nodeInfo, body, callback, {
  connectTimeout: 3_000,
  idleTimeout: 30_000,
  readOperationTimeout: 3_000,
  retryDelay: 1_000,
})

// 企业网络（代理/VPN）
startGossip(nodeInfo, body, callback, {
  connectTimeout: 8_000,
  idleTimeout: 60_000,
  readOperationTimeout: 10_000,
  retryDelay: 3_000,
})

// 移动网络（4G/5G）
startGossip(nodeInfo, body, callback, {
  connectTimeout: 5_000,
  idleTimeout: 45_000,
  readOperationTimeout: 5_000,
  retryDelay: 2_000,
})
*/

// ============================================
// 使用示例
// ============================================

/*
// 默认配置（通用环境）
startGossip(nodeInfo, body, callback)

// 弱网环境（3G/卫星）
startGossip(nodeInfo, body, callback, {
  connectTimeout: 10_000,
  idleTimeout: 60_000,
  readOperationTimeout: 15_000,
  retryDelay: 3_000,
})

// 强网环境（有线网络）
startGossip(nodeInfo, body, callback, {
  connectTimeout: 3_000,
  idleTimeout: 30_000,
  readOperationTimeout: 3_000,
  retryDelay: 1_000,
})

// 企业网络（代理/VPN）
startGossip(nodeInfo, body, callback, {
  connectTimeout: 8_000,
  idleTimeout: 60_000,
  readOperationTimeout: 10_000,
  retryDelay: 3_000,
})

// 移动网络（4G/5G）
startGossip(nodeInfo, body, callback, {
  connectTimeout: 5_000,
  idleTimeout: 45_000,
  readOperationTimeout: 5_000,
  retryDelay: 2_000,
})
*/
export let currentGossipAbortController: AbortController | null = null;

/** Last live gossip listen context — used for mailbox delivery ACK (encrypt to B). */
let gossipDeliveryAckContext: {
	routerArmoredPublicKey: string
	privateKeyArmor: string
	entryNodes: nodeInfo[]
	mailboxDomains: string[]
} | null = null

const mailboxKeyId = (domain: string): string =>
	domain.split('.')[0].trim().toUpperCase()

/**
 * Voice listen encrypts to the route key frozen when gossip started.
 * A long-lived tab keeps that key after the chain mailbox moves, so the
 * offer lands on a stale node and the callee never sees it. Re-read the
 * chain route and retarget before a call. Returns false when the worker
 * still is not encrypting to that mailbox — the caller must not open a relay.
 */
/** Own mailbox route key from the last chain read in {@link alignLiveGossipRouteToChain}. */
let lastChainMailboxRouteArmor = ''

/**
 * Own mailbox route key for excluding it from voice relay / entry choices:
 * the live listen's key, else the chain mailbox read before the dial.
 */
export function getOwnMailboxRouteArmor(): string {
	return (getWorkerGossipRouteArmor() || lastChainMailboxRouteArmor || '').replace(/\r/g, '').trim()
}

export async function alignLiveGossipRouteToChain(
	privateKeyArmor: string,
	nodes: nodeInfo[],
): Promise<boolean> {
	const normalizeRouteArmor = (value?: string) => (value || '').replace(/\r/g, '').trim()
	const live = mailboxKeyId(gossipDeliveryAckContext?.mailboxDomains?.[0] || '')
	const chain = await getKeysFromCoNETPGPSC(new ethers.Wallet(privateKeyArmor).address)
	const chainId = mailboxKeyId(String(chain?.routePgpKeyID || ''))
	const workerArmor = normalizeRouteArmor(getWorkerGossipRouteArmor())
	chatBootLog(`voice route live=${live || 'none'} chain=${chainId || 'none'} worker=${workerArmor ? 'set' : 'none'}`)
	if (!chainId) {
		chatBootLog('voice route chain mailbox unavailable', 'warn')
		return false
	}
	const mailbox = nodes.find((node) => mailboxKeyId(node.domain || '') === chainId)
	const targetArmor = normalizeRouteArmor(mailbox?.armoredPublicKey)
	if (!mailbox?.domain || !targetArmor) {
		chatBootLog(`voice route chain mailbox ${chainId} is not in the node list`, 'warn')
		return false
	}
	lastChainMailboxRouteArmor = targetArmor
	if (isCashTreesNativeWebView()) {
		// Inside the shells the dialer listens natively on a per-call relay
		// reached through an entry; the page's own mailbox listen plays no part
		// in the call. It is down for seconds after every foreground return
		// (background pause + restart), which failed dials with "could not use
		// your current Chat mailbox". The chain mailbox is all the call needs:
		// it is excluded from the relay and entry choices.
		chatBootLog(`voice route native shell: chain mailbox ${chainId}, page listen not required`)
		return true
	}
	const workerLive = isWorkerGossipActive()
		&& !!currentGossipAbortController
		&& !currentGossipAbortController.signal.aborted
	if (!workerLive) {
		chatBootLog('voice route gossip worker is down; restarting listen', 'warn')
		const prev = getWorkerGossipListenParams()
		if (!prev) {
			chatBootLog('voice route listen is not running', 'warn')
			return false
		}
		const controller = new AbortController()
		currentGossipAbortController = controller
		let started = await startWorkerGossipListen({
			...prev,
			nodes: nodes.length ? nodes : prev.nodes,
			ownRouteArmoredPublicKey: targetArmor,
			rootSignal: controller.signal,
		})
		if (!started) {
			started = await startWorkerGossipListen({
				...prev,
				nodes: nodes.length ? nodes : prev.nodes,
				ownRouteArmoredPublicKey: targetArmor,
				rootSignal: controller.signal,
			})
		}
		if (!started || !isWorkerGossipActive()) {
			chatBootLog('voice route gossip restart failed', 'warn')
			return false
		}
	}
	const liveWorkerArmor = normalizeRouteArmor(getWorkerGossipRouteArmor())
	const workerMatches = liveWorkerArmor === targetArmor
	if (workerMatches && live === chainId) return true
	if (workerMatches && gossipDeliveryAckContext) {
		gossipDeliveryAckContext = {
			...gossipDeliveryAckContext,
			routerArmoredPublicKey: mailbox.armoredPublicKey,
			mailboxDomains: [mailbox.domain],
		}
		return true
	}
	if (!getWorkerGossipRouteArmor()) {
		chatBootLog('voice route listen is not running', 'warn')
		return false
	}
	chatBootLog(`voice route retarget ${live || 'none'} -> ${chainId}`)
	const ok = await retargetWorkerGossipRoute(mailbox.armoredPublicKey, nodes)
	if (!ok) {
		chatBootLog('voice route retarget failed', 'warn')
		return false
	}
	if (gossipDeliveryAckContext) {
		gossipDeliveryAckContext = {
			...gossipDeliveryAckContext,
			routerArmoredPublicKey: mailbox.armoredPublicKey,
			mailboxDomains: [mailbox.domain],
		}
	}
	const aligned = normalizeRouteArmor(getWorkerGossipRouteArmor()) === targetArmor
	if (!aligned) chatBootLog('voice route worker still on the previous mailbox', 'warn')
	return aligned
}

export function getGossipDeliveryAckContext(): {
	routerArmoredPublicKey: string
	privateKeyArmor: string
	entryNodes: nodeInfo[]
	mailboxDomains: Set<string>
} | null {
	if (!gossipDeliveryAckContext) return null
	return {
		routerArmoredPublicKey: gossipDeliveryAckContext.routerArmoredPublicKey,
		privateKeyArmor: gossipDeliveryAckContext.privateKeyArmor,
		entryNodes: gossipDeliveryAckContext.entryNodes,
		mailboxDomains: new Set(gossipDeliveryAckContext.mailboxDomains),
	}
}

const clearGossipListenSession = (reason: string) => {
	if (currentGossipAbortController) {
		try {
			currentGossipAbortController.abort(reason)
		} catch {
			/* ignore */
		}
		currentGossipAbortController = null
	}
	// Aborting the controller already triggers the worker teardown via its rootSignal
	// listener; call stop explicitly too so the singleton is cleared even on races.
	stopWorkerGossip()
}

/**
 * iOS WKWebView freezes long fetch streams in background; timers may not fire until foreground.
 * Resume only when listen is truly dead/aborted, or idle longer than staleMs AFTER we have
 * received bytes. Never tear down a connecting stream (lastGossipActivityAt===0) — that races
 * SI offline flush and drops messages.
 */
export const shouldResumeGossipListen = (staleMs = 45_000): boolean => {
	// A second visible/pageshow event was aborting the worker while it was
	// still opening, so the voice relay found no listen and failed.
	if (isWorkerGossipBusy()) return false
	if (!currentGossipAbortController || currentGossipAbortController.signal.aborted) return true
	// Native shells: the chat module owns the listen and reconnects it by
	// itself. Rebuilding chat here took ~9 s and held the incoming offer and the
	// caller's cancel in the mailbox meanwhile.
	if (isNativeChatListenOwner()) return false
	if (isCashTreesAndroidChatModuleAvailable() && isCashTreesAndroidChatModuleRunning()) return false
	// Connecting / draining offline — do not abort
	if (!lastGossipActivityAt) return false
	return Date.now() - lastGossipActivityAt > staleMs
}

/**
 * Tear down listen so mailbox B gets socket close → removes from online pool.
 * Required on background: otherwise SI still "forwards" to a frozen WKWebView and never saveLocal.
 */
export const prepareGossipListenResume = (reason = 'foreground_resume'): void => {
	chatBootLog(`prepareGossipListenResume: ${reason}`, 'info')
	clearGossipListenSession(reason)
	lastGossipActivityAt = 0
}

/**
 * Tear down listen so mailbox treats the user offline (saveLocal + APNs).
 * Prefer calling on true unload / pagehide — not on every Home press.
 * While Home leaves the WebView alive, keep listen for UI ingest; system push is
 * SI mailbox → APNs/FCM only (do not also bridge PWA `notifyBackgroundChat`).
 */
export const pauseGossipListenOnBackground = (
	setGossip: (val: boolean) => void,
): void => {
	// True unload: no background retries; the next foreground resume restarts chat.
	clearChatRetry(false)
	chatRetryArgs = null
	// Native shells: pause the module's listen (it stays up while a call rings
	// or is up) instead of destroying it.
	if (pauseNativeChatListen()) {
		chatBootLog('pauseGossipListenOnBackground: native listen paused', 'info')
		return
	}
	if (!currentGossipAbortController || currentGossipAbortController.signal.aborted) {
		setGossip(false)
		return
	}
	chatBootLog('pauseGossipListenOnBackground: abort listen so mailbox treats user offline', 'info')
	prepareGossipListenResume('background_pause')
	setGossip(false)
}

/**
 * Foreground / pageshow resume: if listen looks dead, abort + re-initChat(gossip=false).
 * Safe to call often; no-ops when the stream recently received bytes or is still connecting.
 */
let gossipResumeInFlight = false

export const resumeGossipListenOnForeground = async (
	setProfiles: (val: profile[]) => void,
	setAllNodes: (val: nodeInfo[]) => void,
	setGossip: (val: boolean) => void,
	newMessage: (val: string) => void,
	staleMs = 45_000,
	force = false,
): Promise<void> => {
	if (gossipResumeInFlight) {
		chatBootLog('foreground resume skipped: restart already running', 'info')
		return
	}
	// Native shells: resume the module's listen; never tear it down and rebuild
	// (a call or other senders' messages may be arriving on it).
	if (resumeNativeChatListen()) {
		chatBootLog(`foreground resume: native listen resumed${force ? ' (wake)' : ''}`, 'info')
		return
	}
	if (!force && !shouldResumeGossipListen(staleMs)) {
		chatBootLog('foreground resume skipped: gossip stream still active or connecting', 'info')
		return
	}
	gossipResumeInFlight = true
	try {
		chatBootLog(
			force
				? 'foreground resume forced by native mailbox wake'
				: 'foreground resume restarting stale gossip stream',
			'info',
		)
		prepareGossipListenResume(force ? 'native_mailbox_wake' : 'foreground_resume')
		setGossip(false)
		await initChat(setProfiles, setAllNodes, setGossip, false, newMessage)
	} finally {
		gossipResumeInFlight = false
	}
}

export const connectToGossipNode = async (
	nodeArmoredPublicKey: string,
	privateKeyArmor: string,
	nodes: nodeInfo[],
	pgpPrivateKey: string,
	pgpPublicArmored: string,
	newMessage: (val: string) => void
): Promise<boolean> => {
  // Already listening: do NOT tear down + reconnect (that flaps SI setUserOnlineOnMe).
  // LoadingPage + AppShell both call initChat; second call must be a no-op — BUT only when
  // the controller is truly live. Failed early-returns must clear the controller (see below).
  if (currentGossipAbortController && !currentGossipAbortController.signal.aborted) {
    chatBootLog('connectToGossipNode skipped: gossip SSE already live', 'info')
    return true
  }

  // Stale aborted controller from a prior session — drop and create a fresh one.
  if (currentGossipAbortController) {
    currentGossipAbortController = null
  }

  // 创建新的控制器，代表本次“会话”的生命周期（进程级，勿因 React remount 杀掉）
  const myController = new AbortController();
  currentGossipAbortController = myController;
  const rootSignal = myController.signal;

  const failConnect = (msg: string): false => {
    chatBootLog(msg, 'error')
    if (currentGossipAbortController === myController) {
      clearGossipListenSession('connect_failed')
    }
    return false
  }

  try {
      // Encrypt listen/mining to mailbox **B** (router armored key), but HTTP/SSE only via
      // random healthy **entry C ≠ B** — Tor-like: never reveal client IP to mailbox B.
      //
      // NOTE: the SSE connect/reconnect loop AND all inbound openpgp decryption now run
      // inside the Beamio Chat SDK Web Worker (see services/chatWorkerBridge) so the main
      // thread never blocks — this is the fix for "app frozen ~10s after launch". We still
      // resolve route + healthy entry nodes here so the main-thread delivery-ACK sender
      // (gossipDeliveryAckContext) keeps working exactly as before.
      const routeNodes = pickRouteNodesByArmoredKey(nodes, nodeArmoredPublicKey)
      if (!routeNodes.length) {
        return failConnect('connectToGossipNode abort: no route node for router key')
      }
      const mailboxDomains = new Set(routeNodes.map(n => n.domain))

      const entryCandidates = nodes.filter(n => !mailboxDomains.has(n.domain))
      const healthyNodes = await pickHealthyGossipNodes(
        entryCandidates.length ? entryCandidates : nodes,
      )
      chatBootLog(
        `Gossip healthy entry C: ${healthyNodes.length} (mailbox B domains excluded: ${[...mailboxDomains].join(',') || 'none'})`,
      )
      let entryNodes = healthyNodes
      if (!entryNodes.length && entryCandidates.length) {
        // A launch-time probe can miss every sampled node on a slow network.
        // Aborting here left chat and voice calls down until the next
        // foreground resume ("could not use your current Chat mailbox").
        // The listen rotates and scores its entries itself, so start it on the
        // unprobed nodes; mailbox B stays excluded (same as gossip send).
        chatBootLog('Gossip healthy entry C: probe found none; using unprobed entries (mailbox B excluded)', 'warn')
        entryNodes = entryCandidates
      }
      if (!entryNodes.length) {
        return failConnect('connectToGossipNode abort: no healthy entry C for gossip listen')
      }

      gossipDeliveryAckContext = {
        routerArmoredPublicKey: nodeArmoredPublicKey,
        privateKeyArmor: privateKeyArmor,
        entryNodes,
        mailboxDomains: [...mailboxDomains],
      }

      console.log("🚀 [Gossip] Starting worker listen…");
      chatBootLog(`Gossip listen route=${[...mailboxDomains].join(',') || 'none'}`)
      chatBootLog('Gossip SSE connect starting (worker)…')

      // Hand the inbound LISTEN loop to the worker. Param naming here is historical:
      //   privateKeyArmor  → raw EOA private key hex (EIP-191 listen signing)
      //   pgpPrivateKey    → armored PGP private key (decrypts inbound in the worker)
      // The worker owns entry rotation + reconnect + decryption; decrypted host-ready
      // lines flow back through `newMessage` (App.tsx addNewMessage serial queue) unchanged,
      // with `_beamioPgpArmorHash` already attached for mailbox delivery ACK.
      const started = await startWorkerGossipListen({
        ownRouteArmoredPublicKey: nodeArmoredPublicKey,
        privateKeyHex: privateKeyArmor,
        pgpPrivateKeyArmored: pgpPrivateKey,
        pgpPublicKeyArmored: pgpPublicArmored,
        nodes,
        rootSignal,
		onLine: (line) => {
          // A wake bounce may abort this signal while the offer is already decrypted.
          // Deliver the line first; dropping it leaves CallStyle on the generic title.
          newMessage(line)
        },
        onActivity: () => {
          if (rootSignal.aborted) return
          noteGossipActivity()
        },
        onLog: (level, message) => chatBootLog(message, level),
      })

      if (!started) {
        return failConnect('connectToGossipNode abort: worker gossip listen failed to start')
      }
      return true

  } catch (ex: any) {
      console.error("Init Error:", ex);
      return failConnect(`connectToGossipNode Init Error: ${(ex as Error)?.message ?? String(ex)}`)
  }
}

async function withChatTimeout<T>(work: Promise<T>, timeoutMs: number, label: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined
	try {
		return await Promise.race([
			work,
			new Promise<T>((_, reject) => {
				timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
			}),
		])
	} finally {
		if (timer) clearTimeout(timer)
	}
}

async function postWithTimeout(url: string, init: RequestInit, timeoutMs = 12_000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)

  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal })
    return res
  } finally {
    clearTimeout(t)
  }
}

const gossipHealthyCache = new Map<string, number>()
const GOSSIP_HEALTH_TTL_MS = 120_000

const markGossipNodeHealthy = (domain: string) => {
	gossipHealthyCache.set(domain, Date.now() + GOSSIP_HEALTH_TTL_MS)
}

const markGossipNodeBad = (domain: string) => {
	gossipHealthyCache.delete(domain)
}

const isGossipNodeHealthy = (domain: string) => {
	const exp = gossipHealthyCache.get(domain) || 0
	return exp > Date.now()
}

const normalizeArmoredKey = (v?: string) => (v || '').replace(/\r/g, '').trim()

/**
 * Recipient user PGP → that recipient's mailbox route PGP. `sendMessage` only
 * receives the user key, and must keep the recipient's mailbox out of the entry
 * pool (entry A ≠ mailbox B), otherwise B would see the sender's IP.
 */
const recipientRouteByUserKey = new Map<string, string>()

export const rememberRecipientRoute = (userArmored?: string, routeArmored?: string) => {
	const user = normalizeArmoredKey(userArmored)
	const route = normalizeArmoredKey(routeArmored)
	if (user && route) recipientRouteByUserKey.set(user, route)
}

const pickRouteNodesByArmoredKey = (nodes: nodeInfo[], routerArmoredPublicKey: string) => {
	const target = normalizeArmoredKey(routerArmoredPublicKey)
	if (!target) return []
	return nodes.filter(n => normalizeArmoredKey(n.armoredPublicKey) === target)
}

const probeGossipNode = async (node: nodeInfo, timeoutMs = 4_000) => {
	// GET / only. Do not OPTIONS /post here: cold init samples ~10 random entries in
	// parallel (main + worker), and SI used to 404 incomplete first TLS records.
	// Chrome logs every OPTIONS 404 in red even when ACAO=* and we then fall through.
	// Real listen POST already sends the browser CORS preflight; that is the CORS proof.
	const url = `https://${node.domain}.conet.network/`
	try {
		const res = await postWithTimeout(
			url,
			{
				method: 'GET',
				headers: { Accept: 'text/html' },
			},
			timeoutMs,
		)
		if (res.status >= 200 && res.status < 400) {
			markGossipNodeHealthy(node.domain)
			return true
		}
	} catch {
		// Network/TLS timeout means the browser cannot reach this node.
	}
	markGossipNodeBad(node.domain)
	return false
}

const pickHealthyGossipNodes = async (nodes: nodeInfo[]): Promise<nodeInfo[]> => {
	if (!nodes.length) return []

	const cached = nodes.filter(n => isGossipNodeHealthy(n.domain))
	if (cached.length >= 2) return cached

	const sample = getRandomNodes(nodes, Math.min(10, nodes.length))
	const checks = await Promise.all(sample.map(async node => ({ node, ok: await probeGossipNode(node) })))
	const healthy = checks.filter(n => n.ok).map(n => n.node)

	return healthy
}

/** Pick up to `n` entry nodes for gossip send (healthy preferred). */
export const pickGossipEntryNodesForSend = async (
	pool: nodeInfo[],
	n = 4,
	excludeDomains?: Set<string>,
): Promise<nodeInfo[]> => {
	const filtered = excludeDomains?.size
		? pool.filter(node => !excludeDomains.has(node.domain))
		: pool
	if (!filtered.length) return []
	const healthy = await pickHealthyGossipNodes(filtered)
	const source = healthy.length >= 2 ? healthy : filtered
	return getRandomNodes(source, Math.min(n, source.length))
}


/** Minimal peer profile when tag search has no hit (still show inbound chat). */
export const emptySearchResultForAddress = (address: string): searchResult => ({
	address,
	created_at: 0,
	first_name: '',
	last_name: '',
	image: '',
	username: '',
	follow_count: '0',
	follower_count: '0',
})

export type CreateInboundChatSessionOpts = {
	/**
	 * Skip AddressPGP RPC + AES decrypt. Use for history restore / bulk catch-up so the
	 * main thread is not blocked for seconds after launch; keys fill in when the user
	 * opens the chat (or a later route refresh).
	 */
	skipKeyFetch?: boolean
}

/**
 * Open inbound chat for a verified sender EOA.
 * Do not refuse solely because profile search or on-chain PGP is missing.
 */
export const createInboundChatSession = async (
	signAddr: string,
	privateKeyArmor: string,
	peerProfile: searchResult | null | undefined,
	opts?: CreateInboundChatSessionOpts,
): Promise<chatData> => {
	const addr = ethers.isAddress(signAddr) ? ethers.getAddress(signAddr) : signAddr
	const beamio = peerProfile?.address ? peerProfile : emptySearchResultForAddress(addr)
	if (!peerProfile?.address) {
		console.warn(
			`[chat inbound] no Beamio profile for ${addr} — creating address-only session (message still shown)`,
		)
	}
	if (opts?.skipKeyFetch) {
		return {
			address: addr,
			beamio,
			messages: [],
			pin: false,
			hide: false,
			chatData: {
				publicArmored: '',
				routersArmoreds: '',
				online: false,
				routePgpKeyID: '',
			},
			unreadCount: 0,
			tag: 'grey',
			muted: false,
		}
	}
	const kk = await getKeysFromCoNETPGPSC(addr)
	if (!kk?.publicArmored) {
		console.warn(
			`[chat inbound] sender ${addr} has no on-chain PGP publicArmored — can display inbound, reply may fail until they register Chat`,
		)
	}
	return {
		address: addr,
		beamio,
		messages: [],
		pin: false,
		hide: false,
		chatData: {
			publicArmored: kk?.publicArmored ?? '',
			routersArmoreds: kk?.routersArmoreds ?? '',
			online: !!kk?.online,
			routePgpKeyID: kk?.routePgpKeyID ?? '',
		},
		unreadCount: 0,
		tag: 'grey',
		muted: false,
	}
}

export const sendMessage = async (
	pgpPublic: string,
	text: string,
	privateKeyArmor: string,
	entryNodes: nodeInfo[],
	opts?: { beamioNoPush?: boolean; mailboxRoutePublicKey?: string; recipientRouteArmored?: string },
): Promise<boolean> => {
	if (!entryNodes?.length) {
		console.error('[sendMessage] no entry nodes')
		return false
	}
	// Entry A must not be the recipient's mailbox B (B would see the sender IP).
	const recipientRoute = normalizeArmoredKey(opts?.recipientRouteArmored || opts?.mailboxRoutePublicKey)
		|| recipientRouteByUserKey.get(normalizeArmoredKey(pgpPublic)) || ''
	const recipientMailboxes = recipientRoute ? pickRouteNodesByArmoredKey(entryNodes, recipientRoute) : []
	if (!recipientRoute) {
		// Without the recipient's mailbox route the message cannot be wrapped to
		// it, and an unwrapped message shows the recipient key ID to the entry.
		console.error('[sendMessage] recipient mailbox unknown; not sent')
		return false
	}
	const recipientMailboxDomains = new Set(recipientMailboxes.map((n) => n.domain))
	// Rule 19: nor our own mailbox (known once the listen is up; native shells add it themselves).
	const ownMailboxDomains = new Set(gossipDeliveryAckContext?.mailboxDomains ?? [])
	const entryPool = entryNodes.filter((n) => !recipientMailboxDomains.has(n.domain) && !ownMailboxDomains.has(n.domain))
	if (!pgpPublic?.trim()) {
		console.error('[sendMessage] missing recipient publicArmored')
		return false
	}

	// Native shell: only the native daemon sends (signs, encrypts, wraps to the
	// mailbox, posts one entry at a time). It waits up to 10 s for the daemon.
	if (isCashTreesNativeWebView()) {
		return sendChatViaNativeDaemon(
			{ address: '', userPublicKeyArmored: pgpPublic, routerArmoredPublicKey: recipientRoute },
			text,
			opts?.beamioNoPush ? { beamioNoPush: true } : undefined,
		)
	}

	const wallet = new ethers.Wallet(privateKeyArmor)
	const signMessage = await wallet.signMessage(text)
	const message = {
		timestamp: Date.now(),
		text,
		from: wallet.address,
		signMessage
	}

	let encryptObj: any
	try {
		encryptObj = {
			message: await withChatTimeout(createMessage({
				text: Buffer.from(JSON.stringify(message)).toString("base64")
			}), 15_000, 'Chat message preparation'),
			encryptionKeys: await withChatTimeout(readKey({ armoredKey: pgpPublic }), 15_000, 'Chat recipient-key parsing'),
			config: { preferredCompressionAlgorithm: enums.compression.zlib }
		}
	} catch (ex: any) {
		console.error(`[sendMessage] createMessage/readKey Error! ${ex?.message || ex}`)
		return false
	}

	let postData: string
	try {
		postData = await withChatTimeout(encrypt(encryptObj), 20_000, 'Chat message encryption')
	} catch (ex: any) {
		console.error(`[sendMessage] encrypt Error! ${ex?.message || ex}`)
		return false
	}

	// Always wrap to the recipient's mailbox B: the entry sees only B's route
	// key ID, never the recipient's key ID (B unwraps and stores).
	try {
		postData = await wrapArmorToMailboxWork(postData, recipientRoute, opts?.beamioNoPush ? { NoPush: true } : undefined)
	} catch (ex: any) {
		console.error(`[sendMessage] mailbox wrap Error! ${ex?.message || ex}`)
		return false
	}

	if (!entryPool.length) {
		console.error('[sendMessage] no entry outside the mailboxes')
		return false
	}
	const body = JSON.stringify({ data: postData })
	const tried = new Set<string>()
	const started = Date.now()
	// One entry at a time; the next only after a clear failure (network error or
	// reset, non-2xx, `{ ok: false }`, or no answer in 8 s). A timed-out POST may
	// have arrived: the mailbox keeps one copy and the recipient dedupes by sendId.
	for (let attempt = 0; attempt < SEND_MAX_ENTRIES && Date.now() - started < SEND_TOTAL_BUDGET_MS; attempt++) {
		const [node] = await pickGossipEntryNodesForSend(entryPool, 1, tried)
		if (!node) break
		tried.add(node.domain)
		const url = `https://${node.domain}.conet.network/post`
		try {
			const res = await postWithTimeout(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body,
				// Avoid Chrome Network panel noise; does not fix node/SI failures.
				referrerPolicy: 'no-referrer',
			}, SEND_ATTEMPT_TIMEOUT_MS)
			if (!res.ok) {
				console.warn(`[sendMessage] ${url} → HTTP ${res.status}`)
				markGossipNodeBad(node.domain)
				continue
			}
			const answer = await res.text().catch(() => '')
			if (/"ok"\s*:\s*false/.test(answer)) {
				console.warn(`[sendMessage] ${url} → ok:false`)
				continue
			}
			markGossipNodeHealthy(node.domain)
			return true
		} catch (ex: any) {
			// Chrome often labels bare network / missing-ACAO failures as CORS
			// ("strict-origin-when-cross-origin"). Prefer explicit fetch error text.
			console.warn(`[sendMessage] ${url} → ${ex?.name || 'error'}: ${ex?.message || ex}`)
			markGossipNodeBad(node.domain)
		}
	}

	console.error('[sendMessage] all entry POSTs failed', [...tried])
	return false
}

const SEND_ATTEMPT_TIMEOUT_MS = 8_000
const SEND_MAX_ENTRIES = 4
const SEND_TOTAL_BUDGET_MS = 25_000


/**
 * EIP-191 signer of a chat envelope, lowercase, or null when the signature is
 * malformed. The recovered signer is the only trusted sender; the envelope's
 * `from` is a claim (see App `addNewMessage`).
 */
export const recoverChatSigner = (message: string, signMess: string): string | null => {
	if (!message || !signMess) return null
	try {
		const recovered = ethers.verifyMessage(message, signMess)
		return recovered ? recovered.toLowerCase() : null
	} catch {
		return null
	}
}

export const checkSign = (message: string, signMess: string, signWallet: string) => {
	if (!message || !signMess) {
		
		return null
	}
	
	let recoverPublicKey
	try {
		recoverPublicKey = ethers.verifyMessage(message, signMess)

	} catch (ex) {
		return null
	}

	if (!recoverPublicKey || recoverPublicKey.toLowerCase() !== signWallet.toLowerCase()) {
		
		return null
	}
	
	return signWallet.toLowerCase()
	
}


/** Prefer sendId so two messages in the same ms (e.g. gift note + merchantGift card) never collapse. */
const stableChatMessageId = (m: ChatMessage | null | undefined, fallbackTs?: number): string => {
	if (m?.id?.startsWith('tmp_')) return String(m.id)
	const sendId = typeof m?.sendId === 'string' ? m.sendId.trim() : ''
	if (sendId) return sendId
	if (typeof m?.id === 'string' && m.id.trim()) return m.id.trim()
	const created = Number(m?.createdAt)
	if (Number.isFinite(created)) return String(created)
	if (Number.isFinite(Number(fallbackTs))) return String(fallbackTs)
	return `msg_${Math.random().toString(16).slice(2)}`
}

export const makeMessage = (
	data: ChatMessage[],
	newChatText: string,
	timestamp: number,
	from: "me" | "them",
	status?: "sending" | "sent" | "delivered" | "failed",
	/** Inbound only: the claimed wallet when it differs from the recovered signer. */
	meta?: { claimedFrom?: string },
) => {
	// 1) Normalize existing rows — never rewrite sendId-backed ids to createdAt alone
	//    (that dropped merchantGift when a note shared the same millisecond).
	const normalized = (data || []).map((m) => {
		if (m?.id?.startsWith('tmp_')) return m
		const id = stableChatMessageId(m)
		return { ...m, id }
	})

	const seen = new Set<string>()
	const result: ChatMessage[] = []

	for (const m of normalized) {
		if (!m) continue
		const key = stableChatMessageId(m)
		if (!key || seen.has(key)) continue
		seen.add(key)
		result.push({ ...m, id: key })
	}

	// 2) Merge the inbound payload (JSON card / sendId text / plain text)
	const resultLenBefore = result.length
	const ts = Number(timestamp)
	const text = (newChatText || '').trim()
	try {
		const card: ChatMessage = JSON.parse(text)
		const dedupKey = stableChatMessageId(card, ts)
		if (seen.has(dedupKey)) {
			// duplicate push — keep existing
		} else if (card.paymentCard) {
			card.from = 'them'
			card.id = dedupKey
			if (card.createdAt == null) card.createdAt = ts
			seen.add(dedupKey)
			result.push(card)
		} else if (card.reply) {
			card.from = 'them'
			card.id = dedupKey
			if (card.createdAt == null) card.createdAt = ts
			seen.add(dedupKey)
			result.push(card)
		} else if (card.sendId != null) {
			card.from = 'them'
			card.id = dedupKey
			if (card.createdAt == null) card.createdAt = ts
			seen.add(dedupKey)
			result.push(card)
		} else throw new Error('')
	} catch {
		if (text && Number.isFinite(ts)) {
			const incomingId = String(ts)
			if (!seen.has(incomingId)) {
				seen.add(incomingId)
				result.push({
					id: incomingId,
					from,
					text,
					createdAt: ts,
					status: status ?? (from === 'me' ? 'sent' : 'sent'),
				})
			}
		}
	}

	// Flag only the row this call added (never an older message).
	if (meta?.claimedFrom && result.length > resultLenBefore) {
		const added = result[result.length - 1]
		if (added && added.from === 'them') added.claimedFrom = meta.claimedFrom
	}
	result.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
	return result
}

export function emitReactionAsNewMessage (amount: number, currency: ICurrency, title: string,usdcAmount: number, cashcodeUrl: string ) {	//(targetMessageId: string, reaction: ReactionKey) {
	// const reactionLabel = REACTIONS.find(r => r.key === reaction)?.label || "👍"
	const now = Date.now()
	const tempId = new Date().getTime()

	// ✅ 你可以换成只发 emoji：text: reactionLabel
	// const text = reactionLabel
	const card: paymentCard = {
		amount: amount,
		currency,
		title,
		usdcAmount,
		timeStamp: new Date().getTime(),
		cashcodeUrl
	}
	const mess: ChatMessage = 
		{
			id: tempId.toString(),
			from: 'me',
			text:'',
			createdAt: now,
			status: "sent",
			paymentCard: card
		}
	return mess
}

/** 创建 Payment Request 卡片消息（共通的 payMe 数据 + 展示用 requestUrl/walletLabel/memo）。fiat 请求不传 usdcAmount，接收方点 Pay 时再按当时汇率换算。 */
export function createPaymentRequestCard(opts: {
	amount: number
	currency: ICurrency
	title: string
	/** 仅 USDC 请求传入；fiat 请求不传，接收方点 Pay 时按当时汇率换算 */
	usdcAmount?: number
	requestUrl: string
	walletLabel?: string
	memo?: string
}): ChatMessage {
	const now = Date.now()
	const sendId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pr_${now}_${Math.random().toString(36).slice(2)}`
	const card: paymentCard = {
		amount: opts.amount,
		currency: opts.currency,
		title: opts.title,
		usdcAmount: opts.usdcAmount ?? 0,
		timeStamp: now,
		cashcodeUrl: opts.requestUrl,
		cardType: 'paymentRequest',
		requestUrl: opts.requestUrl,
		walletLabel: opts.walletLabel ?? 'Main Wallet • EOA',
		memo: opts.memo ?? opts.title,
	}
	return {
		sendId,
		from: 'me',
		text: '',
		createdAt: now,
		status: 'sent',
		paymentCard: card,
	}
}

/**
 * Merchant gift redeem card for Chat (Direct transfer to @BeamioTag).
 * Tap opens the same gift claim sheet as `/app/?beamiocard=&redeemcode=`.
 */
export function createMerchantGiftRedeemCard(params: {
	amount: number
	currency: ICurrency
	merchantTitle: string
	claimUrl: string
	/** Optional short note shown under the card chrome */
	memo?: string
	/** Tier background selected by the purchaser */
	imageUrl?: string
	usdcAmount?: number
}): ChatMessage {
	const now = Date.now()
	const sendId =
		typeof crypto !== 'undefined' && crypto.randomUUID
			? crypto.randomUUID()
			: `gift_${now}_${Math.random().toString(36).slice(2)}`
	const title = (params.merchantTitle || 'Merchant gift').trim() || 'Merchant gift'
	const card: paymentCard = {
		amount: params.amount,
		currency: params.currency,
		title,
		timeStamp: now,
		usdcAmount: params.usdcAmount ?? params.amount,
		cashcodeUrl: params.claimUrl,
		cardType: 'merchantGift',
		requestUrl: params.claimUrl,
		statusLabel: 'Gift voucher',
		memo: params.memo?.trim() || undefined,
		imageUrl: params.imageUrl?.trim() || undefined,
	}
	return {
		sendId,
		id: sendId,
		from: 'me',
		text: '',
		createdAt: now,
		status: 'sent',
		paymentCard: card,
	}
}

/**
 * 创建用于 Chat 的 Membership Activated 卡片消息。
 * 对应 MessageSendReceiveCard 的 variant="membershipActivated"。
 */
export function createMembershipActivatedCard(params: {
	amount: number
	currency: ICurrency
	title?: string
	usdcAmount?: number
	statusLabel?: string
	/** 辅助字段：交易 hash（如链上 tx hash），可用于 View Invoice 等 */
	hash?: string
}): ChatMessage {
	const now = Date.now()
	const tempId = now
	const card: paymentCard = {
		amount: params.amount,
		currency: params.currency,
		title: params.title ?? "Membership Activated",
		timeStamp: now,
		usdcAmount: params.usdcAmount ?? params.amount,
		cashcodeUrl: "",
		cardType: "membershipActivated",
		statusLabel: params.statusLabel ?? "Confirmed on-chain",
		hash: params.hash,
	}
	return {
		id: tempId.toString(),
		from: "me",
		text: "",
		createdAt: now,
		status: "sent",
		paymentCard: card,
	}
}

/** 按 address 去重：规范化小写，每个 address 只保留一项（保留首次出现的） */
export function dedupeChatsByAddress(chats: chatData[]): chatData[] {
	const seen = new Set<string>()
	return chats.filter(chat => {
		const key = (chat.address ?? '').trim().toLowerCase()
		if (!key) return false
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})
}

/** 刷新每个 chat 的链上路由信息（routersArmoreds, routePgpKeyID）。不改 online（见 refreshChatMailboxPresence）。 */
export const refreshChatRoutes = async (profile: profile): Promise<profile> => {
	if (!profile?.chats?.length || !profile.privateKeyArmor) return profile
	const chats = [...profile.chats]
	let changed = false
	for (let i = 0; i < chats.length; i++) {
		const c = chats[i]
		const addr = (c.address ?? '').trim()
		if (!addr || !ethers.isAddress(addr)) continue
		try {
			const kk = await getKeysFromCoNETPGPSC(addr)
			if (!kk) continue
			const cd = c.chatData
			const nextRouters = kk.routersArmoreds || cd?.routersArmoreds || ''
			const nextRouteKeyID = kk.routePgpKeyID || cd?.routePgpKeyID || ''
			const nextPublic = kk.publicArmored || cd?.publicArmored || ''
			if (
				nextRouters !== (cd?.routersArmoreds ?? '') ||
				nextRouteKeyID !== (cd?.routePgpKeyID ?? '') ||
				nextPublic !== (cd?.publicArmored ?? '')
			) {
				chats[i] = {
					...c,
					chatData: {
						publicArmored: nextPublic,
						routersArmoreds: nextRouters,
						routePgpKeyID: nextRouteKeyID,
						// Preserve last mailbox-probe result; never import chain routeOnline.
						online: cd?.online ?? false,
						nativeWakeable: cd?.nativeWakeable,
					}
				}
				changed = true
			}
		} catch (_) { /* 单条失败不影响其他 */ }
	}
	if (changed) {
		profile.chats = dedupeChatsByAddress(chats)
	}
	return profile
}

/**
 * Ask each contact's mailbox whether that wallet has an active listen SSE.
 * Encrypt to mailbox B route PGP; HTTP via entry C ≠ B. Trusted ok:true only updates online.
 * Inside the native shell the shell picks `http://{ip}/post`. Domain HTTPS is the browser path,
 * and the fallback when the shell has no IP roster yet.
 */
async function postQueryViaNativeShell(
	armored: string,
	entryNodes: nodeInfo[],
	mailboxDomains: Set<string>,
): Promise<unknown | 'fallback'> {
	if (!isCashTreesNativeWebView()) return 'fallback'
	const excludeIps = entryNodes
		.filter((n) => n?.ip_addr && mailboxDomains.has(n.domain))
		.map((n) => String(n.ip_addr).trim())
		.filter(Boolean)
	const shell = await postNativePgpCiphertext(armored, excludeIps)
	if (shell.error === 'no_si_roster' || shell.error === 'bridge_missing') return 'fallback'
	const trimmed = (shell.body || '').trim()
	if (!shell.ok || !trimmed) return null
	try {
		return JSON.parse(trimmed)
	} catch {
		const m = trimmed.match(/\{[\s\S]*\}/)
		if (!m) return null
		try {
			return JSON.parse(m[0])
		} catch {
			return null
		}
	}
}

export const queryMailboxWalletOnline = async (opts: {
	targetWallet: string
	routerArmoredPublicKey: string
	privateKeyArmor: string
	entryNodes: nodeInfo[]
	mailboxDomains: Set<string>
}): Promise<{ online: boolean; ok: boolean } | null> => {
	const { targetWallet, routerArmoredPublicKey, privateKeyArmor, entryNodes, mailboxDomains } = opts
	if (!ethers.isAddress(targetWallet) || !routerArmoredPublicKey?.trim() || !privateKeyArmor?.trim()) {
		return null
	}
	if (!entryNodes?.length) return null
	try {
		const wallet = new ethers.Wallet(privateKeyArmor)
		const timestamp = Math.floor(Date.now() / 1000)
		const command = {
			command: 'wallet_online_query',
			walletAddress: wallet.address,
			targetWallet: ethers.getAddress(targetWallet),
			timestamp,
		}
		const message = JSON.stringify(command)
		const signMessage = await wallet.signMessage(message)
		const encryptionKeys = await readKey({ armoredKey: routerArmoredPublicKey })
		const pgpMsg = await createMessage({
			text: Buffer.from(JSON.stringify({ message, signMessage })).toString('base64'),
		})
		const postData = await encrypt({
			message: pgpMsg,
			encryptionKeys,
			config: { preferredCompressionAlgorithm: enums.compression.zlib },
		})
		const armored = typeof postData === 'string' ? postData : String((postData as any)?.data ?? postData)
		const viaShell = await postQueryViaNativeShell(armored, entryNodes, mailboxDomains)
		if (viaShell !== 'fallback') {
			if (viaShell && typeof viaShell === 'object' && (viaShell as { ok?: boolean }).ok === true) {
				return { ok: true, online: !!(viaShell as { online?: boolean }).online }
			}
			return null
		}
		const payload = JSON.stringify({ data: armored })
		const pool = entryNodes.filter(n => n?.domain && !mailboxDomains.has(n.domain))
		if (!pool.length) return null
		const entries = await pickGossipEntryNodesForSend(pool, 4, mailboxDomains)
		const targets = entries.length ? entries : getRandomNodes(pool, Math.min(4, pool.length))
		if (!targets.length) return null
		const results = await Promise.all(
			targets.map(async node => {
				const url = `https://${node.domain}.conet.network/post`
				try {
					const res = await postWithTimeout(
						url,
						{
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: payload,
							referrerPolicy: 'no-referrer',
						},
						10_000,
					)
					const text = await res.text()
					const trimmed = (text || '').trim()
					if (!trimmed) return null
					try {
						return JSON.parse(trimmed)
					} catch {
						const m = trimmed.match(/\{[\s\S]*\}/)
						if (m) {
							try {
								return JSON.parse(m[0])
							} catch {
								return null
							}
						}
						return null
					}
				} catch {
					return null
				}
			}),
		)
		for (const r of results) {
			if (r && typeof r === 'object' && (r as { ok?: boolean }).ok === true) {
				return { ok: true, online: !!(r as { online?: boolean }).online }
			}
		}
		return null
	} catch (e: any) {
		console.warn('[queryMailboxWalletOnline]', e?.message ?? e)
		return null
	}
}

/**
 * Ask the contact mailbox whether that wallet has a registered native shell
 * (iOS, Android, Windows, Linux, or macOS) that push can wake.
 * Encrypt to mailbox B route PGP; HTTP via entry C ≠ B.
 * Trusted only when ok === true. Failure returns null and must not clear the last value.
 * Call this after wallet_online_query.
 */
export const queryMailboxNativeWakeable = async (opts: {
	targetWallet: string
	routerArmoredPublicKey: string
	privateKeyArmor: string
	entryNodes: nodeInfo[]
	mailboxDomains: Set<string>
}): Promise<{ nativeWakeable: boolean; ok: boolean } | null> => {
	const { targetWallet, routerArmoredPublicKey, privateKeyArmor, entryNodes, mailboxDomains } = opts
	if (!ethers.isAddress(targetWallet) || !routerArmoredPublicKey?.trim() || !privateKeyArmor?.trim()) {
		return null
	}
	if (!entryNodes?.length) return null
	try {
		const wallet = new ethers.Wallet(privateKeyArmor)
		const timestamp = Math.floor(Date.now() / 1000)
		const command = {
			command: 'wallet_native_wake_query',
			walletAddress: wallet.address,
			targetWallet: ethers.getAddress(targetWallet),
			timestamp,
		}
		const message = JSON.stringify(command)
		const signMessage = await wallet.signMessage(message)
		const encryptionKeys = await readKey({ armoredKey: routerArmoredPublicKey })
		const pgpMsg = await createMessage({
			text: Buffer.from(JSON.stringify({ message, signMessage })).toString('base64'),
		})
		const postData = await encrypt({
			message: pgpMsg,
			encryptionKeys,
			config: { preferredCompressionAlgorithm: enums.compression.zlib },
		})
		const armored = typeof postData === 'string' ? postData : String((postData as any)?.data ?? postData)
		const viaShell = await postQueryViaNativeShell(armored, entryNodes, mailboxDomains)
		if (viaShell !== 'fallback') {
			if (viaShell && typeof viaShell === 'object' && (viaShell as { ok?: boolean }).ok === true) {
				return { ok: true, nativeWakeable: !!(viaShell as { nativeWakeable?: boolean }).nativeWakeable }
			}
			return null
		}
		const payload = JSON.stringify({ data: armored })
		const pool = entryNodes.filter(n => n?.domain && !mailboxDomains.has(n.domain))
		if (!pool.length) return null
		const entries = await pickGossipEntryNodesForSend(pool, 4, mailboxDomains)
		const targets = entries.length ? entries : getRandomNodes(pool, Math.min(4, pool.length))
		if (!targets.length) return null
		const results = await Promise.all(
			targets.map(async node => {
				const url = `https://${node.domain}.conet.network/post`
				try {
					const res = await postWithTimeout(
						url,
						{
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: payload,
							referrerPolicy: 'no-referrer',
						},
						10_000,
					)
					const text = await res.text()
					const trimmed = (text || '').trim()
					if (!trimmed) return null
					try {
						return JSON.parse(trimmed)
					} catch {
						const m = trimmed.match(/\{[\s\S]*\}/)
						if (m) {
							try {
								return JSON.parse(m[0])
							} catch {
								return null
							}
						}
						return null
					}
				} catch {
					return null
				}
			}),
		)
		for (const r of results) {
			if (r && typeof r === 'object' && (r as { ok?: boolean }).ok === true) {
				return { ok: true, nativeWakeable: !!(r as { nativeWakeable?: boolean }).nativeWakeable }
			}
		}
		return null
	} catch (e: any) {
		console.warn('[queryMailboxNativeWakeable]', e?.message ?? e)
		return null
	}
}

export const sendVoiceCallOffer = async (opts: {
	recipientPgp: string
	recipientRoute: string
	signal: {
		callId: string
		sessionId: string
		from: string
		to: string
		expiresAt: number
	}
	privateKey: string
	allNodes: nodeInfo[]
	entryNodes?: nodeInfo[]
}): Promise<boolean> => {
	const sent = await sendMessage(
		opts.recipientPgp,
		JSON.stringify(opts.signal),
		opts.privateKey,
		opts.entryNodes?.length ? opts.entryNodes : opts.allNodes,
	)
	if (!sent) return false
	ensureNativePushBoundForWallet()
	return true
}

/**
 * Probe all chats with a mailbox route. Returns address(lower) → online for trusted replies only.
 */
export const refreshChatMailboxPresence = async (
	chats: chatData[],
	privateKeyArmor: string,
): Promise<Map<string, boolean>> => {
	const out = new Map<string, boolean>()
	if (!chats?.length || !privateKeyArmor) return out
	const nodes = await getCoNETNodesForChat()
	if (!nodes.length) return out
	await Promise.all(
		chats.map(async chat => {
			const addr = (chat.address || '').trim().toLowerCase()
			const route = chat.chatData?.routersArmoreds?.trim()
			if (!addr || !ethers.isAddress(addr) || !route) return
			const routeNodes = pickRouteNodesByArmoredKey(nodes, route)
			const mailboxDomains = new Set(routeNodes.map(n => n.domain).filter(Boolean))
			const r = await queryMailboxWalletOnline({
				targetWallet: addr,
				routerArmoredPublicKey: route,
				privateKeyArmor,
				entryNodes: nodes,
				mailboxDomains,
			})
			if (r?.ok) out.set(addr, r.online)
		}),
	)
	return out
}

/** Probe one contact after presence. Trusted ok:true only. */
export const refreshPeerNativeWakeable = async (
	targetWallet: string,
	routerArmoredPublicKey: string,
	privateKeyArmor: string,
): Promise<{ ok: true; nativeWakeable: boolean } | null> => {
	const addr = (targetWallet || '').trim()
	const route = (routerArmoredPublicKey || '').trim()
	if (!addr || !ethers.isAddress(addr) || !route || !privateKeyArmor) return null
	const nodes = await getCoNETNodesForChat()
	if (!nodes.length) return null
	const routeNodes = pickRouteNodesByArmoredKey(nodes, route)
	const mailboxDomains = new Set(routeNodes.map(n => n.domain).filter(Boolean))
	const r = await queryMailboxNativeWakeable({
		targetWallet: addr,
		routerArmoredPublicKey: route,
		privateKeyArmor,
		entryNodes: nodes,
		mailboxDomains,
	})
	if (!r?.ok) return null
	return { ok: true, nativeWakeable: r.nativeWakeable }
}

export const initMessage = async (profile: profile, beamioer: searchResult): Promise<chatData|null> => {
	const address = (beamioer.address ?? '').trim().toLowerCase()
	if (!address) return null

	if (!profile.chats) {
		profile.chats = []
	}
	// 按 address 去重，保留首次出现的项
	profile.chats = dedupeChatsByAddress(profile.chats)

	// 先检查 beamioer（按 address）是否已存在于 profile.chats 中
	const existingIndex = profile.chats.findIndex(n => (n.address ?? '').toLowerCase() === address)
	if (existingIndex >= 0) {
		return profile.chats[existingIndex]
	}

	// 不存在则创建新 chat，放入 profile.chats 并返回
	const kk = await getKeysFromCoNETPGPSC(beamioer.address)
	if (!kk?.publicArmored) {
		return null
	}

	const newChat: chatData = {
		address,
		messages: [],
		chatData: kk,
		beamio: beamioer,
		pin: false,
		hide: false,
		muted: false,
		tag: 'grey',
		unreadCount: 1,
	}
	profile.chats.push(newChat)
	// 再次去重，避免并发或其它路径导致同 address 出现多次
	profile.chats = dedupeChatsByAddress(profile.chats)
	return newChat
}
