/**
 * beamio.app 是独立项目，发布/构建时不能跨项目相对引用 BeamioContract 根仓配置。
 * 本文件必须保持自包含，地址与根仓 config/base-addresses.json 对齐（手工或脚本更新）。
 */
export const BASE_MAINNET_CHAIN_ID = 8453

export const BASE_AA_FACTORY = '0x4b31D6a05Cdc817CAc1B06369555b37a5b182122'
export const BASE_BEAMIO_ACCOUNT_DEPLOYER = '0x139D55591A03550259AF32097A9848ECE9869C90'
export const BASE_CARD_FACTORY = '0x2EB245646de404b2Dce87E01C6282C131778bb05'
export const BASE_CCSA_CARD_ADDRESS = '0x2032A363BB2cf331142391fC0DAd21D6504922C7'
export const BASE_TREASURY = '0x5c64a8b0935DA72d60933bBD8cD10579E1C40c58'
/** CashTrees 卡（新部署） */
export const BEAMIO_USER_CARD_ASSET_ADDRESS = '0xA756F2E27a332d6Be2d399dA543E3Ce4C8455F14'
export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

export const CONET_BUINT = '0x4A3E59519eE72B9Dcf376f0617fF0a0a5a1ef879'
/** B-Unit 兑换码空投管理合约（CoNET）；redeemAdmins 可 create/cancel */
export const CONET_BUINT_REDEEM_AIRDROP = '0x0DC615bAc14411CbDCd082fe59CBdDA8768615B0'
/** BusinessStartKet + B-Unit 联合兑换（CoNET）；redeemAdmins 经 EIP-712 + 后端代付 gas 创建/取消；与 deployments/conet-addresses.json 同步 */
export const CONET_BUSINESS_START_KET_REDEEM = '0x0c15545f833CF4DF6C7F51F8D148cf7684e663ab'
export const CONET_MAINNET_CHAIN_ID = 224422
export const BEAMIO_INDEXER_DIAMOND = '0xd990719B2f05ccab4Acdd5D7A3f7aDfd2Fc584Fe'

export const BASE_MAINNET_FACTORIES = {
  AA_FACTORY: BASE_AA_FACTORY,
  BEAMIO_ACCOUNT_DEPLOYER: BASE_BEAMIO_ACCOUNT_DEPLOYER,
  CARD_FACTORY: BASE_CARD_FACTORY,
  BeamioCardCCSA_ADDRESS: BASE_CCSA_CARD_ADDRESS,
} as const

export const CONTRACT_ADDRESSES = {
  base: {
    chainId: BASE_MAINNET_CHAIN_ID,
    aaFactory: BASE_AA_FACTORY,
    beamioAccountDeployer: BASE_BEAMIO_ACCOUNT_DEPLOYER,
    cardFactory: BASE_CARD_FACTORY,
    ccsaCard: BASE_CCSA_CARD_ADDRESS,
    baseTreasury: BASE_TREASURY,
    usdc: USDC_BASE,
  },
  conet: {
    chainId: 224422,
    buint: CONET_BUINT,
    buintRedeemAirdrop: CONET_BUINT_REDEEM_AIRDROP,
    businessStartKetRedeem: CONET_BUSINESS_START_KET_REDEEM,
    beamioIndexerDiamond: BEAMIO_INDEXER_DIAMOND,
  },
} as const
