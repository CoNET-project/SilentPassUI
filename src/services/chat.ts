import {
	pgpCoNET
} from '@/utils/constants'
import {generateKey, readKey, createMessage, enums, encrypt, decryptKey, readPrivateKey, readMessage, decrypt, PrivateKey} from 'openpgp'
import { CoNET_Data, setCoNET_Data } from "@/utils/globals"

import {GuardianNodesMainnet, conetDepinProvider} from '@/utils/constants'
import contracts from '@/utils/contracts'
import {ethers} from 'ethers'
import {aesGcmEncrypt, aesGcmDecrypt, toBase64, fromBase64, storeSystemData } from '@/services/beamio'


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

export const getKeysFromCoNETPGPSC = async (keyID: string, privateKeyArmor: string) => {
	const Wallet = new ethers.Wallet (privateKeyArmor, conetDepinProvider)
	const contract = contracts.constPgpManager
	const SC = new ethers.Contract(contract.address, contract.abi, Wallet)
	try {
		const [info, privateKey] : [searchKeyPGP, string] = await Promise.all([
			SC.searchKey(keyID),
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

		
		return {privateArmored, publicArmored, routersArmoreds: info.routePublicKeyArmored, online: info.routeOnline, routePgpKeyID: info.routePgpKeyID}
	} catch (ex) {
		return null
	}
}



const getAllNodes = (): Promise<nodeInfo[]> => new Promise(async resolve=> {
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

export const initChat = async (setProfiles: (val: profile[]) => void, setAllNodes: (val: nodeInfo[]) => void, setGossip: (val: boolean) => void, gossip: boolean) => {
	if (gossip) return
	setGossip(true)
	const allNodes = await getAllNodes()
	setAllNodes(allNodes)
	const temp = CoNET_Data
	if (!temp || !temp?.profiles?.length) {
		setGossip(false)
		return
	}
	const profiles: profile[] =  temp.profiles
	const profile = profiles[0]
	let chat: IChat = profile?.chat as any
	let routes: string = chat?.router||''
	//		本地非初始化
	if (!chat) {
		const pgpData = await initBeamioPGPKeys(profile)
		if (!pgpData) {
			setGossip(false)
			return
		}

		chat = {
			pgpKey: pgpData,
			router: ''
		}
		profile.chat = chat as any
		routes = pgpData.routes
	}


	// ✅ 如果没有 routes，从链上/SC 找；再不行就随机注册一个
	//	寻找链上信息
	const rr = await getKeysFromCoNETPGPSC(profile.keyID, profile.privateKeyArmor)
	routes = rr?.routersArmoreds||''

	//	链上route信息
	if (routes) {

		chat.router = routes

	}
	if (!routes) {
		const node = getRandomNode(allNodes)
		if (node) {
			await regiestChatRoute(
				profile.privateKeyArmor,
				chat.pgpKey.publicKey,
				chat.pgpKey.keyID,
				chat.pgpKey.privateKey,
				node.domain
			)
			chat.router = node.armoredPublicKey
		}
	}


	profile.chat = chat as any
	temp.profiles[0] = profile
	setProfiles(profiles)
	setCoNET_Data(temp)
	storeSystemData()

	const entryNode = getRandomNode(allNodes)
	if (!entryNode) {
		setGossip(false)
		return
	}
	
	connectToGossipNode(chat.router, profile.privateKeyArmor, entryNode, chat.pgpKey.privateKey)
	
}



export const initBeamioPGPKeys = async (profile: profile): Promise<initBeamioPGPKeysRet|null> => {
	
	const keyInfo = await getKeysFromCoNETPGPSC(profile.keyID, profile.privateKeyArmor)
	if (keyInfo?.privateArmored) {
		return {
			privateKey: keyInfo.privateArmored,
			publicKey: keyInfo.publicArmored,
			keyID: '',
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
	const Wallet = new ethers.Wallet (privateKey, conetDepinProvider)
	const contract = contracts.constPgpManager
	const SC = new ethers.Contract(contract.address, contract.abi, Wallet)
	const encryptPri = await aesGcmEncrypt(priArmor, privateKey)
	const publicKey = toBase64(pubArmor)
	const h = ethers.keccak256(ethers.toUtf8Bytes(routeKeyID))
	try {
		const tx = await SC.addPublicPGP(
			Wallet.address,
			keyID,
			publicKey,
			encryptPri,
			routeKeyID
		)
		await tx.wait()
		return true
	} catch (ex: any) {
		return false
	}

}

function startGossip_old(
  node: nodeInfo,
  body: string,
  callback?: (err?: string, data?: string) => void
) {
  const relaunch = () => {
    setTimeout(() => startGossip(node, body, callback), 1000)
  }

  const url = `https://${node.domain}.conet.network/post`

  // 连接超时（3s，浏览器可能需要更长时间建立 TLS）
  const connectAbort = new AbortController()
  const connectTimer = window.setTimeout(() => {
    console.log(`startGossip connect timeout [${node.ip_addr}:${node.nftNumber}]`)
    connectAbort.abort(new Error("connect timeout"))
    relaunch()
  }, 3000) // 改为 3s

  // idle 超时（30s）
  let idleTimer: number | null = null
  const resetIdle = (aborter: AbortController) => {
    if (idleTimer != null) window.clearTimeout(idleTimer)
    idleTimer = window.setTimeout(() => {
      console.log(`startGossip idle timeout [${node.ip_addr}] -> restart`)
      aborter.abort(new Error("idle timeout"))
      relaunch()
    }, 30_000) // 改为 30s
  }

  ;(async () => {
    let first = true
    try {
      // 关键改动 1：添加必要的 fetch 选项
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          Accept: "text/event-stream",
          // 明确告诉服务器我们期望长连接
          Connection: "keep-alive",
        },
        body,
        signal: connectAbort.signal,
        // 关键改动 2：跨域请求如需凭证，打开这个
        // credentials: "include",
        // 关键改动 3：防止浏览器缓存 SSE 响应
        cache: "no-store",
      })

      window.clearTimeout(connectTimer)

      if (!res.ok) {
        console.log(`startGossip status != 200 [${res.status}] -> relaunch`)
        try {
          await res.body?.cancel()
        } catch {}
        relaunch()
        return
      }

      if (!res.body) {
        console.log(`startGossip no body -> relaunch`)
        relaunch()
        return
      }

      // 连接成功，开始 idle watchdog
      const streamAbort = new AbortController()
      resetIdle(streamAbort)

      const abortForward = () =>
        streamAbort.abort(connectAbort.signal.reason as any)
      connectAbort.signal.addEventListener("abort", abortForward, { once: true })

      const reader = res.body.getReader()
      const decoder = new TextDecoder("utf-8")
      let buffer = ""

      const handleBlock = (block: string) => {
        // 兼容 SSE 标准 "data:" 行
        const lines = block.split("\n")
        const dataLines = lines
          .filter(l => l.startsWith("data:"))
          .map(l => l.slice(5).trimStart())

        // 如果有 data: 前缀，使用 dataLines；否则用原 block
        const payload = (dataLines.length ? dataLines.join("\n") : block).trim()

        if (!payload) return

        if (first) {
          first = false
          try {
            const data = JSON.parse(payload)
            console.log("First message:", data)
          } catch (e) {
            console.log("First message parse error:", payload, e)
          }
          return
        }

        // 后续消息回调
        callback?.("", payload)
      }

      // 关键改动 4：改进的流读取逻辑
      while (true) {
        // 设置读取操作的超时（额外保险）
        let value: Uint8Array | undefined
        let done = false

        try {
          // 使用 Promise.race 给单次读取加超时
          const readPromise = reader.read()
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("read timeout")),
              35_000 // 比 idle 超时稍长
            )
          )

          const result = await Promise.race([readPromise, timeoutPromise])
          value = result.value
          done = result.done
        } catch (readErr: any) {
          if (readErr?.message === "read timeout") {
            console.log("Read operation timeout")
            streamAbort.abort(new Error("read timeout"))
            break
          }
          throw readErr
        }

        if (done) {
          if (idleTimer != null) window.clearTimeout(idleTimer)
          console.log(`startGossip stream end [${node.ip_addr}] -> relaunch`)
          relaunch()
          return
        }

        // 只要有任何 chunk，就视为连接活跃
        resetIdle(streamAbort)

        // 关键改动 5：更严格的换行处理
        // 先转换为 UTF-8 字符串
        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk

        // 处理 \r\n\r\n, \n\n, \r\r 三种分隔符
        let idx: number
        while (
          (idx = buffer.indexOf("\n\n")) !== -1 ||
          (idx = buffer.indexOf("\r\n\r\n")) !== -1 ||
          (idx = buffer.indexOf("\r\r")) !== -1
        ) {
          let blockEnd: number
          let separatorLen: number

          if (buffer.substring(idx, idx + 4) === "\r\n\r\n") {
            blockEnd = idx
            separatorLen = 4
          } else if (buffer.substring(idx, idx + 2) === "\n\n") {
            blockEnd = idx
            separatorLen = 2
          } else if (buffer.substring(idx, idx + 2) === "\r\r") {
            blockEnd = idx
            separatorLen = 2
          } else {
            break
          }

          const block = buffer.slice(0, blockEnd)
          buffer = buffer.slice(blockEnd + separatorLen)
          handleBlock(block)
        }
      }
    } catch (err: any) {
      window.clearTimeout(connectTimer)
      if (idleTimer != null) window.clearTimeout(idleTimer)

      const msg = err?.message ?? String(err)
      console.log(`startGossip fetch error [${node.ip_addr}]`, msg)
      callback?.(msg)
      relaunch()
    }
  })()
}

