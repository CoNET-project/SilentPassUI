import { ethers } from "ethers";
import {
  createMessage,
  decryptKey,
  encrypt,
  enums,
  generateKey,
  readKey,
  readPrivateKey,
} from "openpgp"
import contracts from "../utils/contracts";
import { conetDepinProvider } from "../utils/constants";
import { initProfileTokens, postToEndpoint, findAsync } from "../utils/utils";
import {  } from "../providers/DaemonProvider"
import {checkLocalStorageNodes, storageAllNodes} from './wallets'
import nodes from '../pages/Home/assets/allnodes.json'

let allNodes: nodes_info[] = []
let allRegions: string[] = []

let getAllNodesProcess = false


let currentScanNodeNumber = 0
let maxNodes = 0



const getRandomNodeFromRegion: (region: string) => nodes_info = (
  region: string
) => {
  const allNodeInRegion = allNodes.filter((n) => n.region.endsWith(region));
  const rendomIndex = Math.floor(Math.random() * (allNodeInRegion.length - 1));
  const node = allNodeInRegion[rendomIndex]
  if (!node?.domain) {
	return getRandomNodeFromRegion(region)
  }

  return node
}

const deleteNodeFromList = (node: nodes_info) => {
	const index = allNodes.findIndex(n => n.ip_addr === node.ip_addr)
	if (index > -1 ) {
		allNodes.splice(index, 1)
	}
	
}


const isAbortError = (e: unknown) =>
  e instanceof DOMException && e.name === 'AbortError';

export async function testNode(
  node: nodes_info,
  signal?: AbortSignal,
  timeoutMs = 1000
): Promise<boolean> {
  try {
    const url = `http://${node.ip_addr}`;
    await postToEndpoint(url, false, undefined, timeoutMs, signal ? { signal } : undefined);
    return true;
  } catch (e) {
    if (isAbortError(e)) throw e;     // 由上层并发调度来处理早停
    deleteNodeFromList(node);         // 真实失败 → 剔除
    return false;
  }
}

type SpeedSample = { region: string; node: nodes_info; delay: number };

/**
 * 单次测速（不递归），成功返回样本；失败返回 null。
 * - 会在失败时 deleteNodeFromList(node)
 * - 支持 AbortSignal 早停
 */
