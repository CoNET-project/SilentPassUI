import { ethers } from "ethers";
import { mapLimit } from "async";

import { createMessage, encrypt, enums, readKey } from "openpgp";
import axios from "axios";
import { conetProvider } from "../utils/constants";
import { contracts } from "../utils/contracts";
import { setMiningClass } from "../utils/globals";
import { createGPGKey } from "./wallets";

interface nodeInfo {
  region: string;
  ip_addr: string;
  armoredPublicKey: string;
  nftNumber: number;
  domain: string;
  lastEposh?: number;
}

interface listenClient {
  status: number;
  epoch: number;
  rate: string;
  hash: string;
  nodeWallet: string;
  online: number;
  connetingNodes: number;
  nodeDomain: string;
  nodeIpAddr: string;
  nodeWallets: string[];
  minerResponseHash: any;
  userWallets: string[];
  isUser: boolean;
}

let getAllNodesProcess = false;
let Guardian_Nodes: nodeInfo[] = [];

const getAllNodes = () =>
  new Promise(async (resolve) => {
    if (getAllNodesProcess) {
      return resolve(false);
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
      console.log(`getAllNodes currentNodeID Error`, ex);
      return resolve(false);
    }
    if (!scanNodes) {
      console.log(`getAllNodes STOP scan because scanNodes == 0`);
      return resolve(false);
    }

    Guardian_Nodes = [];

    for (let i = 0; i < scanNodes; i++) {
      Guardian_Nodes.push({
        region: "",
        ip_addr: "",
        armoredPublicKey: "",
        nftNumber: 100 + i,
        domain: "",
      });
    }
    const GuardianNodesInfo = new ethers.Contract(
      contracts.GuardianNodesInfoV6.address,
      contracts.GuardianNodesInfoV6.abi,
      conetProvider
    );

    mapLimit(
      Guardian_Nodes,
      5,
      async (n: nodeInfo) => {
        const nodeInfo = await GuardianNodesInfo.getNodeInfoById(n.nftNumber);
        if (nodeInfo.pgp) {
          n.region = nodeInfo.regionName;
          n.ip_addr = nodeInfo.ipaddress;
          n.armoredPublicKey = Buffer.from(nodeInfo.pgp, "base64").toString();
          const pgpKey1 = await readKey({ armoredKey: n.armoredPublicKey });
          n.domain =
            pgpKey1.getKeyIDs()[1].toHex().toUpperCase() + ".conet.network";
        } else {
          console.log(`nodeInfo ${n.nftNumber} Error!`);
          throw new Error(`${n.nftNumber}`);
        }
      },
      (err) => {
        if (err) {
          const length = parseInt(err.message) - 100;
          console.log(
            `Error at ${length} Guardian_Nodes = ${Guardian_Nodes[length].domain}`
          );
          Guardian_Nodes.splice(length);
          console.log(
            `Guardian_Nodes length = ${
              Guardian_Nodes.length
            } the last node is ${
              Guardian_Nodes[Guardian_Nodes.length - 1].ip_addr
            }`
          );
        }
        console.log(`mapLimit finished err = ${err?.message}`);
        getAllNodesProcess = false;
        return resolve(true);
      }
    );
  });

const getWallet = async (SRP: string, max: number, __start: number) => {
  await getAllNodes();

  const acc = ethers.Wallet.fromPhrase(SRP);
  const wallets: string[] = [];
  if (__start === 0) {
    wallets.push(acc.signingKey.privateKey);
    __start++;
  }

  for (let i = __start; i < max; i++) {
    const sub = acc.deriveChild(i);
    wallets.push(sub.signingKey.privateKey);
  }

  let i = 0;

  wallets.forEach((n) => {
    start(n);
  });
};

let startGossipProcess = false;

