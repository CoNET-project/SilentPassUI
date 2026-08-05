import {
	pgpCoNET
} from '@/utils/constants'
import {generateKey, readKey, createMessage, enums, encrypt, decryptKey, readPrivateKey, readMessage, decrypt, PrivateKey} from 'openpgp'
import { CoNET_Data, setCoNET_Data } from "@/utils/globals"

import {GuardianNodesMainnet, conetDepinProvider, beamioApi} from '@/utils/constants'
import contracts from '@/utils/contracts'
import {ethers} from 'ethers'
import {aesGcmEncrypt, aesGcmDecrypt, toBase64, fromBase64, storeSystemData } from '@/services/beamio'
import { publishNativePwaLog } from '@/utils/cashTreesNativePwaLog'

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
export const getKeysFromCoNETPGPSCByAddress = async (walletAddress: string, privateKeyArmor: string) => {
	return getKeysFromCoNETPGPSC(walletAddress, privateKeyArmor)
}

export const getKeysFromCoNETPGPSC = async (keyIDOrAddress: string, privateKeyArmor: string) => {
	if (!isValidEthersPrivateKey(privateKeyArmor)) {
		console.warn('[getKeysFromCoNETPGPSC] invalid privateKeyArmor format, skipping')
		return null
	}
	let Wallet: ethers.Wallet
	try {
		Wallet = new ethers.Wallet(privateKeyArmor, conetDepinProvider)
	} catch (ex: any) {
		console.warn('[getKeysFromCoNETPGPSC] Wallet creation failed:', ex?.message || ex)
		return null
	}
	const contract = contracts.constPgpManager
	const SC = new ethers.Contract(contract.address, contract.abi, Wallet)
	// searchKey 接受 address；若传入 keyID，可用 pgpKeyIDHash2Wallet 查 address，此处简化为：若为有效 address 则用，否则用 Wallet.address
	const lookupAddr = ethers.isAddress(keyIDOrAddress) ? keyIDOrAddress : Wallet.address
	try {
		const [info, privateKey] : [searchKeyPGP, string] = await Promise.all([
			SC.searchKey(lookupAddr),
			SC.getEncryptedPrivateKey()
		])
		let privateArmored = ''
		let publicArmored = ''
		if (privateKey) {
			try {
				privateArmored = await aesGcmDecrypt(privateKey, privateKeyArmor)
			} catch {
				return null
			}
			
			
		}
		if (info.userPublicKeyArmored) {
			publicArmored = fromBase64(info.userPublicKeyArmored)
		}
		const routersArmoreds = info.routePublicKeyArmored ? fromBase64(info.routePublicKeyArmored) : ''

		// Presence is NOT chain routeOnline (SI abandoned setUserOnlineOnMe).
		// UI online comes from mailbox `wallet_online_query` — see refreshChatMailboxPresence.
		return {privateArmored, publicArmored, routersArmoreds, online: false, routePgpKeyID: info.routePgpKeyID, userPgpKeyID: info.userPgpKeyID}
	} catch (ex) {
		return null
	}
}



/** 获取 CoNET 节点列表（供 sendMessage 等使用），可单独调用无需 initChat */
export const getCoNETNodesForChat = (): Promise<nodeInfo[]> => new Promise(async resolve=> {
	const Guardian_Nodes: nodeInfo[] = []
    const _nodes1 = await GuardianNodesMainnet.getAllNodes(0, 400)
    const _nodes2 = await GuardianNodesMainnet.getAllNodes(400, 800)
    const _nodes = [..._nodes1, ..._nodes2]

    for (let i = 0; i < _nodes.length; i ++) {
        const node = _nodes[i]
        const id = parseInt(node[0].toString())
        const pgpString: string = Buffer.from( node[1], 'base64').toString()
        const domain: string = node[2]
        const ipAddr: string = node[3]
        const region: string = node[4]
        
        

        const itemNode: nodeInfo = {
            ip_addr: ipAddr,
            armoredPublicKey: pgpString,
            domain: domain,
            nftNumber: id,
            region: region
        }
    
        Guardian_Nodes.push(itemNode)
    }
    
    resolve(Guardian_Nodes)
})

const getAllNodes = getCoNETNodesForChat

const isPgpKeyComplete = (pgp: initBeamioPGPKeysRet | undefined): boolean => {
	if (!pgp) return false
	// keyID、privateKey、publicKey 必填；routes 可为空（后续从链上拉取）
	return !!(pgp.keyID?.trim() && pgp.privateKey?.trim() && pgp.publicKey?.trim() && typeof pgp.routes === 'string')
}

