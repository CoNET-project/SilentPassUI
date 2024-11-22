import { ethers } from "ethers";

const localDatabaseName = "conet";
const apiv3_endpoint = `https://apiv3.conet.network/api/`;
const apiv4_endpoint = `https://apiv4.conet.network/api/`;
const XMLHttpRequestTimeout = 30 * 1000;
const conetRpc = "https://rpc.conet.network";
const conetProvider = new ethers.JsonRpcProvider(conetRpc);

export {
  localDatabaseName,
  XMLHttpRequestTimeout,
  apiv3_endpoint,
  apiv4_endpoint,
  conetRpc,
  conetProvider,
};