async function testSpeedOnce(
  region: string,
  opts?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<SpeedSample | null> {
  const node = getRandomNodeFromRegion(region);
  if (!node) return null;

  try {
    const url = `http://${node.ip_addr}`;
    const start = Date.now();
    await postToEndpoint(url, false, undefined, opts?.timeoutMs ?? 1000, opts?.signal ? { signal: opts.signal } : undefined);
    const delay = Date.now() - start;
    return { region, node, delay };
  } catch (e) {
    if (isAbortError(e)) throw e; // 外层并发池会捕获
    deleteNodeFromList(node);     // 坏节点剔除
    return null;
  }
}



const testClosestRegion = async (
  opts?: {
    timeoutMs?: number;   // 单次请求超时，默认 1000ms
    maxAttempts?: number; // 每个地区最多尝试次数，默认 3
  }
): Promise<SpeedSample | null> => {
  const timeoutMs   = opts?.timeoutMs   ?? 1000;
  const maxAttempts = opts?.maxAttempts ?? 3;

  // 仅保留目标地区
  const pickedRegions = allRegions.filter(r => /^(DE|ES|GB|US)$/i.test(r));
  if (pickedRegions.length === 0) {
    return null;
  }

  // 一个全局 AbortController：一旦某个地区成功，其它全部中止
  const ac = new AbortController();

  // 把“每个地区多次尝试，直到成功或用尽次数”封装成一个 Promise；
  // 为了配合 Promise.any：若最终仍未成功，抛一个错误，让 any 跳过它。
  const regionTasks = pickedRegions.map(region => (async () => {
    let attempts = 0;
    while (attempts < maxAttempts && !ac.signal.aborted) {
      attempts++;
      const sample = await testSpeedOnce(region, { signal: ac.signal, timeoutMs });
      if (sample) return sample;           // 成功
      // 失败则继续循环尝试下一个随机节点
    }
    throw new Error(`region ${region} failed`); // 让 Promise.any 忽略此地区
  })());

  let winner: SpeedSample | null = null;

  try {
    // 谁先成功就先返回
    winner = await Promise.any(regionTasks);
    // 立即早停其他在途请求
    ac.abort(new DOMException("Found winner", "AbortError"));
  } catch {
    // 所有地区都失败
    winner = null;
  } finally {
    // 确保回调一定被调用
    
  }

  return winner;
};


export const exitNodes = (exitRegion: string, entryNodes: nodes_info[]) => {
	const exitNodes = allNodes.filter((n: nodes_info) => {
		const region: string = n.region
		
		const regionName = /HK/i.test(exitRegion) ? region.split('.')[0] : region.split('.')[1]
		if (exitRegion === 'CN' && region === 'HK.CN') {
			return false
		}
		const index = entryNodes.findIndex(_n => _n.ip_addr === n.ip_addr)
		if (index > -1) {
			return false
		}
		return regionName === exitRegion
	})
	return exitNodes
}

const _getAllNodes = (): Promise<any[]> => new Promise ( async executor => {
	const GuardianNodesContract = new ethers.Contract(
		contracts.GuardianNodesInfoV6.address,
		contracts.GuardianNodesInfoV6.abi,
		conetDepinProvider
	)
	let i = 0
	let nodes: any [] = []
	let loop = true
	const length = 400
	do {
		try {
			const _nodes: any[] = await GuardianNodesContract.getAllNodes(i, i + 400)
			nodes = [...nodes, ..._nodes]
			if (_nodes.length < 400) {
				loop = false
			}
			i += length
		} catch (ex) {
			loop = false
		}

	} while (loop)

	return executor(nodes)
	
})

const getAllNodes = async (
  	callback: (allnodes: nodes_info[]) => void
) => {

  if (getAllNodesProcess) {
    return
  }
  getAllNodesProcess = true

  const _nodes = await _getAllNodes()


  const _allNodes:nodes_info[] = []
  const _countryArray: Map<string, boolean> = new Map()
  for (let i = 0; i < _nodes.length; i ++) {
	const node = _nodes[i]
	const id = parseInt(node[0].toString())
	const pgpString: string = Buffer.from( node[1], 'base64').toString()
	const domain: string = node[2]
	const ipAddr: string = node[3]
	const region: string = node[4]
	let country_item = region.split('.')[1]
	if (/zh/i.test(region.split('.')[0])) {
		country_item = 'zh'
	}
	const itemNode: nodes_info = {
		country: country_item,
		ip_addr: ipAddr,
		armoredPublicKey: pgpString,
		domain: domain,
		last_online: true,
		nftNumber: id,
		region
	}

	_countryArray.set(country_item, true)
	_allNodes.push(itemNode)
  }



  	allRegions = Array.from(_countryArray.keys())
	allNodes = _allNodes
	await storageAllNodes(allNodes)
	getAllNodesProcess = false
	callback(_allNodes)
}

const getAllRegions = (nodes: nodes_info[]) => {
	const country: Map<string, boolean> = new Map();
	nodes.forEach(n => {
		let _country = n.region.split(".")[1]
		
		country.set(_country, true)
	})
	allRegions = Array.from(country.keys())
}


export async function getEntryNodes(
  allNodes: readonly nodes_info[],
  want = 20,
  concurrency = 10,
  shuffle = true
): Promise<nodes_info[]> {
  if (want <= 0 || allNodes.length === 0) return [];

  const items = shuffle ? [...allNodes].sort(() => Math.random() - 0.5) : [...allNodes];
  let next = 0;
  const picked: nodes_info[] = [];
  const seen = new Set<string>();
  let stopped = false;

  const controller = new AbortController();
  const { signal } = controller;

  const runOne = async () => {
    while (true) {
      if (stopped) return;
      const i = next++;
      if (i >= items.length) return;

      const node = items[i];

      if (picked.length >= want) {
        stopped = true;
        controller.abort();
        return;
      }

      try {
        const ok = await testNode(node, signal);
        if (stopped) continue;

        if (ok && !seen.has(node.ip_addr)) {
          seen.add(node.ip_addr);
          picked.push(node);
          if (picked.length >= want) {
            stopped = true;
            controller.abort();
            return;
          }
        }
      } catch (e) {
        // 被中止就退出当前 worker
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
  };

  await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runOne())
  );

  return picked.slice(0, want);
}

const nodeRegion = (n: nodes_info) => (n.region ?? n.region ?? "").toString().toUpperCase();

// 小工具：打乱（Fisher-Yates）
function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const afterALlNodes = async (setClosestRegion: (entryNodes: nodes_info[]) => void, callback: (_allnodes: nodes_info[]) => void) => {
	await Promise.resolve(getAllRegions(allNodes));

  // 2) 测最快地区（允许不传 callback）
  const winner = await testClosestRegion();

  // 3) 通知上层拿到“当前全量节点”（按你的原逻辑在测速后调用）
  try { callback(allNodes); } catch {}

  // 如果测速没有赢家，就直接按全量 nodes 走
  if (!winner) {
    // 直接抽 20 个
    const _entryNodes = await getEntryNodes(allNodes, 20, 10, true);
    setClosestRegion(_entryNodes)
    // 若需要刷新全量 nodes（按你原本的占位）
    Promise.resolve(getAllNodes(() => {}));
    return;
  }

  // 4) 有赢家：把赢家地区的节点放到前面（内部仍会 shuffle，避免顺序偏差）
  const winRegion = winner.region.toUpperCase();

  const preferred: nodes_info[] = [];
  const others: nodes_info[] = [];

  for (const n of allNodes) {
    (nodeRegion(n) === winRegion ? preferred : others).push(n);
  }

  // 先对两个组各自打乱，再拼接，确保“赢家地区优先 + 整体随机”
  shuffleInPlace(preferred);
  shuffleInPlace(others);
  const prioritized = preferred.concat(others);

  // 5) 在优先序列下并发挑 20 个
  const _entryNodes = await getEntryNodes(prioritized, 20, 10, /*shuffle*/ false)
  setClosestRegion(_entryNodes)

  // 6) 可选：再做一次全量节点的异步刷新（保持你原来的占位写法）
  Promise.resolve(getAllNodes(() => {}))

}

const getAllNodesV2 = async (
	setClosestRegion: (entryNodes: nodes_info[]) => void,
	callback: (_allnodes: nodes_info[]) => void) => {
	allNodes = nodes

	if (allNodes?.length) {
		return afterALlNodes(setClosestRegion, callback)
	}

	getAllNodes(() => {
		afterALlNodes(setClosestRegion, callback)
	})
}


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

let startMiningV2Process = false;

const ceateMininngValidator = async (
  currentProfile: profile,
  node: nodes_info,
  requestData: any = null
) => {
  if (!currentProfile || !currentProfile.pgpKey || !node.armoredPublicKey) {
    console.log(
      `currentProfile?.pgpKey[${currentProfile?.pgpKey}]|| !SaaSnode?.armoredPublicKey[${node?.armoredPublicKey}] Error`
    );
    return null;
  }
  const key = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
    "base64"
  );

  const command: SICommandObj = {
    command: "mining_validator",
    algorithm: "aes-256-cbc",
    Securitykey: key,
    requestData,
    walletAddress: currentProfile.keyID.toLowerCase(),
  };

  const message = JSON.stringify(command);
  const wallet = new ethers.Wallet(currentProfile.privateKeyArmor);
  const signMessage = await wallet.signMessage(message);
  let privateKeyObj = null;

  try {
    privateKeyObj = await makePrivateKeyObj(
      currentProfile.pgpKey.privateKeyArmor
    );
  } catch (ex) {
    return console.log(ex);
  }

  const encryptedCommand = await encrypt_Message(
    privateKeyObj,
    node.armoredPublicKey,
    { message, signMessage }
  );
  command.requestData = [encryptedCommand, "", key];
  return command;
};

