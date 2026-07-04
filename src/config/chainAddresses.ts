/**
 * bizSite 是独立项目，发布/构建时不能跨项目相对引用 BeamioContract 根仓配置。
 * 本文件必须保持自包含，地址由同步脚本或手工更新。
 */
export const BASE_MAINNET_CHAIN_ID = 8453

/** BeamioFactoryPaymasterV07 on Base. CoNET uses CONET_AA_FACTORY until the new bytecode is deployed on Base too. */
export const BEAMIO_AA_FACTORY = '0x869B31C87ABd9bFB858F5183Ef6021b28ED225E2'

/** @deprecated 使用 BEAMIO_AA_FACTORY */
export const BASE_AA_FACTORY = BEAMIO_AA_FACTORY
export const BASE_CARD_FACTORY = '0xF2864210577359AcaE448D2B116031a0c5EE1016'
export const BASE_CCSA_CARD_ADDRESS = '0x2032A363BB2cf331142391fC0DAd21D6504922C7'
/** 统一国库 ConetTreasury CREATE2（Base + CoNET 同址） */
export const CONET_TREASURY_CREATE2 = '0xa311c8fBE7CafC611603Ee925465A62493B73B30'
export const BASE_TREASURY = CONET_TREASURY_CREATE2
/** @deprecated 旧 BaseTreasury 0x5c64… */
export const BASE_TREASURY_LEGACY = '0x5c64a8b0935DA72d60933bBD8cD10579E1C40c58'
export const BEAMIO_USER_CARD_ASSET_ADDRESS = '0xA756F2E27a332d6Be2d399dA543E3Ce4C8455F14'
export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
export const BEAMIO_INDEXER_DIAMOND = '0x6113fE738489c0aB64B4606Ce333aD29b44ED0C4'
/** CoNET BUint ERC20（balanceOf / balanceOfAll）；与 deployments/conet-addresses.json `BUint` 同步 */
export const CONET_BUINT = '0x54ac4672cE75EC5ACebaeF1a7aFC6F49E77Ae9Ae'
/** CoNET BUnitAirdrop（claim / getBUnitBalance）；与 deployments/conet-addresses.json 同步 */
export const CONET_BUNIT_AIRDROP_ADDRESS = '0xa01DFfD68b355540B840310a9f0C1E7a779C3Ce8'
/** BuintRedeemAirdrop（CoNET）；与 x402sdk chainAddresses / 部署记录同步 */
export const CONET_BUINT_REDEEM_AIRDROP = '0x74Fc5C1f105E64663689692e3240127DdE649AF1'
/** BusinessStartKet ERC1155（CoNET）；用户持有的 Ket 在此合约 `balanceOf`；须与 Redeem 构造参数 `ket` / deployments 同步 */
export const CONET_BUSINESS_START_KET = '0xAcf20dbb4DE0992d8947Ef00b505bBc17E6A03b2'
/** BusinessStartKetRedeem（CoNET）；Ket + B-Unit 兑换码 */
export const CONET_BUSINESS_START_KET_REDEEM = '0xe9CeDC2c9F7DE7c0e6d1f1ba1F7e7126F0F1D3c8'
/** ValidatorDepositRedeem（CoNET）；validator deposit 兑换码 */
export const CONET_VALIDATOR_DEPOSIT_REDEEM = '0xc71e246DD78B37C2fABc905D340932F28F503433'
/** CoNET UserCard Factory（224422） */
export const CONET_CARD_FACTORY = '0xfA52a0CcC96C19cF4b6Ea864615F6d52BD0774FB'
/** CoNET EntryPoint-aware BeamioFactoryPaymasterV07（224422） */
export const CONET_AA_FACTORY = '0x869B31C87ABd9bFB858F5183Ef6021b28ED225E2'
/** CoNET 默认 BeamioUserCard */
export const CONET_BEAMIO_USER_CARD_DEFAULT = '0xA5C727d11d04BeBC095bd814c6530c4e77fD6662'
/** CoNET USDC（ConetTreasury FactoryERC20） */
export const CONET_USDC = '0xF9240fd613C00d5C479f1E9f1690130c5Fdc8BC3'
/** @deprecated minter=旧国库 0x6dC6… */
export const CONET_USDC_LEGACY_UUPS_V1 = '0x84e55A7d82aEa1243cB88b20dDde9Ba5cea0E134'
/** @deprecated legacy FactoryERC20 (non-UUPS) */
export const CONET_USDC_LEGACY = '0x2975c85D8Cc8F5d263492E332A6dAa7ad11aDBdC'
export const CONET_BEAMIO_USER_CARD_FORMATTING_LIB = '0x9727136BC5DAA5540e7397C9086e9980EBDD0e48'
export const CONET_BEAMIO_USER_CARD_TRANSFER_LIB = '0xBcf3f8C5994B02B89fB743e1dee6AFDD5a49a664'
/** BeamioOracle on CoNET mainnet (getRate returns 1 currency = X USD, E18) */
export const BEAMIO_ORACLE_CONET = '0x77CB8358c5a37aB7190b0A2C7EaA7fEeDCF11008'
/** CoNET PoS HTTP RPC — 与 deployments/conet-addresses.json `rpcUrl` 同步 */
export const CONET_RPC_URL = 'https://publicrpc.conet.network'
/** CoNET 224422 — 与 deployments/conet-addresses.json 同步 */
export const CONET_GUARDIAN_NODES_INFO_V6 = '0xBC6b53065b5647261396d002bDBA0d3396E0722f'
export const CONET_ADDRESS_PGP = '0x684b0ac760cEE9c9b85de36d69746420648Cf9e2'
export const CONET_ACCOUNT_REGISTRY = '0xfFDc8d2021A41F4638Cb3eCf58B5155383EE9f6d'
/** MerchantPOSManagement（CoNET）；与 deployments/conet-addresses.json / x402sdk chainAddresses 同步 */
export const MERCHANT_POS_MANAGEMENT_CONET = '0x74140e0C8118889538da8625Fc96Aac6B1342AE5'

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
    aaFactory: CONET_AA_FACTORY,
    bUint: CONET_BUINT,
    bUnitAirdrop: CONET_BUNIT_AIRDROP_ADDRESS,
    beamioIndexerDiamond: BEAMIO_INDEXER_DIAMOND,
    buintRedeemAirdrop: CONET_BUINT_REDEEM_AIRDROP,
    businessStartKet: CONET_BUSINESS_START_KET,
    businessStartKetRedeem: CONET_BUSINESS_START_KET_REDEEM,
    validatorDepositRedeem: CONET_VALIDATOR_DEPOSIT_REDEEM,
    cardFactory: CONET_CARD_FACTORY,
    defaultUserCard: CONET_BEAMIO_USER_CARD_DEFAULT,
    usdc: CONET_USDC,
  },
} as const
