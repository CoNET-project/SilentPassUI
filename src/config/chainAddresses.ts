/**
 * bizSite 是独立项目，发布/构建时不能跨项目相对引用 BeamioContract 根仓配置。
 * 本文件必须保持自包含，地址由同步脚本或手工更新。
 */
export const BASE_MAINNET_CHAIN_ID = 8453

/** 跨链同址 BeamioFactoryPaymasterV07（Nick CREATE2；Base + CoNET 同值） */
export const BEAMIO_AA_FACTORY = '0xe58F457Cd5674516400013E8d338054be556A730'

/** @deprecated 使用 BEAMIO_AA_FACTORY */
export const BASE_AA_FACTORY = BEAMIO_AA_FACTORY
export const BASE_CARD_FACTORY = '0xF2864210577359AcaE448D2B116031a0c5EE1016'
export const BASE_CCSA_CARD_ADDRESS = '0x2032A363BB2cf331142391fC0DAd21D6504922C7'
export const BASE_TREASURY = '0x5c64a8b0935DA72d60933bBD8cD10579E1C40c58'
export const BEAMIO_USER_CARD_ASSET_ADDRESS = '0xA756F2E27a332d6Be2d399dA543E3Ce4C8455F14'
export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
export const BEAMIO_INDEXER_DIAMOND = '0x6113fE738489c0aB64B4606Ce333aD29b44ED0C4'
/** CoNET BUint ERC20（balanceOf / balanceOfAll）；与 deployments/conet-addresses.json `BUint` 同步 */
export const CONET_BUINT = '0xf5484F11b7De647E17aea1089e3CbD6BF15dfC0f'
/** CoNET BUnitAirdrop（claim / getBUnitBalance）；与 deployments/conet-addresses.json 同步 */
export const CONET_BUNIT_AIRDROP_ADDRESS = '0xFd60936707cb4583c08D8AacBA19E4bfaEE446B8'
/** BuintRedeemAirdrop（CoNET）；与 x402sdk chainAddresses / 部署记录同步 */
export const CONET_BUINT_REDEEM_AIRDROP = '0xd633E268bCcC5A38122873a8BeA3aD7Fd83a9966'
/** BusinessStartKet ERC1155（CoNET）；用户持有的 Ket 在此合约 `balanceOf`；须与 Redeem 构造参数 `ket` / deployments 同步 */
export const CONET_BUSINESS_START_KET = '0xe747faB957eD29ec07B81Edab546AF5C6724fCf2'
/** BusinessStartKetRedeem（CoNET）；Ket + B-Unit 兑换码 */
export const CONET_BUSINESS_START_KET_REDEEM = '0x4C3995D1Cad52a9EE65024C8Ad80Ad6B51b098ce'
/** BeamioOracle on CoNET mainnet (getRate returns 1 currency = X USD, E18) */
export const BEAMIO_ORACLE_CONET = '0x77CB8358c5a37aB7190b0A2C7EaA7fEeDCF11008'
/** CoNET PoS HTTP RPC — 与 deployments/conet-addresses.json `rpcUrl` 同步 */
export const CONET_RPC_URL = 'https://publicrpc.conet.network'
/** CoNET 224422 — 与 deployments/conet-addresses.json 同步 */
export const CONET_GUARDIAN_NODES_INFO_V6 = '0xBC6b53065b5647261396d002bDBA0d3396E0722f'
export const CONET_ADDRESS_PGP = '0x684b0ac760cEE9c9b85de36d69746420648Cf9e2'
export const CONET_ACCOUNT_REGISTRY = '0xfFDc8d2021A41F4638Cb3eCf58B5155383EE9f6d'

export const BASE_MAINNET_FACTORIES = {
  AA_FACTORY: BEAMIO_AA_FACTORY,
  CARD_FACTORY: BASE_CARD_FACTORY,
  BeamioCardCCSA_ADDRESS: BASE_CCSA_CARD_ADDRESS,
} as const

export const CONTRACT_ADDRESSES = {
  base: {
    chainId: BASE_MAINNET_CHAIN_ID,
    aaFactory: BEAMIO_AA_FACTORY,
    cardFactory: BASE_CARD_FACTORY,
    ccsaCard: BASE_CCSA_CARD_ADDRESS,
    baseTreasury: BASE_TREASURY,
    usdc: USDC_BASE,
  },
  conet: {
    chainId: 224422,
    aaFactory: BEAMIO_AA_FACTORY,
    bUint: CONET_BUINT,
    bUnitAirdrop: CONET_BUNIT_AIRDROP_ADDRESS,
    beamioIndexerDiamond: BEAMIO_INDEXER_DIAMOND,
    buintRedeemAirdrop: CONET_BUINT_REDEEM_AIRDROP,
    businessStartKet: CONET_BUSINESS_START_KET,
    businessStartKetRedeem: CONET_BUSINESS_START_KET_REDEEM,
  },
} as const
