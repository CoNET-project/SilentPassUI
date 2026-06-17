import { ethers } from "ethers";
import contracts from './contracts'
import { baseEndpoint } from './baseRpc'
import { BEAMIO_USER_CARD_ASSET_ADDRESS as BEAMIO_USER_CARD_ASSET, USDC_BASE } from '../config/chainAddresses'
const localDatabaseName = "conet";
const apiv3_endpoint = `https://apiv3.conet.network/api/`;
const apiv4_endpoint = `https://apiv4.conet.network/api/`;
const payment_endpoint = `https://hooks.conet.network/api/`;
const XMLHttpRequestTimeout = 90 * 1000;
// const conetRpc = "https://cancun-rpc.conet.network";
const mainChain_rpc = "https://publicrpc.conet.network";
const paypal_endpoint = `https://centerapi.fx168api.com/`;

const beamioApi = 'https://beamio.app'
/** API 端点：提交 Open Relay 支付（扫码得到的 payload + 金额 + 收款 AA） */
const voucherRelayApi = `${beamioApi}/api/voucher/relay`

const _ethRpc = [
  "http://rpc.ankr.com/eth",
  "https://eth.llamarpc.com",
  "https://ethereum-rpc.publicnode.com",
  "https://eth-mainnet.public.blastapi.io"
];
const USDCContract_BASE = USDC_BASE

const BeamioCardFactorySC = new ethers.Contract(
	contracts.BeamioCardFactory.address,
	contracts.BeamioCardFactory.abi,
	baseEndpoint
)


const ethRpc = () => _ethRpc[Math.round(Math.random() * (_ethRpc.length - 1))];
const rewardWalletAddress = "GUq7PhyAUZko2mPhv3CupmdJKQ61LH8VyrdsRL25q7zg";
const stripe_pay_monthly = 'https://buy.stripe.com/test_9AQ16b6Du82p0Ja9AG?client_reference_id='
const stripe_pay_Annual ='https://buy.stripe.com/test_eVa2af5zqdmJ2Ri14b?client_reference_id='
const SilentPassOfficial = 'A8Vk2LsNqKktabs4xPY4YUmYxBoDqcTdxY5em4EQm8v1'

const CCSA_Card_Address = contracts.BeamioCardCCSA.address.toLowerCase()
/** @deprecated 废弃全局卡；API/display 已 exclude，勿在新功能中使用 */
const BEAMIO_USER_CARD_ASSET_ADDRESS = BEAMIO_USER_CARD_ASSET.toLowerCase()
/** CashTrees 程序卡（Alliance FIXED_USER_CARD） */
const CASH_TREES_CARD_ADDRESS = '0x82ceE96dB45933fE4b71D36fa8904508f929027C'.toLowerCase()
/** 用户程序卡资产聚合（不含废弃全局 CCSA / infra 卡） */
const ASSET_CARD_ADDRESSES = [CASH_TREES_CARD_ADDRESS]

let ethProvider = new ethers.JsonRpcProvider(ethRpc());
const conetDepinProvider = new ethers.JsonRpcProvider(mainChain_rpc);
const Solana_USDT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
const Solana_SOL = 'So11111111111111111111111111111111111111112'
const Solana_SP = 'Bzr4aEQEXrk7k8mbZffrQ9VzX6V3PAH4LvWKXkKppump'



const sGB_ReadOnly = new ethers.Contract(
	contracts.sGB.address,
	contracts.sGB.abi,
	conetDepinProvider
)

const sGB_Dashboard_ReadOnly = new ethers.Contract(
	contracts.sGB_Dashboard.address,
	contracts.sGB_Dashboard.abi,
	
	conetDepinProvider
)

const pgpCoNET = new ethers.Contract(
	contracts.constPgpManager.address,
	contracts.constPgpManager.abi,
	conetDepinProvider
)

const GuardianNodesMainnet = new ethers.Contract(
	contracts.GuardianNodesInfoV6.address,
	contracts.GuardianNodesInfoV6.abi,
	conetDepinProvider
)


const changeRPC = () => {
	ethProvider = new ethers.JsonRpcProvider(ethRpc());
}


export {
	localDatabaseName,
	XMLHttpRequestTimeout,
	apiv3_endpoint,
	apiv4_endpoint,
	rewardWalletAddress,

	ethProvider,
	SilentPassOfficial,
	conetDepinProvider,
	changeRPC,
	stripe_pay_monthly,
	stripe_pay_Annual,
	payment_endpoint,
	paypal_endpoint,
	Solana_USDT,
	Solana_SOL,
	Solana_SP,
	sGB_ReadOnly,
	sGB_Dashboard_ReadOnly,
	pgpCoNET,
	GuardianNodesMainnet,
	baseEndpoint,  // 来自 baseRpc，带自动切换免费 RPC
	USDCContract_BASE,
	beamioApi,
	voucherRelayApi,
	CCSA_Card_Address,
	BEAMIO_USER_CARD_ASSET_ADDRESS,
	CASH_TREES_CARD_ADDRESS,
	ASSET_CARD_ADDRESSES,
	BeamioCardFactorySC
};

export { withBaseRpc, switchToNextBaseRpc, getCurrentBaseRpcUrl, resetBaseRpcIndex, setBaseRpcNodeProvider, setRpcDegradedGetter } from './baseRpc'
