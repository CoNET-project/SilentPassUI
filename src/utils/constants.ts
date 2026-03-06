import { ethers } from "ethers";
import contracts from './contracts'
import { baseEndpoint } from './baseRpc'
const localDatabaseName = "conet";
const apiv3_endpoint = `https://apiv3.conet.network/api/`;
const apiv4_endpoint = `https://apiv4.conet.network/api/`;
const payment_endpoint = `https://hooks.conet.network/api/`;
const XMLHttpRequestTimeout = 90 * 1000;
// const conetRpc = "https://cancun-rpc.conet.network";
const mainChain_rpc = "https://mainnet-rpc.conet.network";
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
const USDCContract_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

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
/** 与 CCSA 同等对待的资产卡：用户查询资产时同时查找此卡与 CCSA（基础设施卡，新创建卡合约地址） */
const BEAMIO_USER_CARD_ASSET_ADDRESS = '0xa86a8406B06bD6c332b4b380A0EAced822218Eff'.toLowerCase()
/** 资产卡列表：CCSA + beamioUserCard，用于聚合查询 */
const ASSET_CARD_ADDRESSES = [CCSA_Card_Address, BEAMIO_USER_CARD_ASSET_ADDRESS]

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

const beamioConet = new ethers.Contract(
	contracts.beamioConet.address,
	contracts.beamioConet.abi,
	conetDepinProvider
)

const beamioCoreConet = new ethers.Contract(
	contracts.beamioCoreConet.address,
	contracts.beamioCoreConet.abi,
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
	beamioConet,
	beamioCoreConet,
	pgpCoNET,
	GuardianNodesMainnet,
	baseEndpoint,  // 来自 baseRpc，带自动切换免费 RPC
	USDCContract_BASE,
	beamioApi,
	voucherRelayApi,
	CCSA_Card_Address,
	BEAMIO_USER_CARD_ASSET_ADDRESS,
	ASSET_CARD_ADDRESSES,
	BeamioCardFactorySC
};

export { withBaseRpc, switchToNextBaseRpc, getCurrentBaseRpcUrl, resetBaseRpcIndex, setBaseRpcNodeProvider, setRpcDegradedGetter } from './baseRpc'