const startGossip = (
  node: nodeInfo,
  POST: string,
  callback?: (err?: string, data?: string) => void
) => {
  if (startGossipProcess) {
    return;
  }
  startGossipProcess = true;

  const relaunch = () =>
    setTimeout(() => {
      startGossip(node, POST, callback);
    }, 1000);

  const waitingTimeout = setTimeout(() => {
    console.log(
      `startGossip on('Timeout') [${node.ip_addr}:${node.nftNumber}]!`
    );
    relaunch();
  }, 5 * 1000);

  const postData = async () => {
    const url = `https://${node.domain}/post`;
    const headers = {
      "Content-Type": "application/json;charset=UTF-8",
    };
    const data = POST; // Assuming POST contains the data to send

    try {
      let first = true;

      // Use fetch instead of axios
      const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(data), // Convert data to JSON
      });

      if (!response.ok) {
        relaunch();
        return console.log(
          `startGossip ${node.ip_addr} got statusCode = [${response.status}] != 200 error! relaunch !!!`
        );
      }

      let responseData = await response.text(); // Read the response as text
      if (typeof responseData === "string") {
        responseData = responseData.replace(/\r\n/g, "");
      }

      if (first) {
        first = false;
        try {
          const parsedData = JSON.parse(responseData);
          // console.log(inspect(parsedData, false, 3, true))
        } catch (ex) {
          console.log("first JSON.parse Error", responseData);
        }
        return;
      }

      if (typeof callback === "function") {
        callback("", responseData);
      }

      // Timeout handler to manage gossip process time
      const timeout = setTimeout(() => {
        console.log(
          `startGossip [${node.ip_addr}] has 2 EPOCH got NONE Gossip Error! Try to restart! `
        );
        relaunch();
      }, 24 * 1000);

      // Clear timeout if successful
      clearTimeout(timeout);
    } catch (err) {
      console.log(
        `startGossip [${node.ip_addr}] Error: ${err}. Trying to restart.`
      );
      relaunch();
    }
  };

  postData();
};

const getRandomNodeV2: any = (index = -1) => {
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
  if (!node) {
    console.log(`getRandomNodeV2 index ${nodoNumber} has no data try again`);
    return getRandomNodeV2(index);
  }
  return { node, nodoNumber };
};

const sendToUsedNode = async (
  wallet: ethers.Wallet,
  data: listenClient,
  validatorNode: nodeInfo
) => {
  const key = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
    "base64"
  );
  const command = {
    command: "mining_validator",
    walletAddress: wallet.address.toLowerCase(),
    algorithm: "aes-256-cbc",
    Securitykey: key,
    requestData: data,
  };

  const message = JSON.stringify(command);
  const signMessage = await wallet.signMessage(message);

  const encryptObj = {
    message: await createMessage({
      text: Buffer.from(JSON.stringify({ message, signMessage })).toString(
        "base64"
      ),
    }),
    encryptionKeys: await readKey({
      armoredKey: validatorNode.armoredPublicKey,
    }),
    config: { preferredCompressionAlgorithm: enums.compression.zlib }, // compress the data with zlib
  };

  const _postData = await encrypt(encryptObj);
  console.log(
    `validator [${wallet.address.toLowerCase()}] post to ${
      validatorNode.ip_addr
    } epoch ${data.epoch} total miner [${data.online}]`
  );
  postToUrl(validatorNode, JSON.stringify({ data: _postData }));
};

const connectToGossipNode = async (
  wallet: ethers.Wallet,
  miningNode: nodeInfo,
  index: number
) => {
  const key = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
    "base64"
  );

  const command = {
    command: "mining",
    walletAddress: wallet.address.toLowerCase(),
    algorithm: "aes-256-cbc",
    Securitykey: key,
  };

  const message = JSON.stringify(command);
  const signMessage = await wallet.signMessage(message);

  const encryptObj = {
    message: await createMessage({
      text: Buffer.from(JSON.stringify({ message, signMessage })).toString(
        "base64"
      ),
    }),
    encryptionKeys: await readKey({ armoredKey: miningNode.armoredPublicKey }),
    config: { preferredCompressionAlgorithm: enums.compression.zlib }, // compress the data with zlib
  };

  const postData = await encrypt(encryptObj);
  console.log(
    `connectToGossipNode ${miningNode.domain}:${miningNode.ip_addr}, wallet = ${
      wallet.signingKey.privateKey
    }:${wallet.address.toLowerCase()}`
  );

  startGossip(
    miningNode,
    JSON.stringify({ data: postData }),
    async (err, _data) => {
      if (!_data) {
        return console.log(
          `connectToGossipNode ${miningNode.ip_addr} push ${_data} is null!`
        );
      }

      if (!SaaSNodes.size) {
        return;
      }

      let data: listenClient;
      try {
        data = JSON.parse(_data);
      } catch (ex) {
        console.log(`${miningNode.ip_addr} => \n${_data}`);
        return console.log(`connectToGossipNode JSON.parse(_data) Error!`);
      }

      data.minerResponseHash = await wallet.signMessage(data.hash);
      data.isUser = true;
      data.userWallets = data.nodeWallets = [];

      SaaSNodes.forEach(async (v, key) => {
        await sendToUsedNode(wallet, data, v);
      });
    }
  );
};