/** 互斥：确保同一时刻只有一个 initChat 在执行 */
let initChatInProgress = false

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
	chatBootLog('initChat starting…')
	try {
		setGossip(true)
		const allNodes = await getAllNodes()
		chatBootLog(`CoNET nodes loaded: ${allNodes?.length ?? 0}`)
		setAllNodes(allNodes)
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
				setGossip(false)
				return
			}

			chatManager = {
				pgpKey: pgpData,
				router: chatManager?.router || '',

			}
			profile.chatManager = chatManager
			routes = pgpData.routes || chatManager.router || ''
		}


		// ✅ 如果没有 routes，从链上/SC 找；再不行就随机注册一个
		//	寻找链上信息
		const rr = await getKeysFromCoNETPGPSC(profile.keyID, profile.privateKeyArmor)
		routes = rr?.routersArmoreds||''

		//	链上route信息
		if (routes) {
			chatManager.router = routes
		}

		// 检测：本地 PGP 与链上不一致时，说明用户在本地更换了密钥对但未重新登记，需调用 regiestChatRoute 同步
		if (rr?.userPgpKeyID && chatManager.pgpKey.publicKey) {
			try {
				const localKeyID = await getPublicKeyArmoredKeyID(chatManager.pgpKey.publicKey)
				const chainKeyID = (rr.userPgpKeyID || '').toUpperCase()
				if (localKeyID && chainKeyID && localKeyID !== chainKeyID) {
					console.warn('[initChat] 本地 PGP KeyID 与链上不一致，重新登记', { localKeyID, chainKeyID })
					const node = getRandomNode(allNodes)
					if (node) {
						const ok = await regiestChatRoute(
							profile.privateKeyArmor,
							chatManager.pgpKey.publicKey,
							localKeyID,
							chatManager.pgpKey.privateKey,
							node.domain
						)
						if (ok) {
							await new Promise(r => setTimeout(r, 5000))
							const rr2 = await getKeysFromCoNETPGPSC(profile.keyID, profile.privateKeyArmor)
							const chainKeyID2 = (rr2?.userPgpKeyID || '').toUpperCase()
							if (chainKeyID2 === localKeyID) {
								console.log('[initChat] 重新登记验证成功', { localKeyID, chainKeyID2 })
							} else {
								console.warn('[initChat] 重新登记 5 秒后验证失败：链上仍为', chainKeyID2, '，期望', localKeyID)
							}
						}
					}
				}
			} catch (e: any) {
				console.warn('[initChat] 检测 PGP KeyID 时出错', e?.message ?? e)
			}
		}

		if (!routes) {
			const node = getRandomNode(allNodes)
			if (node) {
				await regiestChatRoute(
					profile.privateKeyArmor,
					chatManager.pgpKey.publicKey,
					chatManager.pgpKey.keyID,
					chatManager.pgpKey.privateKey,
					node.domain
				)
				chatManager.router = node.armoredPublicKey
			}
		}


		profile.chatManager = chatManager
		temp.profiles[0] = profile
		setProfiles(profiles)
		setCoNET_Data(temp)
		storeSystemData()

		if (!allNodes?.length) {
			chatBootLog('initChat abort: no CoNET gossip nodes', 'warn')
			setGossip(false)
			return
		}
	
		chatBootLog(`connectToGossipNode starting (router=${Boolean(chatManager.router)})`)
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
		}
	} catch (error) {
		chatBootLog(`initChat error: ${(error as Error)?.message ?? String(error)}`, 'error')
		setGossip(false)
	} finally {
		initChatInProgress = false
	}
}

