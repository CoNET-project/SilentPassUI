/**
 * bizSite 是独立项目，发布/构建时不能跨项目相对引用 BeamioContract 根仓配置。
 * 本文件必须保持自包含，地址由同步脚本或手工更新。
 */
export const BASE_MAINNET_CHAIN_ID = 8453

export const BASE_AA_FACTORY = '0x4b31D6a05Cdc817CAc1B06369555b37a5b182122'
export const BASE_BEAMIO_ACCOUNT_DEPLOYER = '0x139D55591A03550259AF32097A9848ECE9869C90'
export const BASE_CARD_FACTORY = '0xF2864210577359AcaE448D2B116031a0c5EE1016'
export const BASE_CCSA_CARD_ADDRESS = '0x2032A363BB2cf331142391fC0DAd21D6504922C7'
export const BASE_TREASURY = '0x5c64a8b0935DA72d60933bBD8cD10579E1C40c58'
export const BEAMIO_USER_CARD_ASSET_ADDRESS = '0xA756F2E27a332d6Be2d399dA543E3Ce4C8455F14'
export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
export const BEAMIO_INDEXER_DIAMOND = '0xd764eBA64536cFF1bbE7e7c7Bbc90F35620f72a9'
/** CoNET BUint ERC20（balanceOf / balanceOfAll）；与 deployments/conet-addresses.json `BUint` 同步 */
export const CONET_BUINT = '0x9149433F154C508d2a04454b8E527A479C6fd254'
/** CoNET BUnitAirdrop（claim / getBUnitBalance）；与 deployments/conet-addresses.json 同步 */
export const CONET_BUNIT_AIRDROP_ADDRESS = '0x67d01e0E9c859A89def4098aC7803f04BF0d77af'
/** BuintRedeemAirdrop（CoNET）；与 x402sdk chainAddresses / 部署记录同步 */
export const CONET_BUINT_REDEEM_AIRDROP = '0x05a19aA5100B9F6C22446cCD801F010Dc42D25E5'
/** BusinessStartKet ERC1155（CoNET）；用户持有的 Ket 在此合约 `balanceOf`；须与 Redeem 构造参数 `ket` / deployments 同步 */
export const CONET_BUSINESS_START_KET = '0x61A206aD8fFdBA847fCB92eB8EE4bfAa2546249D'
/** BusinessStartKetRedeem（CoNET）；Ket + B-Unit 兑换码 */
export const CONET_BUSINESS_START_KET_REDEEM = '0x980340A8Eb23117b624b1f037b8a489F54C7b6a5'
/** BeamioOracle on CoNET mainnet (getRate returns 1 currency = X USD, E18) */
export const BEAMIO_ORACLE_CONET = '0x102E9FBE87a28BaC10ADbc0E67a2b0385C8Bd0E9'
/** CoNET 224422 — 与 deployments/conet-addresses.json 同步 */
export const CONET_GUARDIAN_NODES_INFO_V6 = '0x359F781A5eEb17630A44e15Bc2aC57b248b81790'
export const CONET_ADDRESS_PGP = '0xa5F64dd3c034442F5377c8F2Aa1A03ba378D685e'
export const CONET_ACCOUNT_REGISTRY = '0x26626a515EDFb5DF9547ac1A32Ec1785352211Ba'

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
    bUint: CONET_BUINT,
    bUnitAirdrop: CONET_BUNIT_AIRDROP_ADDRESS,
    beamioIndexerDiamond: BEAMIO_INDEXER_DIAMOND,
    buintRedeemAirdrop: CONET_BUINT_REDEEM_AIRDROP,
    businessStartKet: CONET_BUSINESS_START_KET,
    businessStartKetRedeem: CONET_BUSINESS_START_KET_REDEEM,
  },
} as const
