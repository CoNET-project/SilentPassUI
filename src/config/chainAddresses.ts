/**
 * SilentPassUI 是独立项目，发布/构建时不能跨项目相对引用 BeamioContract 根仓配置。
 * 本文件必须保持自包含，地址由 sync 脚本或手工更新。
 * 权威来源：deployments/conet-addresses.json → npx tsx scripts/updateConetReferences.ts
 */
export const BASE_MAINNET_CHAIN_ID = 8453

/** BeamioFactoryPaymasterV07 on Base. CoNET uses CONET_AA_FACTORY until the new bytecode is deployed on Base too. */
export const BEAMIO_AA_FACTORY = '0x869B31C87ABd9bFB858F5183Ef6021b28ED225E2'

/** @deprecated 使用 BEAMIO_AA_FACTORY */
export const BASE_AA_FACTORY = BEAMIO_AA_FACTORY
export const BASE_CARD_FACTORY = '0xF2864210577359AcaE448D2B116031a0c5EE1016'
export const BASE_CCSA_CARD_ADDRESS = '0x2032A363BB2cf331142391fC0DAd21D6504922C7'
export const BASE_TREASURY = '0x5c64a8b0935DA72d60933bBD8cD10579E1C40c58'
/** CashTrees 卡（新部署） */
export const BEAMIO_USER_CARD_ASSET_ADDRESS = '0xA756F2E27a332d6Be2d399dA543E3Ce4C8455F14'
export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

export const CONET_MAINNET_CHAIN_ID = 224422
/** CoNET PoS HTTP RPC — 与 deployments/conet-addresses.json `rpcUrl` 同步 */
export const CONET_RPC_URL = 'https://publicrpc.conet.network'
export const CONET_BUINT = '0xa354CC4c414568Dd14F6d63b53013f35483427f0'
export const BEAMIO_INDEXER_DIAMOND = '0x6113fE738489c0aB64B4606Ce333aD29b44ED0C4'
/** CoNET BUnitAirdrop（claim / getBUnitBalance）；与 deployments/conet-addresses.json 同步 */
export const CONET_BUNIT_AIRDROP_ADDRESS = '0xb9cf45AF87b16853c8F48a16b0495F030309e70f'
/** BuintRedeemAirdrop（CoNET） */
export const CONET_BUINT_REDEEM_AIRDROP = '0x02e954D352EB4C687AB066f0967E35D41E7721b6'
/** BusinessStartKet ERC1155（CoNET） */
export const CONET_BUSINESS_START_KET = '0xAcf20dbb4DE0992d8947Ef00b505bBc17E6A03b2'
/** BusinessStartKetRedeem（CoNET） */
export const CONET_BUSINESS_START_KET_REDEEM = '0xe9CeDC2c9F7DE7c0e6d1f1ba1F7e7126F0F1D3c8'
/** CoNET UserCard Factory（224422） */
export const CONET_CARD_FACTORY = '0xfA52a0CcC96C19cF4b6Ea864615F6d52BD0774FB'
/** CoNET EntryPoint-aware BeamioFactoryPaymasterV07（224422） */
export const CONET_AA_FACTORY = '0x869B31C87ABd9bFB858F5183Ef6021b28ED225E2'
/** CoNET 默认 BeamioUserCard（AA Factory `beamioUserCard`） */
export const CONET_BEAMIO_USER_CARD_DEFAULT = '0xA5C727d11d04BeBC095bd814c6530c4e77fD6662'
/** CoNET USDC（ConetTreasury FactoryERC20） */
export const CONET_USDC = '0x2975c85D8Cc8F5d263492E332A6dAa7ad11aDBdC'
export const CONET_BEAMIO_USER_CARD_FORMATTING_LIB = '0x9727136BC5DAA5540e7397C9086e9980EBDD0e48'
export const CONET_BEAMIO_USER_CARD_TRANSFER_LIB = '0xBcf3f8C5994B02B89fB743e1dee6AFDD5a49a664'
/** BeamioOracle on CoNET mainnet */
export const BEAMIO_ORACLE_CONET = '0x77CB8358c5a37aB7190b0A2C7EaA7fEeDCF11008'
/** CoNET 224422 — GuardianNodesInfoV6 */
export const CONET_GUARDIAN_NODES_INFO_V6 = '0xBC6b53065b5647261396d002bDBA0d3396E0722f'
/** CoNET AddressPGP（Chat 路由公钥） */
export const CONET_ADDRESS_PGP = '0x684b0ac760cEE9c9b85de36d69746420648Cf9e2'
/** CoNET AccountRegistry（Beamio 社交账户） */
export const CONET_ACCOUNT_REGISTRY = '0xfFDc8d2021A41F4638Cb3eCf58B5155383EE9f6d'
/** ConetGB1155（原 sGB） */
export const CONET_GB1155 = '0x3Dc53e528d45225e8F38c391Cc6a72CDec435748'
/** ConetGB_total（原 sGB_Dashboard） */
export const CONET_GB_TOTAL = '0x949ed49faB0e999f685f16e09Cf5EaaF4090F290'
/** ValidatorDepositRedeem（CoNET 224422）— resolveNodeBundle / resolveUnifiedIncomeStats RPC 直读 */
export const CONET_VALIDATOR_DEPOSIT_REDEEM = '0xc71e246DD78B37C2fABc905D340932F28F503433'
/** GB net-total token id on ConetGB1155（id=0 累计净 GB，18 decimals） */
export const CONET_GB_TOTAL_TOKEN_ID = 0

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
    chainId: CONET_MAINNET_CHAIN_ID,
    aaFactory: CONET_AA_FACTORY,
    buint: CONET_BUINT,
    bUnitAirdrop: CONET_BUNIT_AIRDROP_ADDRESS,
    beamioIndexerDiamond: BEAMIO_INDEXER_DIAMOND,
    buintRedeemAirdrop: CONET_BUINT_REDEEM_AIRDROP,
    businessStartKet: CONET_BUSINESS_START_KET,
    businessStartKetRedeem: CONET_BUSINESS_START_KET_REDEEM,
    cardFactory: CONET_CARD_FACTORY,
    defaultUserCard: CONET_BEAMIO_USER_CARD_DEFAULT,
    usdc: CONET_USDC,
    beamioOracle: BEAMIO_ORACLE_CONET,
    guardianNodesInfoV6: CONET_GUARDIAN_NODES_INFO_V6,
    addressPgp: CONET_ADDRESS_PGP,
    accountRegistry: CONET_ACCOUNT_REGISTRY,
    conetGb1155: CONET_GB1155,
    conetGbTotal: CONET_GB_TOTAL,
  },
} as const
