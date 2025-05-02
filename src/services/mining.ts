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
import { conetProvider } from "../utils/constants";
import { initProfileTokens, postToEndpoint } from "../utils/utils";
import async from "async";
import {checkLocalStorageNodes, storageAllNodes} from './wallets'

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
  jsonData: any
) => Promise<string> = (url: string, post: boolean, jsonData) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      clearTimeout(timeCount);
      //const status = parseInt(xhr.responseText.split (' ')[1])

      if (xhr.status === 200) {
        // parse JSON
        if (!xhr.responseText.length) {
          return resolve("");
        }
        return resolve(xhr.responseText);
      }
      return resolve("");
    };

    xhr.open(post ? "POST" : "GET", url, true);
    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    // xhr.setRequestHeader('Connection', 'close')

    xhr.send(jsonData ? JSON.stringify(jsonData) : "");

    const timeCount = setTimeout(() => {
      const Err = `postToEndpoint Timeout!`;
      return resolve("");
    }, 30 * 1000);
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
};

const testClosestRegion = async (callback: () => void) => {
  testRegion = [];

  async.each(allRegions, (item, _callback) => {
	const node = getRandomNodeFromRegion(item)
	const url = `https://${node.domain}`;
      const startTime = new Date().getTime();
	  const test = async () => {
		await postToEndpointGetBody(url, false, null);
		const endTime = new Date().getTime();
		const delay = endTime - startTime;
		testRegion.push({ node, delay })
		_callback(new Error(''))
	  }
      test()
      
  }).then (() => {
	testRegion.forEach(n => closestNodes.push(n.node))
	// callback()
  }).catch (ex=> {
	testRegion.forEach(n => closestNodes.push(n.node))
	callback()
  })
};

const getAllNodes = async (
  setClosestRegion: (entryNodes: nodes_info[]) => void,
  callback: (allnodes: nodes_info[]) => void
) => {
  if (getAllNodesProcess) {
    return
  }

  getAllNodesProcess = true;

  const GuardianNodesContract = new ethers.Contract(
    contracts.ConetGuardianNodesV6.address,
    contracts.ConetGuardianNodesV6.abi,
    conetProvider
  );
  maxNodes = 0;
  try {
    const _maxNodes: BigInt = await GuardianNodesContract.currentNodeID();
    maxNodes = parseInt(_maxNodes.toString());
  } catch (ex) {
    return console.log(`getAllNodes currentNodeID Error`, ex);
  }
  if (!maxNodes) {
    return console.log(`getAllNodes STOP scan because scanNodes == 0`);
  }
  allNodes = [];
  for (let i = 0; i < maxNodes; i++) {
    allNodes.push({
      region: "",
      country: "",
      ip_addr: "",
      armoredPublicKey: "",
      last_online: false,
      nftNumber: 100 + i,
    });
  }
  const GuardianNodesInfoContract = new ethers.Contract(
    contracts.GuardianNodesInfoV6.address,
    contracts.GuardianNodesInfoV6.abi,
    conetProvider
  );
  const country: Map<string, boolean> = new Map();
  currentScanNodeNumber = 0;
  let i = 0;
  await async
    .mapLimit(allNodes, 10, async (n: nodes_info, next: any) => {
      const nodeInfo = await GuardianNodesInfoContract.getNodeInfoById(
        n.nftNumber
      );
      if (nodeInfo?.pgp) {
        i = n.nftNumber;
        currentScanNodeNumber++;
        n.region = nodeInfo.regionName;
        const _country = n.region.split(".")[1];
        country.set(_country, true);
        n.ip_addr = nodeInfo.ipaddress;
        n.country = _country;
        n.armoredPublicKey = Buffer.from(nodeInfo.pgp, "base64").toString();
        const pgpKey1 = await readKey({
          armoredKey: n.armoredPublicKey,
        });
        n.domain =
          pgpKey1.getKeyIDs()[1].toHex().toUpperCase() + ".conet.network";
        return;
      }
      throw new Error(`Ended`);
    })
    .catch(() => {});
  maxNodes = currentScanNodeNumber - currentScanNodeNumber * 0.1;

  const index = allNodes.findIndex((n) => n.nftNumber === i) + 1;
  allNodes = allNodes.slice(0, index);
  allRegions = Array.from(country.keys());
  testClosestRegion(() => {
    // maxNodes = currentScanNodeNumber;
    const country = testRegion[0].node.country;
    const entryRegionNodes = allNodes.filter((n) => n.country === country);
    do {
      const index = Math.floor(Math.random() * entryRegionNodes.length);
      const node = entryRegionNodes[index];
      if (node?.ip_addr) {
        entryNodes.push(node);
      }
    } while (entryNodes.length < 5);
    setClosestRegion(entryNodes);
    callback(allNodes);
	storageAllNodes(allNodes)
  });
};

const getAllRegions = (nodes: nodes_info[]) => {
	const country: Map<string, boolean> = new Map();
	nodes.forEach(n => {
		const _country = n.region.split(".")[1]
		country.set(_country, true)
	})
	allRegions = Array.from(country.keys())
}

const getAllNodesV2 = async (
	setClosestRegion: (entryNodes: nodes_info[]) => void,
	callback: (_allnodes: nodes_info[]) => void) => {
	allNodes = await checkLocalStorageNodes()
	if (allNodes) {
		getAllRegions(allNodes)
		return testClosestRegion(() => {
			setClosestRegion(closestNodes)
			callback(allNodes)
			getAllNodes(setClosestRegion, () => {})
		})
		
	}
	getAllNodes(setClosestRegion, callback)
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
  getAllNodesV2
};