export const initBeamioPGPKeys = async (profile: profile): Promise<initBeamioPGPKeysRet|null> => {
	
	const keyInfo = await getKeysFromCoNETPGPSC(profile.keyID, profile.privateKeyArmor)
	if (keyInfo?.privateArmored) {
		return {
			privateKey: keyInfo.privateArmored,
			publicKey: keyInfo.publicArmored,
			keyID: profile.keyID || keyInfo.userPgpKeyID || '',
			routes: keyInfo.routersArmoreds
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

export const regiestChatRoute = async (privateKey: string, pubArmor: string, keyID: string, priArmor: string, routeKeyID: string) => {
	const Wallet = new ethers.Wallet(privateKey, conetDepinProvider)
	const encryptPri = await aesGcmEncrypt(priArmor, privateKey)
	const publicKeyArmored = toBase64(pubArmor)
	try {
		const res = await fetch(`${beamioApi}/api/regiestChatRoute`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				wallet: Wallet.address,
				keyID,
				publicKeyArmored,
				encrypKeyArmored: encryptPri,
				routeKeyID
			})
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

function isGossipListingLivenessFrame(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false
  const row = payload as Record<string, unknown>
  return typeof row.ipaddress === 'string' || 'nodeWallets' in row
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

interface SSEErrorType {
  type: 'connect_timeout' | 'idle_timeout' | 'read_timeout' | 'network_error' | 'unknown'
  message: string
  retriable: boolean
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
}

/**
 * iOS WKWebView freezes long fetch streams in background; timers may not fire until foreground.
 * Resume only when listen is truly dead/aborted, or idle longer than staleMs AFTER we have
 * received bytes. Never tear down a connecting stream (lastGossipActivityAt===0) — that races
 * SI offline flush and drops messages.
 */
export const shouldResumeGossipListen = (staleMs = 45_000): boolean => {
	if (!currentGossipAbortController || currentGossipAbortController.signal.aborted) return true
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
 * While Home leaves the WebView alive, keep listen and use native
 * `notifyBackgroundChat` local push instead (see DaemonProvider + cashTreesAppLifecycle).
 */
export const pauseGossipListenOnBackground = (
	setGossip: (val: boolean) => void,
): void => {
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
export const resumeGossipListenOnForeground = async (
	setProfiles: (val: profile[]) => void,
	setAllNodes: (val: nodeInfo[]) => void,
	setGossip: (val: boolean) => void,
	newMessage: (val: string) => void,
	staleMs = 45_000,
): Promise<void> => {
	if (!shouldResumeGossipListen(staleMs)) {
		chatBootLog('foreground resume skipped: gossip stream still active or connecting', 'info')
		return
	}
	prepareGossipListenResume('foreground_resume')
	setGossip(false)
	await initChat(setProfiles, setAllNodes, setGossip, false, newMessage)
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
      const routeNodes = pickRouteNodesByArmoredKey(nodes, nodeArmoredPublicKey)
      if (!routeNodes.length) {
        return failConnect('connectToGossipNode abort: no route node for router key')
      }
      const mailboxDomains = new Set(routeNodes.map(n => n.domain))

      // ... (加密/准备逻辑保持不变) ...
      const wallet = new ethers.Wallet(privateKeyArmor);
      const key = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
      const command = { command: 'mining', walletAddress: wallet.address, algorithm: 'aes-256-cbc', Securitykey: key };
      const message = JSON.stringify(command);
      const signMessage = await wallet.signMessage(message);
      
      const encryptionKeys = await readKey({ armoredKey: nodeArmoredPublicKey });
      const pgpMsg = await createMessage({ text: Buffer.from(JSON.stringify({ message, signMessage })).toString('base64') });
      const postData = await encrypt({ message: pgpMsg, encryptionKeys, config: { preferredCompressionAlgorithm: enums.compression.zlib }});

      let decryptedPrivateKey: PrivateKey;
      const pk = await readPrivateKey({ armoredKey: pgpPrivateKey });
      decryptedPrivateKey = pk.isDecrypted() ? pk : await decryptKey({ privateKey: pk, passphrase: "" });

      const userPgpKeyID = pgpPublicArmored ? await getPublicKeyArmoredKeyID(pgpPublicArmored) : '';

      console.log("🚀 [Gossip] Starting new connection...");
      chatBootLog('Gossip SSE connect starting…')
      const gossipBody = JSON.stringify({ data: postData })
      const entryCandidates = nodes.filter(n => !mailboxDomains.has(n.domain))
      const healthyNodes = await pickHealthyGossipNodes(
        entryCandidates.length ? entryCandidates : nodes,
      )
      chatBootLog(
        `Gossip healthy entry C: ${healthyNodes.length} (mailbox B domains excluded: ${[...mailboxDomains].join(',') || 'none'})`,
      )
      if (!healthyNodes.length) {
        return failConnect('connectToGossipNode abort: no healthy entry C for gossip listen')
      }

      gossipDeliveryAckContext = {
        routerArmoredPublicKey: nodeArmoredPublicKey,
        privateKeyArmor: privateKeyArmor,
        entryNodes: healthyNodes,
        mailboxDomains: [...mailboxDomains],
      }

      // 启动递归循环，传入 entry C 数组，重连时随机换 entry（不直连 B）
      startGossip(
        healthyNodes, 
        gossipBody, 
        async (err, _data) => {
            // 回调卫语句：如果总开关关了，不要处理任何数据
            if (rootSignal.aborted) return;

            if (err) return console.error("Gossip Error:", err);
            if (!_data) return;
            noteGossipActivity()

            try {
                const data = JSON.parse(_data);
                if (isGossipListingLivenessFrame(data) && extractGossipListingBlockHeight(data)) {
                    const nodeHint =
                      typeof data.nodeDomain === 'string'
                        ? data.nodeDomain
                        : typeof data.nodeIpAddr === 'string'
                          ? data.nodeIpAddr
                          : undefined
                    logGossipListingBlockHeight('listing', data, rootSignal, nodeHint)
                    return
                }
                if (data?.data && /^-----BEGIN PGP MESSAGE-----/i.test(data.data)) {
                    const armoredMessage = data.data;
                    const msg = await readMessage({ armoredMessage });
                    const encrypKeyIDs = msg.getEncryptionKeyIDs?.();
                    if (encrypKeyIDs?.length) {
                        const customerKeyID = encrypKeyIDs[0].toHex().toUpperCase();
                        const ourKeyIDs = decryptedPrivateKey.getKeyIDs?.()?.map(k => k.toHex().toUpperCase()) ?? [];
                        const match = ourKeyIDs.includes(customerKeyID) || (userPgpKeyID && customerKeyID.endsWith(userPgpKeyID));
                        console.debug(`[Gossip Debug] msgEncryptKeyID=${customerKeyID} | ourKeyIDs=[${ourKeyIDs.join(',')}] | userPgpKeyID=${userPgpKeyID} | match=${match}`);
                    } else {
                        console.debug(`[Gossip Debug] msg has no encryption key packets`);
                    }
                    const { data: decrypted } = await decrypt({ message: msg, decryptionKeys: decryptedPrivateKey });
                    const decryptedString = typeof decrypted === 'string' ? decrypted : String(decrypted);
                    const kkk = fromBase64(decryptedString);
                    // Attach armor hash for mailbox ACK (must match SI saveLocal hash).
                    let inboundLine = kkk
                    try {
                      const env = JSON.parse(kkk)
                      if (env && typeof env === 'object') {
                        env._beamioPgpArmorHash = ethers.keccak256(ethers.toUtf8Bytes(armoredMessage))
                        inboundLine = JSON.stringify(env)
                      }
                    } catch {
                      /* keep raw */
                    }
                    console.log(`✅ Message:`, kkk.slice(0, 50) + "..."); // 仅打印前50字符防止刷屏
                    newMessage(inboundLine);
                } else if (data?.from && data?.text != null && data?.signMessage) {
                    // 非 PGP：明文信封格式 { timestamp, text, from, signMessage }，直接交给 newMessage
                    console.log(`✅ Plain envelope from ${data.from}`);
                    newMessage(JSON.stringify(data));
                } else {
                    console.log('[Gossip] Unknown format:', data);
                }
            } catch (ex: any) {
                // "No decryption key packets found" = 消息不是发给我们的（gossip 广播了发给其他用户的消息），静默跳过
                if (ex?.message?.includes?.("No decryption key packets found")) return;
                console.warn("Parse Error:", ex?.message ?? ex);
            }
        },
        rootSignal // <--- 必须传入这个信号
      );
      return true

  } catch (ex: any) {
      console.error("Init Error:", ex);
      return failConnect(`connectToGossipNode Init Error: ${(ex as Error)?.message ?? String(ex)}`)
  }
}

type NodePostResponse =
  | { ok: true; [k: string]: any }
  | { ok?: boolean; error?: string; message?: string; [k: string]: any }

function normalizeArmored(postData: any) {
  // openpgp encrypt() 通常直接返回 string（armored）
  if (typeof postData === "string") return postData

  // 有些版本可能返回 { data: "-----BEGIN PGP MESSAGE-----..." }
  if (postData && typeof postData.data === "string") return postData.data

  // 或者是 message 对象，需要 armored
  if (postData && typeof postData.armor === "function") return postData.armor()

  // 兜底
  return String(postData ?? "")
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

const pickRouteNodesByArmoredKey = (nodes: nodeInfo[], routerArmoredPublicKey: string) => {
	const target = normalizeArmoredKey(routerArmoredPublicKey)
	if (!target) return []
	return nodes.filter(n => normalizeArmoredKey(n.armoredPublicKey) === target)
}

const probeGossipNode = async (node: nodeInfo, timeoutMs = 4_000) => {
	// Prefer OPTIONS /post — matches browser preflight and proves CoNET-SI is answering CORS.
	// GET / alone can be a static nginx 200 while POST /post error paths lack ACAO (browser CORS).
	const origin =
		typeof window !== 'undefined' && window.location?.origin
			? window.location.origin
			: 'https://beamio.app'
	const postUrl = `https://${node.domain}.conet.network/post`
	try {
		const res = await postWithTimeout(
			postUrl,
			{
				method: 'OPTIONS',
				headers: {
					Origin: origin,
					'Access-Control-Request-Method': 'POST',
					'Access-Control-Request-Headers': 'content-type',
				},
			},
			timeoutMs,
		)
		const acao = (res.headers.get('access-control-allow-origin') || '').trim()
		if (res.status > 0 && res.status < 500 && (acao === '*' || acao.length > 0)) {
			markGossipNodeHealthy(node.domain)
			return true
		}
	} catch {
		// fall through to GET /
	}
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
		if (res.status > 0 && res.status < 500) {
			markGossipNodeHealthy(node.domain)
			return true
		}
	} catch {
		// ignore probe errors
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

/**
 * Open inbound chat for a verified sender EOA.
 * Do not refuse solely because profile search or on-chain PGP is missing.
 */
export const createInboundChatSession = async (
	signAddr: string,
	privateKeyArmor: string,
	peerProfile: searchResult | null | undefined,
): Promise<chatData> => {
	const addr = ethers.isAddress(signAddr) ? ethers.getAddress(signAddr) : signAddr
	const beamio = peerProfile?.address ? peerProfile : emptySearchResultForAddress(addr)
	const kk = await getKeysFromCoNETPGPSC(addr, privateKeyArmor)
	if (!peerProfile?.address) {
		console.warn(
			`[chat inbound] no Beamio profile for ${addr} — creating address-only session (message still shown)`,
		)
	}
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
			privateArmored: kk?.privateArmored ?? '',
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
	opts?: { beamioNoPush?: boolean },
): Promise<boolean> => {
	if (!entryNodes?.length) {
		console.error('[sendMessage] no entry nodes')
		return false
	}
	if (!pgpPublic?.trim()) {
		console.error('[sendMessage] missing recipient publicArmored')
		return false
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
			message: await createMessage({
				text: Buffer.from(JSON.stringify(message)).toString("base64")
			}),
			encryptionKeys: await readKey({ armoredKey: pgpPublic }),
			config: { preferredCompressionAlgorithm: enums.compression.zlib }
		}
	} catch (ex: any) {
		console.error(`[sendMessage] createMessage/readKey Error! ${ex?.message || ex}`)
		return false
	}

	let postData: string
	try {
		postData = await encrypt(encryptObj)
	} catch (ex: any) {
		console.error(`[sendMessage] encrypt Error! ${ex?.message || ex}`)
		return false
	}

	const payload: { data: string; beamioNoPush?: boolean } = { data: postData }
	if (opts?.beamioNoPush) payload.beamioNoPush = true
	const postOpts: RequestInit = {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
		// Avoid Chrome Network panel noise; does not fix node/SI failures.
		referrerPolicy: "no-referrer",
	}

	const postToNodes = async (nodes: nodeInfo[]): Promise<boolean> => {
		if (!nodes.length) return false
		const results = await Promise.all(
			nodes.map(async node => {
				const url = `https://${node.domain}.conet.network/post`
				try {
					const res = await postWithTimeout(url, postOpts, 12_000)
					if (!res.ok) {
						console.warn(`[sendMessage] ${url} → HTTP ${res.status}`)
						markGossipNodeBad(node.domain)
						return false
					}
					console.log(`[sendMessage] ${url} → ${res.status}`)
					markGossipNodeHealthy(node.domain)
					return true
				} catch (ex: any) {
					// Chrome often labels bare network / missing-ACAO failures as CORS
					// ("strict-origin-when-cross-origin"). Prefer explicit fetch error text.
					console.warn(`[sendMessage] ${url} → ${ex?.name || 'error'}: ${ex?.message || ex}`)
					markGossipNodeBad(node.domain)
					return false
				}
			})
		)
		return results.some(Boolean)
	}

	// Callers may pass a full Guardian pool or a small sample; prefer healthy entries and retry.
	const wave1 = await pickGossipEntryNodesForSend(entryNodes, Math.min(4, entryNodes.length))
	if (await postToNodes(wave1)) return true

	const tried = new Set(wave1.map(n => n.domain))
	const wave2 = await pickGossipEntryNodesForSend(entryNodes, Math.min(4, entryNodes.length), tried)
	if (await postToNodes(wave2)) return true

	console.error(
		'[sendMessage] all entry POSTs failed',
		[...tried, ...wave2.map(n => n.domain)],
	)
	return false
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


export const makeMessage = (
	data: ChatMessage[],
	newChatText: string,
	timestamp: number,
	from: "me" | "them",
	status?: "sending" | "sent" | "delivered" | "failed"
) => {
  // 1) 先把已有消息“规范化”：用 createdAt(=timestamp) 生成稳定唯一 id
	const normalized = (data || []).map(m => {
		// ✅ 保留你本地临时消息 tmp_... 的 id（用于发送三态 UI）
		if (m?.id?.startsWith("tmp_")) return m

		const ts = Number(m?.createdAt)
		const stableId = Number.isFinite(ts)
		? String(ts) // ✅ 用 timestamp 作为唯一性
		: (m?.id || `msg_${Math.random().toString(16).slice(2)}`)

		return {
			...m,
			id: stableId
		}
	})

	// 2) 建一个 Set 来做去重（以 id=timestamp 为唯一性）
	const seen = new Set<string>()
	const result: ChatMessage[] = []

	for (const m of normalized) {
		if (!m) continue

		const key = m.id || String(m.createdAt || "")
		if (!key) continue

		if (seen.has(key)) continue
		seen.add(key)
		result.push(m)
  	}

	// 3) 集成“新来的消息”：newChatText + timestamp + from + status
	//    ✅ 你要求：通过 timestamp 检查唯一性，可直接用 timestamp 作为 id
	const ts = Number(timestamp)
	const text = (newChatText || "").trim()
  	try {
		const card: ChatMessage = JSON.parse(text)
		const dedupKey = card.sendId || card.id || String(ts)
		if (seen.has(dedupKey)) {
			// 已存在则不再追加（如重复推送）
		} else if (card.paymentCard) {
			card.from = 'them'
			if (!card.id) card.id = String(ts)
			if (card.createdAt == null) card.createdAt = ts
			seen.add(dedupKey)
			result.push(card)
		} else if (card.reply) {
			card.from = 'them'
			if (!card.id) card.id = String(ts)
			if (card.createdAt == null) card.createdAt = ts
			seen.add(dedupKey)
			result.push(card)
		} else if (card.sendId != null) {
			// 发送方带 sendId 的正文消息（对方发来的普通文字）
			card.from = 'them'
			if (!card.id) card.id = String(ts)
			if (card.createdAt == null) card.createdAt = ts
			seen.add(dedupKey)
			result.push(card)
		} else throw new Error('')
	} catch (ex) {
		if (text && Number.isFinite(ts)) {
		const incomingId = String(ts)

		if (!seen.has(incomingId)) {
			seen.add(incomingId)
			result.push({
				id: incomingId,
				from,
				text,
				createdAt: ts,
				status: status ?? (from === "me" ? "sent" : "sent")
			})
		}
	}
	}


	// 4) 排序：按时间升序（iMessage 从上到下）
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
			const kk = await getKeysFromCoNETPGPSC(addr, profile.privateKeyArmor)
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
						privateArmored: cd?.privateArmored ?? '',
						publicArmored: nextPublic,
						routersArmoreds: nextRouters,
						routePgpKeyID: nextRouteKeyID,
						// Preserve last mailbox-probe result; never import chain routeOnline.
						online: cd?.online ?? false,
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
 */
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
		const payload = JSON.stringify({ data: armored })
		const candidates = entryNodes.filter(n => n?.domain && !mailboxDomains.has(n.domain))
		const pool = candidates.length ? candidates : entryNodes.filter(n => n?.domain)
		const entries = await pickGossipEntryNodesForSend(pool, 4, mailboxDomains)
		const targets = entries.length ? entries : getRandomNodes(pool, Math.min(4, pool.length))
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
	const kk = await getKeysFromCoNETPGPSC(beamioer.address, profile.privateKeyArmor)
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
