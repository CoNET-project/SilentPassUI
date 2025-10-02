import { ethers } from "ethers";
import {
  createMessage,
  decryptKey,
  encrypt,
  enums,
  generateKey,
  readKey,
  readPrivateKey,
} from "openpgp";
import contracts from "../utils/contracts";
import { conetDepinProvider } from "../utils/constants";
import { initProfileTokens, postToEndpoint } from "../utils/utils";
import async from "async";
import {checkLocalStorageNodes, storageAllNodes} from './wallets'
import nodes from '../pages/Home/assets/allnodes.json'
import {mapLimit} from 'async'
let allNodes: nodes_info[] = [];
let closestNodes: nodes_info[] = [];
let allRegions: string[] = [];
let cCNTPcurrentTotal = 0;

let epoch = 0;
let getAllNodesProcess = false;

let entryNodes: nodes_info[] = [];
let currentScanNodeNumber = 0;
let maxNodes = 0;
let testRegion: ClosestRegion[] = [];
const postToEndpointGetBody: (
  url: string,
  post: boolean,
  isJSON: boolean,
  jsonData: any
) => Promise<string> = (url: string, post: boolean, isJSON: boolean, jsonData: any ) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      //const status = parseInt(xhr.responseText.split (' ')[1])
		clearTimeout(timeout)
      if (xhr.status === 200) {
		
        // parse JSON
        if (!xhr.responseText.length) {
          return resolve("");
        }
        return resolve(xhr.responseText);
      }
      return resolve("");
    };

	xhr.timeout = 15 * 1000
    xhr.open(post ? "POST" : "GET", url, true);
    isJSON && xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    // xhr.setRequestHeader('Connection', 'close')
	const timeout = setTimeout(() => {
		xhr.abort()
		resolve ("")
	}, 15*1000)

    xhr.send(jsonData ? JSON.stringify(jsonData) : "");
  });
};

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

export const testNode = (node: nodes_info): Promise<boolean> => new Promise (async executor => {
	try {
		const url = `http://${node.ip_addr}`
		await postToEndpoint(url, false, false, 1000)
		// 只有在“计入结果”的时候才判断是否够数
		executor(true)
	} catch (e) {
		// 失败再次测试
		deleteNodeFromList(node)
		executor(false)
	}
})

const testSpeed = (region: string) =>
	new Promise<void>(async (resolve, reject) => {
		const node = getRandomNodeFromRegion(region);
		try {
			
			const url = `http://${node.ip_addr}`
			const startTime = Date.now()

			// 这里建议加超时（可选）：await fetchWithTimeout(...)
			await postToEndpoint(url, false, false, 1000)

			const delay = Date.now() - startTime
			
			testRegion.push({ node, delay })
			// 只有在“计入结果”的时候才判断是否够数
			resolve(); // 别忘了正常完结
		} catch (e) {
			// 失败再次测试
			deleteNodeFromList(node)
			resolve(await testSpeed(region))
		}
	})

const testClosestRegion = async (callback: () => void) => {


	const processPool: any[] = []
	let didCallBack = false
	allRegions.forEach(n => {
		if (/DE|ES|GB|US/i.test(n)) {
			processPool.push(testSpeed(n))
		}
		
	})

	
	await Promise.all(processPool).finally(() => {
		if (!didCallBack) {
			callback()
		}
		
		
	}).catch(ex => {
		if (testRegion.length && !didCallBack) {
			didCallBack = true
			callback()
		}
	})
	
}

		
export const exitNodes = (exitRegion: string) => {
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

const getEntryNodes = (country: string, setClosestRegion: (entryNodes: nodes_info[]) => void) => {
	const entryRegionNodes = allNodes.filter((n) => n.country === country);
	const closeNodes: nodes_info[] = []
	mapLimit(entryRegionNodes, 10, async (n, next ) => {
		
		const test = await testNode(n)
		if (test) {
			closeNodes.push(n)
			setClosestRegion(closeNodes)
		}
	}).finally(() => {
		console.log(closeNodes)
	})
}

const getAllNodesV2 = async (
	setClosestRegion: (entryNodes: nodes_info[]) => void,
	callback: (_allnodes: nodes_info[]) => void) => {
	allNodes = nodes
	const index = allNodes.findIndex(n => n.ip_addr === '74.208.234.210')
	if (index > -1) {
		allNodes.splice(index, 1)
	}

	if (allNodes?.length) {
		getAllRegions(allNodes)
		return testClosestRegion( async ()=> {
			const country = testRegion[0].node.country;
			
			callback(allNodes)
			getEntryNodes(country, setClosestRegion)

			
			getAllNodes(() => {
				return testClosestRegion(async ()=> {
					const country = testRegion[0].node.country;
					getEntryNodes(country, setClosestRegion)
					
				})
			})
		})
		
	}

	getAllNodes(() => {
		return testClosestRegion(async ()=> {
			const country = testRegion[0].node.country;
			
			callback(allNodes)
			getEntryNodes(country, setClosestRegion)
			
			getAllNodes(() => {
				return testClosestRegion(async ()=> {
					const country = testRegion[0].node.country;
					getEntryNodes(country, setClosestRegion)
					
				})
			})
		
		})
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
};

const getRandomNode = () => {
	const index = Math.floor(Math.random()*allNodes.length)
	return allNodes[index].ip_addr
}

const getRandomNodeDomain = () => {
	const index = Math.floor(Math.random()*allNodes.length)
	return allNodes[index].domain
}

const postToEndpointSSE = (
  url: string,
  post: boolean,
  jsonData: any,
  CallBack: (err: any, data: string) => void
) => {
  const xhr = new XMLHttpRequest();

  let chunk = 0;
  xhr.onprogress = async (e) => {
    const data = await xhr.responseText;
    clearTimeout(timeCount);
    if (e.eventPhase < 2) {
      return console.log(
        `xhr.status = ${xhr.status} e.eventPhase [${e.eventPhase}]`,
        data
      );
    }

    if (xhr.status === 401) {
      return CallBack("Err_Multiple_IP", "");
    }
    if (xhr.status === 402) {
      return CallBack("Err_Existed", "");
    }
    if (xhr.status !== 200) {
      return CallBack("FAILURE", "");
    }

    const currentData = data.substring(chunk);
    const responseText = data.split("\r\n\r\n");
    chunk = data.length;
    CallBack(null, currentData);
  };

  xhr.upload.onabort = () => {
    console.log(`xhr.upload.onabort`);
  };

  xhr.upload.onerror = (err) => {
    clearTimeout(timeCount);
    // CallBack('NOT_INTERNET', '')
    console.log(`xhr.upload.onerror`, err);
  };

  xhr.onerror = (err) => {
    console.log(`xhr.onerror`, err);
    clearTimeout(timeCount);
    CallBack("NOT_INTERNET", "");
  };

  const timeCount = setTimeout(() => {
    const Err = `postToEndpoint Timeout!`;
    console.log(`postToEndpoint Error`, Err);
    CallBack("TIMEOUT", "");
  }, 1000 * 45);

  xhr.open(post ? "POST" : "GET", url, true);
  xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
  xhr.send(typeof jsonData !== "string" ? JSON.stringify(jsonData) : jsonData);

  return xhr;
};

export {
  getAllNodes,
  testClosestRegion,
  closestNodes,
  allNodes,
  maxNodes,
  currentScanNodeNumber,
  getAllNodesV2,
  getRandomNode,
  getRandomNodeDomain
};