interface TimeoutConfig {
  connectTimeout: number        // 连接阶段超时
  idleTimeout: number           // 无数据超时
  readOperationTimeout: number  // 单次 read() 操作超时
  retryDelay: number            // 重连延迟
}

interface SSEErrorType {
  type: 'connect_timeout' | 'idle_timeout' | 'read_timeout' | 'network_error' | 'unknown'
  message: string
  retriable: boolean
}

function startGossip(
  node: nodeInfo,
  body: string,
  callback?: (err?: string, data?: string) => void,
  timeoutConfig?: Partial<TimeoutConfig>
) {
  // 默认配置
  const config: TimeoutConfig = {
    connectTimeout: 5_000,
    idleTimeout: 60_000,
    readOperationTimeout: 20_000,
    retryDelay: 2_000,
    ...timeoutConfig,
  };

  const url = `https://${node.domain}.conet.network/post`;
  
  // 统一的 AbortController，用于管理本次连接的所有生命周期（连接、读取、空闲）
  const controller = new AbortController();
  
  // 重连逻辑：使用闭包防止重叠调用
  let isRelaunching = false;
  const triggerRelaunch = () => {
    if (isRelaunching) return; // 防止多次重入
    isRelaunching = true;
    
    // 确保当前控制器已中止，释放资源
    try { controller.abort("relaunching"); } catch {}

    setTimeout(() => {
      startGossip(node, body, callback, timeoutConfig);
    }, config.retryDelay);
  };

  // --- 1) 连接超时 ---
  // 修正点：超时只负责 abort，不负责 relaunch，让 catch 块去处理 relaunch
  const connectTimer = setTimeout(() => {
    console.warn(`[SSE] Connect timeout [${node.ip_addr}]`);
    controller.abort(new Error("connect_timeout")); 
  }, config.connectTimeout);

  // --- 2) Idle 超时管理 ---
  let idleTimer: number | null = null;
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      console.warn(`[SSE] Idle timeout [${node.ip_addr}]`);
      // 修正点：Idle 超时也只负责 abort
      controller.abort(new Error("idle_timeout"));
    }, config.idleTimeout);
  };

  // --- 3) Read 超时 Promise ---
  const createReadTimeout = () => {
    return new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("read_operation_timeout")), config.readOperationTimeout);
    });
  };

  // 错误分类器 (保持原逻辑不变)
  const classifyError = (err: any) => {
    const message = err?.message ?? String(err);
    if (message.includes("connect_timeout") || message === "connect_timeout") return { type: "connect_timeout", retriable: true };
    if (message.includes("idle_timeout") || message === "idle_timeout") return { type: "idle_timeout", retriable: true };
    if (message.includes("read_operation_timeout")) return { type: "read_timeout", retriable: true };
    if (message.includes("network") || message.includes("Failed to fetch") || message.includes("aborted")) return { type: "network_error", retriable: true };
    return { type: "unknown", message, retriable: true };
  };

  (async () => {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
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

      // 连接建立成功，清除连接定时器
      clearTimeout(connectTimer);

      if (!res.ok || !res.body) {
        throw new Error(`HTTP error ${res.status}`);
      }

      console.log(`[SSE] Connected [${node.ip_addr}]`);
      
      reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let first = true;

      // 开始 Idle 监控
      resetIdle();

      while (true) {
        // 使用 Race 机制处理单个 Read 超时
        // 注意：这里需要 try-catch 是因为 Promise.race 中如果 timeout 会 reject
        let readResult;
        try {
            const readPromise = reader.read();
            // 这里我们不直接 abort controller，因为 read 超时可能只是暂时的
            // 如果要严格处理，可以在 createReadTimeout 里 reject 一个特定 error
            readResult = await Promise.race([readPromise, createReadTimeout()]);
        } catch (readErr: any) {
            if (readErr.message === "read_operation_timeout") {
                console.warn(`[SSE] Read op slow [${node.ip_addr}], continuing...`);
                // 你的原始逻辑是 read 超时继续等待，这里保持一致
                // 但要检查 controller 是否已经被其他原因 abort 了
                if (controller.signal.aborted) throw controller.signal.reason;
                continue; 
            }
            throw readErr;
        }

        const { value, done } = readResult;
        
        if (done) {
          console.log(`[SSE] Stream done [${node.ip_addr}]`);
          break; // 退出循环，进入 finally/catch 触发重连
        }

        resetIdle(); // 收到数据，重置 idle

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // --- 解析逻辑 (保持不变) ---
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
                    try { console.log("[SSE] First msg:", JSON.parse(payload)); } catch {}
                } else {
                    callback?.("", payload);
                }
            }
        }
      }
      
      // 正常结束（服务器关闭连接） -> 触发重连
      triggerRelaunch();

    } catch (err: any) {
      // 统一错误处理入口
      clearTimeout(connectTimer);
      if (idleTimer) clearTimeout(idleTimer);

      // 如果是手动 abort (relaunching) 引起的，忽略
      if (err === "relaunching") return;

      const errorInfo = classifyError(err);
      
      // 忽略 AbortError，因为这通常是我们自己调用的
      if (err.name === 'AbortError' || errorInfo.message?.includes('aborted')) {
          console.log(`[SSE] Connection aborted: ${errorInfo.type}`);
      } else {
          console.error(`[SSE] Error [${node.ip_addr}]:`, errorInfo.message);
          callback?.(errorInfo.message);
      }

      // 决定是否重连
      if (errorInfo.retriable) {
        triggerRelaunch();
      }
    } finally {
      // 修正点：显式关闭 reader，确保 Socket 断开
      if (reader) {
        try {
           await reader.cancel(); 
           reader.releaseLock();
        } catch {}
      }
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


export const connectToGossipNode = async (
  nodeArmoredPublicKey: string,
  privateKeyArmor: string,
  entryNode: nodeInfo,
  pgpPrivateKey: string
) => {
  const wallet = new ethers.Wallet(privateKeyArmor)

  const key = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64')
  const command = {
    command: 'mining',
    walletAddress: wallet.address,
    algorithm: 'aes-256-cbc',
    Securitykey: key
  }

  const message = JSON.stringify(command)
  const signMessage = await wallet.signMessage(message)

  // 1) 先把 postData 做出来
  const encryptionKeys = await readKey({ armoredKey: nodeArmoredPublicKey })
  const pgpMsg = await createMessage({
    text: Buffer.from(JSON.stringify({ message, signMessage })).toString('base64')
  })
  const postData = await encrypt({
    message: pgpMsg,
    encryptionKeys,
    config: { preferredCompressionAlgorithm: enums.compression.zlib }
  })

  // 2) ✅ 关键：先把私钥“读出来并确保可用”
  let decryptedPrivateKey: PrivateKey
  try {
    const pk = await readPrivateKey({ armoredKey: pgpPrivateKey })

    // 如果你的私钥根本没加密（无 passphrase），不要调用 decryptKey
    // 但为了兼容两种情况，可以这样写：
    decryptedPrivateKey = pk.isDecrypted()
      ? pk
      : await decryptKey({
          privateKey: pk,
          passphrase: "" // 你若确实有 passphrase 就填这里
        })
  } catch (ex: any) {

  }
 

  // 3) 回调里直接用 const（闭包捕获的是值引用，且已初始化成功）
  startGossip(entryNode, JSON.stringify({ data: postData }), async (err, _data) => {
    if (!_data) return console.log("startGossip callback null")

    try {
      const data = JSON.parse(_data)

      if (data?.data && /^-----BEGIN PGP MESSAGE-----/i.test(data.data)) {
        const armoredMessage = data.data
        const msg = await readMessage({ armoredMessage })

        const { data: decrypted } = await decrypt({
          message: msg,
          decryptionKeys: decryptedPrivateKey
        })
		const kkk = fromBase64(decrypted)
		const { emitGossipEvent, GOSSIP_MESSAGE } = await import('./eventBus')
        emitGossipEvent(GOSSIP_MESSAGE, {
			node: entryNode.domain,
			raw: kkk,
			decrypted,
			ts: Date.now()
		})
		console.log ()
		
      } else {
		console.log(data)
	  }
    } catch (ex: any) {
      console.log("startGossip JSON.parse(_data) Error", ex.message)
    }
  })
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


export const sendMessage = async (
	pgpPublic: string,
	text: string,
	privateKeyArmor: string,
	entryNode: nodeInfo
): Promise<boolean> => {
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
		console.log(`connectToGossipNode !createMessage Errro! ${ex?.message || ex}`)
		return false
	}

	let postData: string
	try {
		postData = await encrypt(encryptObj)
	} catch (ex: any) {
		console.log(`encrypt Error! ${ex?.message || ex}`)
		return false
	}

	const nodeUrl = `https://${entryNode.domain}.conet.network/post`

	// ✅ 推荐：统一用 JSON 包一层，后端更稳定
	const payload = {
		data: postData
	}

	// 可选：简单重试一次（网络波动时很有用）
	// 重试逻辑
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const res = await postWithTimeout(
				nodeUrl,
				{
				method: "POST",
				headers: {
					"Content-Type": "application/json", // charset=UTF-8 是 fetch 默认行为，可省略
				},
				body: JSON.stringify(payload)
				},
				12_000
			);

			if (!res.ok) {
				// 4xx 错误通常重试也没用，可以根据 status 决定是否 continue
				if (res.status >= 400 && res.status < 500) {
					console.error(`[Gossip] Client Error (${res.status}), giving up.`);
					return false;
				}
				console.warn(`[Gossip] Attempt ${attempt + 1} failed: ${res.status}`);
				continue;
			}

			const data = (await res.json().catch(() => null)) as NodePostResponse | null;
			
			// 更加鲁棒的检查
			if (!data || (data.ok === false) || data.error) {
				console.warn(`[Gossip] Server Error: ${data?.error || "Unknown error"}`);
				continue;
			}

			return true;
		} catch (ex: any) {
			const isTimeout = ex.message === "Timeout" || ex.name === "AbortError";
			console.warn(`[Gossip] Network/Timeout Error (Attempt ${attempt + 1}):`, isTimeout ? "Timeout" : ex.message);
			// Loop 继续
		}
	}

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
	
	return signWallet
	
}