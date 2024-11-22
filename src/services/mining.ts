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
import { contracts } from "../utils/contracts";

const conetRpc = "https://rpc.conet.network";
const conetProvider = new ethers.JsonRpcProvider(conetRpc);

let Guardian_Nodes: nodes_info[] = [];
let cCNTPcurrentTotal = 0;
let miningAddress = "";
let miningConnection: any = null;
let mining_epoch = 0;
let epoch = 0;
let getAllNodesProcess = false;
let miningProfile: profile | null = null;
const XMLHttpRequestTimeout = 30 * 1000;

const getAllNodes = async () => {
  if (getAllNodesProcess) {
    return;
  }
  getAllNodesProcess = true;
  const GuardianNodes = new ethers.Contract(
    contracts.ConetGuardianNodesV6.address,
    contracts.ConetGuardianNodesV6.abi,
    conetProvider
  );
  let scanNodes = 0;
  try {
    const maxNodes: BigInt = await GuardianNodes.currentNodeID();
    scanNodes = parseInt(maxNodes.toString());
  } catch (ex) {
    return console.log(`getAllNodes currentNodeID Error`, ex);
  }
  if (!scanNodes) {
    return console.log(`getAllNodes STOP scan because scanNodes == 0`);
  }
  Guardian_Nodes = [];
  for (let i = 0; i < scanNodes; i++) {
    Guardian_Nodes.push({
      region: "",
      country: "",
      ip_addr: "",
      armoredPublicKey: "",
      last_online: false,
      nftNumber: 100 + i,
    });
  }
  const GuardianNodesInfo = new ethers.Contract(
    contracts.GuardianNodesInfoV6.address,
    contracts.GuardianNodesInfoV6.abi,
    conetProvider
  );

  let i = 0;

  await async
    .mapLimit(Guardian_Nodes, 5, async (n: nodes_info, next) => {
      const nodeInfo = await GuardianNodesInfo.getNodeInfoById(n.nftNumber);
      if (nodeInfo?.pgp) {
        i = n.nftNumber;
        n.region = nodeInfo.regionName;
        n.ip_addr = nodeInfo.ipaddress;
        n.armoredPublicKey = buffer.Buffer.from(
          nodeInfo.pgp,
          "base64"
        ).toString();
        const pgpKey1 = await readKey({
          armoredKey: n.armoredPublicKey,
        });
        n.domain =
          pgpKey1.getKeyIDs()[1].toHex().toUpperCase() + ".conet.network";
      } else {
        throw new Error("");
      }
    })
    .catch(() => {});
  const index = Guardian_Nodes.findIndex((n) => n.nftNumber === i) + 1;
  Guardian_Nodes = Guardian_Nodes.slice(0, index);
  getAllNodesProcess = false;
};

const getRandomNodeV2: (index: number) => null | nodes_info = (index = -1) => {
  const totalNodes = Guardian_Nodes.length - 1;
  if (!totalNodes) {
    return null;
  }

  const nodoNumber = Math.floor(Math.random() * totalNodes);
  if (index > -1 && nodoNumber === index) {
    console.log(
      `getRandomNodeV2 nodoNumber ${nodoNumber} == index ${index} REUNING AGAIN!`
    );
    return getRandomNodeV2(index);
  }

  const node = Guardian_Nodes[nodoNumber];
  console.log(
    `getRandomNodeV2 Guardian_Nodes length =${Guardian_Nodes.length} nodoNumber = ${nodoNumber} `
  );
  return node;
};

const createGPGKey = async (passwd: string, name: string, email: string) => {
  const userId = {
    name: name,
    email: email,
  };
  const option = {
    type: "ecc",
    passphrase: passwd,
    userIDs: [userId],
    curve: "curve25519",
    format: "armored",
  };

  return await generateKey(option);
};