let SaaSNodes: Map<string, nodeInfo> = new Map();

const start = (privateKeyArmor: string) =>
  new Promise(async (resolve) => {
    await getAllNodes();
    const wallet = new ethers.Wallet(privateKeyArmor);

    const miningNode = getRandomNodeV2();
    if (!miningNode) {
      return console.log(`start has Error!`);
    }
    Guardian_Nodes.splice(miningNode.nodoNumber, 1);
    connectToGossipNode(wallet, miningNode.node, miningNode.nodoNumber);
  });

const postToUrl = (node: nodeInfo, POST: string) => {
  const url = `http://${node.ip_addr}/post`;

  const config = {
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
    },
    timeout: 5000,
  };

  axios
    .post(url, POST, config)
    .then((response) => {
      if (response.status === 200) {
        console.log(`Successfully posted to ${node.ip_addr}:${node.nftNumber}`);
      } else {
        console.log(
          `postToUrl ${node.ip_addr} statusCode = [${response.status}] != 200 error!`
        );
      }
    })
    .catch((error) => {
      if (error.code === "ECONNABORTED") {
        console.log(
          `postToUrl on('Timeout') [${node.ip_addr}:${node.nftNumber}]!`
        );
      } else {
        console.log(
          `postToUrl on('error') [${node.ip_addr}] requestHttps on Error! no call relaunch`,
          error.message
        );
      }
    });
};

const changeRegion = (miningClass: miningV2_Class, selectedCountry: string) => {
  const result = miningClass.changeUsedNodes(selectedCountry);
  if (!result || !result.length) {
    return false;
  }

  const activeNodes = result.slice(0, result.length / 2);
  const egressNodes = result.slice(result.length / 2);

  return [activeNodes, egressNodes];
};

class miningV2_Class {
  private init = (privateKeyArmor: string) => {
    start(privateKeyArmor);
  };

  constructor(privateKeyArmor: string) {
    this.init(privateKeyArmor);
  }

  public changeUsedNodes(region: string) {
    SaaSNodes = new Map();
    const nodes = Guardian_Nodes.filter(
      (n) => n.region.split(".")[1] === region
    );

    if (!nodes.length) {
      return null;
    }

    const exportNodes: nodeInfo[] = [];

    do {
      const index = Math.floor(Math.random() * nodes.length);
      const node = nodes[index];
      const isExisting = exportNodes.findIndex(
        (n) => n.ip_addr === node.ip_addr
      );
      if (node && isExisting < 0) {
        exportNodes.push(node);
      }
    } while (exportNodes.length < 10 && exportNodes.length < nodes.length);

    exportNodes.forEach((n) => {
      SaaSNodes.set(n.ip_addr, n);
    });

    return exportNodes;
  }
}

const startVpnMining = async () => {
  const acc = ethers.Wallet.createRandom();
  const key = await createGPGKey("", "", "");
  const profile = {
    tokens: null,
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
    hdPath: acc.path || "",
    index: acc.index,
  };

  const miningClassTmp = new miningV2_Class(profile.privateKeyArmor);
  setMiningClass(miningClassTmp);
};

export { miningV2_Class, changeRegion, startVpnMining };
