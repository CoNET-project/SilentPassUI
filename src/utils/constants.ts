import { ethers } from "ethers";

const localDatabaseName = "conet";
const apiv3_endpoint = `https://apiv3.conet.network/api/`;
const apiv4_endpoint = `https://apiv4.conet.network/api/`;
const payment_endpoint = `https://hooks.conet.network/api/`;
const XMLHttpRequestTimeout = 90 * 1000;
const conetRpc = "https://cancun-rpc.conet.network";
const mainChain_rpc = "https://mainnet-rpc.conet.network";
const paypal_endpoint = `https://centerapi.fx168api.com/`;
const _ethRpc = [
  "http://rpc.ankr.com/eth",
  "https://eth.llamarpc.com",
  "https://ethereum-rpc.publicnode.com",
  "https://eth-mainnet.public.blastapi.io"
];

const ethRpc = () => _ethRpc[Math.round(Math.random() * (_ethRpc.length - 1))];
const rewardWalletAddress = "GUq7PhyAUZko2mPhv3CupmdJKQ61LH8VyrdsRL25q7zg";
const stripe_pay_monthly = 'https://buy.stripe.com/test_9AQ16b6Du82p0Ja9AG?client_reference_id='
const stripe_pay_Annual ='https://buy.stripe.com/test_eVa2af5zqdmJ2Ri14b?client_reference_id='

const conetProvider = new ethers.JsonRpcProvider(conetRpc);
let ethProvider = new ethers.JsonRpcProvider(ethRpc());
const conetDepinProvider = new ethers.JsonRpcProvider(mainChain_rpc);

const changeRPC = () => {
	ethProvider = new ethers.JsonRpcProvider(ethRpc());
}
export {
  localDatabaseName,
  XMLHttpRequestTimeout,
  apiv3_endpoint,
  apiv4_endpoint,
  conetRpc,
  rewardWalletAddress,
  conetProvider,
  ethProvider,
  conetDepinProvider,
  changeRPC,
  stripe_pay_monthly,
  stripe_pay_Annual,
  payment_endpoint,
  paypal_endpoint
};