const _startMiningV2 = async (
  profile: profile,
  cmd: worker_command | null = null
) => {
  await getAllNodes();
  miningAddress = profile.keyID.toLowerCase();
  const totalNodes = Guardian_Nodes.length - 1;
  if (!totalNodes) {
    if (cmd) {
      cmd.err = "FAILURE";
      return returnUUIDChannel(cmd);
    }
    return;
  }
  const nodoNumber = Math.floor(Math.random() * totalNodes);
  const connectNode = Guardian_Nodes[nodoNumber];

  if (!connectNode) {
    if (cmd) {
      cmd.err = "FAILURE";
      return returnUUIDChannel(cmd);
    }
    return;
  }

  if (!profile?.pgpKey) {
    profile.pgpKey = await createGPGKey("", "", "");
  }

  const index = Guardian_Nodes.findIndex(
    (n) => n.ip_addr === connectNode.ip_addr
  );
  Guardian_Nodes.splice(index, 1);

  const postData = await createConnectCmd(profile, connectNode);
  let first = true;

  const balance = profile?.tokens?.cCNTP?.balance;
  cCNTPcurrentTotal = !balance ? 0 : parseFloat(balance);

  if (!connectNode?.domain || !postData) {
    if (cmd) {
      cmd.err = "FAILURE";
      return returnUUIDChannel(cmd);
    }
    return;
  }

  const url = `https://${connectNode.domain}/post`;

  miningConnection = postToEndpointSSE(
    url,
    true,
    { data: postData.requestData[0] },
    async (err: any, _data: any) => {
      if (err) {
        console.log(err);
        if (cmd) {
          cmd.err = err;
          return returnUUIDChannel(cmd);
        }
        return;
      }

      console.log("_startMiningV2 success", _data);
      const response: nodeResponse = JSON.parse(_data);
      mining_epoch = epoch;

      if (!profile?.tokens) {
        profile.tokens = {};
      }

      if (!profile.tokens?.cCNTP) {
        profile.tokens.cCNTP = {
          balance: "0",
          history: [],
          network: "CONET Holesky",
          decimal: 18,
          contract: contracts.ClaimableConetPoint.address,
          name: "cCNTP",
        };
      }

      const cCNTP = profile.tokens.cCNTP;

      if (first) {
        miningProfile = profile;
        first = false;

        if (cmd) {
          cCNTPcurrentTotal = parseFloat(cCNTP.balance || "0");
          response.currentCCNTP = "0";
          cmd.data = ["success", JSON.stringify(response)];
          return returnUUIDChannel(cmd);
        }

        return;
      }
      const kk = parseFloat(response.rate);
      response.rate = isNaN(kk) ? "" : kk.toFixed(8);
      response.currentCCNTP = (
        parseFloat(profile.tokens.cCNTP.balance || "0") - cCNTPcurrentTotal
      ).toFixed(8);
      if (response.currentCCNTP < "0") {
        cCNTPcurrentTotal = parseFloat(profile.tokens.cCNTP.balance);
        response.currentCCNTP = "0";
      }

      const cmdd = {
        cmd: "miningStatus",
        data: [JSON.stringify(response)],
      };

      sendState("toFrontEnd", cmdd);
      const entryNode = getRandomNodeV2(nodoNumber);
      if (!entryNode) {
        console.log(`_startMiningV2 Error! getRandomNodeV2 return null!`);
        return;
      }

      validator(response, profile, entryNode);
    }
  );
};

const validator = async (
  response: nodeResponse,
  profile: profile,
  sentryNode: nodes_info
) => {
  if (!response.hash) {
    console.log(response);
    return console.log(`checkMiningHash got NULL response.hash ERROR!`);
  }
  const message = JSON.stringify({
    epoch: response.epoch,
    wallet: profile.keyID.toLowerCase(),
  });
  const va = ethers.verifyMessage(message, response.hash);
  if (va.toLowerCase() !== response.nodeWallet.toLowerCase()) {
    return console.log(
      `validator va${va.toLowerCase()} !== response.nodeWallet ${response.nodeWallet.toLowerCase()}`
    );
  }
  const wallet = new ethers.Wallet(profile.privateKeyArmor);
  response.minerResponseHash = await wallet.signMessage(response.hash);
  //	clean data
  response.userWallets = response.nodeWallets = [];
  const request = await ceateMininngValidator(profile, sentryNode, response);
  if (!request) {
    return console.log(`ceateMininngValidator got null Error!`);
  }

  const url = `https://${sentryNode.domain}/post`;
  const req = await postToEndpoint(url, true, {
    data: request.requestData[0],
  }).catch((ex: any) => {
    console.log(ex);
  });

  console.log(req);
};

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
  const key = buffer.Buffer.from(
    self.crypto.getRandomValues(new Uint8Array(16))
  ).toString("base64");
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

  const key = buffer.Buffer.from(
    self.crypto.getRandomValues(new Uint8Array(16))
  ).toString("base64");
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
      text: buffer.Buffer.from(JSON.stringify(message)).toString("base64"),
    }),
    encryptionKeys: await readKey({ armoredKey: armoredPublicKey }),
    signingKeys: privatePgpObj,
    config: { preferredCompressionAlgorithm: enums.compression.zlib }, // compress the data with zlib
  };
  return await encrypt(encryptObj);
};

const postToEndpoint = (url: string, post: boolean, jsonData: any) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      clearTimeout(timeCount);
      //const status = parseInt(xhr.responseText.split (' ')[1])

      if (xhr.status === 200) {
        // parse JSON
        xhr.abort();
        if (!xhr.responseText.length) {
          return resolve(true);
        }
        let ret;
        try {
          ret = JSON.parse(xhr.responseText);
        } catch (ex) {
          return resolve(true);
        }
        return resolve(ret);
      }
      xhr.abort();
      console.log(
        `postToEndpoint [${url}] xhr.status [${
          xhr.status === 200
        }] !== 200 Error`
      );
      return resolve(false);
    };

    xhr.open(post ? "POST" : "GET", url, true);
    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");

    xhr.send(jsonData ? JSON.stringify(jsonData) : "");

    const timeCount = setTimeout(() => {
      xhr.abort();
      const Err = `Timeout!`;
      console.log(`postToEndpoint ${url} Timeout Error`, Err);
      reject(new Error(Err));
    }, XMLHttpRequestTimeout);
  });

const postToEndpointSSE = (
  url: string,
  post: boolean,
  jsonData: any,
  CallBack: (err: WorkerCommandError | null, data: string) => void
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

  xhr.open(post ? "POST" : "GET", url, true);
  xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
  xhr.send(typeof jsonData !== "string" ? JSON.stringify(jsonData) : jsonData);

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

  return xhr;
};
