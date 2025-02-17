import { ethers } from "ethers";

const localDatabaseName = "conet";
const apiv3_endpoint = `https://apiv3.conet.network/api/`;
const apiv4_endpoint = `https://apiv4.conet.network/api/`;
const XMLHttpRequestTimeout = 30 * 1000;
const conetRpc = "https://cancun-rpc.conet.network";
const mainChain_rpc = "https://mainnet-rpc.conet.network";
const _ethRpc = [
  "https://rpc.ankr.com/eth",
  "https://eth.llamarpc.com",
  "https://ethereum-rpc.publicnode.com",
];
const ethRpc = () => _ethRpc[Math.round(Math.random() * (_ethRpc.length - 1))];

const conetProvider = new ethers.JsonRpcProvider(conetRpc);
const ethProvider = new ethers.JsonRpcProvider(ethRpc());
const conetDepinProvider = new ethers.JsonRpcProvider(mainChain_rpc);

export {
  localDatabaseName,
  XMLHttpRequestTimeout,
  apiv3_endpoint,
  apiv4_endpoint,
  conetRpc,
  conetProvider,
  ethProvider,
  conetDepinProvider,
};