const makePrivateKeyObj = async (privateArmor: string, password = "") => {
  if (!privateArmor) {
    const msg = `makePrivateKeyObj have no privateArmor Error!`;
    return console.log(msg);
  }

  let privateKey = await readPrivateKey({ armoredKey: privateArmor });

  if (!privateKey.isDecrypted()) {
    privateKey = await decryptKey({
      privateKey,
      passphrase: password,
    });
  }

  return privateKey;
};

const createConnectCmd = async (
  currentProfile: profile,
  node: nodes_info,
  requestData: any = null
) => {
  if (!currentProfile || !currentProfile.pgpKey || !node.armoredPublicKey) {
    console.log(
      `currentProfile?.pgpKey[${currentProfile?.pgpKey}]|| !SaaSnode?.armoredPublicKey[${node?.armoredPublicKey}] Error`
    );
    return null;
  }

  const key = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
    "base64"
  );
  const command: SICommandObj = {
    command: "mining",
    algorithm: "aes-256-cbc",
    Securitykey: key,
    requestData,
    walletAddress: currentProfile.keyID.toLowerCase(),
  };

  console.log(`mining`);
  const message = JSON.stringify(command);
  const wallet = new ethers.Wallet(currentProfile.privateKeyArmor);
  const signMessage = await wallet.signMessage(message);

  let privateKeyObj = null;

  try {
    privateKeyObj = await makePrivateKeyObj(
      currentProfile.pgpKey.privateKeyArmor
    );
  } catch (ex) {
    return console.log(ex);
  }

  const encryptedCommand = await encrypt_Message(
    privateKeyObj,
    node.armoredPublicKey,
    { message, signMessage }
  );
  command.requestData = [encryptedCommand, "", key];
  return command;
};

const encrypt_Message = async (
  privatePgpObj: any,
  armoredPublicKey: string,
  message: any
) => {
  const encryptObj = {
    message: await createMessage({
      text: Buffer.from(JSON.stringify(message)).toString("base64"),
    }),
    encryptionKeys: await readKey({ armoredKey: armoredPublicKey }),
    signingKeys: privatePgpObj,
    config: { preferredCompressionAlgorithm: enums.compression.zlib }, // compress the data with zlib
  };
  return await encrypt(encryptObj);
}


export {
  getAllNodes,
  testClosestRegion,
  allNodes,
  maxNodes,
  currentScanNodeNumber,
  getAllNodesV2
};
